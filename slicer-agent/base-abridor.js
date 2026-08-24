// Desenha a base do abridor: uma placa atrás da cereja, cobrindo a
// largura das duas bolinhas, reta de um lado e curva do outro
// (acompanhando o contorno), com um vão no meio pro anel da tampinha.
//
//   node base-abridor.js
//
// Gera downloads/base-abridor.3mf — abra ao lado da cereja e arraste
// pra posição (mais fácil de acertar visualmente do que eu calcular
// às cegas, dado que já erramos a posição uma vez).
const fs = require('fs');
const path = require('path');
const { gerarModelo3mfConfigurado } = require('./gerar3mf');

// ---- medidas (mm) ------------------------------------------------
// Correção 24/08: o vão é um retângulo NA PONTA (parte negativa),
// não uma cápsula no meio — o dono corrigiu depois de ver o rascunho.
const LARGURA = 55;   // cobre as duas bolinhas
const PROFUNDIDADE = 28;
const ESPESSURA = 4;
const RAIO_CANTO = 12; // arredonda o lado que acompanha o contorno da cereja
const VAO_LARGURA = 14;   // retângulo vazado, na ponta
const VAO_ALTURA = 10;
const VAO_MARGEM_PONTA = 6; // distância do vão até a borda reta

function meshParaSTLBinario(mesh) {
  const numTri = mesh.triVerts.length / 3;
  const buf = Buffer.alloc(84 + numTri * 50);
  buf.write('base-abridor', 0);
  buf.writeUInt32LE(numTri, 80);
  let offset = 84;
  for (let t = 0; t < numTri; t++) {
    const i0 = mesh.triVerts[t * 3], i1 = mesh.triVerts[t * 3 + 1], i2 = mesh.triVerts[t * 3 + 2];
    buf.writeFloatLE(0, offset); buf.writeFloatLE(0, offset + 4); buf.writeFloatLE(0, offset + 8);
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

async function main() {
  const { default: Module } = await import('manifold-3d');
  const wasm = await Module();
  wasm.setup();
  const { Manifold, CrossSection } = wasm;

  // Placa: reta do lado -Y (borda externa), arredondada do lado +Y
  // (lado que encosta na cereja) — um retângulo com os dois cantos de
  // +Y cortados por círculos grandes, pra ficar uma curva suave.
  let placa2d = CrossSection.square([LARGURA, PROFUNDIDADE], true);
  const cantoEsq = CrossSection.circle(RAIO_CANTO, 48).translate([-LARGURA / 2 + RAIO_CANTO, PROFUNDIDADE / 2 - RAIO_CANTO]);
  const cantoDir = CrossSection.circle(RAIO_CANTO, 48).translate([LARGURA / 2 - RAIO_CANTO, PROFUNDIDADE / 2 - RAIO_CANTO]);
  const cantoQuadrado = CrossSection.square([RAIO_CANTO, RAIO_CANTO], false).translate([-LARGURA / 2, PROFUNDIDADE / 2 - RAIO_CANTO]);
  const cantoQuadrado2 = CrossSection.square([RAIO_CANTO, RAIO_CANTO], false).translate([LARGURA / 2 - RAIO_CANTO, PROFUNDIDADE / 2 - RAIO_CANTO]);
  placa2d = placa2d.subtract(cantoQuadrado.subtract(cantoEsq)).subtract(cantoQuadrado2.subtract(cantoDir));

  let base = Manifold.extrude(placa2d, ESPESSURA);

  // Vão retangular na ponta (lado reto, -Y) — parte negativa que encaixa
  // o lacre da latinha.
  const centroVaoY = -PROFUNDIDADE / 2 + VAO_MARGEM_PONTA + VAO_ALTURA / 2;
  const vao2d = CrossSection.square([VAO_LARGURA, VAO_ALTURA], true).translate([0, centroVaoY]);
  const vao = Manifold.extrude(vao2d, ESPESSURA * 2).translate([0, 0, -ESPESSURA / 2]);

  base = base.subtract(vao);
  console.log('Status: ' + base.status() + ' (NoError = sólido válido)');
  console.log('Volume: ' + base.volume().toFixed(1) + ' mm³');

  const mesh = base.getMesh();
  const stlBuf = meshParaSTLBinario(mesh);
  const resultado = gerarModelo3mfConfigurado(stlBuf, null, 'base-abridor.stl', 'manual_upload');
  const destino = path.join(__dirname, 'downloads', 'base-abridor.3mf');
  fs.writeFileSync(destino, resultado.buffer);
  console.log('✅ Salvo em: ' + destino);
  console.log('Tamanho: ' + resultado.tamanhoFinalMm.map((t) => t.toFixed(1)).join(' x ') + ' mm');
}

main().catch((e) => { console.error('ERRO: ' + e.stack); process.exit(1); });
