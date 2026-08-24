// Desenha o corpo do chaveiro de cereja por medida exata (manifold-3d),
// em vez de tentar gerar por foto — a peça é simples o bastante pra
// modelar direto, e isso já resolve de graça o encaixe de precisão que
// o produto real usa (rebaixo do laço, bolso do NFC).
//
// v1: só as duas "bolinhas" da cereja (achatadas, costas planas) + o
// bolso do NFC. Laço, gancho do abridor e texto gravado vêm depois,
// uma vez que a proporção geral estiver aprovada.
//
//   node cereja-cad.js
//
// Gera cereja-v1.3mf em downloads/, já com impressora/PLA aplicados
// (reaproveita gerarModelo3mfConfigurado, igual o resto do sistema).
const fs = require('fs');
const path = require('path');
const { gerarModelo3mfConfigurado } = require('./gerar3mf');

// ---- medidas (mm) ----------------------------------------------------
const LARGURA_ALVO = 60;      // ponta a ponta, pedida pelo Anderson
const RAIO_BOLINHA_GRANDE = 18;
const RAIO_BOLINHA_PEQUENA = 13;
const ALTURA_TAMPA_GRANDE = 13; // quão "inflada" a bolinha grande fica (calota esférica)
const ALTURA_TAMPA_PEQUENA = 10;
const DISTANCIA_CENTROS = 22;   // quanto as duas bolinhas se sobrepõem
const NFC_DIAMETRO = 25;
const NFC_PROFUNDIDADE = 1.5;

// Serializa um Mesh do Manifold (vertProperties/triVerts, floats/uint32
// planos) pra um .stl binário — formato que o resto do sistema já sabe
// ler (lerSTL em gerar3mf.js).
function meshParaSTLBinario(mesh) {
  const numTri = mesh.triVerts.length / 3;
  const buf = Buffer.alloc(84 + numTri * 50);
  buf.write('cereja-cad', 0);
  buf.writeUInt32LE(numTri, 80);
  let offset = 84;
  for (let t = 0; t < numTri; t++) {
    const i0 = mesh.triVerts[t * 3], i1 = mesh.triVerts[t * 3 + 1], i2 = mesh.triVerts[t * 3 + 2];
    buf.writeFloatLE(0, offset); buf.writeFloatLE(0, offset + 4); buf.writeFloatLE(0, offset + 8); // normal: deixa o Bambu recalcular
    offset += 12;
    for (const i of [i0, i1, i2]) {
      buf.writeFloatLE(mesh.vertProperties[i * 3], offset);
      buf.writeFloatLE(mesh.vertProperties[i * 3 + 1], offset + 4);
      buf.writeFloatLE(mesh.vertProperties[i * 3 + 2], offset + 8);
      offset += 12;
    }
    buf.writeUInt16LE(0, offset); offset += 2;
  }
  return buf;
}

// Calota esférica com costas planas em z=0: pega uma esfera de raio R,
// desce o centro dela pra ficar só uma "fatia" (altura h) acima do
// plano z=0, e corta tudo que sobra abaixo. h < R dá uma bolinha achatada.
function calotaEsferica(Manifold, raio, altura, segments) {
  const esfera = Manifold.sphere(raio, segments).translate([0, 0, altura - raio]);
  const caixaCorte = Manifold.cube([raio * 3, raio * 3, raio * 2], true).translate([0, 0, raio]);
  return esfera.intersect(caixaCorte);
}

async function main() {
  const { default: Module } = await import('manifold-3d');
  const wasm = await Module();
  wasm.setup();
  const { Manifold } = wasm;

  const grande = calotaEsferica(Manifold, RAIO_BOLINHA_GRANDE, ALTURA_TAMPA_GRANDE, 64)
    .translate([-DISTANCIA_CENTROS / 2, 0, 0]);
  const pequena = calotaEsferica(Manifold, RAIO_BOLINHA_PEQUENA, ALTURA_TAMPA_PEQUENA, 64)
    .translate([DISTANCIA_CENTROS / 2, 0, 0]);
  let corpo = grande.add(pequena);

  const bbox = corpo.boundingBox();
  const larguraReal = bbox.max[0] - bbox.min[0];
  console.log('Largura real do desenho: ' + larguraReal.toFixed(1) + 'mm (alvo: ' + LARGURA_ALVO + 'mm)');

  // Bolso do NFC, cortado nas costas (z=0) da bolinha grande — é a que
  // tem mais espessura, então é onde o bolso cabe sem furar a peça.
  const bolsoNfc = Manifold.cylinder(NFC_PROFUNDIDADE, NFC_DIAMETRO / 2, NFC_DIAMETRO / 2, 64)
    .translate([-DISTANCIA_CENTROS / 2, 0, 0]);
  corpo = corpo.subtract(bolsoNfc);

  console.log('Status final: ' + corpo.status() + ' (NoError = sólido válido)');
  console.log('Volume: ' + corpo.volume().toFixed(1) + ' mm³');

  const mesh = corpo.getMesh();
  const stlBuf = meshParaSTLBinario(mesh);

  const resultado = gerarModelo3mfConfigurado(stlBuf, null, 'cereja-v1.stl', 'manual_upload');
  const destino = path.join(__dirname, 'downloads', 'cereja-v1.3mf');
  fs.writeFileSync(destino, resultado.buffer);
  console.log('✅ Salvo em: ' + destino);
  console.log('Tamanho final na mesa: ' + resultado.tamanhoFinalMm.map((t) => t.toFixed(1)).join(' x ') + ' mm');
}

main().catch((e) => { console.error('ERRO: ' + e.stack); process.exit(1); });
