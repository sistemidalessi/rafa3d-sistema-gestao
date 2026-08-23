// Compara Hi3D e Meshy gerando a MESMA peça, pra decidir com as duas
// malhas lado a lado em vez de no achismo.
//
// Ele pega o último projeto que já tem modelo gerado pela Meshy, baixa a
// foto original que a Meshy usou, manda essa mesma foto pro Hi3D e salva
// os dois .stl em comparacao/ pra abrir no fatiador.
//
//   node comparar-geradores.js                    (usa hi3dv3.0 / 2048quality)
//   node comparar-geradores.js hitem3dv2.1 1536fast
//
// Não mexe em nada do sistema: só lê do banco e escreve arquivo local.

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { lerSTL, calcularBBox } = require('./gerar3mf');

const API = 'https://api.hitem3d.ai';
const ACCESS_KEY = process.env.HI3D_ACCESS_KEY;
const SECRET_KEY = process.env.HI3D_SECRET_KEY;
const BUCKET = 'modelos-3d';
const FOTOS_BUCKET = 'projetos-fotos';
const PASTA = path.join(__dirname, 'comparacao');

const MODELO = process.argv[2] || 'hi3dv3.0';
const RESOLUCAO = process.argv[3] || '2048quality';
// Mínimo que o Hi3D aceita. Peça de FDM não aproveita mais que isso, e
// cada triângulo a mais vira arquivo maior no Storage.
const FACES = '100000';

function log(msg) {
  console.log('[' + new Date().toLocaleTimeString('pt-BR') + '] ' + msg);
}

function exigir(valor, nome) {
  if (!valor) {
    console.error('Falta ' + nome + ' no .env do agente.');
    process.exit(1);
  }
  return valor;
}

// O Hi3D não aceita a chave direto: troca o par access/secret por um
// token de curta duração, em Basic base64(access:secret).
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

