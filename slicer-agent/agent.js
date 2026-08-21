require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const AdmZip = require('adm-zip');
const { gerarModelo3mfConfigurado } = require('./gerar3mf');

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

/* ============================================================
   FATIAMENTO AUTOMÁTICO — fila slice_status em products
   Nada na tela enfileira isso hoje: o botão "Fatiar" foi substituído
   por "Abrir no Fatiador" no commit b4e0aa2, porque a CLI do OrcaSlicer
   falha em peça com vários objetos ou troca de filamento (o detalhe
   está na sliceOne, logo abaixo). O código fica de propósito, pronto
   pra voltar se a CLI melhorar — pra religar, basta um botão na tela
   que grave slice_status = 'queued'. Enquanto isso, a tick() só faz
   uma consulta que sempre volta vazia.
   ============================================================ */

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
  'Olhe a imagem desta peça (miniatura renderizada de dentro do arquivo de projeto) e responda em DUAS partes, ' +
  'NESSA ORDEM (o bloco de números primeiro é importante — se sua resposta for cortada por tamanho, o que mais ' +
  'importa precisa ter saído primeiro):\n\n' +
  '1) Primeiro, só o bloco de código JSON abaixo, com os MESMOS valores que você vai decidir, preenchido — nada de ' +
  'texto antes dele, com exatamente estas chaves, sem inventar chave nova nem omitir nenhuma (se não precisar de ' +
  'suporte, ainda assim preencha support_enable como false e os outros campos de suporte com um valor qualquer, ' +
  'eles são ignorados quando enable é false):\n\n' +
  '```json\n' +
  '{\n' +
  '  "layer_height_mm": 0.2,\n' +
  '  "wall_loops": 3,\n' +
  '  "infill_density_pct": 15,\n' +
  '  "infill_pattern": "grid",\n' +
  '  "support_enable": false,\n' +
  '  "support_type": "normal",\n' +
  '  "support_threshold_angle": 40,\n' +
  '  "brim_type": "outer_brim_only",\n' +
  '  "brim_width_mm": 3,\n' +
  '  "nozzle_temp_c": 220,\n' +
  '  "bed_temp_c": 55\n' +
  '}\n' +
  '```\n\n' +
  '2) Depois do bloco JSON, a ficha técnica pra humano ler, nesta estrutura exata, preenchendo cada campo com um ' +
  'valor concreto (pode marcar "não se aplica" só quando genuinely não fizer sentido pra essa peça, nunca por ' +
  'preguiça de decidir):\n\n' +
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
  'A ficha usa títulos ## e itens com traço, sem introdução nem conclusão — é pra colar direto num sistema interno ' +
  'e ser lido rápido antes de fatiar de verdade.';

// Puxa o bloco ```json{...}``` do fim da resposta da IA. Se não achar
// ou vier mal formado, devolve null — quem chama trata isso como "sem
// versão estruturada" e simplesmente não pré-configura o fatiador,
// nunca quebra o resto do fluxo por causa disso.
function extrairAjustesEstruturados(textoCompleto) {
  const m = textoCompleto.match(/```json\s*([\s\S]*?)```/i);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch (e) {
    return null;
  }
}

// A ficha "pra humano ler" não deve mostrar o JSON colado embaixo —
// tira o bloco antes de guardar em ai_slicing_tips.
function removerBlocoJSON(textoCompleto) {
  return textoCompleto.replace(/```json\s*[\s\S]*?```/i, '').trim();
}

// Busca as últimas tentativas de impressão registradas pra essa peça
// (produto ou projeto) e monta um textinho pra IA levar em conta — é
// assim que a colinha "aprende" com o que já deu errado antes.
async function buscarHistoricoFeedback(coluna, id) {
  const { data, error } = await supabase
    .from('print_feedback')
    .select('funcionou, nota, created_at')
    .eq(coluna, id)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error || !data || !data.length) return null;
  const linhas = data.map((f) => {
    const quando = new Date(f.created_at).toLocaleDateString('pt-BR');
    return f.funcionou ? ('- ' + quando + ': funcionou bem') : ('- ' + quando + ': DEU PROBLEMA — ' + (f.nota || 'sem detalhe'));
  });
  return linhas.join('\n');
}

