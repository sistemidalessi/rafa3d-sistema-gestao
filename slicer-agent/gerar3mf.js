// Converte um .stl puro (o que a Meshy gera) num .3mf já configurado —
// impressora, filamento e os ajustes que a colinha da IA recomendou —
// pra abrir no Bambu Studio sem escolher nada na mão.
//
// Formato .3mf: é só um .zip (OPC package) com uns XML dentro. A parte
// arriscada aqui é a malha (vertices/triangles) e a escala/posição do
// objeto — a Meshy não exporta em milímetro de verdade, então tem uma
// heurística de escala. TODO PRIMEIRO USO REAL PRECISA SER CONFERIDO
// VISUALMENTE no Bambu Studio antes de fatiar — ver README/CLAUDE.md.
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { montarZip } = require('./zip3mf');

const TEMPLATE_SETTINGS = JSON.parse(fs.readFileSync(path.join(__dirname, 'template-3mf', 'project_settings.config'), 'utf8'));

// O Bambu so le as configuracoes de dentro do arquivo quando reconhece
// que ele veio de um Bambu Studio. Com outro nome aqui, ele importa so a
// malha e mantem o perfil que estava na tela.
const VERSAO_BAMBU = TEMPLATE_SETTINGS.version || '02.01.00.59';

// ---- STL: binário ou ASCII, detecta e lê os dois -------------------
function lerSTL(buf) {
  const pareceAscii = buf.length >= 5 && buf.slice(0, 5).toString('ascii').toLowerCase() === 'solid';
  if (pareceAscii) {
    // Pode ser binário que por acaso começa com "solid " (raro, mas existe) —
    // confere pelo tamanho batendo com o formato binário antes de decidir.
    if (buf.length >= 84) {
      const qtd = buf.readUInt32LE(80);
      const tamanhoEsperado = 84 + qtd * 50;
      if (buf.length !== tamanhoEsperado) return lerSTLAscii(buf.toString('utf8'));
    } else {
      return lerSTLAscii(buf.toString('utf8'));
    }
  }
  return lerSTLBinario(buf);
}

function lerSTLBinario(buf) {
  const qtd = buf.readUInt32LE(80);
  const vertices = [];
  const triangulos = [];
  let offset = 84;
  for (let t = 0; t < qtd; t++) {
    offset += 12; // normal do triângulo — não precisamos, o Bambu Studio recalcula
    const i0 = vertices.length;
    for (let v = 0; v < 3; v++) {
      const x = buf.readFloatLE(offset);
      const y = buf.readFloatLE(offset + 4);
      const z = buf.readFloatLE(offset + 8);
      vertices.push([x, y, z]);
      offset += 12;
    }
    triangulos.push([i0, i0 + 1, i0 + 2]);
    offset += 2; // attribute byte count
  }
  return { vertices, triangulos };
}

function lerSTLAscii(texto) {
  const vertices = [];
  const triangulos = [];
  const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
  let m;
  let atual = [];
  while ((m = re.exec(texto))) {
    atual.push([parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]);
    if (atual.length === 3) {
      const i0 = vertices.length;
      vertices.push(atual[0], atual[1], atual[2]);
      triangulos.push([i0, i0 + 1, i0 + 2]);
      atual = [];
    }
  }
  return { vertices, triangulos };
}

function calcularBBox(vertices) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const [x, y, z] of vertices) {
    if (x < min[0]) min[0] = x; if (x > max[0]) max[0] = x;
    if (y < min[1]) min[1] = y; if (y > max[1]) max[1] = y;
    if (z < min[2]) min[2] = z; if (z > max[2]) max[2] = z;
  }
  return { min, max, tamanho: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
}

// Mesa da Bambu Lab A1 — usada pra centralizar a peça e pra avisar
// quando ela não cabe.
const MESA_MM = 256;
const ALVO_MM = 80;

