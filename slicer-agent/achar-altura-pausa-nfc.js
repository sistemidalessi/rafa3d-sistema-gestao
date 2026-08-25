// Acha a altura (Z) certa pra pausar a impressão e encaixar o NFC, e o
// ponto onde ele realmente cabe.
//
// Corta a malha em fatias horizontais (interseção triângulo × plano Z —
// não exige malha "perfeita", só geometria, por isso funciona mesmo em
// malha que o manifold-3d recusaria).
//
//   node achar-altura-pausa-nfc.js caminho/pro/arquivo.stl [diametro_nfc_mm]
//
// ---------------------------------------------------------------------
// A primeira versão errava em duas coisas, e as duas davam uma resposta
// confiante e errada:
//
// 1. Devolvia a PRIMEIRA altura que servia. Como a peça é mais larga
//    embaixo, isso era sempre a primeira camada — o chip ficaria colado
//    na mesa, exposto no fundo da peça. Agora existe um piso mínimo.
//
// 2. Comparava o NFC com a CAIXA da fatia (largura × profundidade). Mas
//    a cereja em corte são duas bolinhas com um vão no meio: a caixa
//    pode ter 72mm sem existir 25mm de material contínuo em canto
//    nenhum. Agora ele mede o maior círculo que cabe DENTRO do
//    material, que é a pergunta de verdade.
// ---------------------------------------------------------------------
const fs = require('fs');
const { lerSTL } = require('./gerar3mf');

const DIAMETRO_NFC = parseFloat(process.argv[3] || '25');
const MARGEM_MINIMA = 2;    // mm de folga entre o NFC e a borda da peça
const PISO_MINIMO = 1.2;    // 3 camadas de 0.4 embaixo do chip, pra ele não ficar à mostra
const TETO_MINIMO = 1.2;    // material suficiente por cima pra fechar
const ALTURA_MAX_BUSCA = 15;
const PASSO = 0.4;          // altura de camada
const CELULA = 0.5;         // resolução da grade que mede o espaço interno

/* ====== FATIAR ====== */

// Segmentos onde o plano Z corta a malha. Cada triângulo atravessado
// devolve um segmento; juntos eles formam o contorno da fatia.
function segmentosEmZ(vertices, triangulos, z) {
  const segs = [];
  for (const [i0, i1, i2] of triangulos) {
    const v = [vertices[i0], vertices[i1], vertices[i2]];
    const pontos = [];
    for (let k = 0; k < 3; k++) {
      const a = v[k], b = v[(k + 1) % 3];
      const za = a[2], zb = b[2];
      if ((za <= z && zb > z) || (zb <= z && za > z)) {
        const t = (z - za) / (zb - za);
        pontos.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      }
    }
    if (pontos.length === 2) segs.push([pontos[0][0], pontos[0][1], pontos[1][0], pontos[1][1]]);
  }
  return segs;
}

/* ====== MEDIR O ESPAÇO DE DENTRO ====== */

// Pinta a fatia numa grade (dentro/fora) varrendo linha por linha: pra
// cada linha horizontal, acha onde ela cruza o contorno, ordena, e
// preenche entre os pares. É muito mais rápido que testar ponto a ponto,
// e é o que deixa a busca varrer 30 alturas em segundos.
function pintarFatia(segs, caixa, cel) {
  const cols = Math.max(1, Math.ceil((caixa.maxX - caixa.minX) / cel));
  const rows = Math.max(1, Math.ceil((caixa.maxY - caixa.minY) / cel));
  const dentro = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    const y = caixa.minY + (r + 0.5) * cel;
    const cruzas = [];
    for (const [x1, y1, x2, y2] of segs) {
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        cruzas.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    if (cruzas.length < 2) continue;
    cruzas.sort((a, b) => a - b);
    // Par a par: o que está entre o 1º e o 2º cruzamento é material, o
    // que está entre o 2º e o 3º é buraco, e assim por diante.
    for (let i = 0; i + 1 < cruzas.length; i += 2) {
      const cIni = Math.max(0, Math.ceil((cruzas[i] - caixa.minX) / cel - 0.5));
      const cFim = Math.min(cols - 1, Math.floor((cruzas[i + 1] - caixa.minX) / cel - 0.5));
      for (let c = cIni; c <= cFim; c++) dentro[r * cols + c] = 1;
    }
  }
  return { dentro, cols, rows };
}

// Pra cada célula de dentro, a distância até a borda mais próxima —
// calculada em duas varreduras sobre a grade (chamfer), em vez de medir
// contra cada segmento. O maior valor é o raio do maior círculo que
// cabe, e onde ele está é onde o NFC deve ser apoiado.
function maiorCirculoQueCabe(mapa, caixa, cel) {
  const { dentro, cols, rows } = mapa;
  const D = new Float32Array(cols * rows);
  const GRANDE = 1e9;
  const d1 = 1, d2 = Math.SQRT2;

  for (let i = 0; i < D.length; i++) D[i] = dentro[i] ? GRANDE : 0;

  const vizinho = (i, j, base, peso) => {
    const v = D[base] + peso;
    if (v < D[i * cols + j]) D[i * cols + j] = v;
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!dentro[r * cols + c]) continue;
      if (r > 0) vizinho(r, c, (r - 1) * cols + c, d1);
      if (c > 0) vizinho(r, c, r * cols + (c - 1), d1);
      if (r > 0 && c > 0) vizinho(r, c, (r - 1) * cols + (c - 1), d2);
      if (r > 0 && c < cols - 1) vizinho(r, c, (r - 1) * cols + (c + 1), d2);
    }
  }
  let melhor = { raio: 0, x: 0, y: 0 };
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = cols - 1; c >= 0; c--) {
      if (!dentro[r * cols + c]) continue;
      if (r < rows - 1) vizinho(r, c, (r + 1) * cols + c, d1);
      if (c < cols - 1) vizinho(r, c, r * cols + (c + 1), d1);
      if (r < rows - 1 && c < cols - 1) vizinho(r, c, (r + 1) * cols + (c + 1), d2);
      if (r < rows - 1 && c > 0) vizinho(r, c, (r + 1) * cols + (c - 1), d2);
      const raio = D[r * cols + c] * cel;
      if (raio > melhor.raio) {
        melhor = { raio, x: caixa.minX + (c + 0.5) * cel, y: caixa.minY + (r + 0.5) * cel };
      }
    }
  }
  return melhor;
}

