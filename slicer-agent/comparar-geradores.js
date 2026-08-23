// Compara Hi3D e Meshy gerando a MESMA peça, pra decidir com as duas
// malhas lado a lado em vez de no achismo.
//
// Manda a mesma foto pros dois geradores ao mesmo tempo e salva os dois
// .stl em comparacao/, com tamanho, triângulos e dimensões de cada um.
//
//   node comparar-geradores.js --foto=../catalogo/assets/mini_scooby_doo.jpg
//   node comparar-geradores.js --foto=... hitem3dv2.1 1536fast
//   node comparar-geradores.js --foto=... --so=hi3d
//
// Sem --foto ele procura no banco o último projeto que a Meshy já gerou
// e reaproveita a foto original dele.
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
const MESHY_API_KEY = process.env.MESHY_API_KEY;
const BUCKET = 'modelos-3d';
const FOTOS_BUCKET = 'projetos-fotos';
const PASTA = path.join(__dirname, 'comparacao');

function opcao(nome) {
  const achou = process.argv.find((a) => a.startsWith('--' + nome + '='));
  return achou ? achou.slice(nome.length + 3) : null;
}

// Tenta gerar mesmo com o saldo zerado. Serve pra separar duas coisas
// que parecem iguais de fora: conta realmente sem crédito, ou pacote já
// ativo que o endpoint de saldo ainda não enxerga. Recusa não cobra.
const IGNORAR_SALDO = process.argv.includes('--ignorar-saldo');
const FOTO_LOCAL = opcao('foto');
const SO = opcao('so'); // 'hi3d' ou 'meshy', pra repetir só um lado
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const MODELO = args[0] || 'hi3dv3.0';
const RESOLUCAO = args[1] || '2048quality';
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

function mediaTypeDe(nome) {
  if (/\.png$/i.test(nome)) return 'image/png';
  if (/\.webp$/i.test(nome)) return 'image/webp';
  return 'image/jpeg';
}

/* ====== HI3D ====== */

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

async function hi3dCriarTarefa(token, imagemBuf, nomeArquivo) {
  const form = new FormData();
  form.append('images', new Blob([imagemBuf], { type: mediaTypeDe(nomeArquivo) }), nomeArquivo);
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

async function hi3dEsperarTarefa(token, taskId) {
  const limite = Date.now() + 20 * 60 * 1000;
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
  throw new Error('Hi3D passou de 20 minutos.');
}

async function gerarComHi3d(foto) {
  const token = await pegarToken();
  const saldo = await verSaldo(token);
  if (saldo === null) {
    log('AVISO: não consegui ler o saldo do Hi3D — sigo assim mesmo.');
  } else {
    // A tabela do Hi3D cobra em crédito, mas quem decide se vale a pena
    // pensa em dinheiro. US$ 0,02 por crédito é o preço de tabela deles.
    log('Saldo Hi3D: ' + saldo + ' créditos (~US$ ' + (saldo * 0.02).toFixed(2) + ')');
    if (saldo <= 0 && !IGNORAR_SALDO) {
      throw new Error(
        'a conta do Hi3D está sem crédito, então ele recusaria a geração.\n'
        + '   Entre em platform.hi3d.ai -> Resource Packages e ative o pacote de\n'
        + '   teste (ou compre um). A chave já está funcionando, é só o saldo.'
      );
    }
  }

  log('Hi3D: mandando (' + MODELO + ' / ' + RESOLUCAO + ' / só geometria / ' + FACES + ' faces)...');
  const inicio = Date.now();
  const taskId = await hi3dCriarTarefa(token, foto.buf, foto.nome);
  log('Hi3D: tarefa ' + taskId);
  const pronto = await hi3dEsperarTarefa(token, taskId);

  const stlRes = await fetch(pronto.url);
  if (!stlRes.ok) throw new Error('não consegui baixar o .stl do Hi3D (HTTP ' + stlRes.status + ').');
  return {
    buf: Buffer.from(await stlRes.arrayBuffer()),
    minutos: (Date.now() - inicio) / 60000,
    arquivo: 'hi3d-' + MODELO + '-' + RESOLUCAO + '.stl',
  };
}

/* ====== MESHY ====== */

// Mesmos parâmetros que o agente usa hoje em produção — senão a
// comparação mediria a configuração, não o gerador.
async function gerarComMeshy(foto) {
  const inicio = Date.now();
  log('Meshy: mandando...');
  const res = await fetch('https://api.meshy.ai/openapi/v1/image-to-3d', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + MESHY_API_KEY },
    body: JSON.stringify({
      image_url: 'data:' + mediaTypeDe(foto.nome) + ';base64,' + foto.buf.toString('base64'),
      target_formats: ['stl'],
      should_texture: false,
      should_remesh: true,
      target_polycount: 30000,
    }),
  });
  if (!res.ok) {
    throw new Error('Meshy recusou a tarefa (HTTP ' + res.status + '): ' + (await res.text()).slice(0, 300));
  }
  const taskId = (await res.json()).result;
  log('Meshy: tarefa ' + taskId);

  const limite = Date.now() + 20 * 60 * 1000;
  let ultimo = '';
  while (Date.now() < limite) {
    const r = await fetch('https://api.meshy.ai/openapi/v1/image-to-3d/' + taskId, {
      headers: { Authorization: 'Bearer ' + MESHY_API_KEY },
    });
    const j = await r.json().catch(() => ({}));
    if (j.status && j.status !== ultimo) {
      ultimo = j.status;
      log('  Meshy: ' + j.status);
    }
    if (j.status === 'SUCCEEDED') {
      const url = j.model_urls && j.model_urls.stl;
      if (!url) throw new Error('Meshy terminou sem .stl na resposta.');
      const d = await fetch(url);
      if (!d.ok) throw new Error('não consegui baixar o .stl da Meshy (HTTP ' + d.status + ').');
      return {
        buf: Buffer.from(await d.arrayBuffer()),
        minutos: (Date.now() - inicio) / 60000,
        arquivo: 'meshy.stl',
      };
    }
    if (j.status === 'FAILED' || j.status === 'CANCELED') {
      throw new Error('Meshy não conseguiu gerar (status ' + j.status + ').');
    }
    await new Promise((r2) => setTimeout(r2, 8000));
  }
  throw new Error('Meshy passou de 20 minutos.');
}

