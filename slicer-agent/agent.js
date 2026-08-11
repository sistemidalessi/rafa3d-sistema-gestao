require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const AdmZip = require('adm-zip');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ORCA_PATH = process.env.ORCA_PATH || 'C:\\Program Files\\OrcaSlicer\\orca-slicer.exe';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '5000', 10);
const BUCKET = 'modelos-3d';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

function log(msg) {
  console.log('[' + new Date().toLocaleTimeString('pt-BR') + '] ' + msg);
}

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[agente] Faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env. Copie .env.example para .env e preencha.');
  process.exit(1);
}
if (!fs.existsSync(ORCA_PATH)) {
  console.error('[agente] OrcaSlicer não encontrado em: ' + ORCA_PATH + ' — ajuste ORCA_PATH no .env.');
  process.exit(1);
}
if (!ANTHROPIC_API_KEY) {
  log('Sem ANTHROPIC_API_KEY no .env — a análise por IA fica desligada, mas o fatiamento continua funcionando normalmente.');
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function runOrca(args) {
  return new Promise((resolve) => {
    execFile(ORCA_PATH, args, { timeout: 5 * 60 * 1000, windowsHide: true }, (err, stdout, stderr) => {
      resolve({ stdout: stdout || '', stderr: stderr || '', err });
    });
  });
}

// O OrcaSlicer termina com código 0 mesmo quando falha em fatiar — a única
// forma confiável de saber se deu certo é conferir se o arquivo de saída
// foi criado de verdade.
//
// Quando falha por causa de um valor "-1" (sentinela de "automático" que o
// próprio arquivo .3mf trazia) fora da faixa aceita pela CLI, a mensagem
// de erro nomeia exatamente o(s) campo(s) — em vez de sempre forçar os
// mesmos campos pra 0 de cara, só sobrescrevemos os que o erro realmente
// apontou, e só nessa peça.
function extractOutOfRangeKeys(text) {
  const keys = [];
  const re = /^([a-z0-9_]+):\s.*not in range/gim;
  let m;
  while ((m = re.exec(text))) keys.push(m[1]);
  return keys;
}

async function sliceOne(product) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rafa3d-slice-'));
  const inputExt = path.extname(product.model_file_path) || '.3mf';
  const inputLocal = path.join(workDir, 'input' + inputExt);
  const outputLocal = path.join(workDir, 'output.3mf');

  try {
    log('Baixando modelo de "' + product.name + '" (' + product.catalog_code + ')...');
    const { data: fileData, error: dlErr } = await supabase.storage.from(BUCKET).download(product.model_file_path);
    if (dlErr) throw new Error('download do modelo falhou: ' + dlErr.message);
    fs.writeFileSync(inputLocal, Buffer.from(await fileData.arrayBuffer()));

    log('Fatiando "' + product.name + '"...');
    let result = await runOrca(['--export-3mf', outputLocal, '--slice', '1', inputLocal]);
    let combined = result.stdout + '\n' + result.stderr;

    if (!fs.existsSync(outputLocal)) {
      const badKeys = [...new Set(extractOutOfRangeKeys(combined))];
      if (badKeys.length > 0) {
        log('Perfil da peça tem valor fora de faixa em: ' + badKeys.join(', ') + ' — tentando de novo com 0 nesses campos.');
        const overrideArgs = ['--export-3mf', outputLocal];
        badKeys.forEach((k) => { overrideArgs.push('--' + k.replace(/_/g, '-'), '0'); });
        overrideArgs.push('--slice', '1', inputLocal);
        result = await runOrca(overrideArgs);
        combined = result.stdout + '\n' + result.stderr;
      }
    }

    if (!fs.existsSync(outputLocal)) {
      throw new Error(combined.trim().slice(0, 500) || 'OrcaSlicer não gerou o arquivo de saída (motivo desconhecido).');
    }

    const slicedPath = product.catalog_code + '/sliced.3mf';
    const fileBuf = fs.readFileSync(outputLocal);
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(slicedPath, fileBuf, { upsert: true });
    if (upErr) throw new Error('upload do arquivo fatiado falhou: ' + upErr.message);

    await supabase.from('products').update({
      slice_status: 'done', sliced_file_path: slicedPath, sliced_at: new Date().toISOString(), slice_error: null,
    }).eq('id', product.id);
    log('✅ "' + product.name + '" fatiado com sucesso.');
  } catch (e) {
    log('❌ "' + product.name + '" falhou: ' + e.message);
    await supabase.from('products').update({
      slice_status: 'error', slice_error: String(e.message).slice(0, 2000),
    }).eq('id', product.id);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

async function tick() {
  const { data: queued, error } = await supabase
    .from('products')
    .select('id, name, catalog_code, model_file_path')
    .eq('slice_status', 'queued')
    .order('slice_requested_at', { ascending: true })
    .limit(1);
  if (error) { log('Erro consultando a fila: ' + error.message); return; }
  if (!queued || queued.length === 0) return;

  const product = queued[0];
  await supabase.from('products').update({ slice_status: 'processing' }).eq('id', product.id);
  await sliceOne(product);
}

// O .3mf já traz uma miniatura renderizada da peça (é o que o OrcaSlicer
// mostra na prévia) — não precisa gerar imagem nenhuma, só extrair do zip.
// plate_1.png é maior/melhor pra IA enxergar detalhe; plate_1_small.png é
// o backup se o primeiro não existir por algum motivo.
function extrairMiniatura(fileBuf) {
  const zip = new AdmZip(fileBuf);
  const candidatos = ['Metadata/plate_1.png', 'Metadata/plate_1_small.png', 'Metadata/top_1.png', 'Metadata/pick_1.png'];
  for (const nome of candidatos) {
    const entry = zip.getEntry(nome);
    if (entry) return entry.getData();
  }
  const qualquerPng = zip.getEntries().find((e) => e.entryName.startsWith('Metadata/') && e.entryName.endsWith('.png'));
  if (qualquerPng) return qualquerPng.getData();
  return null;
}

const PROMPT_ANALISE = 'Você é um técnico experiente de impressão 3D FDM, especialista em Bambu Lab A1 e OrcaSlicer. ' +
  'Olhe a imagem desta peça (miniatura de dentro do arquivo de projeto) e escreva uma "colinha" curta e prática, ' +
  'em português, com o que ajustar no fatiador antes de imprimir. Cubra, quando fizer sentido pra essa peça: ' +
  '(1) precisa de suporte? de que tipo (normal/árvore) e onde; (2) precisa de brim/aba de adesão, e de que tamanho; ' +
  '(3) alguma sugestão de orientação da peça na mesa; (4) se parecer multi-cor/AMS, algum cuidado com troca de ' +
  'filamento; (5) qualquer outro risco que você enxergue (parede fina, ponte longa, peça alta e fina, etc). ' +
  'Seja direto e objetivo — formato de lista curta, sem introdução nem conclusão, pronto pra alguém ler rápido ' +
  'e já digitar no fatiador. Se a peça for simples e não precisar de nada especial, diga isso em uma frase só.';

async function chamarClaude(imagemBuf) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 700,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imagemBuf.toString('base64') } },
          { type: 'text', text: PROMPT_ANALISE },
        ],
      }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error('API da Anthropic respondeu ' + res.status + ': ' + body.slice(0, 300));
  }
  const json = await res.json();
  const texto = (json.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  if (!texto) throw new Error('resposta da IA veio vazia.');
  return texto;
}

