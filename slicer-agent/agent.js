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
// Programa que abre quando clica "Abrir no Fatiador" — separado do ORCA_PATH
// (que só é usado pelo fatiamento automático via linha de comando, hoje sem
// botão na tela). O Rafa 3D usa Bambu Studio no dia a dia, não OrcaSlicer.
const SLICER_APP_PATH = process.env.SLICER_APP_PATH || 'C:\\Program Files\\Bambu Studio\\bambu-studio.exe';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '5000', 10);
const BUCKET = 'modelos-3d';
const FOTOS_BUCKET = 'projetos-fotos';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const MESHY_API_KEY = process.env.MESHY_API_KEY;

function log(msg) {
  console.log('[' + new Date().toLocaleTimeString('pt-BR') + '] ' + msg);
}

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[agente] Faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env. Copie .env.example para .env e preencha.');
  process.exit(1);
}
if (!fs.existsSync(SLICER_APP_PATH)) {
  log('AVISO: fatiador não encontrado em: ' + SLICER_APP_PATH + ' — "Abrir no Fatiador" vai falhar até ajustar SLICER_APP_PATH no .env.');
}
if (!ANTHROPIC_API_KEY) {
  log('Sem ANTHROPIC_API_KEY no .env — a análise por IA fica desligada, mas o fatiamento continua funcionando normalmente.');
}
if (!MESHY_API_KEY) {
  log('Sem MESHY_API_KEY no .env — a geração de modelo 3D por IA (aba Projetos) fica desligada até configurar.');
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
      const bruto = combined.trim();
      // "Slic3r::CLI::run found error, exit" sozinho, sem mais detalhe, é a
      // assinatura de um bug conhecido do OrcaSlicer: a CLI dele falha em
      // projetos com vários objetos/partes/troca de filamento mesmo quando a
      // interface gráfica do mesmo programa fatia sem problema. Não é algo
      // que dá pra corrigir por parâmetro — a peça precisa ser fatiada à mão.
      const mensagemAmigavel = /^Slic3r::CLI::run found error, exit\.?$/i.test(bruto)
        ? 'Peça complexa demais pra fatiar sozinho (provavelmente tem vários objetos, partes ou trocas de filamento) — limitação conhecida do OrcaSlicer em modo automático. Fatie esta manualmente no programa.'
        : (bruto || 'OrcaSlicer não gerou o arquivo de saída (motivo desconhecido).');
      throw new Error(mensagemAmigavel);
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

const PROMPT_ANALISE = 'Você é um engenheiro de aplicação sênior especializado em impressão 3D FDM profissional, ' +
  'consultor de uma empresa que vende peças impressas (Bambu Lab A1, bico 0.4mm, perfil base "0.20mm Standard @BBL A1", ' +
  'filamentos PLA/PETG). Um funcionário vai olhar sua resposta e digitar os valores direto no OrcaSlicer antes de ' +
  'imprimir uma peça pra vender — a resposta precisa ser uma ficha técnica de verdade, com números específicos, ' +
  'não recomendações vagas ou faixas genéricas. Nunca responda "ajuste conforme necessário" ou similar — decida um ' +
  'valor e diga esse valor.\n\n' +
  'Olhe a imagem desta peça (miniatura renderizada de dentro do arquivo de projeto) e produza a ficha nesta estrutura ' +
  'exata, preenchendo cada campo com um valor concreto (pode marcar "não se aplica" só quando genuinely não fizer ' +
  'sentido pra essa peça, nunca por preguiça de decidir):\n\n' +
  '## Perfil\nAltura de camada (mm) — Número de paredes/contornos — Padrão e % de preenchimento\n\n' +
  '## Temperatura e velocidade\nBico e mesa (°C, considerando PLA salvo se a peça pedir PETG) — Velocidade parede ' +
  'externa/interna/preenchimento (mm/s) — Velocidade reduzida em algum trecho específico da peça, se aplicável\n\n' +
  '## Suporte\nPrecisa? (sim/não) — Tipo (normal ou árvore) e por quê — Densidade (%) — Distância Z do topo/base ' +
  '(mm) — Ângulo limite de overhang (°) — Onde exatamente na peça (descreva a região)\n\n' +
  '## Aderência à mesa\nBrim, raft ou nenhum — Largura/altura (mm) e número de loops se for brim — Por quê, dado o ' +
  'formato de contato da peça com a mesa\n\n' +
  '## Orientação sugerida\nComo posicionar na mesa e por quê (reduz suporte, melhora acabamento em superfície ' +
  'visível, evita peça soltar)\n\n' +
  '## Riscos específicos desta peça\nLista curta do que pode dar errado (parede fina, ponte longa sem suporte, ' +
  'seção fina que quebra, peça alta e estreita que tomba, troca excessiva de filamento em AMS, etc.) e a mitigação ' +
  'pra cada um\n\n' +
  'Responda só com a ficha nesse formato (títulos ## e itens com traço), sem introdução nem conclusão — é pra ' +
  'colar direto num sistema interno e ser lido rápido antes de fatiar de verdade.';

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
      max_tokens: 4000,
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
  const { data: queued, error } = await supabase
    .from('products')
    .select('id, name, catalog_code, model_file_path')
    .eq('ai_analysis_status', 'queued')
    .order('ai_analysis_requested_at', { ascending: true })
    .limit(1);
  if (error) { log('Erro consultando a fila de análise: ' + error.message); return; }
  if (!queued || queued.length === 0) return;

  const product = queued[0];
  if (!ANTHROPIC_API_KEY) {
    await supabase.from('products').update({
      ai_analysis_status: 'error', ai_analysis_error: 'ANTHROPIC_API_KEY não configurada no agente local (.env) — a análise por IA está desligada.',
    }).eq('id', product.id);
    return;
  }
  await supabase.from('products').update({ ai_analysis_status: 'processing' }).eq('id', product.id);
  await analisarUm(product);
}