// A Meshy não exporta em milímetro: o número que vem no arquivo é
// unidade dela, e varia muito de um modelo pro outro (já vieram 1905
// unidades num caso real, e vir 2,5 é igualmente possível). Por isso a
// origem do arquivo decide, e não o tamanho:
//
//   meshy_generated → sempre normaliza pro alvo. Qualquer valor que
//                     "pareça milímetro" ali é coincidência.
//   qualquer outra  → não mexe. Quem modelou à mão já pôs na medida
//                     certa, e reescalar destruiria a intenção.
//
// A versão antiga adivinhava pelo tamanho ("entre 2 e 350 já deve estar
// em mm") e errava nas duas pontas: um modelo da Meshy com 2,5 unidades
// ia pra mesa com 2,5 mm (grão de arroz), e um com 300 passava batido
// sem caber na mesa.
function escalaSegura(bbox, origem) {
  if (origem !== 'meshy_generated') return 1;
  const maior = Math.max(...bbox.tamanho);
  if (!maior || !isFinite(maior)) return 1;
  return ALVO_MM / maior;
}

function gerarMeshXML(vertices, triangulos) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" ' +
    'xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" ' +
    'xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p">\n' +
    ' <metadata name="BambuStudio:3mfVersion">1</metadata>\n' +
    ' <resources>\n' +
    '  <object id="1" p:UUID="00010000-0000-4000-8000-000000000001" type="model">\n' +
    '   <mesh>\n    <vertices>\n';
  for (const v of vertices) xml += '     <vertex x="' + v[0] + '" y="' + v[1] + '" z="' + v[2] + '"/>\n';
  xml += '    </vertices>\n    <triangles>\n';
  for (const t of triangulos) xml += '     <triangle v1="' + t[0] + '" v2="' + t[1] + '" v3="' + t[2] + '"/>\n';
  xml += '    </triangles>\n   </mesh>\n  </object>\n </resources>\n <build/>\n</model>\n';
  return xml;
}

function gerarManifestoXML(escala, translacao) {
  const t = [
    escala, 0, 0,
    0, escala, 0,
    0, 0, escala,
    translacao[0], translacao[1], translacao[2],
  ].join(' ');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" ' +
    'xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" ' +
    'xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p">\n' +
    ' <metadata name="Application">BambuStudio-' + VERSAO_BAMBU + '</metadata>\n' +
    ' <metadata name="Designer">Rafa 3D Dalessi</metadata>\n' +
    ' <metadata name="BambuStudio:3mfVersion">1</metadata>\n' +
    ' <resources>\n' +
    '  <object id="2" p:UUID="00000001-0000-4000-8000-000000000002" type="model">\n' +
    '   <components>\n' +
    '    <component p:path="/3D/Objects/object_1.model" objectid="1" p:UUID="00010000-0000-4000-8000-000000000003" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>\n' +
    '   </components>\n' +
    '  </object>\n' +
    ' </resources>\n' +
    ' <build p:UUID="2c7c17d8-0000-4000-8000-000000000004">\n' +
    '  <item objectid="2" p:UUID="00000002-0000-4000-8000-000000000005" transform="' + t + '" printable="1"/>\n' +
    ' </build>\n' +
    '</model>\n';
}