async function chamarClaude(imagemBuf, mediaType, historico) {
  const promptFinal = historico
    ? PROMPT_ANALISE + '\n\nHistórico real de impressões anteriores dessa mesma peça — leve em conta pra não repetir ' +
      'o que já deu errado, e ajuste a ficha especificamente pra evitar esses problemas de novo:\n' + historico
    : PROMPT_ANALISE;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/png', data: imagemBuf.toString('base64') } },
          { type: 'text', text: promptFinal },
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
    const historico = await buscarHistoricoFeedback('product_id', product.id);
    const respostaCompleta = await chamarClaude(miniatura, undefined, historico);
    const ajustes = extrairAjustesEstruturados(respostaCompleta);
    const tips = removerBlocoJSON(respostaCompleta);

    await supabase.from('products').update({
      ai_analysis_status: 'done', ai_slicing_tips: tips, ai_slicing_settings: ajustes,
      ai_analysis_done_at: new Date().toISOString(), ai_analysis_error: null,
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

    // Miniatura renderizada pela própria Meshy — não é obrigatória (se
    // falhar, a análise por IA depois cai de volta pra foto de referência),
    // por isso só loga o erro em vez de derrubar a geração inteira.
    let thumbnailPath = null;
    if (tarefaPronta.thumbnail_url) {
      try {
        const thumbRes = await fetch(tarefaPronta.thumbnail_url);
        if (thumbRes.ok) {
          const thumbBuf = Buffer.from(await thumbRes.arrayBuffer());
          thumbnailPath = li.id + '/meshy_thumb.png';
          const { error: thumbUpErr } = await supabase.storage.from(FOTOS_BUCKET).upload(thumbnailPath, thumbBuf, { upsert: true });
          if (thumbUpErr) { thumbnailPath = null; log('AVISO: upload da miniatura da Meshy falhou: ' + thumbUpErr.message); }
        }
      } catch (e) {
        log('AVISO: não consegui baixar a miniatura da Meshy: ' + e.message);
      }
    }

    await supabase.from('order_line_items').update({
      meshy_status: 'done', model_file_path: modeloPath, model_source: 'meshy_generated', meshy_error: null,
      meshy_thumbnail_path: thumbnailPath, updated_at: new Date().toISOString(),
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

// Colinha de fatiamento por IA pro projeto — mesma ficha técnica dos
// produtos do catálogo. Como .stl não carrega miniatura embutida (ao
// contrário do .3mf), usa a miniatura que a própria Meshy renderizou
// (capturada em gerarModeloMeshyUm); se o modelo foi anexado à mão sem
// passar pela Meshy, cai de volta pra foto de referência do cliente.
async function analisarProjetoUm(li) {
  const nomeRef = li.requester_name || li.id;
  try {
    const imagemPath = li.meshy_thumbnail_path || li.custom_reference_image_path;
    if (!imagemPath) throw new Error('projeto não tem miniatura do modelo nem foto de referência pra analisar.');

    log('Baixando imagem do projeto de "' + nomeRef + '" pra analisar...');
    const { data: fileData, error: dlErr } = await supabase.storage.from(FOTOS_BUCKET).download(imagemPath);
    if (dlErr) throw new Error('download da imagem falhou: ' + dlErr.message);
    const fileBuf = Buffer.from(await fileData.arrayBuffer());

    log('Analisando projeto de "' + nomeRef + '" com IA...');
    const historico = await buscarHistoricoFeedback('order_line_item_id', li.id);
    const respostaCompleta = await chamarClaude(fileBuf, mediaTypeFromPath(imagemPath), historico);
    const ajustes = extrairAjustesEstruturados(respostaCompleta);
    const tips = removerBlocoJSON(respostaCompleta);

    await supabase.from('order_line_items').update({
      ai_analysis_status: 'done', ai_slicing_tips: tips, ai_slicing_settings: ajustes,
      ai_analysis_done_at: new Date().toISOString(), ai_analysis_error: null,
    }).eq('id', li.id);
    log('✅ Análise do projeto de "' + nomeRef + '" pronta.');
  } catch (e) {
    log('❌ Análise do projeto de "' + nomeRef + '" falhou: ' + e.message);
    await supabase.from('order_line_items').update({
      ai_analysis_status: 'error', ai_analysis_error: String(e.message).slice(0, 2000),
    }).eq('id', li.id);
  }
}

async function tickAIProjeto() {
  const { data: queued, error } = await supabase
    .from('order_line_items')
    .select('id, requester_name, meshy_thumbnail_path, custom_reference_image_path')
    .eq('line_type', 'custom').eq('ai_analysis_status', 'queued')
    .order('ai_analysis_requested_at', { ascending: true })
    .limit(1);
  if (error) { log('Erro consultando a fila de análise (projetos): ' + error.message); return; }
  if (!queued || queued.length === 0) return;
  const li = queued[0];
  if (!ANTHROPIC_API_KEY) {
    await supabase.from('order_line_items').update({
      ai_analysis_status: 'error', ai_analysis_error: 'ANTHROPIC_API_KEY não configurada no agente local (.env).',
    }).eq('id', li.id);
    return;
  }
  await supabase.from('order_line_items').update({ ai_analysis_status: 'processing' }).eq('id', li.id);
  await analisarProjetoUm(li);
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
    const stlBuf = Buffer.from(await fileData.arrayBuffer());

    // Se a colinha já tem os números certinhos e o arquivo é um .stl cru
    // (é o que a Meshy sempre gera), monta um .3mf com impressora,
    // filamento e os ajustes da colinha já aplicados — pra abrir sem
    // escolher nada na mão. Se der qualquer problema na conversão, cai
    // pro comportamento de sempre (.stl puro) em vez de travar o pedido.
    let localPath;
    if (ext.toLowerCase() === '.stl' && li.ai_slicing_settings) {
      try {
        const resultado = gerarModelo3mfConfigurado(stlBuf, li.ai_slicing_settings, nomeSeguro + '.stl');
        localPath = path.join(downloadsDir, nomeSeguro + '.3mf');
        fs.writeFileSync(localPath, resultado.buffer);
        log('Projeto de "' + nomeRef + '" convertido pra .3mf configurado (escala ' + resultado.escalaAplicada.toFixed(4) + ').');
      } catch (e) {
        log('AVISO: não consegui pré-configurar o .3mf de "' + nomeRef + '" (' + e.message + ') — abrindo o .stl puro mesmo.');
        localPath = path.join(downloadsDir, nomeSeguro + ext);
        fs.writeFileSync(localPath, stlBuf);
      }
    } else {
      localPath = path.join(downloadsDir, nomeSeguro + ext);
      fs.writeFileSync(localPath, stlBuf);
    }

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
    .select('id, requester_name, model_file_path, ai_slicing_settings')
    .eq('line_type', 'custom').eq('open_slicer_status', 'queued')
    .order('open_slicer_requested_at', { ascending: true })
    .limit(1);
  if (error) { log('Erro consultando fila de abrir-no-fatiador (projetos): ' + error.message); return; }
  if (!queued || queued.length === 0) return;
  await abrirNoFatiadorProjeto(queued[0]);
}

/* ============================================================
   PARTES DE PROJETO — quando a peça de referência foi feita em
   pedaços separados (project_parts), cada parte passa pela mesma
   esteira que um projeto de peça única: Meshy → colinha → fatiador.
   Funções praticamente iguais às de cima, só que lendo/gravando em
   project_parts em vez de order_line_items — duplicado de propósito,
   mexer numa não deveria arriscar quebrar a outra.
   ============================================================ */

async function gerarModeloMeshyParte(parte) {
  const nomeRef = parte.nome || ('parte ' + parte.ordem);
  try {
    if (!parte.reference_image_path) throw new Error('parte não tem foto de referência anexada.');
    log('Baixando foto da "' + nomeRef + '" pra gerar modelo 3D...');
    const { data: fileData, error: dlErr } = await supabase.storage.from(FOTOS_BUCKET).download(parte.reference_image_path);
    if (dlErr) throw new Error('download da foto falhou: ' + dlErr.message);
    const fileBuf = Buffer.from(await fileData.arrayBuffer());

    log('Pedindo pra Meshy gerar o modelo 3D da "' + nomeRef + '"...');
    const taskId = await meshyCriarTarefa(fileBuf, mediaTypeFromPath(parte.reference_image_path));
    await supabase.from('project_parts').update({ meshy_task_id: taskId }).eq('id', parte.id);

    log('Aguardando a Meshy terminar a "' + nomeRef + '" (pode levar alguns minutos)...');
    const tarefaPronta = await meshyEsperarTarefa(taskId);
    const stlUrl = tarefaPronta.model_urls && tarefaPronta.model_urls.stl;
    if (!stlUrl) throw new Error('Meshy terminou mas não veio um arquivo .stl na resposta.');

    const stlRes = await fetch(stlUrl);
    if (!stlRes.ok) throw new Error('não consegui baixar o .stl gerado pela Meshy (HTTP ' + stlRes.status + ').');
    const stlBuf = Buffer.from(await stlRes.arrayBuffer());

    const modeloPath = 'projetos/' + parte.order_line_item_id + '/partes/' + parte.id + '/meshy.stl';
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(modeloPath, stlBuf, { upsert: true });
    if (upErr) throw new Error('upload do modelo gerado falhou: ' + upErr.message);

    let thumbnailPath = null;
    if (tarefaPronta.thumbnail_url) {
      try {
        const thumbRes = await fetch(tarefaPronta.thumbnail_url);
        if (thumbRes.ok) {
          const thumbBuf = Buffer.from(await thumbRes.arrayBuffer());
          thumbnailPath = parte.order_line_item_id + '/partes/' + parte.id + '/meshy_thumb.png';
          const { error: thumbUpErr } = await supabase.storage.from(FOTOS_BUCKET).upload(thumbnailPath, thumbBuf, { upsert: true });
          if (thumbUpErr) { thumbnailPath = null; log('AVISO: upload da miniatura da Meshy falhou: ' + thumbUpErr.message); }
        }
      } catch (e) {
        log('AVISO: não consegui baixar a miniatura da Meshy: ' + e.message);
      }
    }

    await supabase.from('project_parts').update({
      meshy_status: 'done', model_file_path: modeloPath, model_source: 'meshy_generated', meshy_error: null,
      meshy_thumbnail_path: thumbnailPath, updated_at: new Date().toISOString(),
    }).eq('id', parte.id);
    log('✅ Modelo 3D da "' + nomeRef + '" gerado com sucesso.');
  } catch (e) {
    log('❌ Geração de modelo da "' + nomeRef + '" falhou: ' + e.message);
    await supabase.from('project_parts').update({
      meshy_status: 'error', meshy_error: String(e.message).slice(0, 2000),
    }).eq('id', parte.id);
  }
}

async function tickMeshyPartes() {
  const { data: queued, error } = await supabase
    .from('project_parts')
    .select('id, order_line_item_id, nome, ordem, reference_image_path')
    .eq('meshy_status', 'queued')
    .order('meshy_requested_at', { ascending: true })
    .limit(1);
  if (error) { log('Erro consultando a fila da Meshy (partes): ' + error.message); return; }
  if (!queued || queued.length === 0) return;
  const parte = queued[0];
  if (!MESHY_API_KEY) {
    await supabase.from('project_parts').update({
      meshy_status: 'error', meshy_error: 'MESHY_API_KEY não configurada no agente local (.env).',
    }).eq('id', parte.id);
    return;
  }
  await supabase.from('project_parts').update({ meshy_status: 'processing' }).eq('id', parte.id);
  await gerarModeloMeshyParte(parte);
}

async function analisarParteUm(parte) {
  const nomeRef = parte.nome || ('parte ' + parte.ordem);
  try {
    const imagemPath = parte.meshy_thumbnail_path || parte.reference_image_path;
    if (!imagemPath) throw new Error('parte não tem miniatura do modelo nem foto de referência pra analisar.');

    log('Baixando imagem da "' + nomeRef + '" pra analisar...');
    const { data: fileData, error: dlErr } = await supabase.storage.from(FOTOS_BUCKET).download(imagemPath);
    if (dlErr) throw new Error('download da imagem falhou: ' + dlErr.message);
    const fileBuf = Buffer.from(await fileData.arrayBuffer());

    log('Analisando a "' + nomeRef + '" com IA...');
    const historico = await buscarHistoricoFeedback('order_line_item_id', parte.order_line_item_id);
    const respostaCompleta = await chamarClaude(fileBuf, mediaTypeFromPath(imagemPath), historico);
    const ajustes = extrairAjustesEstruturados(respostaCompleta);
    const tips = removerBlocoJSON(respostaCompleta);

    await supabase.from('project_parts').update({
      ai_analysis_status: 'done', ai_slicing_tips: tips, ai_slicing_settings: ajustes,
      ai_analysis_done_at: new Date().toISOString(), ai_analysis_error: null,
    }).eq('id', parte.id);
    log('✅ Análise da "' + nomeRef + '" pronta.');
  } catch (e) {
    log('❌ Análise da "' + nomeRef + '" falhou: ' + e.message);
    await supabase.from('project_parts').update({
      ai_analysis_status: 'error', ai_analysis_error: String(e.message).slice(0, 2000),
    }).eq('id', parte.id);
  }
}

async function tickAIPartes() {
  const { data: queued, error } = await supabase
    .from('project_parts')
    .select('id, order_line_item_id, nome, ordem, meshy_thumbnail_path, reference_image_path')
    .eq('ai_analysis_status', 'queued')
    .order('ai_analysis_requested_at', { ascending: true })
    .limit(1);
  if (error) { log('Erro consultando a fila de análise (partes): ' + error.message); return; }
  if (!queued || queued.length === 0) return;
  const parte = queued[0];
  if (!ANTHROPIC_API_KEY) {
    await supabase.from('project_parts').update({
      ai_analysis_status: 'error', ai_analysis_error: 'ANTHROPIC_API_KEY não configurada no agente local (.env).',
    }).eq('id', parte.id);
    return;
  }
  await supabase.from('project_parts').update({ ai_analysis_status: 'processing' }).eq('id', parte.id);
  await analisarParteUm(parte);
}

async function abrirNoFatiadorParte(parte) {
  const nomeRef = parte.nome || ('parte ' + parte.ordem);
  try {
    if (!fs.existsSync(SLICER_APP_PATH)) throw new Error('fatiador não encontrado em ' + SLICER_APP_PATH + ' — ajuste SLICER_APP_PATH no .env.');

    log('Baixando modelo da "' + nomeRef + '" pra abrir no fatiador...');
    const { data: fileData, error: dlErr } = await supabase.storage.from(BUCKET).download(parte.model_file_path);
    if (dlErr) throw new Error('download do modelo falhou: ' + dlErr.message);

    const downloadsDir = path.join(__dirname, 'downloads');
    fs.mkdirSync(downloadsDir, { recursive: true });
    const ext = path.extname(parte.model_file_path) || '.stl';
    const nomeSeguro = ('parte-' + nomeRef).replace(/[^a-z0-9À-ÿ]+/gi, '_');
    const stlBuf = Buffer.from(await fileData.arrayBuffer());

    let localPath;
    if (ext.toLowerCase() === '.stl' && parte.ai_slicing_settings) {
      try {
        const resultado = gerarModelo3mfConfigurado(stlBuf, parte.ai_slicing_settings, nomeSeguro + '.stl');
        localPath = path.join(downloadsDir, nomeSeguro + '.3mf');
        fs.writeFileSync(localPath, resultado.buffer);
        log('"' + nomeRef + '" convertida pra .3mf configurado (escala ' + resultado.escalaAplicada.toFixed(4) + ').');
      } catch (e) {
        log('AVISO: não consegui pré-configurar o .3mf da "' + nomeRef + '" (' + e.message + ') — abrindo o .stl puro mesmo.');
        localPath = path.join(downloadsDir, nomeSeguro + ext);
        fs.writeFileSync(localPath, stlBuf);
      }
    } else {
      localPath = path.join(downloadsDir, nomeSeguro + ext);
      fs.writeFileSync(localPath, stlBuf);
    }

    log('Abrindo a "' + nomeRef + '" no fatiador...');
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

    await supabase.from('project_parts').update({ open_slicer_status: 'done', open_slicer_error: null }).eq('id', parte.id);
    log('✅ "' + nomeRef + '" aberta no fatiador.');
  } catch (e) {
    log('❌ Abrir "' + nomeRef + '" no fatiador falhou: ' + e.message);
    await supabase.from('project_parts').update({
      open_slicer_status: 'error', open_slicer_error: String(e.message).slice(0, 2000),
    }).eq('id', parte.id);
  }
}

async function tickAbrirFatiadorPartes() {
  const { data: queued, error } = await supabase
    .from('project_parts')
    .select('id, order_line_item_id, nome, ordem, model_file_path, ai_slicing_settings')
    .eq('open_slicer_status', 'queued')
    .order('open_slicer_requested_at', { ascending: true })
    .limit(1);
  if (error) { log('Erro consultando fila de abrir-no-fatiador (partes): ' + error.message); return; }
  if (!queued || queued.length === 0) return;
  await abrirNoFatiadorParte(queued[0]);
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
    try { await tickAIProjeto(); } catch (e) { log('Erro inesperado (análise IA - projeto): ' + e.message); }
    try { await tickMeshyPartes(); } catch (e) { log('Erro inesperado (Meshy - partes): ' + e.message); }
    try { await tickAIPartes(); } catch (e) { log('Erro inesperado (análise IA - partes): ' + e.message); }
    try { await tickAbrirFatiadorPartes(); } catch (e) { log('Erro inesperado (abrir no fatiador - partes): ' + e.message); }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main();
