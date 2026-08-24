// Desenha o gancho do abridor de latinha — peça limpa, só com formas
// geométricas (manifold-3d), pra encostar na aba que o Hi3D já gerou
// sem precisar cortar a malha dele (que falha na validação, ver
// investigação em 24/08). O Bambu Studio funde objetos que se tocam
// na hora de fatiar, então não precisa ser uma malha só.
//
//   node gancho-abridor.js
//
// Gera downloads/gancho-abridor.3mf — abra ao lado da peça da cereja
// no Bambu Studio e posicione encostado na ponta da aba.
const fs = require('fs');
const path = require('path');
const { gerarModelo3mfConfigurado } = require('./gerar3mf');

// ---- medidas (mm), padrão de abridor de chaveiro comum --------------
// Não é furo fechado — é uma mordida arredondada aberta na borda,
// pra entrar de lado no anel da tampinha (referência real conferida
// com o cliente em 24/08: o dedo empurra por cima, o entalhe faz
// alavanca no anel, igual um abridor "chave de igreja" clássico).
const LARGURA_ABA = 20;
const COMPRIMENTO_ABA = 30;
const ESPESSURA = 5;
const RAIO_BOLSO = 8.5;   // onde o anel fica retido depois de entrar
const LARGURA_ENTRADA = 5; // canal estreito na borda — mais estreito que o bolso, segura o anel sem deixar escapar de lado
const DISTANCIA_BOLSO_BORDA = 6; // do centro do bolso até a borda da aba

function meshParaSTLBinario(mesh) {
  const numTri = mesh.triVerts.length / 3;
  const buf = Buffer.alloc(84 + numTri * 50);
  buf.write('gancho-abridor', 0);
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
  const { Manifold } = wasm;

  // Aba retangular, centralizada em (0,0), da base (z=0) até z=ESPESSURA.
  const aba = Manifold.cube([COMPRIMENTO_ABA, LARGURA_ABA, ESPESSURA], true)
    .translate([0, 0, ESPESSURA / 2]);

  // Bolso redondo, um pouco pra dentro da borda — é onde o anel da
  // tampinha fica retido depois de entrar, dá pra fazer alavanca sem
  // escorregar.
  const centroBolsoX = COMPRIMENTO_ABA / 2 - DISTANCIA_BOLSO_BORDA;
  const bolso = Manifold.cylinder(ESPESSURA * 2, RAIO_BOLSO, RAIO_BOLSO, 48)
    .translate([centroBolsoX, 0, -ESPESSURA / 2]);

  // Canal estreito ligando o bolso até a borda da ponta — a "abertura"
  // por onde o anel entra. Mais estreito que o bolso de propósito, pra
  // segurar o anel depois que ele entrar, não deixar escapar de lado.
  const comprimentoCanal = COMPRIMENTO_ABA / 2 - centroBolsoX + 2;
  const canal = Manifold.cube([comprimentoCanal, LARGURA_ENTRADA, ESPESSURA * 2], true)
    .translate([centroBolsoX + comprimentoCanal / 2, 0, ESPESSURA / 2]);

  let gancho = aba.subtract(bolso).subtract(canal);
  console.log('Status: ' + gancho.status() + ' (NoError = sólido válido)');
  console.log('Volume: ' + gancho.volume().toFixed(1) + ' mm³');

  const mesh = gancho.getMesh();
  const stlBuf = meshParaSTLBinario(mesh);
  const resultado = gerarModelo3mfConfigurado(stlBuf, null, 'gancho-abridor.stl', 'manual_upload');
  const destino = path.join(__dirname, 'downloads', 'gancho-abridor.3mf');
  fs.writeFileSync(destino, resultado.buffer);
  console.log('✅ Salvo em: ' + destino);
  console.log('Tamanho: ' + resultado.tamanhoFinalMm.map((t) => t.toFixed(1)).join(' x ') + ' mm');
}

main().catch((e) => { console.error('ERRO: ' + e.stack); process.exit(1); });