// "Abrir no Fatiador": baixa o arquivo e já abre no Bambu Studio, sem clicar
// em nada dentro do programa — só isso, sem automação de tela nenhuma, por
// isso não tem o risco de segurança que a automação de clique tinha.
async function abrirNoFatiador(product) {
  try {
    if (!fs.existsSync(SLICER_APP_PATH)) throw new Error('fatiador não encontrado em ' + SLICER_APP_PATH + ' — ajuste SLICER_APP_PATH no .env.');

    log('Baixando modelo de "' + product.name + '" pra abrir no fatiador...');
    const { data: fileData, error: dlErr } = await supabase.storage.from(BUCKET).download(product.model_file_path);
    if (dlErr) throw new Error('download do modelo falhou: ' + dlErr.message);

    const downloadsDir = path.join(__dirname, 'downloads');
    fs.mkdirSync(downloadsDir, { recursive: true });
    const ext = path.extname(product.model_file_path) || '.3mf';
    const nomeSeguro = (product.catalog_code + '-' + product.name).replace(/[^a-z0-9À-ÿ]+/gi, '_');
    const localPath = path.join(downloadsDir, nomeSeguro + ext);
    fs.writeFileSync(localPath, Buffer.from(await fileData.arrayBuffer()));

    log('Abrindo "' + product.name + '" no fatiador...');
    // Abre via um script PowerShell em vez de spawn direto: o agente roda em
    // segundo plano, então a janela do fatiador nasceria atrás de tudo sem
    // ninguém perceber — o script espera a janela existir e traz pra frente.
    const psScript = path.join(__dirname, 'abrir-fatiador.ps1');
    const psResult = await new Promise((resolve) => {
      execFile('powershell.exe', [
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psScript,
        '-ExePath', SLICER_APP_PATH, '-FilePath', localPath,
      ], { timeout: 30000, windowsHide: true }, (err, stdout, stderr) => {
        resolve({ stdout: stdout || '', stderr: stderr || '', err });
      });
    });
    if (psResult.err) throw new Error('não consegui abrir o fatiador: ' + (psResult.stderr || psResult.err.message).slice(0, 300));
    log(psResult.stdout.trim() || 'fatiador aberto.');

    await supabase.from('products').update({ open_slicer_status: 'done', open_slicer_error: null }).eq('id', product.id);
    log('✅ "' + product.name + '" aberto no fatiador.');
  } catch (e) {
    log('❌ Abrir "' + product.name + '" no fatiador falhou: ' + e.message);
    await supabase.from('products').update({
      open_slicer_status: 'error', open_slicer_error: String(e.message).slice(0, 2000),
    }).eq('id', product.id);
  }
}

async function tickAbrirFatiador() {
  const { data: queued, error } = await supabase
    .from('products')
    .select('id, name, catalog_code, model_file_path')
    .eq('open_slicer_status', 'queued')
    .order('open_slicer_requested_at', { ascending: true })
    .limit(1);
  if (error) { log('Erro consultando fila de abrir-no-fatiador: ' + error.message); return; }
  if (!queued || queued.length === 0) return;
  await abrirNoFatiador(queued[0]);
}

/* ============================================================
   PROJETOS — pedido personalizado (order_line_items, line_type='custom')
   Mesma ideia dos produtos do catálogo (geração de modelo, abrir no
   fatiador), só que a origem é uma foto de referência que o cliente
   mandou, não um .3mf já preparado.
   ============================================================ */