async function verSaldo(token) {
  const res = await fetch(API + '/open-api/v1/balance', {
    headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.data) return null;
  return Number(json.data.totalBalance);
}

async function criarTarefa(token, imagemBuf, nomeArquivo, mediaType) {
  const form = new FormData();
  form.append('images', new Blob([imagemBuf], { type: mediaType }), nomeArquivo);
  form.append('request_type', '1'); // só geometria — peça impressa não usa textura
  form.append('model', MODELO);
  form.append('resolution', RESOLUCAO);
  form.append('face', FACES);
  form.append('format', '3'); // 3 = stl
  const res = await fetch(API + '/open-api/v1/submit-task', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.data || !json.data.task_id) {
    throw new Error('Hi3D recusou a tarefa (HTTP ' + res.status + '): ' + JSON.stringify(json).slice(0, 400));
  }
  return json.data.task_id;
}

async function esperarTarefa(token, taskId) {
  const limite = Date.now() + 15 * 60 * 1000;
  let ultimo = '';
  while (Date.now() < limite) {
    const res = await fetch(API + '/open-api/v1/query-task?task_id=' + encodeURIComponent(taskId), {
      headers: { Authorization: 'Bearer ' + token },
    });
    const json = await res.json().catch(() => ({}));
    const d = json.data || {};
    if (d.state && d.state !== ultimo) {
      ultimo = d.state;
      log('  Hi3D: ' + d.state);
    }
    if (d.state === 'success') return d;
    if (d.state === 'failed') throw new Error('Hi3D não conseguiu gerar: ' + (json.msg || 'sem detalhe'));
    await new Promise((r) => setTimeout(r, 8000));
  }
  throw new Error('Hi3D passou de 15 minutos.');
}

function medir(rotulo, buf) {
  try {
    const { vertices, triangulos } = lerSTL(buf);
    const bbox = calcularBBox(vertices);
    const mm = bbox.tamanho.map((t) => t.toFixed(1)).join(' x ');
    return rotulo + ': ' + (buf.length / 1024 / 1024).toFixed(2) + ' MB, '
      + triangulos.length.toLocaleString('pt-BR') + ' triângulos, caixa ' + mm + ' (unidade do arquivo)';
  } catch (e) {
    return rotulo + ': ' + (buf.length / 1024 / 1024).toFixed(2) + ' MB (não consegui ler a malha: ' + e.message + ')';
  }
}

async function main() {
  exigir(ACCESS_KEY, 'HI3D_ACCESS_KEY');
  exigir(SECRET_KEY, 'HI3D_SECRET_KEY');
  const supabase = createClient(
    exigir(process.env.SUPABASE_URL, 'SUPABASE_URL'),
    exigir(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY')
  );

  log('Trocando as chaves por um token...');
  const token = await pegarToken();

  // Sem crédito o Hi3D só recusa lá na hora de criar a tarefa, com um
  // código numérico. Melhor descobrir agora e já dizer onde resolver.
  const saldo = await verSaldo(token);
  if (saldo === null) {
    log('AVISO: não consegui ler o saldo — sigo assim mesmo.');
  } else {
    // A tabela do Hi3D cobra em crédito, mas quem decide se vale a pena
    // pensa em dinheiro. US$ 0,02 por crédito é o preço de tabela deles.
    log('Saldo: ' + saldo + ' créditos (~US$ ' + (saldo * 0.02).toFixed(2) + ')');
    if (saldo <= 0) {
      throw new Error(
        'a conta do Hi3D está sem crédito, então ele recusaria a geração.\n'
        + '   Entre em platform.hi3d.ai -> Resource Packages e ative o pacote de\n'
        + '   teste (ou compre um). A chave já está funcionando, é só o saldo.'
      );
    }
  }

  log('Procurando um projeto que a Meshy já gerou, pra usar a mesma foto...');
  const { data: itens, error } = await supabase
    .from('order_line_items')
    .select('id, requester_name, custom_reference_image_path, model_file_path')
    .eq('line_type', 'custom')
    .eq('meshy_status', 'done')
    .not('custom_reference_image_path', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error) throw new Error('consulta ao banco falhou: ' + error.message);
  if (!itens || !itens.length) {
    throw new Error('nenhum projeto com modelo da Meshy pronto — gere um primeiro pelo sistema.');
  }
  const item = itens[0];
  const nome = item.requester_name || item.id;
  log('Peça escolhida: "' + nome + '"');

  const { data: fotoData, error: fotoErr } = await supabase.storage
    .from(FOTOS_BUCKET)
    .download(item.custom_reference_image_path);
  if (fotoErr) throw new Error('não consegui baixar a foto: ' + fotoErr.message);
  const fotoBuf = Buffer.from(await fotoData.arrayBuffer());
  const nomeFoto = path.basename(item.custom_reference_image_path);
  const mediaType = /\.png$/i.test(nomeFoto) ? 'image/png'
    : /\.webp$/i.test(nomeFoto) ? 'image/webp' : 'image/jpeg';

  fs.mkdirSync(PASTA, { recursive: true });
  fs.writeFileSync(path.join(PASTA, 'foto-usada-' + nomeFoto), fotoBuf);

  log('Mandando pro Hi3D (' + MODELO + ' / ' + RESOLUCAO + ' / só geometria / ' + FACES + ' faces)...');
  const inicio = Date.now();
  const taskId = await criarTarefa(token, fotoBuf, nomeFoto, mediaType);
  log('Tarefa criada: ' + taskId);
  const pronto = await esperarTarefa(token, taskId);
  const minutos = ((Date.now() - inicio) / 60000).toFixed(1);

  const stlRes = await fetch(pronto.url);
  if (!stlRes.ok) throw new Error('não consegui baixar o .stl do Hi3D (HTTP ' + stlRes.status + ').');
  const hi3dBuf = Buffer.from(await stlRes.arrayBuffer());
  fs.writeFileSync(path.join(PASTA, 'hi3d-' + MODELO + '.stl'), hi3dBuf);

  let meshyBuf = null;
  if (item.model_file_path) {
    const { data: mData } = await supabase.storage.from(BUCKET).download(item.model_file_path);
    if (mData) {
      meshyBuf = Buffer.from(await mData.arrayBuffer());
      fs.writeFileSync(path.join(PASTA, 'meshy.stl'), meshyBuf);
    }
  }

  console.log('\n===== ' + nome + ' =====');
  console.log('Hi3D levou ' + minutos + ' minutos.');
  console.log(medir('Hi3D  ', hi3dBuf));
  if (meshyBuf) console.log(medir('Meshy ', meshyBuf));
  console.log('\nOs arquivos estão em: ' + PASTA);
  console.log('Abra os dois no Bambu Studio lado a lado e veja qual peça ficou melhor.');
}

main().catch((e) => {
  console.error('\n❌ ' + e.message);
  process.exit(1);
});
