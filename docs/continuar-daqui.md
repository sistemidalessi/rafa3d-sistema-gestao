# Continuar daqui

Onde as coisas pararam em **25/08/2026**, à noite.

> **Memória do agente não viaja entre as máquinas.** O que precisa
> sobreviver à troca de computador tem que estar no repositório — aqui
> ou no `CLAUDE.md`. Não deixe recado só na memória.

## Antes de tudo, numa máquina nova

```
powershell -ExecutionPolicy Bypass -File slicer-agent\conferir-maquina.ps1
```

O `.env` não viaja (carrega a `service_role`). Cada máquina tem o seu, e
as chaves da Anthropic e do Hi3D **só aparecem na hora de criar** —
guarde no gerenciador de senhas, é o que evita recriar toda vez.

`MESHY_API_KEY` pode ficar vazia: o Hi3D tomou o lugar dela.

Se o agente estiver parado, dois cliques em `slicer-agent\start-hidden.vbs`.
Sem ele, todo botão de fatiador e de IA fica girando pra sempre, **sem
erro nenhum na tela** — o sintoma mais confuso do projeto.

## Frente 1 — o chaveiro de cereja (falta imprimir)

**Encomenda real, já vendida.** Está no sistema como projeto
**PRJ-MT94B82V — "JJ Solene / Chaveiro cereja"**.

### O que já está feito

- Modelo gerado no Hi3D e **cortado pra impressão** (split to print): as
  cerejas e o laço separados e deitados na mesa, o que evita suporte.
- Arquivo **no servidor** (`model_source = manual_upload`), 1,5 milhão de
  triângulos.
- **Colinha da IA pronta e aplicada** — 0,2mm de camada, 3 paredes, 15%
  em grade, ironing no topo, brim externo, sem suporte.
- **Aberto no fatiador** com sucesso.

### O que falta: imprimir de verdade

Nada foi impresso ainda. Falta, na peça já fatiada:

1. **O entalhe do abridor.** A aba já está na peça (é ela a placa
   retangular — não apague). Tampinha tem 32mm, e o entalhe precisa de
   **20 a 22mm de abertura** com pelo menos **5mm de parede** em volta,
   senão quebra na primeira garrafa.
2. **O bolso do NFC de 23mm** e a pausa pra encaixar o chip.
3. **Imprimir e testar**: colar, abrir uma garrafa, encostar o celular.

O bolso e o entalhe saem por **Add negative part** no Bambu Studio, não
cortando a malha. **Cortar não funciona** — tentado de duas formas em
24/08 (booleana com `manifold-3d` e remendo à mão), as duas esbarraram em
defeito de malha mais fundo que costura solta. Não tente de novo sem uma
ideia nova.

Pra recalcular a altura da pausa depois de qualquer mudança de tamanho:

```
node extrair-stl-do-3mf.js <arquivo>.3mf --largura=<mm>
node achar-altura-pausa-nfc.js <arquivo>-<mm>.stl 23
```

### As ferramentas que existem pra isso

| | |
|---|---|
| `ver-peca.js` | desenha a peça de 4 ângulos, sem abrir fatiador |
| `extrair-stl-do-3mf.js` | tira a malha do `.3mf` e escala |
| `achar-altura-pausa-nfc.js` | acha onde o NFC cabe **dentro do material** |
| `base-abridor.js` | placa de abridor separada, 71 × 36 × 4mm |

A `base-abridor.js` só faz sentido se a aba da peça acabar virando
enfeite. Com a aba funcionando, ela não é necessária.

## Frente 2 — o sistema e a loja (tudo no ar)

Nada pendente de deploy. O que entrou:

**24/08** — filamento em quilo, cor mesclada, apagar cor, corrigir e
apagar rolo, aviso de estoque em 50g, cores do catálogo vindas do banco,
pagamento integral (era metade), entrega a combinar por conta do cliente,
cor obrigatória escolhida em bolinhas, PIX na hora também pra quem
combina a entrega. Patches 26 a 31.

**25/08, de manhã** — **o catálogo passou a se adaptar ao celular**
(nunca teve nenhuma media query): grade de 2 a 5 colunas conforme a tela,
bolinhas de cor em quantas colunas couberem, respiro de borda com
`clamp()`, botão de adicionar maior pro dedo. E a colinha ganhou
`ironing_type`, junto com a correção de `manual_upload` nunca receber a
colinha.

**25/08, à noite** — a aba Pedidos tinha ficado pra trás: pedido que
chegava do catálogo só dava pra abrir ou excluir, e não havia caminho
nenhum até imprimir. Entrou tudo isto:

- **Do pedido dá pra mandar a peça pro fatiador**, com o código do
  catálogo à vista e o botão certo pro estado (abrir, esperando, ver a
  colinha, pedir uma). Item personalizado não ganha isso de propósito —
  o caminho dele é a aba Projetos.
- **A colinha finalmente chega no arquivo do produto.** Antes o
  `abrirNoFatiador` dos produtos abria o arquivo cru: a IA escrevia uma
  ficha ótima que ficava só bonita na tela. A lógica virou função única
  (`prepararArquivoPraFatiador`) porque já existiam duas cópias e o
  produto não tinha nenhuma.
- **A colinha pergunta em qual placa a peça vai** (patch 32). Cada placa
  tem o seu campo de temperatura no arquivo, e escrever no campo errado
  não dá erro — o valor é ignorado em silêncio. Era o que acontecia.