/* ====== BUSCA ====== */

function main() {
  const arquivo = process.argv[2];
  if (!arquivo) {
    console.error('Uso: node achar-altura-pausa-nfc.js caminho/pro/arquivo.stl [diametro_nfc_mm]');
    process.exit(1);
  }

  const { vertices, triangulos } = lerSTL(fs.readFileSync(arquivo));
  const caixa = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const v of vertices) {
    if (v[0] < caixa.minX) caixa.minX = v[0]; if (v[0] > caixa.maxX) caixa.maxX = v[0];
    if (v[1] < caixa.minY) caixa.minY = v[1]; if (v[1] > caixa.maxY) caixa.maxY = v[1];
    if (v[2] < caixa.minZ) caixa.minZ = v[2]; if (v[2] > caixa.maxZ) caixa.maxZ = v[2];
  }
  const altura = caixa.maxZ - caixa.minZ;
  const precisaRaio = DIAMETRO_NFC / 2 + MARGEM_MINIMA;

  console.log('Peça: ' + (caixa.maxX - caixa.minX).toFixed(1) + ' x ' + (caixa.maxY - caixa.minY).toFixed(1) + ' x ' + altura.toFixed(1) + ' mm');
  console.log('NFC de ' + DIAMETRO_NFC + 'mm + ' + MARGEM_MINIMA + 'mm de folga = precisa de um círculo de ' + (precisaRaio * 2).toFixed(1) + 'mm de material contínuo.');
  console.log('Piso mínimo embaixo do chip: ' + PISO_MINIMO + 'mm. Teto mínimo por cima: ' + TETO_MINIMO + 'mm.\n');

  const limiteAlto = Math.min(ALTURA_MAX_BUSCA, altura - TETO_MINIMO);
  let escolhido = null;
  let melhorGeral = { raio: 0 };

  for (let z = caixa.minZ + PISO_MINIMO; z <= caixa.minZ + limiteAlto; z += PASSO) {
    const segs = segmentosEmZ(vertices, triangulos, z);
    if (segs.length < 3) continue;
    const mapa = pintarFatia(segs, caixa, CELULA);
    const circ = maiorCirculoQueCabe(mapa, caixa, CELULA);
    const zRel = z - caixa.minZ;
    if (circ.raio > melhorGeral.raio) melhorGeral = { ...circ, z: zRel };
    if (!escolhido && circ.raio >= precisaRaio) escolhido = { ...circ, z: zRel };
  }

  if (!escolhido) {
    console.log('❌ Não achei altura nenhuma onde um NFC de ' + DIAMETRO_NFC + 'mm caiba dentro do material.');
    if (melhorGeral.raio > 0) {
      console.log('   O maior círculo que cabe em qualquer altura tem ' + (melhorGeral.raio * 2).toFixed(1) + 'mm '
        + '(em Z = ' + melhorGeral.z.toFixed(1) + 'mm).');
      const cabeSemFolga = melhorGeral.raio * 2;
      console.log('   Ou seja: só caberia um NFC de até ' + (cabeSemFolga - MARGEM_MINIMA * 2).toFixed(0) + 'mm com a folga de sempre,');
      console.log('   ou até ' + cabeSemFolga.toFixed(0) + 'mm espremido na borda (não recomendo).');
      console.log('\n   Saídas: usar um NFC menor, ou aumentar a peça.');
    }
    process.exit(1);
  }

  console.log('✅ Pausar em Z = ' + escolhido.z.toFixed(1) + 'mm');
  console.log('   Nessa altura cabe um círculo de ' + (escolhido.raio * 2).toFixed(1) + 'mm de material contínuo.');
  console.log('   Apoiar o NFC centrado em X=' + escolhido.x.toFixed(1) + 'mm, Y=' + escolhido.y.toFixed(1) + 'mm');
  console.log('   (coordenada da peça; confira contra a posição real no Bambu Studio).');
  if (melhorGeral.raio > escolhido.raio + 0.5) {
    console.log('\n   Se quiser mais folga: a altura mais generosa é Z = ' + melhorGeral.z.toFixed(1)
      + 'mm, onde cabe ' + (melhorGeral.raio * 2).toFixed(1) + 'mm.');
  }

  console.log('\n⚠️  O chip tem espessura, e a peça não tem bolso.');
  console.log('   Se você só pausar e apoiar o NFC, o bico bate nele na camada seguinte.');
  console.log('   Antes de fatiar, abra um bolso pelo próprio Bambu Studio:');
  console.log('   botão direito na peça → Add negative part → Cylinder,');
  console.log('   diâmetro ' + (DIAMETRO_NFC + 1) + 'mm, altura ~1mm, posicionado no ponto acima,');
  console.log('   com o topo do cilindro na altura da pausa.');
  console.log('   Isso abre o rebaixo sem tocar na malha — que é justamente o');
  console.log('   que não deu certo tentando cortar o modelo.');
  console.log('\n   Depois: botão direito na barra de camadas → "Add pause" em Z = ' + escolhido.z.toFixed(1) + 'mm.');
}

main();
