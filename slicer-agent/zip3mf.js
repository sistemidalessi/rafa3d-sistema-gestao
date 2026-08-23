// Escritor de zip próprio, só pra montar o .3mf.
//
// Existe por um motivo específico: o formato .3mf segue a norma OPC, que
// exige o [Content_Types].xml como PRIMEIRA parte do pacote. O adm-zip
// não garante a ordem ao gravar — ele chegou a jogar o _rels/.rels na
// frente — e o Bambu Studio recusa o pacote quando isso acontece.
//
// O sintoma era enganoso: o arquivo até abria, mas o Bambu descartava as
// configurações e importava só a malha. Ao forçar o reconhecimento como
// projeto dele, passava a dar erro de carregamento. Nenhuma das duas
// coisas tinha a ver com os valores, que sempre estiveram corretos
// dentro do arquivo.
//
// Aqui a ordem é exatamente a que se passa, e nada mais mexe nela.
const zlib = require('zlib');

// Data fixa nas entradas: sem isso o mesmo modelo geraria arquivos
// diferentes a cada segundo, e comparar duas gerações viraria adivinhação.
const DATA_FIXA = { hora: 0, data: 0x2821 }; // 2020-01-01 00:00

function crc32(buf) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0;
  let c, tabela = crc32.tabela;
  if (!tabela) {
    tabela = crc32.tabela = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      tabela[n] = c >>> 0;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ tabela[(crc ^ buf[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// entradas: [{ nome, conteudo }] — gravadas nesta ordem, sem reordenar.
function montarZip(entradas) {
  const pedacos = [];
  const central = [];
  let deslocamento = 0;

  for (const { nome, conteudo } of entradas) {
    const nomeBuf = Buffer.from(nome, 'utf8');
    const dados = Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(conteudo, 'utf8');
    const comprimido = zlib.deflateRawSync(dados, { level: 6 });
    const soma = crc32(dados);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);   // assinatura de cabeçalho local
    local.writeUInt16LE(20, 4);           // versão necessária
    local.writeUInt16LE(0, 6);            // sem flags (nada de data descriptor)
    local.writeUInt16LE(8, 8);            // deflate
    local.writeUInt16LE(DATA_FIXA.hora, 10);
    local.writeUInt16LE(DATA_FIXA.data, 12);
    local.writeUInt32LE(soma, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(dados.length, 22);
    local.writeUInt16LE(nomeBuf.length, 26);
    local.writeUInt16LE(0, 28);           // sem campo extra
    pedacos.push(local, nomeBuf, comprimido);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);     // assinatura de diretório central
    dir.writeUInt16LE(20, 4);             // versão de quem gravou
    dir.writeUInt16LE(20, 6);             // versão necessária
    dir.writeUInt16LE(0, 8);
    dir.writeUInt16LE(8, 10);
    dir.writeUInt16LE(DATA_FIXA.hora, 12);
    dir.writeUInt16LE(DATA_FIXA.data, 14);
    dir.writeUInt32LE(soma, 16);
    dir.writeUInt32LE(comprimido.length, 20);
    dir.writeUInt32LE(dados.length, 24);
    dir.writeUInt16LE(nomeBuf.length, 28);
    dir.writeUInt16LE(0, 30);             // extra
    dir.writeUInt16LE(0, 32);             // comentário
    dir.writeUInt16LE(0, 34);             // disco
    dir.writeUInt16LE(0, 36);             // atributos internos
    dir.writeUInt32LE(0, 38);             // atributos externos
    dir.writeUInt32LE(deslocamento, 42);  // onde começa o cabeçalho local
    central.push(dir, nomeBuf);

    deslocamento += local.length + nomeBuf.length + comprimido.length;
  }

  const centralBuf = Buffer.concat(central);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(0, 4);
  fim.writeUInt16LE(0, 6);
  fim.writeUInt16LE(entradas.length, 8);
  fim.writeUInt16LE(entradas.length, 10);
  fim.writeUInt32LE(centralBuf.length, 12);
  fim.writeUInt32LE(deslocamento, 16);
  fim.writeUInt16LE(0, 20);

  return Buffer.concat([...pedacos, centralBuf, fim]);
}

module.exports = { montarZip };