function mediaTypeFromPath(p) {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

// Geração de modelo 3D via Meshy (Image-to-3D). Pede STL direto (evita
// converter formato depois — o fatiador importa .stl sem problema).
async function meshyCriarTarefa(imagemBuf, mediaType) {
  const res = await fetch('https://api.meshy.ai/openapi/v1/image-to-3d', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + MESHY_API_KEY },
    body: JSON.stringify({
      image_url: 'data:' + mediaType + ';base64,' + imagemBuf.toString('base64'),
      target_formats: ['stl'],
      should_texture: false,
      // Sem isso, a Meshy manda malha de altíssimo detalhe (chegou a 99MB num
      // teste, pra um chaveiro) — muito além do que qualquer impressora FDM
      // consegue aproveitar, e estoura o limite de upload do Supabase.
      // 30k triângulos é bem mais que suficiente pra peça pequena/média.
      should_remesh: true,
      target_polycount: 30000,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error('Meshy (criar tarefa) respondeu ' + res.status + ': ' + body.slice(0, 300));
  }
  const json = await res.json();
  if (!json.result) throw new Error('Meshy não retornou id de tarefa.');
  return json.result;
}

async function meshyEsperarTarefa(taskId) {
  const deadline = Date.now() + 10 * 60 * 1000; // Meshy costuma levar de 1 a alguns minutos
  while (Date.now() < deadline) {
    const res = await fetch('https://api.meshy.ai/openapi/v1/image-to-3d/' + taskId, {
      headers: { Authorization: 'Bearer ' + MESHY_API_KEY },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error('Meshy (consultar tarefa) respondeu ' + res.status + ': ' + body.slice(0, 300));
    }
    const json = await res.json();
    if (json.status === 'SUCCEEDED') return json;
    if (json.status === 'FAILED' || json.status === 'CANCELED') {
      throw new Error('Meshy não conseguiu gerar o modelo (status ' + json.status + ').');
    }
    await new Promise((r) => setTimeout(r, 8000));
  }
  throw new Error('Meshy demorou demais pra gerar o modelo (mais de 10 minutos) — tente de novo.');
}

async function gerarModeloMeshyUm(li) {
  const nomeRef = li.requester_name || li.id;
  try {
    if (!li.custom_reference_image_path) throw new Error('projeto não tem foto de referência anexada.');
    log('Baixando foto do projeto de "' + nomeRef + '" pra gerar modelo 3D...');
    const { data: fileData, error: dlErr } = await supabase.storage.from(FOTOS_BUCKET).download(li.custom_reference_image_path);
    if (dlErr) throw new Error('download da foto falhou: ' + dlErr.message);
    const fileBuf = Buffer.from(await fileData.arrayBuffer());

    log('Pedindo pra Meshy gerar o modelo 3D de "' + nomeRef + '"...');
    const taskId = await meshyCriarTarefa(fileBuf, mediaTypeFromPath(li.custom_reference_image_path));
    await supabase.from('order_line_items').update({ meshy_task_id: taskId }).eq('id', li.id);

    log('Aguardando a Meshy terminar (pode levar alguns minutos)...');
    const tarefaPronta = await meshyEsperarTarefa(taskId);
    const stlUrl = tarefaPronta.model_urls && tarefaPronta.model_urls.stl;
    if (!stlUrl) throw new Error('Meshy terminou mas não veio um arquivo .stl na resposta.');

    const stlRes = await fetch(stlUrl);
    if (!stlRes.ok) throw new Error('não consegui baixar o .stl gerado pela Meshy (HTTP ' + stlRes.status + ').');
    const stlBuf = Buffer.from(await stlRes.arrayBuffer());

    const modeloPath = 'projetos/' + li.id + '/meshy.stl';
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(modeloPath, stlBuf, { upsert: true });
    if (upErr) throw new Error('upload do modelo gerado falhou: ' + upErr.message);

    await supabase.from('order_line_items').update({
      meshy_status: 'done', model_file_path: modeloPath, model_source: 'meshy_generated', meshy_error: null,
      updated_at: new Date().toISOString(),
    }).eq('id', li.id);
    log('✅ Modelo 3D de "' + nomeRef + '" gerado com sucesso.');
  } catch (e) {
    log('❌ Geração de modelo de "' + nomeRef + '" falhou: ' + e.message);
    await supabase.from('order_line_items').update({
      meshy_status: 'error', meshy_error: String(e.message).slice(0, 2000),
    }).eq('id', li.id);
  }
}

async function tickMeshy() {
  const { data: queued, error } = await supabase
    .from('order_line_items')
    .select('id, requester_name, custom_reference_image_path')
    .eq('line_type', 'custom').eq('meshy_status', 'queued')
    .order('meshy_requested_at', { ascending: true })
    .limit(1);
  if (error) { log('Erro consultando a fila da Meshy: ' + error.message); return; }
  if (!queued || queued.length === 0) return;
  const li = queued[0];
  if (!MESHY_API_KEY) {
    await supabase.from('order_line_items').update({
      meshy_status: 'error', meshy_error: 'MESHY_API_KEY não configurada no agente local (.env) — a geração de modelo por IA está desligada.',
    }).eq('id', li.id);
    return;
  }
  await supabase.from('order_line_items').update({ meshy_status: 'processing' }).eq('id', li.id);
  await gerarModeloMeshyUm(li);
}

// "Abrir no Fatiador" pra projeto — igual ao dos produtos do catálogo,
// só que lendo/gravando em order_line_items em vez de products.
async function abrirNoFatiadorProjeto(li) {
  const nomeRef = li.requester_name || li.id;
  try {
    if (!fs.existsSync(SLICER_APP_PATH)) throw new Error('fatiador não encontrado em ' + SLICER_APP_PATH + ' — ajuste SLICER_APP_PATH no .env.');

    log('Baixando modelo do projeto de "' + nomeRef + '" pra abrir no fatiador...');
    const { data: fileData, error: dlErr } = await supabase.storage.from(BUCKET).download(li.model_file_path);
    if (dlErr) throw new Error('download do modelo falhou: ' + dlErr.message);

    const downloadsDir = path.join(__dirname, 'downloads');
    fs.mkdirSync(downloadsDir, { recursive: true });
    const ext = path.extname(li.model_file_path) || '.stl';
    const nomeSeguro = ('projeto-' + nomeRef).replace(/[^a-z0-9À-ÿ]+/gi, '_');
    const localPath = path.join(downloadsDir, nomeSeguro + ext);
    fs.writeFileSync(localPath, Buffer.from(await fileData.arrayBuffer()));

    log('Abrindo projeto de "' + nomeRef + '" no fatiador...');
    const psScript = path.join(__dirname, 'abrir-fatiador.ps1');
    const psResult = await new Promise((resolve) => {
      execFile('powershell.exe', [
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psScript,
        '-ExePath', SLICER_APP_PATH, '-FilePath', localPath,
      ], { timeout: 30000, windowsHide: true }, (err, stdout, stderr) => {
        resolve({ stdout: stdout || '', stderr: stderr || '', err });
      });
    });
    if (psResult.err) throw new Error('não consegui abrir o fatiador: ' + (psResult.stderr || psResult.err.message).slice(0, 300));
    log(psResult.stdout.trim() || 'fatiador aberto.');

    await supabase.from('order_line_items').update({ open_slicer_status: 'done', open_slicer_error: null }).eq('id', li.id);
    log('✅ Projeto de "' + nomeRef + '" aberto no fatiador.');
  } catch (e) {
    log('❌ Abrir projeto de "' + nomeRef + '" no fatiador falhou: ' + e.message);
    await supabase.from('order_line_items').update({
      open_slicer_status: 'error', open_slicer_error: String(e.message).slice(0, 2000),
    }).eq('id', li.id);
  }
}

async function tickAbrirFatiadorProjeto() {
  const { data: queued, error } = await supabase
    .from('order_line_items')
    .select('id, requester_name, model_file_path')
    .eq('line_type', 'custom').eq('open_slicer_status', 'queued')
    .order('open_slicer_requested_at', { ascending: true })
    .limit(1);
  if (error) { log('Erro consultando fila de abrir-no-fatiador (projetos): ' + error.message); return; }
  if (!queued || queued.length === 0) return;
  await abrirNoFatiadorProjeto(queued[0]);
}

async function main() {
  log('Agente de fatiamento iniciado.');
  log('OrcaSlicer: ' + ORCA_PATH);
  log('Verificando a fila a cada ' + (POLL_INTERVAL_MS / 1000) + 's. Ctrl+C para parar.');
  for (;;) {
    try { await tick(); } catch (e) { log('Erro inesperado (fatiamento): ' + e.message); }
    try { await tickAI(); } catch (e) { log('Erro inesperado (análise IA): ' + e.message); }
    try { await tickAbrirFatiador(); } catch (e) { log('Erro inesperado (abrir no fatiador): ' + e.message); }
    try { await tickMeshy(); } catch (e) { log('Erro inesperado (geração Meshy): ' + e.message); }
    try { await tickAbrirFatiadorProjeto(); } catch (e) { log('Erro inesperado (abrir no fatiador - projeto): ' + e.message); }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main();