/* ====== COMPARAÇÃO ====== */

function medir(rotulo, r) {
  const mb = (r.buf.length / 1024 / 1024).toFixed(2) + ' MB';
  const tempo = r.minutos.toFixed(1) + ' min';
  try {
    const { vertices, triangulos } = lerSTL(r.buf);
    const bbox = calcularBBox(vertices);
    // A proporção é o que dá pra comparar entre geradores: cada um
    // exporta numa unidade própria, então o tamanho absoluto não diz
    // nada, mas peça achatada ou esticada aparece aqui.
    const maior = Math.max(...bbox.tamanho) || 1;
    const prop = bbox.tamanho.map((t) => (t / maior).toFixed(2)).join(' : ');
    return rotulo.padEnd(7) + tempo.padStart(9) + '  ' + mb.padStart(9) + '  '
      + triangulos.length.toLocaleString('pt-BR').padStart(11) + ' triâng.  proporção ' + prop;
  } catch (e) {
    return rotulo.padEnd(7) + tempo.padStart(9) + '  ' + mb.padStart(9)
      + '  (não consegui ler a malha: ' + e.message + ')';
  }
}

async function obterFoto(supabase) {
  if (FOTO_LOCAL) {
    const p = path.resolve(__dirname, FOTO_LOCAL);
    if (!fs.existsSync(p)) throw new Error('não achei a foto: ' + p);
    return { buf: fs.readFileSync(p), nome: path.basename(p), de: p };
  }
  log('Procurando no banco um projeto que a Meshy já gerou...');
  const { data: itens, error } = await supabase
    .from('order_line_items')
    .select('id, requester_name, custom_reference_image_path')
    .eq('line_type', 'custom')
    .eq('meshy_status', 'done')
    .not('custom_reference_image_path', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error) throw new Error('consulta ao banco falhou: ' + error.message);
  if (!itens || !itens.length) {
    throw new Error(
      'nenhum projeto com modelo pronto no banco.\n'
      + '   Passe uma foto direto:  node comparar-geradores.js --foto=../catalogo/assets/mini_scooby_doo.jpg'
    );
  }
  const item = itens[0];
  const { data, error: dlErr } = await supabase.storage
    .from(FOTOS_BUCKET).download(item.custom_reference_image_path);
  if (dlErr) throw new Error('não consegui baixar a foto: ' + dlErr.message);
  return {
    buf: Buffer.from(await data.arrayBuffer()),
    nome: path.basename(item.custom_reference_image_path),
    de: 'projeto "' + (item.requester_name || item.id) + '"',
  };
}

async function main() {
  const supabase = createClient(
    exigir(process.env.SUPABASE_URL, 'SUPABASE_URL'),
    exigir(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY')
  );

  const foto = await obterFoto(supabase);
  log('Foto: ' + foto.nome + ' (' + (foto.buf.length / 1024).toFixed(0) + ' KB) — de ' + foto.de);

  fs.mkdirSync(PASTA, { recursive: true });
  fs.writeFileSync(path.join(PASTA, 'foto-usada-' + foto.nome), foto.buf);

  // Os dois ao mesmo tempo: são serviços diferentes, um não atrapalha o
  // outro, e assim a espera é a do mais lento em vez da soma das duas.
  const tarefas = [];
  if (SO !== 'meshy') {
    exigir(ACCESS_KEY, 'HI3D_ACCESS_KEY');
    exigir(SECRET_KEY, 'HI3D_SECRET_KEY');
    tarefas.push(gerarComHi3d(foto).then((r) => ({ rotulo: 'Hi3D', r }), (e) => ({ rotulo: 'Hi3D', erro: e })));
  }
  if (SO !== 'hi3d') {
    exigir(MESHY_API_KEY, 'MESHY_API_KEY');
    tarefas.push(gerarComMeshy(foto).then((r) => ({ rotulo: 'Meshy', r }), (e) => ({ rotulo: 'Meshy', erro: e })));
  }
  const saidas = await Promise.all(tarefas);

  console.log('\n===== ' + foto.nome + ' =====');
  console.log('        '.padEnd(7) + '   tempo'.padStart(9) + '   tamanho'.padStart(11) + '      malha');
  let algumOk = false;
  for (const s of saidas) {
    if (s.erro) {
      console.log(s.rotulo.padEnd(7) + '  ❌ ' + s.erro.message);
      continue;
    }
    algumOk = true;
    fs.writeFileSync(path.join(PASTA, s.r.arquivo), s.r.buf);
    console.log(medir(s.rotulo, s.r));
  }
  if (algumOk) {
    console.log('\nArquivos em: ' + PASTA);
    console.log('Abra os dois no Bambu Studio lado a lado e veja qual peça ficou melhor.');
    console.log('O número que decide é o olho, não a tabela — ela só mostra o custo de cada um.');
  }
}

main().catch((e) => {
  console.error('\n❌ ' + e.message);
  process.exit(1);
});
