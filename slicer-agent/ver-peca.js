// Desenha a peça em imagem, de vários ângulos, sem abrir fatiador
// nenhum. Serve pra conferir a forma de um modelo antes de imprimir —
// e pra eu conseguir OLHAR a peça em vez de julgar por números.
//
//   node ver-peca.js downloads/cereja-inteira.3mf
//   node ver-peca.js arquivo.stl --tamanho=800
//
// Gera .bmp em downloads/vistas/ (frente, lado, cima, diagonal). BMP
// porque dá pra escrever sem biblioteca nenhuma; converta depois se
// precisar de PNG.
//
// Projeção ortográfica com z-buffer e sombreamento simples — o
// suficiente pra reconhecer a forma e achar sobra de geração.

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

function opcao(nome, padrao) {
  const a = process.argv.find((x) => x.startsWith('--' + nome + '='));
  return a ? parseFloat(a.slice(nome.length + 3)) : padrao;
}

const entrada = process.argv[2];
if (!entrada) {
  console.error('Uso: node ver-peca.js arquivo.3mf|arquivo.stl [--tamanho=700]');
  process.exit(1);
}
const LADO = opcao('tamanho', 700);

/* ====== LER A MALHA ====== */

function lerDo3mf(caminho) {
  const zip = new AdmZip(caminho);
  const vertices = [];
  const triangulos = [];
  const modelos = zip.getEntries().filter((e) => /\.model$/i.test(e.entryName) && !/3dmodel\.model$/i.test(e.entryName));
  const alvos = modelos.length ? modelos : zip.getEntries().filter((e) => /\.model$/i.test(e.entryName));
  for (const e of alvos) {
    const xml = e.getData().toString('utf8');
    // Cada <object> tem sua própria numeração de vértices, então o
    // deslocamento é recalculado a cada um.
    for (const bloco of xml.split('<object ').slice(1)) {
      const base = vertices.length;
      let m;
      const rv = /<vertex x="([-\d.eE+]+)" y="([-\d.eE+]+)" z="([-\d.eE+]+)"/g;
      while ((m = rv.exec(bloco)) !== null) vertices.push([+m[1], +m[2], +m[3]]);
      const rt = /<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"/g;
      while ((m = rt.exec(bloco)) !== null) triangulos.push([+m[1] + base, +m[2] + base, +m[3] + base]);
    }
  }
  return { vertices, triangulos };
}

function lerDoStl(caminho) {
  const { lerSTL } = require('./gerar3mf');
  return lerSTL(fs.readFileSync(caminho));
}

/* ====== DESENHAR ====== */

// Gira o ponto pra cada vista. Nomes em vez de matrizes porque são
// quatro ângulos fixos e isso deixa o código legível.
const VISTAS = {
  frente: (p) => [p[0], p[2], p[1]],
  lado: (p) => [p[1], p[2], p[0]],
  cima: (p) => [p[0], p[1], p[2]],
  diagonal: (p) => {
    const a = Math.PI / 5, b = Math.PI / 7;
    const x = p[0] * Math.cos(a) + p[1] * Math.sin(a);
    const y = -p[0] * Math.sin(a) + p[1] * Math.cos(a);
    return [x, p[2] * Math.cos(b) - y * Math.sin(b), p[2] * Math.sin(b) + y * Math.cos(b)];
  },
};

function desenhar(vertices, triangulos, transformar, lado) {
  const pts = vertices.map(transformar);
  let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
  for (const p of pts) {
    if (p[0] < mnx) mnx = p[0]; if (p[0] > mxx) mxx = p[0];
    if (p[1] < mny) mny = p[1]; if (p[1] > mxy) mxy = p[1];
  }
  const escala = (lado * 0.88) / Math.max(mxx - mnx, mxy - mny);
  const cx = (mnx + mxx) / 2, cy = (mny + mxy) / 2;
  const tela = (p) => [lado / 2 + (p[0] - cx) * escala, lado / 2 - (p[1] - cy) * escala];

  const cor = new Uint8Array(lado * lado * 3).fill(246);
  const prof = new Float32Array(lado * lado).fill(-Infinity);

  for (const [i0, i1, i2] of triangulos) {
    const a = pts[i0], b = pts[i1], c = pts[i2];
    if (!a || !b || !c) continue;
    // Normal pra sombrear: quanto mais virada pra luz, mais clara.
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const tam = Math.hypot(n[0], n[1], n[2]) || 1;
    const luz = Math.max(0.15, Math.abs((n[0] * -0.4 + n[1] * 0.35 + n[2] * 0.85) / tam));
    const tomR = Math.round(70 + luz * 175), tomG = Math.round(95 + luz * 150), tomB = Math.round(140 + luz * 110);

    const A = tela(a), B = tela(b), C = tela(c);
    const minX = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0])));
    const maxX = Math.min(lado - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
    const minY = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1])));
    const maxY = Math.min(lado - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
    const area = (B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]);
    if (Math.abs(area) < 1e-9) continue;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((B[0] - px) * (C[1] - py) - (C[0] - px) * (B[1] - py)) / area;
        const w1 = ((C[0] - px) * (A[1] - py) - (A[0] - px) * (C[1] - py)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * a[2] + w1 * b[2] + w2 * c[2];
        const i = y * lado + x;
        if (z <= prof[i]) continue;
        prof[i] = z;
        cor[i * 3] = tomR; cor[i * 3 + 1] = tomG; cor[i * 3 + 2] = tomB;
      }
    }
  }
  return cor;
}

// BMP é o formato que dá pra escrever sem depender de nada. Linhas de
// baixo pra cima e canal na ordem B,G,R, que é como o formato pede.
function salvarBmp(caminho, cor, lado) {
  const linha = Math.ceil((lado * 3) / 4) * 4;
  const dados = Buffer.alloc(linha * lado);
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const o = (lado - 1 - y) * linha + x * 3;
      const i = (y * lado + x) * 3;
      dados[o] = cor[i + 2]; dados[o + 1] = cor[i + 1]; dados[o + 2] = cor[i];
    }
  }
  const cab = Buffer.alloc(54);
  cab.write('BM', 0);
  cab.writeUInt32LE(54 + dados.length, 2);
  cab.writeUInt32LE(54, 10);
  cab.writeUInt32LE(40, 14);
  cab.writeInt32LE(lado, 18);
  cab.writeInt32LE(lado, 22);
  cab.writeUInt16LE(1, 26);
  cab.writeUInt16LE(24, 28);
  cab.writeUInt32LE(dados.length, 34);
  fs.writeFileSync(caminho, Buffer.concat([cab, dados]));
}

/* ====== RODAR ====== */

const malha = /\.3mf$/i.test(entrada) ? lerDo3mf(entrada) : lerDoStl(entrada);
console.log('malha:', malha.vertices.length.toLocaleString('pt-BR'), 'vértices,',
  malha.triangulos.length.toLocaleString('pt-BR'), 'triângulos');

const pasta = path.join(path.dirname(entrada), 'vistas');
fs.mkdirSync(pasta, { recursive: true });
const base = path.basename(entrada).replace(/\.(3mf|stl)$/i, '');

for (const [nome, fn] of Object.entries(VISTAS)) {
  const t0 = Date.now();
  const cor = desenhar(malha.vertices, malha.triangulos, fn, LADO);
  const saida = path.join(pasta, base + '-' + nome + '.bmp');
  salvarBmp(saida, cor, LADO);
  console.log('  ' + nome.padEnd(9) + ' -> ' + saida + '  (' + ((Date.now() - t0) / 1000).toFixed(1) + 's)');
}
