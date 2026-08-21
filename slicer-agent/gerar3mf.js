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

const TEMPLATE_SETTINGS = JSON.parse(fs.readFileSync(path.join(__dirname, 'template-3mf', 'project_settings.config'), 'utf8'));

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

// Meshy não exporta em milímetro real — se o maior lado vier claramente
// fora do que cabe numa impressora de mesa, reescala pra um tamanho
// "peça pequena" razoável (8cm no maior lado). Se já vier num tamanho
// plausível, não mexe em nada.
function escalaSegura(bbox) {
  const maior = Math.max(...bbox.tamanho);
  if (maior >= 2 && maior <= 350) return 1;
  const ALVO_MM = 80;
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
    ' <metadata name="Application">Rafa3DSistemaGestao</metadata>\n' +
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
function aplicarAjustesColinha(ajustes) {
  const settings = { ...TEMPLATE_SETTINGS };
  if (!ajustes) return settings;
  const mapa = {
    layer_height_mm: (v) => { settings.layer_height = String(v); },
    wall_loops: (v) => { settings.wall_loops = String(v); },
    infill_density_pct: (v) => { settings.sparse_infill_density = v + '%'; },
    infill_pattern: (v) => { settings.sparse_infill_pattern = v; },
    support_enable: (v) => { settings.enable_support = v ? '1' : '0'; },
    support_type: (v) => { settings.support_type = v; },
    support_threshold_angle: (v) => { settings.support_threshold_angle = String(v); },
    brim_type: (v) => { settings.brim_type = v; },
    brim_width_mm: (v) => { settings.brim_width = String(v); },
    nozzle_temp_c: (v) => { settings.nozzle_temperature = [String(v)]; settings.nozzle_temperature_initial_layer = [String(v)]; },
    bed_temp_c: (v) => { settings.hot_plate_temp = [String(v)]; settings.hot_plate_temp_initial_layer = [String(v)]; },
  };
  for (const chave of Object.keys(ajustes)) {
    if (mapa[chave] && ajustes[chave] !== null && ajustes[chave] !== undefined) {
      try { mapa[chave](ajustes[chave]); } catch (e) { /* ignora um campo ruim, não derruba o resto */ }
    }
  }
  return settings;
}

// stlBuffer: Buffer do .stl baixado. ajustes: objeto com as chaves acima
// (pode vir null — nesse caso usa só o template padrão, sem nada da
// colinha). nomeObjeto: nome pra aparecer dentro do Bambu Studio.
// Retorna um Buffer do .3mf pronto.
function gerarModelo3mfConfigurado(stlBuffer, ajustes, nomeObjeto) {
  const { vertices, triangulos } = lerSTL(stlBuffer);
  if (!vertices.length || !triangulos.length) throw new Error('.stl não tem malha válida (0 vértices/triângulos).');

  const bbox = calcularBBox(vertices);
  const escala = escalaSegura(bbox);
  // Centraliza no meio de uma mesa de 256x256 (Bambu Lab A1) e apoia no Z=0.
  const centroX = (bbox.min[0] + bbox.max[0]) / 2 * escala;
  const centroY = (bbox.min[1] + bbox.max[1]) / 2 * escala;
  const baseZ = bbox.min[2] * escala;
  const translacao = [128 - centroX, 128 - centroY, -baseZ];

  const settings = aplicarAjustesColinha(ajustes);

  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml',
    Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n' +
      ' <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n' +
      ' <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>\n' +
      '</Types>\n'));
  zip.addFile('_rels/.rels',
    Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
      ' <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n' +
      '</Relationships>\n'));
  zip.addFile('3D/3dmodel.model', Buffer.from(gerarManifestoXML(escala, translacao)));
  zip.addFile('3D/_rels/3dmodel.model.rels',
    Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
      ' <Relationship Target="/3D/Objects/object_1.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n' +
      '</Relationships>\n'));
  zip.addFile('3D/Objects/object_1.model', Buffer.from(gerarMeshXML(vertices, triangulos)));
  zip.addFile('Metadata/model_settings.config', Buffer.from(gerarModelSettingsXML(nomeObjeto)));
  zip.addFile('Metadata/project_settings.config', Buffer.from(JSON.stringify(settings, null, 4)));

  return { buffer: zip.toBuffer(), escalaAplicada: escala, bbox };
}

module.exports = { gerarModelo3mfConfigurado, lerSTL, calcularBBox };
