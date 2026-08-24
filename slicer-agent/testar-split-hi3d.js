// Teste pontual, não faz parte do sistema: manda um .stl já gerado pro
// endpoint de DIVISÃO do Hi3D (o motivo real de cogitar a troca) e salva
// o resultado em comparacao/. Cada rodada custa 20 créditos.
//
//   node testar-split-hi3d.js caminho/do/arquivo.stl

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');

const API = 'https://api.hitem3d.ai';
const ACCESS_KEY = process.env.HI3D_ACCESS_KEY;
const SECRET_KEY = process.env.HI3D_SECRET_KEY;
const PASTA = path.join(__dirname, 'comparacao');

function log(msg) {
  console.log('[' + new Date().toLocaleTimeString('pt-BR') + '] ' + msg);
}

async function pegarToken() {
  const basic = Buffer.from(ACCESS_KEY + ':' + SECRET_KEY).toString('base64');
  const res = await fetch(API + '/open-api/v1/auth/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + basic, 'content-type': 'application/json' },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.data || !json.data.accessToken) {
    throw new Error('Hi3D recusou as chaves (HTTP ' + res.status + '): ' + JSON.stringify(json).slice(0, 300));
  }
  return json.data.accessToken;
}

async function criarTarefaSplit(token, stlBuf, nomeArquivo) {
  const form = new FormData();
  form.append('mesh', new Blob([stlBuf], { type: 'model/stl' }), nomeArquivo);
  form.append('model', 'general');
  form.append('level', 'low');
  form.append('format', '6'); // 6 = .3mf direto
  const res = await fetch(API + '/open-api/v1/split/create-task', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.data || !json.data.task_id) {
    throw new Error('Hi3D recusou a divisão (HTTP ' + res.status + '): ' + JSON.stringify(json).slice(0, 500));
  }
  return json.data.task_id;
}

async function esperarSplit(token, taskId) {
  const limite = Date.now() + 20 * 60 * 1000;
  let ultimo = '';
  while (Date.now() < limite) {
    // A doc anotou que este endpoint pode responder só com "Token" em vez
    // de "Bearer" — tenta Bearer primeiro, cai pro outro se vier 401.
    let res = await fetch(API + '/open-api/v1/split/query-task?task_id=' + encodeURIComponent(taskId), {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (res.status === 401) {
      res = await fetch(API + '/open-api/v1/split/query-task?task_id=' + encodeURIComponent(taskId), {
        headers: { Authorization: 'Token ' + token },
      });
    }
    const json = await res.json().catch(() => ({}));
    const d = json.data || {};
    if (d.state && d.state !== ultimo) {
      ultimo = d.state;
      log('  Hi3D (split): ' + d.state);
    }
    if (d.state === 'success') return d;
    if (d.state === 'failed') throw new Error('Hi3D não conseguiu dividir: ' + (json.msg || 'sem detalhe'));
    await new Promise((r) => setTimeout(r, 8000));
  }
  throw new Error('Hi3D (split) passou de 20 minutos.');
}

async function main() {
  const arquivo = process.argv[2];
  if (!arquivo) { console.error('Uso: node testar-split-hi3d.js caminho/do/arquivo.stl'); process.exit(1); }
  if (!ACCESS_KEY || !SECRET_KEY) { console.error('Falta HI3D_ACCESS_KEY / HI3D_SECRET_KEY no .env.'); process.exit(1); }

  const stlBuf = fs.readFileSync(arquivo);
  log('Arquivo: ' + path.basename(arquivo) + ' (' + (stlBuf.length / 1024).toFixed(0) + ' KB)');

  const token = await pegarToken();
  log('Mandando pra dividir (model=character, part=c, joint=dovetail)...');
  const taskId = await criarTarefaSplit(token, stlBuf, path.basename(arquivo));
  log('Tarefa: ' + taskId);

  const resultado = await esperarSplit(token, taskId);
  log('Resultado bruto: ' + JSON.stringify(resultado).slice(0, 800));

  const url = resultado.url || (resultado.model_urls && (resultado.model_urls.model || resultado.model_urls['3mf'])) || null;
  if (!url) { log('AVISO: não achei um link de arquivo na resposta — confira o JSON acima na mão.'); return; }

  fs.mkdirSync(PASTA, { recursive: true });
  const destino = path.join(PASTA, 'hi3d-split-resultado.3mf');
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destino, buf);
  log('✅ Salvo em: ' + destino + ' (' + (buf.length / 1024 / 1024).toFixed(2) + ' MB)');
}

main().catch((e) => { console.error('❌ ' + e.message); process.exit(1); });
