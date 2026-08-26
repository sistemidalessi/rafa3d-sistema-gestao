# Notas pra Claude Code

Contexto, setup e convenções gerais estão no [README.md](README.md) — leia ele
primeiro. Este arquivo só guarda o que dá pra tropeçar ao mexer no código.


## ⏳ TAREFAS EM ABERTO — 26/08/2026

**Assim que a sessão começar, lembre o Anderson destas.** O detalhe está
em [docs/continuar-daqui.md](docs/continuar-daqui.md).

1. **Conferir a máquina.** Rodar `slicer-agent\conferir-maquina.ps1` antes
   de tudo (veja a seção seguinte). Depois, subir o agente
   (`start-hidden.vbs`) — sem ele, todo botão de colinha e de fatiador
   fica girando pra sempre, sem erro nenhum na tela.
2. **O chaveiro de cereja está CANCELADO** e continua sem imprimir. Foi
   cancelado sem querer; existe o botão "Reabrir orçamento" pra desfazer.
   É encomenda real, já vendida. Falta o entalhe do abridor, o bolso do
   NFC de 23mm e a pausa — nada disso foi impresso, só validado em
   arquivo.

Também pendente, e é com o Anderson e não com o agente: **testar o fluxo
completo do "Sugerir categoria e tamanho com a foto"** logado de verdade
(a função foi testada por fora, o caminho navegador→função não),
**testar o botão de copiar o PIX num celular** e **falar com os clientes
de 23/08** — esses ficaram na regra antiga de 50% de propósito, e as
mensagens escritas pra eles falam em metade, então estão coerentes.

**Antes de julgar qualquer modelo 3D, rode `node ver-peca.js arquivo.3mf`.**
Ele desenha a peça de quatro ângulos, sem abrir fatiador. Em 24/08 eu
passei horas achando que a cereja estava ruim porque olhei ela achatada
numa janela do Bambu, e cheguei a propor apagar a aba do abridor achando
que era lixo de geração — a aba **é** o abridor. Ver a peça desfez tudo em
trinta segundos.

**Apague esta seção quando as duas de cima estiverem resolvidas** — nota
de tarefa que fica pra trás vira ruído e mente sobre o estado do projeto.


## Primeira coisa numa máquina nova

O Anderson trabalha em dois computadores, e o agente precisa ser instalado em
cada um — Node, dependências e o `.env` não viajam no repositório, de
propósito (o `.env` carrega a `service_role`).

**Se a sessão parecer estar numa máquina ainda não preparada** — o agente não
roda, o `node` não existe, ou ele mencionar que trocou de computador — rode
isto antes de qualquer outra coisa e diga o que apareceu:

```
powershell -ExecutionPolicy Bypass -File slicer-agent\conferir-maquina.ps1
```

Ele confere Node, dependências, `.env` (inclusive se a chave está preenchida),
Bambu Studio e se o agente está de pé — e imprime os comandos do que faltar, na
ordem. É PowerShell e não Node de propósito: numa máquina nova o Node pode ser
justamente o que falta.

Sem isso, o sintoma é confuso: o sistema abre e funciona normal, mas todo botão
de fatiador e de IA fica esperando na fila pra sempre, sem erro nenhum na tela.

## Escrevendo texto de tela

Quem opera este sistema no dia a dia tem 10 anos. Todo texto que aparece na
tela — rótulo, botão, aviso, mensagem de erro — precisa ser entendido por uma
criança sozinha, sem ninguém do lado explicando.

Na prática:

- **Pergunta direta no lugar de rótulo técnico.** "Quantos gramas de filamento
  ela gasta?" em vez de "Peso estimado (g)", com uma dica embaixo dizendo onde
  achar o número ("o fatiador mostra quando termina de fatiar"). Use
  `<label class="pergunta">` — o estilo padrão de label é caixa alta de 11px,
  que serve pra "NOME" e não pra uma pergunta inteira.
- **Palavra de negócio não entra.** "margem", "pós-processamento", "mão de
  obra", "receita de custo", "estimativa" não querem dizer nada pra ele.
  Troque por "quanto sobra pra você", "teve pintura?", "o seu trabalho".