- **Status ganharam cor**, as mesmas cinco em todo o sistema. De quebra,
  tudo que estava em andamento aparecia em vermelho, com cara de erro.
- **Pasta padrão dos arquivos 3D**, criada sozinha pelo
  `conferir-maquina.ps1`: `Documentos\Rafa 3D\pecas-do-catalogo\`, com o
  arquivo nomeado pelo código (`01.27 - Arvore do Amor.3mf`).
- **O `conferir-maquina.ps1` parou de mentir** sobre o agente: ele dava
  "rodando" se existisse qualquer processo Node, inclusive um servidor de
  teste. Agora procura `agent.js` na linha de comando.
- **Anexar arquivo e ver a colinha não tiram você do pedido.** Antes os
  dois botões jogavam pra aba Produtos e deixavam a pessoa lá. Agora
  abrem numa janela por cima, e depois de enviar o arquivo o botão da
  peça já vira "Abrir no Fatiador" na mesma tela.
- **A colinha pergunta o MATERIAL** (patch 33), logo depois da placa. As
  duas conversam: PETG com a placa fria marcada dispara um aviso na hora
  de escolher. A IA recebe as duas faixas e aplica as regras do material
  — testado: PLA 220°C/40°C virou PETG 240°C/75°C, com ventoinha em 40% e
  30% mais devagar, sem ninguém pedir esses dois últimos.

  Junto foi o perfil de filamento: trocar o material troca o
  `filament_settings_id` inteiro. Sem isso o arquivo abria como "Bambu
  PLA Basic" com temperatura de PETG, e corrigir na mão fazia o fatiador
  reescrever as temperaturas.

O caminho do pedido até a impressão está escrito em
[roteiro-pedido.md](roteiro-pedido.md), no nível do Rafa.

- **A etiqueta de frete funciona, e agora aparece.** O link de impressão
  nunca chegava: o endpoint `/shipment/print` do Melhor Envio é **POST
  com o corpo**, e o código chamava com GET na URL. Além disso o link
  saía em `mode=private`, que exige estar logado na conta deles pra
  abrir. Os dois corrigidos, e testado de fora: o link abre sem login.

  Se uma etiqueta ficar sem link outra vez, o botão **"🔎 Buscar o link
  da etiqueta"** aparece sozinho — ele recupera a etiqueta que já foi
  paga, sem comprar nada de novo.
- **Existe uma cartinha de agradecimento** pra ir dentro da caixa, em
  meia folha deitada, com o nome do cliente e o texto na voz do Rafa. Na
  hora de despachar, um botão abre etiqueta e cartinha juntas.

  Cuidado ao mexer nisso: o navegador **só deixa abrir uma janela por
  clique**, e depois de um `await` ele nem considera mais que houve
  clique. As duas janelas têm que ser abertas no gesto, e preenchidas
  depois — foi exatamente esse o defeito que fez a cartinha não aparecer.
- **Anotar pagamento traz o valor pronto**, calculado pelo tipo (tudo,
  metade, o resto, devolução), com a conta do pedido à vista. E diz na
  tela que o frete é repasse, não lucro — a aba "Quanto sobrou" já
  calculava por `unit_price × quantidade` e nunca somou entrega, mas
  isso não estava escrito em lugar nenhum.

### Uma coisa que o sistema NÃO resolve, de propósito

**A placa tem que ser trocada na mão, no Bambu Studio.** O arquivo não
consegue: a placa é preferência do aplicativo, não do projeto (testado
abrindo o Bambu do zero). O sistema avisa qual escolher ao mandar pro
fatiador, e o Bambu reclama sozinho quando a combinação não fecha — mas
o clique é da pessoa. Trocar a placa física na impressora também, óbvio.

### O gargalo que sobrou

**Nenhum dos 161 produtos tem arquivo 3D anexado.** O catálogo foi
montado com fotos. Por isso o botão do pedido diz "📎 Anexar o arquivo
3D" e leva direto pra tela de anexar: sobe conforme vende, e cada peça dá
esse trabalho uma vez na vida.

Consequência: as colinhas antigas de 01.01, 03.09 e 05.07 **não podem ser
refeitas** enquanto não houver arquivo — a IA precisa da miniatura que
vive dentro do `.3mf`.

### O que sobrou de pendente, e é com o Anderson

1. **Ctrl+F5 na tela do Rafa** — ele pode estar vendo versão antiga.
2. **Testar o botão de copiar o PIX num celular de verdade** — a
   automação trava no pedido de permissão da área de transferência.
   Tem que aparecer "✓ Copiado! Agora abra o banco".
3. **Falar com os clientes de 23/08** (Batista, Evelyn, Bernardo). Eles
   ficaram na **regra antiga de 50%** de propósito, e as mensagens
   escritas pra eles falam em metade — está coerente.

## Duas coisas sem resposta

- **`slicer-agent/_teste-3cores.js`** — gera um `.3mf` sintético de 3
  cores pra testar. O `_` no nome sugere temporário, e ele menciona um
  "Split3mf" que não existe no repositório. Fica ou sai?
- **O tamanho final da peça da cereja.** O arquivo no servidor está
  cortado e deitado, então a caixa dele (60 × 32 × 28mm) não diz o
  tamanho da peça montada.