async function analisarUm(product) {
  try {
    log('Baixando modelo de "' + product.name + '" pra analisar...');
    const { data: fileData, error: dlErr } = await supabase.storage.from(BUCKET).download(product.model_file_path);
    if (dlErr) throw new Error('download do modelo falhou: ' + dlErr.message);
    const fileBuf = Buffer.from(await fileData.arrayBuffer());

    const miniatura = extrairMiniatura(fileBuf);
    if (!miniatura) throw new Error('não achei nenhuma miniatura dentro do arquivo .3mf.');

    log('Analisando "' + product.name + '" com IA...');
    const tips = await chamarClaude(miniatura);

    await supabase.from('products').update({
      ai_analysis_status: 'done', ai_slicing_tips: tips, ai_analysis_done_at: new Date().toISOString(), ai_analysis_error: null,
    }).eq('id', product.id);
    log('✅ Análise de "' + product.name + '" pronta.');
  } catch (e) {
    log('❌ Análise de "' + product.name + '" falhou: ' + e.message);
    await supabase.from('products').update({
      ai_analysis_status: 'error', ai_analysis_error: String(e.message).slice(0, 2000),
    }).eq('id', product.id);
  }
}

async function tickAI() {
  if (!ANTHROPIC_API_KEY) return;
  const { data: queued, error } = await supabase
    .from('products')
    .select('id, name, catalog_code, model_file_path')
    .eq('ai_analysis_status', 'queued')
    .order('ai_analysis_requested_at', { ascending: true })
    .limit(1);
  if (error) { log('Erro consultando a fila de análise: ' + error.message); return; }
  if (!queued || queued.length === 0) return;

  const product = queued[0];
  await supabase.from('products').update({ ai_analysis_status: 'processing' }).eq('id', product.id);
  await analisarUm(product);
}

async function main() {
  log('Agente de fatiamento iniciado.');
  log('OrcaSlicer: ' + ORCA_PATH);
  log('Verificando a fila a cada ' + (POLL_INTERVAL_MS / 1000) + 's. Ctrl+C para parar.');
  for (;;) {
    try { await tick(); } catch (e) { log('Erro inesperado (fatiamento): ' + e.message); }
    try { await tickAI(); } catch (e) { log('Erro inesperado (análise IA): ' + e.message); }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main();
