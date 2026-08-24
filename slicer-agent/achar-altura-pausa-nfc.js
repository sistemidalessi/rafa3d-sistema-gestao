// Acha a altura (Z) certa pra pausar a impressão e encaixar o NFC —
// sem precisar cortar buraco nenhum na malha (por isso não esbarra no
// problema de malha não-manifold que travou a ideia do bolso colado).
//
// Como funciona: a peça imprime com as costas planas na mesa (convenção
// já usada em todo o sistema — "manter exatamente como modelado, base
// plana na mesa"). É logo ali, perto da base, que a peça é mais larga —
// então é aí que sobra espaço pra apoiar o NFC antes do resto do corpo
// fechar por cima. A ferramenta varre alturas baixas e acha a primeira
// onde um círculo do tamanho do NFC cabe dentro do contorno da peça.
//
//   node achar-altura-pausa-nfc.js caminho/pro/arquivo.stl [diametro_nfc_mm]
//
// Corta a malha em fatias horizontais (interseção triângulo × plano Z —
// não exige malha "perfeita", só geometria, por isso funciona mesmo em
// malha que o manifold-3d recusaria).
const fs = require('fs');
const { lerSTL } = require('./gerar3mf');

const DIAMETRO_NFC = parseFloat(process.argv[3] || '25');
const MARGEM_MINIMA = 2; // mm de folga ao redor do NFC, pra não ficar espremido na borda da peça
const ALTURA_MAX_BUSCA = 15; // não faz sentido pausar muito alto — perde resistência embaixo
const PASSO = 0.4;

// Pontos onde o plano Z corta as arestas de um triângulo — 0 pontos (não
// cruza), 2 pontos (corta em segmento) ou raramente 1 (toca só um vértice,
// ignorado, não muda o resultado).
function interseccaoTrianguloComZ(v0, v1, v2, z) {
  const pontos = [];
  const arestas = [[v0, v1], [v1, v2], [v2, v0]];
  for (const [a, b] of arestas) {
    const za = a[2], zb = b[2];
    if ((za <= z && zb > z) || (zb <= z && za > z)) {
      const t = (z - za) / (zb - za);
      pontos.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return pontos;
}

function fatiaEmZ(vertices, triangulos, z) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, n = 0;
  for (const [i0, i1, i2] of triangulos) {
    const pontos = interseccaoTrianguloComZ(vertices[i0], vertices[i1], vertices[i2], z);
    for (const [x, y] of pontos) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      n++;
    }
  }
  if (n === 0) return null;
  return { minX, maxX, minY, maxY, largura: maxX - minX, profundidade: maxY - minY, centroX: (minX + maxX) / 2, centroY: (minY + maxY) / 2 };
}

function main() {
  const arquivo = process.argv[2];
  if (!arquivo) { console.error('Uso: node achar-altura-pausa-nfc.js caminho/pro/arquivo.stl [diametro_nfc_mm]'); process.exit(1); }

  const buf = fs.readFileSync(arquivo);
  const { vertices, triangulos } = lerSTL(buf);
  console.log('Malha: ' + vertices.length + ' vértices, ' + triangulos.length + ' triângulos');
  console.log('Procurando altura com espaço pra um NFC de ' + DIAMETRO_NFC + 'mm de diâmetro (+ ' + MARGEM_MINIMA + 'mm de folga)...\n');

  const precisaCaber = DIAMETRO_NFC + MARGEM_MINIMA * 2;
  let melhor = null;
  for (let z = PASSO; z <= ALTURA_MAX_BUSCA; z += PASSO) {
    const fatia = fatiaEmZ(vertices, triangulos, z);
    if (!fatia) continue;
    const cabe = fatia.largura >= precisaCaber && fatia.profundidade >= precisaCaber;
    if (cabe) { melhor = { z, ...fatia }; break; } // primeira altura (mais baixa) que já serve
  }

  if (!melhor) {
    console.log('❌ Não achei nenhuma altura até ' + ALTURA_MAX_BUSCA + 'mm onde o NFC caiba sozinho. ' +
      'A peça pode ser estreita demais nessa região, ou o NFC pode não caber deitado — precisa olhar a peça na mão.');
    process.exit(1);
  }

  console.log('✅ Pausar em Z = ' + melhor.z.toFixed(1) + 'mm');
  console.log('Nessa altura a peça mede ' + melhor.largura.toFixed(1) + ' x ' + melhor.profundidade.toFixed(1) + 'mm — cabe o NFC de ' + DIAMETRO_NFC + 'mm com folga.');
  console.log('Centro sugerido pra apoiar o NFC: X=' + melhor.centroX.toFixed(1) + 'mm, Y=' + melhor.centroY.toFixed(1) + 'mm (coordenada da peça antes de ir pra mesa — confira contra a posição real no Bambu Studio).');
  console.log('\nComo usar no Bambu Studio: clica com o botão direito na peça, na linha do tempo/timeline, e adiciona uma pausa (\"Add pause\") na altura acima. Quando a impressora parar, encosta o NFC no centro sugerido e manda continuar.');
}

main();
