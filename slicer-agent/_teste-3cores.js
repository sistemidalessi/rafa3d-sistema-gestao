// Gera um .3mf pequeno, sintético, com 3 objetos e 3 cores diferentes —
// só pra testar o Split3mf sem precisar transferir um arquivo grande.
const fs = require('fs');
const { montarZip } = require('./zip3mf');

function meshXML(objId, verts, tris) {
  let xml = '<mesh><vertices>';
  for (const v of verts) xml += '<vertex x="' + v[0] + '" y="' + v[1] + '" z="' + v[2] + '"/>';
  xml += '</vertices><triangles>';
  for (const t of tris) xml += '<triangle v1="' + t[0] + '" v2="' + t[1] + '" v3="' + t[2] + '"/>';
  xml += '</triangles></mesh>';
  return xml;
}

// Caixa simples (8 vértices, 12 triângulos), do tamanho e posição dados.
function caixa(cx, cy, cz, s) {
  const h = s / 2;
  const v = [
    [cx - h, cy - h, cz - h], [cx + h, cy - h, cz - h], [cx + h, cy + h, cz - h], [cx - h, cy + h, cz - h],
    [cx - h, cy - h, cz + h], [cx + h, cy - h, cz + h], [cx + h, cy + h, cz + h], [cx - h, cy + h, cz + h],
  ];
  const t = [
    [0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6],
    [0, 4, 5], [0, 5, 1], [1, 5, 6], [1, 6, 2],
    [2, 6, 7], [2, 7, 3], [3, 7, 4], [3, 4, 0],
  ];
  return { v, t };
}

const caixas = [caixa(-12, 0, 5, 10), caixa(0, 0, 5, 10), caixa(12, 0, 5, 10)];
const cores = ['#EE4B4B', '#4BEE6B', '#4B7DEE']; // vermelho, verde, azul

let objetos = '';
let rels = '';
let itens = '';
caixas.forEach((c, i) => {
  const objId = i + 1;
  const x = -30 + i * 30;
  objetos += '<object id="' + objId + '" type="model">' + meshXML(objId, c.v, c.t) + '</object>';
});

const manifest = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" ' +
  'xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" ' +
  'xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p">\n' +
  '<metadata name="Application">BambuStudio-02.01.00.59</metadata>\n' +
  '<resources>' + objetos + '</resources>\n' +
  '<build>' +
  caixas.map((c, i) => '<item objectid="' + (i + 1) + '" transform="1 0 0 0 1 0 0 0 1 128 128 0" printable="1"/>').join('') +
  '</build>\n</model>\n';

const modelSettings = '<?xml version="1.0" encoding="utf-8"?>\n<config>\n' +
  caixas.map((c, i) =>
    '<object id="' + (i + 1) + '"><metadata key="name" value="parte' + (i + 1) + '"/>' +
    '<part id="' + (i + 1) + '" subtype="normal_part"><metadata key="name" value="parte' + (i + 1) + '"/>' +
    '<metadata key="matrix" value="1 0 0 0 1 0 0 0 1 0 0 0"/>' +
    '<metadata key="extruder" value="' + (i + 1) + '"/></part></object>'
  ).join('') +
  '<plate><metadata key="plater_id" value="1"/></plate>\n</config>\n';

const projectSettings = JSON.stringify({
  version: '02.01.00.59',
  printer_settings_id: 'Bambu Lab A1 0.4 nozzle',
  filament_settings_id: ['Bambu PLA Basic @BBL A1', 'Bambu PLA Basic @BBL A1', 'Bambu PLA Basic @BBL A1'],
  filament_colour: cores,
}, null, 2);

const entradas = [
  { nome: '[Content_Types].xml', conteudo:
    '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>' +
    '</Types>\n' },
  { nome: '3D/3dmodel.model', conteudo: manifest },
  { nome: '_rels/.rels', conteudo:
    '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>' +
    '</Relationships>\n' },
  { nome: 'Metadata/model_settings.config', conteudo: modelSettings },
  { nome: 'Metadata/project_settings.config', conteudo: projectSettings },
  { nome: 'Metadata/slice_info.config', conteudo:
    '<?xml version="1.0" encoding="UTF-8"?>\n<config><header>' +
    '<header_item key="X-BBL-Client-Type" value="slicer"/>' +
    '<header_item key="X-BBL-Client-Version" value="02.01.00.59"/>' +
    '</header></config>\n' },
];

const buf = montarZip(entradas);
fs.writeFileSync(__dirname + '/downloads/teste-3cores.3mf', buf);
console.log('Salvo: ' + buf.length + ' bytes');