- **O sistema faz a conta.** Nunca peça um número que dê pra calcular a partir
  dos outros — e mostre o resultado por extenso ("desses R$ 75,90, R$ 30,00
  pagam o filamento, a luz e a pintura") em vez de só uma porcentagem.
- **Dinheiro vai na ordem custo → preço.** Primeiro se monta quanto custa
  fazer, depois o preço sai da conta e um botão aplica. Digitar um preço e
  conferir a margem depois exige adivinhar.

`desenharPrecificar()` é o modelo a seguir — a tela de dar preço num produto.
Ela é uma tela cheia, não modal, porque passo numerado + explicação + a conta
ao lado não cabem numa janelinha. E a conta fica grudada enquanto se rola de
propósito: ver o número mudar enquanto digita é o que ensina de onde ele vem.

**A conta é a da planilha do Anderson, não um modelo inventado** (patch-15):
pintura soma 20% em cima de filamento+luz, só quando a peça é pintada, e o
preço é custo × um multiplicador editável (padrão 2,5). Não volte pro modelo
antigo de "quanto sobra de cada R$ 100" nem pra mão de obra por minuto — foi
trocado de propósito, pra bater com o que ele já usa há tempo.


## Onde as coisas ficam

[`index.html`](index.html) é o sistema de gestão inteiro em ~3900 linhas, nesta
ordem: `<style>` no topo → HTML das abas → `<script>` com todo o JavaScript,
dividido por faixas de comentário (`/* ====== FILA ====== */`). Pra achar uma
tela, procure pela faixa da aba, não pelo nome do arquivo.

Padrão de nome das funções: `renderX()` desenha a aba, `openXForm()` /
`abrirX()` abre modal, `saveX()` / `salvarX()` grava. A tela é montada com
concatenação de string em `innerHTML` — **todo dado vindo do banco passa por
`escapeHtml()`**.

Tela que não cabe em modal vira tela cheia dentro da própria aba, no esquema
"uma variável guarda o que está aberto e o render decide o que desenhar"
(`pedidoDetalheId`, `produtoPrecificarId`).

Listas que quase não mudam (produtos, filamentos, impressoras, clientes) têm
cache em memória: `getProdutos()` devolve o cache, `getProdutos(true)` força
recarregar. Depois de gravar algo, force.


## Mexendo nas filas do agente

Adicionar uma ação nova que precisa do mundo real (fatiador, IA, arquivo local)
sempre encosta em três lugares — se esquecer um, o botão fica girando pra
sempre:

1. **Patch SQL novo** em `docs/`: as colunas `x_status` (com `check` em
   `queued/processing/done/error`), `x_error`, `x_requested_at`, mais um índice
   parcial em `where x_status = 'queued'`.
2. **[`index.html`](index.html)**: o botão só grava `x_status = 'queued'` e
   `x_requested_at = now()`. Nada mais — o navegador não executa nada.
3. **[`agent.js`](slicer-agent/agent.js)**: uma `tickX()` que pega 1 item da
   fila, marca `processing`, faz o trabalho, grava `done`/`error` — e
   **registrar essa `tickX()` no laço da `main()`**, que é onde é fácil
   esquecer.

Hoje são **dez** filas: as mesmas três operações (gerar modelo, colinha de IA,
abrir no fatiador) sobre `products`, `order_line_items` e `project_parts`, mais
a do Hi3D (`tickHi3d`, patch-27), que gera a peça inteira e já divide em partes
coloridas. Mexeu numa, confira se as irmãs precisam da mesma coisa.


## Mexendo nas Edge Functions

[`supabase/functions/`](supabase/functions/) é Deno, não Node, e **não sobe com
o `git push`** — precisa de `supabase functions deploy <nome>`. Segredo novo é
secret do projeto Supabase, nunca `.env` nem constante no código.

`finalizar-pedido` **revalida os preços no servidor**. Nunca passe a confiar no
valor que o navegador mandou: o catálogo é público e qualquer um edita o que
sai dali.


## Pegadinhas conhecidas

- **Mexeu no `agent.js` ou no `gerar3mf.js`? Reinicie o agente.** Ele lê o
  código uma vez, ao iniciar — testar sem reiniciar é testar a versão
  velha e concluir errado. Isso enganou duas vezes em 25/08: um teste
  "falhou" e a conclusão quase foi de que o código não funcionava.
  Parar e subir: `Stop-Process` no `node.exe` cuja linha de comando tem
  `agent.js`, depois dois cliques em `start-hidden.vbs`.

- **`GRANT` é separado de RLS, e vale até pro `service_role`.** Essa mesma
  pegadinha derrubou os patches 06, 09, 17, 19, 26, 34 e 35: sem `grant`, a consulta nem
  chega a ser avaliada pela política (erro 42501, "permission denied"). Tabela
  nova ou coluna nova usada pelo agente ou por Edge Function precisa do `grant`
  correspondente — já inclua no mesmo patch.
- **São dois fatiadores, de propósito.** `SLICER_APP_PATH` (Bambu Studio) é o
  que abre pro Rafael trabalhar; `ORCA_PATH` (OrcaSlicer) é só pro fatiamento
  por linha de comando. Não unifique.
- **`.stl` não tem miniatura embutida; `.3mf` tem.** Por isso a análise de IA
  do produto extrai a imagem de dentro do `.3mf`, e a do projeto usa a
  miniatura que a Meshy devolveu (ou cai pra foto do cliente).
- **A fila de "Abrir no Fatiador" tem destino.** Desde o patch-25 cada pedido
  carrega `open_slicer_agent` — o computador que deve abrir a janela — e cada
  agente só pega o que é dele (ou o que está sem dono, que é como todo registro
  antigo se comporta). Se você mexer nessa fila, mantenha o filtro: sem ele,
  com dois agentes ligados, o arquivo abre na tela errada. O nome vem de
  `os.hostname()` e o agente se anuncia sozinho em `slicer_agents`.
- **A escala do `.3mf` gerado é decidida pela origem do arquivo, não pelo
  tamanho.** Modelo da Meshy sempre é normalizado pra 80mm no maior lado
  (a Meshy não exporta em milímetro, e o número dela varia muito); arquivo
  anexado à mão nunca é reescalado. A versão antiga adivinhava pelo tamanho e
  errava nas duas pontas. Se um dia isso precisar mudar, mexa em
  `escalaSegura()` — e lembre que `model_source` vem do banco, então a consulta
  do agente precisa continuar trazendo essa coluna.
- **Projeto não é tabela própria.** É `order_line_items` com
  `line_type = 'custom'` — sempre filtre por isso ao consultar projetos. Já as
  **partes** de um projeto são tabela de verdade (`project_parts`, patch-23).
- **O checkout do catálogo é JavaScript puro, fora do framework de template**
  ([`catalogo/support.js`](catalogo/support.js)). Foi de propósito: aquele
  framework re-renderiza a página inteira a cada scroll, e um formulário dentro
  dele perderia o que a pessoa digitou.
- **O arquivo NÃO troca a placa no Bambu Studio.** Gravar `curr_bed_type`
  descreve pra que placa a peça foi pensada, mas não muda nada: a placa é
  preferência do **aplicativo** (fica em `BambuStudio.conf` como
  `"curr_bed_type": "1"`, um número). Testado em 25/08/2026 abrindo o
  Bambu do zero — ele continua na placa anterior. Quem troca é a pessoa,
  na tela do fatiador; por isso o sistema avisa qual escolher ao abrir.
- **`filament_settings_id` é o nome de um perfil que precisa existir** na
  instalação (`resources\profiles\BBL\filament`). Trocar o material troca
  esse perfil junto — sem isso o arquivo abria como "Bambu PLA Basic" com
  temperatura de PETG, e corrigir o filamento na mão fazia o fatiador
  reescrever as temperaturas e jogar a colinha fora.
- **Cada placa da Bambu tem o SEU campo de temperatura**, e o fatiador só
  lê o da placa selecionada em `curr_bed_type`. Escrever em
  `hot_plate_temp` com o perfil em `Cool Plate` não dá erro nenhum — o
  valor é simplesmente ignorado, e foi o que aconteceu até 25/08/2026.
  A tabela `PLACAS` em [`gerar3mf.js`](slicer-agent/gerar3mf.js) faz a
  ligação, e a placa é resolvida **antes** do laço de campos justamente
  porque ela decide onde a temperatura vai ser gravada.
- **`model_source` decide se o arquivo recebe a colinha.** Quem reconfigura o
  `.3mf` olha essa coluna, e por um tempo `manual_upload` ficou de fora: a IA
  analisava, gerava uma ficha ótima, e ela nunca era aplicada no arquivo que de
  fato abria no fatiador. Sintoma: colinha linda na tela, fatiador com os
  valores do perfil. Origem nova precisa entrar nessa lista.
- **A adaptação do catálogo ao celular é feita em JavaScript, não em CSS.** O
  framework de template tem um prop `columns` que **vence qualquer media
  query** — ele foi pensado pra pré-visualizar em 1080px fixos. Por isso a
  grade lê `viewportW` do estado (atualizado no `resize`) e decide o número de
  colunas na mão. Se um dia a grade voltar a ficar com produto do tamanho de um
  selo no celular, é esse prop brigando de novo — não adianta escrever CSS.
- **Colunas mortas:** `post_processing_minutes` e `post_processing_labor_rate`
  ficaram órfãs quando o patch-15 trocou a conta de custo por `has_painting` —
  nenhuma linha de código as usa. As `ai_viability_*` do patch 09 tiveram o
  mesmo destino e já foram apagadas pelo patch 12.
- **`unit_cost_estimate` quase nunca está preenchido.** Só recebe valor em
  item personalizado, quando o dono aprova o orçamento. Item de catálogo nunca
  preenche — `salvarItem()` não toca nele. Por isso a aba "Quanto sobrou" tem
  quatro fontes de custo em cascata em vez de simplesmente ler essa coluna.
- **O fatiamento por linha de comando do OrcaSlicer não funciona — em caso
  nenhum.** Testado em 26/08 numa peça simples, de um objeto e um
  filamento, e num `.stl` cru sem perfil: a mesma
  `Slic3r::CLI::run found error, exit` nos dois. Conferido no código-fonte
  do OrcaSlicer: é um catch-all impresso em qualquer erro interno, não
  assinatura de peça complexa. Não conte com essa via pra extrair peso e
  tempo automaticamente — é por isso que "Terminei" pergunta os números.
- **`orders.status` é campo morto.** Nada no sistema atualiza ele: fica
  preso em "Vendo o preço" desde a criação. Quem sabe o estado de verdade
  é o `line_status` de cada peça, e é nele que a lista de Pedidos e a Fila
  se baseiam. Não escreva lógica nova em cima de `orders.status`.
- **"Terminei" mistura duas contas que só são iguais quando a quantidade
  é 1.** O peso baixado do estoque é o TOTAL impresso; o peso guardado na
  receita do produto tem que ser de UMA peça, porque é reaproveitado em
  qualquer pedido futuro. Num pedido de 60, guardar o total multiplicaria
  o custo por 60 na próxima venda. A divisão é feita antes de gravar na
  receita — se mexer ali, mantenha.
- **As 10 categorias do catálogo vivem em DOIS lugares:** `CATEGORY_LABELS`
  no [`index.html`](index.html) e a lista dentro da Edge Function
  [`sugerir-cadastro-produto`](supabase/functions/sugerir-cadastro-produto/index.ts).
  Categoria nova exige mexer nos dois — a IA nunca inventa uma.
- **Fundo colorido some na impressão sem `print-color-adjust: exact`.** O
  navegador apaga fundo "pra economizar tinta", e a cartinha saía branca.
  Vale pra qualquer coisa desenhada pra imprimir.
- **O OrcaSlicer sai com código 0 mesmo falhando.** A única checagem confiável
  é ver se o arquivo de saída existe.


## Abrir o fatiador já configurado: por que é delicado

O [`gerar3mf.js`](slicer-agent/gerar3mf.js) converte o `.stl` da Meshy num
`.3mf` que abre no Bambu Studio com os ajustes da colinha já aplicados. Isso
funciona hoje, mas foram **três defeitos empilhados** até funcionar, cada um
escondendo o seguinte. Se algum dia voltar a abrir "sem a colinha", provavelmente
é um destes:

1. **A ordem dentro do zip.** A norma do `.3mf` (OPC) exige o
   `[Content_Types].xml` como **primeira** parte do pacote. O `adm-zip`
   reordenava ao gravar e jogava o `_rels/.rels` na frente, e o Bambu recusava
   o pacote. Por isso o zip é montado pelo [`zip3mf.js`](slicer-agent/zip3mf.js),
   escrito à mão, que grava na ordem exata — **não troque por biblioteca de
   zip sem garantir a ordem.**
2. **O arquivo precisa se declarar como projeto do Bambu.** Ele decide entre
   "leio as configurações" e "importo só a malha" pelo
   `<metadata name="Application">BambuStudio-...` e pela presença do
   `Metadata/slice_info.config`. Sem os dois, ignora tudo em silêncio.
3. **`different_settings_to_system` é o que faz os valores valerem.** O Bambu
   não lê os valores soltos: ele carrega o perfil nomeado em
   `print_settings_id` e aplica por cima **só** os campos listados nesse
   vetor de três posições (processo, filamento, impressora). Campo alterado
   que não entra na lista é descartado — o sintoma é abrir limpo, sem erro
   nenhum, e mesmo assim vir tudo com os valores do perfil.

Além disso, os campos de lista só aceitam as palavras exatas do Bambu, e
**valor inválido derruba o arquivo de configuração inteiro**, não só aquele
campo. Por isso `aplicarAjustesColinha()` traduz por lista fechada
(`LISTAS_DO_BAMBU`) e descarta o que não conhece.

Os nomes mudaram entre versões, e é aí que se erra: `normal` virou
`normal(auto)`, e o `outer_brim_only` do formato antigo hoje é **`outer_only`**
(o `inner_brim_only` virou `inner_only`). Mandar o nome velho não dá erro — o
Bambu troca por `auto_brim` sozinho e avisa numa janela, e a peça sai com o
brim errado. Os valores válidos, tirados da tabela de dentro do
`BambuStudio.dll`:

```
no_brim | outer_only | inner_only | outer_and_inner | auto_brim | brim_ears
```
