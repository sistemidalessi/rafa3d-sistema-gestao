require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ORCA_PATH = process.env.ORCA_PATH || 'C:\\Program Files\\OrcaSlicer\\orca-slicer.exe';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '5000', 10);
const BUCKET = 'modelos-3d';

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

async function main() {
  log('Agente de fatiamento iniciado.');
  log('OrcaSlicer: ' + ORCA_PATH);
  log('Verificando a fila a cada ' + (POLL_INTERVAL_MS / 1000) + 's. Ctrl+C para parar.');
  for (;;) {
    try { await tick(); } catch (e) { log('Erro inesperado: ' + e.message); }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main();