function gerarModelSettingsXML(nomeObjeto) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<config>\n' +
    '  <object id="2">\n' +
    '    <metadata key="name" value="' + escapeXml(nomeObjeto) + '"/>\n' +
    '    <metadata key="extruder" value="1"/>\n' +
    '    <part id="1" subtype="normal_part">\n' +
    '      <metadata key="name" value="' + escapeXml(nomeObjeto) + '"/>\n' +
    '      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>\n' +
    '      <metadata key="source_file" value="' + escapeXml(nomeObjeto) + '"/>\n' +
    '    </part>\n' +
    '  </object>\n' +
    '  <plate>\n' +
    '    <metadata key="plater_id" value="1"/>\n' +
    '    <metadata key="plater_name" value=""/>\n' +
    '    <metadata key="locked" value="false"/>\n' +
    '    <model_instance>\n' +
    '      <metadata key="object_id" value="2"/>\n' +
    '      <metadata key="instance_id" value="0"/>\n' +
    '    </model_instance>\n' +
    '  </plate>\n' +
    '</config>\n';
}

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ajustes: o JSON estruturado que a colinha devolveu (ver PROMPT_ANALISE
// em agent.js) — só sobrescreve as chaves que vieram, o resto do
// template (impressora Bambu Lab A1 + PLA já testados) fica intacto.
// Os campos de lista do Bambu Studio só aceitam palavras exatas dele. A
// colinha escreve em linguagem de gente ("normal", "árvore"), e gravar
// isso cru quebra TUDO: o Bambu recusa o arquivo inteiro e cai pra
// importar só a geometria, perdendo junto os ajustes que estavam certos.
//
// Por isso a tradução é por lista fechada. Valor que não estiver aqui é
// ignorado, e o template prevalece naquele campo.
const LISTAS_DO_BAMBU = {
  support_type: {
    normal: 'normal(auto)', 'normal(auto)': 'normal(auto)',
    tree: 'tree(auto)', 'tree(auto)': 'tree(auto)', arvore: 'tree(auto)', 'árvore': 'tree(auto)',
  },
  // Os nomes mudaram de versão: o que o formato antigo chamava de
  // 'outer_brim_only' hoje é 'outer_only' (e 'inner_brim_only' virou
  // 'inner_only'). Mandar o nome velho faz o Bambu trocar por auto_brim
  // sozinho e avisar numa janela. A lista abaixo saiu da tabela de
  // valores de dentro do BambuStudio.dll:
  //   no_brim | outer_only | inner_only | outer_and_inner | auto_brim | brim_ears
  brim_type: {
    auto_brim: 'auto_brim', automatico: 'auto_brim', 'automático': 'auto_brim',
    outer_brim_only: 'outer_only', outer_only: 'outer_only', externo: 'outer_only',
    inner_brim_only: 'inner_only', inner_only: 'inner_only', interno: 'inner_only',
    outer_and_inner: 'outer_and_inner', ambos: 'outer_and_inner',
    brim_ears: 'brim_ears', orelhas: 'brim_ears',
    no_brim: 'no_brim', nenhum: 'no_brim', sem: 'no_brim',
  },
  sparse_infill_pattern: {
    grid: 'grid', grade: 'grid', gyroid: 'gyroid', giroide: 'gyroid', 'giróide': 'gyroid',
    crosshatch: 'crosshatch', cubic: 'cubic', cubico: 'cubic', 'cúbico': 'cubic',
    'zig-zag': 'zig-zag', zigzag: 'zig-zag', line: 'line', linha: 'line',
    concentric: 'concentric', concentrico: 'concentric', 'concêntrico': 'concentric',
    honeycomb: 'honeycomb', colmeia: 'honeycomb', triangles: 'triangles',
    'tri-hexagon': 'tri-hexagon', adaptivecubic: 'adaptivecubic', lightning: 'lightning',
    supportcubic: 'supportcubic', monotonic: 'monotonic',
  },
  // "no ironing" é o padrão (desligado). Os outros três passam o bico de
  // novo por cima quase sem extrudar, pra alisar — mais lento, só vale a
  // pena quando aquela superfície realmente vai ficar à mostra.
  ironing_type: {
    'no ironing': 'no ironing', nenhum: 'no ironing', desligado: 'no ironing', sem: 'no ironing',
    top: 'top', topo: 'top',
    topmost: 'topmost',
    solid: 'solid', solido: 'solid', 'sólido': 'solid',
  },
};

// Em qual das três listas de "mexi neste aqui" cada campo entra. O Bambu
// guarda isso separado por categoria: processo, filamento e impressora.
const CATEGORIA = {
  layer_height: 0, wall_loops: 0, sparse_infill_density: 0, sparse_infill_pattern: 0,
  enable_support: 0, support_type: 0, support_threshold_angle: 0, brim_type: 0, brim_width: 0,
  ironing_type: 0,
  nozzle_temperature: 1, nozzle_temperature_initial_layer: 1,
  // Cada placa tem o seu campo de temperatura, e o Bambu só lê o da
  // placa que está selecionada em curr_bed_type. Todos entram na lista
  // porque a peça pode ir em qualquer uma.
  cool_plate_temp: 1, cool_plate_temp_initial_layer: 1,
  textured_plate_temp: 1, textured_plate_temp_initial_layer: 1,
  eng_plate_temp: 1, eng_plate_temp_initial_layer: 1,
  hot_plate_temp: 1, hot_plate_temp_initial_layer: 1,
  filament_type: 1, filament_settings_id: 1, filament_vendor: 1,
  curr_bed_type: 2,
};

// As placas da loja. O "campo" é onde a temperatura tem que ser
// gravada; o "bambu" é o nome que vai em curr_bed_type.
//
// Gravar no campo errado não dá erro nenhum: o Bambu simplesmente lê o
// da placa selecionada e ignora o resto. Foi o que aconteceu até
// 25/08/2026 — a colinha mandava 55°C, o sistema gravava em
// hot_plate_temp, e o perfil estava em Cool Plate lendo 35°C.
const PLACAS = {
  cool: { bambu: 'Cool Plate', campo: 'cool_plate_temp', nome: 'placa fria' },
  textured: { bambu: 'Textured PEI Plate', campo: 'textured_plate_temp', nome: 'placa texturizada' },
  engineering: { bambu: 'Engineering Plate', campo: 'eng_plate_temp', nome: 'placa de engenharia' },
  high_temp: { bambu: 'High Temp Plate', campo: 'hot_plate_temp', nome: 'placa de alta temperatura' },
};

// Material -> o que gravar no arquivo.
//
// "perfil" é o nome do perfil de filamento do Bambu, e ele tem que
// existir na instalação: nome errado aqui faz o fatiador reclamar ou
// cair pro padrão. Os nomes abaixo foram conferidos na pasta
// resources\profiles\BBL\filament da instalação (25/08/2026).
//
// PLA fica no perfil da Bambu porque é o que o template já usava e
// funciona. Os outros usam "Generic", que é o honesto: o filamento da
// loja não é necessariamente da Bambu.
//
// Se um dia o Bambu renomear os perfis, é aqui que conserta — e o
// sintoma vai ser o fatiador avisando que não achou o filamento.
const MATERIAIS = {
  pla:  { tipo: 'PLA',  perfil: 'Bambu PLA Basic @BBL A1', fabricante: 'Bambu Lab' },
  petg: { tipo: 'PETG', perfil: 'Generic PETG @BBL A1',    fabricante: 'Generic' },
  tpu:  { tipo: 'TPU',  perfil: 'Generic TPU @BBL A1',     fabricante: 'Generic' },
  abs:  { tipo: 'ABS',  perfil: 'Generic ABS @BBL A1',     fabricante: 'Generic' },
};

function traduzirParaOBambu(campo, valor) {
  const lista = LISTAS_DO_BAMBU[campo];
  if (!lista) return valor;
  return lista[String(valor).trim().toLowerCase()] || null;
}

// settingsBase: de onde parte a configuração — o template padrão (peça
// única) ou a config que o Hi3D já mandou (peça dividida, ver
// reconfigurarHi3d3mf) preservando as cores por parte que ele escolheu.
function aplicarAjustesColinha(ajustes, settingsBase) {
  const settings = { ...(settingsBase || TEMPLATE_SETTINGS) };
  if (!ajustes) return settings;

  // Quantos filamentos essa peça tem (1 numa peça única, N numa dividida
  // por cor) — a temperatura da colinha vale pro material, não pra cor,
  // então repete o mesmo valor pra cada slot em vez de sempre gravar um
  // array de 1 posição só.
  const numFilamentos = Array.isArray(settings.filament_settings_id) ? settings.filament_settings_id.length : 1;

  // Guarda tudo que a colinha mexeu. Sem essa lista o Bambu carrega o
  // perfil nomeado em print_settings_id e IGNORA os valores do arquivo:
  // pra ele, campo que não está aqui é campo que continua igual ao
  // perfil. Foi exatamente o que aconteceu no primeiro teste que abriu
  // limpo — só a altura da camada "bateu", e mesmo assim por acaso,
  // porque o template já usava 0.2.
  const mexidos = [];
  const gravar = (campo, valor) => { settings[campo] = valor; mexidos.push(campo); };
  const escolha = (campo, valor) => {
    const traduzido = traduzirParaOBambu(campo, valor);
    if (traduzido !== null) gravar(campo, traduzido);
  };

  // A placa é resolvida ANTES do laço, e não como mais um campo dentro
  // dele: é ela que decide em qual campo a temperatura vai ser gravada,
  // e depender da ordem das chaves do JSON seria pedir pra quebrar no
  // dia em que a IA devolvesse bed_temp_c antes de bed_plate.
  //
  // Sem placa informada, mantém a que já está no perfil — melhor do que
  // escolher uma e escrever a temperatura num campo que o Bambu não lê.
  // ATENÇÃO: gravar curr_bed_type NÃO troca a placa no Bambu Studio.
  // Testado em 25/08/2026, abrindo o aplicativo do zero: ele continua na
  // placa que estava. A escolha da placa é preferência do APLICATIVO
  // (fica em BambuStudio.conf como "curr_bed_type": "1", um número), não
  // do arquivo.
  //
  // O campo continua sendo gravado porque descreve pra que placa a peça
  // foi pensada, e o Bambu avisa sozinho quando a placa selecionada não
  // combina com o filamento. Mas quem troca a placa é a pessoa, na tela
  // do fatiador — por isso o sistema avisa qual escolher ao abrir.
  let placa = PLACAS[String(ajustes.bed_plate || '').trim().toLowerCase()];
  if (placa) {
    gravar('curr_bed_type', placa.bambu);
  } else {
    const atual = settings.curr_bed_type;
    placa = Object.values(PLACAS).find((p) => p.bambu === atual) || PLACAS.cool;
  }

  // O material troca o perfil de filamento inteiro. Sem isso o arquivo
  // abria dizendo "Bambu PLA Basic" com temperatura de PETG — e ao
  // corrigir o filamento na mão o fatiador reescrevia as temperaturas,
  // jogando fora a colinha.
  const material = MATERIAIS[String(ajustes.material || '').trim().toLowerCase()];
  if (material) {
    gravar('filament_type', Array(numFilamentos).fill(material.tipo));
    gravar('filament_settings_id', Array(numFilamentos).fill(material.perfil));
    gravar('filament_vendor', Array(numFilamentos).fill(material.fabricante));
  }

  const mapa = {
    layer_height_mm: (v) => gravar('layer_height', String(v)),
    wall_loops: (v) => gravar('wall_loops', String(v)),
    infill_density_pct: (v) => gravar('sparse_infill_density', v + '%'),
    infill_pattern: (v) => escolha('sparse_infill_pattern', v),
    support_enable: (v) => gravar('enable_support', v ? '1' : '0'),
    support_type: (v) => escolha('support_type', v),
    support_threshold_angle: (v) => gravar('support_threshold_angle', String(v)),
    brim_type: (v) => escolha('brim_type', v),
    brim_width_mm: (v) => gravar('brim_width', String(v)),
    ironing_type: (v) => escolha('ironing_type', v),
    nozzle_temp_c: (v) => {
      gravar('nozzle_temperature', Array(numFilamentos).fill(String(v)));
      gravar('nozzle_temperature_initial_layer', Array(numFilamentos).fill(String(v)));
    },
    // bed_plate não entra aqui: já foi resolvida antes do laço.
    bed_temp_c: (v) => {
      gravar(placa.campo, Array(numFilamentos).fill(String(v)));
      gravar(placa.campo + '_initial_layer', Array(numFilamentos).fill(String(v)));
    },
  };

  for (const chave of Object.keys(ajustes)) {
    if (mapa[chave] && ajustes[chave] !== null && ajustes[chave] !== undefined) {
      try { mapa[chave](ajustes[chave]); } catch (e) { /* ignora um campo ruim, não derruba o resto */ }
    }
  }

  // Junta o que já vinha marcado no template com o que a colinha mexeu.
  //
  // O vetor NEM SEMPRE tem três posições. Isso só é verdade pro arquivo
  // gerado do zero (um filamento só). Peça dividida por cor no Hi3D tem
  // um slot de filamento PRA CADA cor — 4 cores vira vetor de 6 posições
  // (processo, filamento 1, 2, 3, 4, impressora), e a impressora deixa
  // de ser a posição 2 pra virar a última. Escrever com índice fixo
  // marcava só o filamento 1 como "mexido" (as cores 2-4 voltavam pro
  // perfil, mesmo com o valor certo já gravado nelas) e gravava
  // curr_bed_type na posição do filamento 2 em vez da impressora — os
  // dois em silêncio, sem erro nenhum, o Bambu só ignorava. Achado com
  // o Chaveiro do Pikachu (4 cores): abriu limpo, colinha nenhuma valeu.
  const listas = (settings.different_settings_to_system || ['', '', '']).slice();
  const indiceProcesso = 0;
  const indiceImpressora = listas.length - 1;
  const indicesFilamento = [];
  for (let i = 1; i < listas.length - 1; i++) indicesFilamento.push(i);
  if (indicesFilamento.length === 0) indicesFilamento.push(Math.min(1, indiceImpressora));

  const marcar = (i, campo) => {
    const atuais = String(listas[i] || '').split(';').filter(Boolean);
    if (!atuais.includes(campo)) atuais.push(campo);
    listas[i] = atuais.join(';');
  };
  mexidos.forEach((campo) => {
    const categoria = CATEGORIA[campo];
    if (categoria === undefined) return;
    const indices = categoria === 0 ? [indiceProcesso] : categoria === 2 ? [indiceImpressora] : indicesFilamento;
    indices.forEach((i) => marcar(i, campo));
  });
  settings.different_settings_to_system = listas;

  return settings;
}

// stlBuffer: Buffer do .stl baixado. ajustes: objeto com as chaves acima
// (pode vir null — nesse caso usa só o template padrão, sem nada da
// colinha). nomeObjeto: nome pra aparecer dentro do Bambu Studio.
// Retorna um Buffer do .3mf pronto.
function gerarModelo3mfConfigurado(stlBuffer, ajustes, nomeObjeto, origem) {
  const { vertices, triangulos } = lerSTL(stlBuffer);
  if (!vertices.length || !triangulos.length) throw new Error('.stl não tem malha válida (0 vértices/triângulos).');

  const bbox = calcularBBox(vertices);
  const escala = escalaSegura(bbox, origem);
  // Centraliza no meio de uma mesa de 256x256 (Bambu Lab A1) e apoia no Z=0.
  const centroX = (bbox.min[0] + bbox.max[0]) / 2 * escala;
  const centroY = (bbox.min[1] + bbox.max[1]) / 2 * escala;
  const baseZ = bbox.min[2] * escala;
  const translacao = [MESA_MM / 2 - centroX, MESA_MM / 2 - centroY, -baseZ];

  const settings = aplicarAjustesColinha(ajustes);

  // A ORDEM AQUI IMPORTA: a norma do .3mf exige o [Content_Types].xml
  // como primeira parte do pacote, e o Bambu Studio recusa quando não é.
  // Por isso o zip é montado pelo zip3mf.js, e não pelo adm-zip — ele
  // reordenava as entradas na hora de gravar e jogava o _rels na frente.
  const buffer = montarZip([
    { nome: '[Content_Types].xml', conteudo:
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n' +
      ' <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n' +
      ' <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>\n' +
      ' <Default Extension="png" ContentType="image/png"/>\n' +
      '</Types>\n' },
    { nome: '3D/3dmodel.model', conteudo: gerarManifestoXML(escala, translacao) },
    { nome: '3D/_rels/3dmodel.model.rels', conteudo:
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
      ' <Relationship Target="/3D/Objects/object_1.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n' +
      '</Relationships>\n' },
    { nome: '3D/Objects/object_1.model', conteudo: gerarMeshXML(vertices, triangulos) },
    { nome: '_rels/.rels', conteudo:
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
      ' <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n' +
      '</Relationships>\n' },
    { nome: 'Metadata/model_settings.config', conteudo: gerarModelSettingsXML(nomeObjeto) },
    { nome: 'Metadata/project_settings.config', conteudo: JSON.stringify(settings, null, 4) },
    // O Bambu Studio espera este arquivo em todo projeto dele. Sem ele o
    // .3mf passa por modelo solto e as configurações são descartadas.
    { nome: 'Metadata/slice_info.config', conteudo:
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<config>\n' +
      '  <header>\n' +
      '    <header_item key="X-BBL-Client-Type" value="slicer"/>\n' +
      '    <header_item key="X-BBL-Client-Version" value="' + VERSAO_BAMBU + '"/>\n' +
      '  </header>\n' +
      '</config>\n' },
  ]);

  const tamanhoFinalMm = bbox.tamanho.map((t) => t * escala);
  return {
    buffer, escalaAplicada: escala, bbox, tamanhoFinalMm,
    cabeNaMesa: Math.max(tamanhoFinalMm[0], tamanhoFinalMm[1]) <= MESA_MM && tamanhoFinalMm[2] <= MESA_MM,
  };
}

// Reconfigura um .3mf que JÁ VEIO PRONTO — seja porque o Hi3D dividiu a
// peça em partes, seja porque alguém anexou um .3mf à mão (ex: baixado
// direto do workspace do Hi3D, sem passar pela geração automática) — não
// precisa (e não deve) recalcular malha, escala ou posição, o arquivo já
// traz isso certo em milímetro real. O problema é que o
// project_settings.config de dentro não é do nosso perfil validado (é do
// Hi3D, ou de qualquer outra origem), então ele ignora a colinha. Aqui só
// troca essa configuração pela nossa (impressora + filamento + ajustes da
// colinha), mantendo a malha e as cores exatamente como vieram — mesma
// ideia do gerarModelo3mfConfigurado, mas sem tocar em vértice nenhum.
function reconfigurarHi3d3mf(zipBuffer, ajustes) {
  const zip = new AdmZip(zipBuffer);
  const porNome = {};
  for (const entrada of zip.getEntries()) porNome[entrada.entryName] = entrada.getData();

  const contentTypes = porNome['[Content_Types].xml'];
  if (!contentTypes) throw new Error('.3mf do Hi3D veio sem [Content_Types].xml — formato inesperado.');
  const projectSettingsHi3d = porNome['Metadata/project_settings.config'];
  if (!projectSettingsHi3d) throw new Error('.3mf do Hi3D veio sem project_settings.config — formato inesperado.');

  // Achado em 28/08/2026 com um .3mf exportado do Layerpaint (peça
  // dividida por cor à mão, fora do Hi3D): o Bambu Studio abriu dizendo
  // "configuração inválida, carregar apenas os dados de geometria" —
  // a colinha inteira ia pro lixo, silenciosamente, mesmo com o
  // project_settings.config certinho. O motivo é a regra 2 do
  // CLAUDE.md ("por que é delicado"): o Bambu só lê a configuração
  // quando o 3D/3dmodel.model se declara com
  // <metadata name="Application">BambuStudio-...</metadata>. O Hi3D e o
  // Bambu Studio sempre escrevem essa tag; o Layerpaint não escreve
  // nada parecido (só a fingerprint dele) — por isso nunca tinha
  // aparecido antes. Se a tag já existir (Hi3D, projeto real do Bambu),
  // isto não mexe em nada.
  const modeloTop = porNome['3D/3dmodel.model'];
  if (modeloTop && !/<metadata\s+name="Application">/i.test(modeloTop.toString('utf8'))) {
    const xml = modeloTop.toString('utf8').replace(
      /(<model\b[^>]*>)/i,
      '$1\n <metadata name="Application">BambuStudio-' + VERSAO_BAMBU + '</metadata>'
    );
    porNome['3D/3dmodel.model'] = Buffer.from(xml, 'utf8');
  }

  // Parte da config que o PRÓPRIO Hi3D mandou, não do nosso template do
  // zero — ele já escolheu uma cor por parte (filament_colour) batendo
  // com quantas partes a peça tem. Só troca o que precisa: a impressora
  // pro perfil validado, e o material — o Hi3D rotula tudo como "Generic
  // PETG" (só serve de rótulo de cor pra ele), mas quem imprime é PLA, e
  // fatiar com perfil de PETG usa temperatura e resfriamento errados.
  const settingsBase = JSON.parse(projectSettingsHi3d.toString('utf8'));
  const numFilamentos = Array.isArray(settingsBase.filament_settings_id) ? settingsBase.filament_settings_id.length : 1;
  settingsBase.printer_settings_id = TEMPLATE_SETTINGS.printer_settings_id;
  settingsBase.filament_settings_id = Array(numFilamentos).fill(TEMPLATE_SETTINGS.filament_settings_id[0]);
  // Mesmo achado do Layerpaint: ele não escreve print_settings_id (só
  // mexe em filamento/cor), e sem esse campo o Bambu não tem qual
  // perfil de processo (altura de camada, parede etc.) carregar como
  // base. Só entra quando falta — Hi3D e projeto real do Bambu já
  // trazem um válido, e nesse caso mantém o que já tinha.
  if (!settingsBase.print_settings_id) settingsBase.print_settings_id = TEMPLATE_SETTINGS.print_settings_id;

  const settings = aplicarAjustesColinha(ajustes, settingsBase);

  // A ORDEM IMPORTA (ver comentário em gerarModelo3mfConfigurado): o
  // [Content_Types].xml tem que ser a primeira parte do pacote.
  const entradas = [{ nome: '[Content_Types].xml', conteudo: contentTypes }];
  for (const nome of Object.keys(porNome)) {
    if (nome === '[Content_Types].xml') continue;
    if (nome === 'Metadata/project_settings.config') continue; // trocada abaixo
    if (nome === 'Metadata/slice_info.config') continue; // recriada abaixo
    entradas.push({ nome, conteudo: porNome[nome] });
  }
  entradas.push({ nome: 'Metadata/project_settings.config', conteudo: JSON.stringify(settings, null, 4) });
  entradas.push({ nome: 'Metadata/slice_info.config', conteudo:
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<config>\n' +
    '  <header>\n' +
    '    <header_item key="X-BBL-Client-Type" value="slicer"/>\n' +
    '    <header_item key="X-BBL-Client-Version" value="' + VERSAO_BAMBU + '"/>\n' +
    '  </header>\n' +
    '</config>\n' });

  return montarZip(entradas);
}

module.exports = { gerarModelo3mfConfigurado, reconfigurarHi3d3mf, lerSTL, calcularBBox };
