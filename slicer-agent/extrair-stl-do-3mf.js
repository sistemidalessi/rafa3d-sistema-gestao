// Tira a malha de dentro de um .3mf e salva como .stl, opcionalmente
// numa escala nova.
//
// Existe porque o Hi3D devolve .3mf com várias partes (é a graça dele:
// já vem dividido por cor), mas as ferramentas que medem geometria —
// como a achar-altura-pausa-nfc.js — leem .stl. O .stl não guarda cor
// nem divisão, e tudo bem: pra achar onde o NFC cabe só interessa o
// contorno da peça.
//
//   node extrair-stl-do-3mf.js downloads/cereja-hi3d-dividido.3mf
//   node extrair-stl-do-3mf.js arquivo.3mf --largura=78
//   node extrair-stl-do-3mf.js arquivo.3mf --escala=0.78
//
// Sem --largura nem --escala, sai no tamanho original.
//
// ATENÇÃO: o .stl gerado NÃO serve pra imprimir uma peça multicor —
// ele perde a divisão em partes. Pra imprimir, escale o .3mf no próprio
// Bambu Studio, que preserva as cores.

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

function opcao(nome) {
  const achado = process.argv.find((a) => a.startsWith('--' + nome + '='));
  return achado ? parseFloat(achado.slice(nome.length + 3).replace(',', '.')) : null;
}

const entrada = process.argv[2];
if (!entrada) {
  console.error('Uso: node extrair-stl-do-3mf.js arquivo.3mf [--largura=78] [--escala=0.78]');
  process.exit(1);
}

// Lê um .model do 3mf: devolve vértices e triângulos. O formato é XML
// simples o bastante pra ler por expressão regular — e assim não entra
// dependência de parser de XML só por causa disto.
function lerModel(xml) {
  const vertices = [];
  const re = /<vertex x="([-\d.eE+]+)" y="([-\d.eE+]+)" z="([-\d.eE+]+)"/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    vertices.push([parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]);
  }
  const triangulos = [];
  const rt = /<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"/g;
  while ((m = rt.exec(xml)) !== null) {
    triangulos.push([parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)]);
  }
  return { vertices, triangulos };
}

function escreverSTLBinario(vertices, triangulos) {
  const buf = Buffer.alloc(84 + triangulos.length * 50);
  buf.write('Rafa 3D - extraido de 3mf', 0, 'ascii');
  buf.writeUInt32LE(triangulos.length, 80);
  let p = 84;
  for (const t of triangulos) {
    const a = vertices[t[0]], b = vertices[t[1]], c = vertices[t[2]];
    // Normal calculada pelo produto vetorial. Muitos programas ignoram
    // e recalculam, mas gravar zero faz alguns reclamarem.
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const tam = Math.hypot(n[0], n[1], n[2]) || 1;
    n = n.map((x) => x / tam);
    n.forEach((x) => { buf.writeFloatLE(x, p); p += 4; });
    [a, b, c].forEach((vt) => vt.forEach((x) => { buf.writeFloatLE(x, p); p += 4; }));
    buf.writeUInt16LE(0, p); p += 2;
  }
  return buf;
}

const zip = new AdmZip(entrada);
const partes = zip.getEntries().filter((e) => /\.model$/i.test(e.entryName) && !/3dmodel\.model$/i.test(e.entryName));
const alvos = partes.length ? partes : zip.getEntries().filter((e) => /\.model$/i.test(e.entryName));

// Junta todas as partes numa malha só, reindexando os triângulos.
const vertices = [];
const triangulos = [];
console.log('Partes encontradas:', alvos.length);
for (const e of alvos) {
  const { vertices: v, triangulos: t } = lerModel(e.getData().toString('utf8'));
  const desloc = vertices.length;
  v.forEach((x) => vertices.push(x));
  t.forEach((x) => triangulos.push([x[0] + desloc, x[1] + desloc, x[2] + desloc]));
  console.log('  ' + e.entryName.replace(/^.*\//, '') + ': ' + v.length.toLocaleString('pt-BR') + ' vértices, ' + t.length.toLocaleString('pt-BR') + ' triângulos');
}

function medir(vs) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  vs.forEach((v) => { for (let i = 0; i < 3; i++) { if (v[i] < mn[i]) mn[i] = v[i]; if (v[i] > mx[i]) mx[i] = v[i]; } });
  return mn.map((_, i) => mx[i] - mn[i]);
}

const antes = medir(vertices);
console.log('\nTamanho original: ' + antes.map((t) => t.toFixed(1)).join(' x ') + ' mm');

const larguraAlvo = opcao('largura');
let escala = opcao('escala') || 1;
if (larguraAlvo) escala = larguraAlvo / antes[0];

if (escala !== 1) {
  vertices.forEach((v) => { for (let i = 0; i < 3; i++) v[i] *= escala; });
  const dep = medir(vertices);
  console.log('Escala aplicada: ' + escala.toFixed(4) + ' (' + (escala * 100).toFixed(1) + '%)');
  console.log('Tamanho final:   ' + dep.map((t) => t.toFixed(1)).join(' x ') + ' mm');
}

const saida = process.argv[3] && !process.argv[3].startsWith('--')
  ? process.argv[3]
  : path.join(path.dirname(entrada), path.basename(entrada, '.3mf') + (escala !== 1 ? '-' + Math.round(escala * 100) : '') + '.stl');
fs.writeFileSync(saida, escreverSTLBinario(vertices, triangulos));
console.log('\n✅ Salvo: ' + path.resolve(saida) + '  (' + (fs.statSync(saida).size / 1024 / 1024).toFixed(2) + ' MB)');
console.log('Lembrete: este .stl não tem as cores. Pra imprimir multicor, escale o .3mf no Bambu Studio.');
