# Notas pra Claude Code

Contexto, setup e convenções gerais estão no [README.md](README.md) — leia ele
primeiro. Este arquivo só guarda o que dá pra tropeçar ao mexer no código.


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
Bambu Studio, se o agente está de pé e se o vigia que religa ele sozinho está
instalado — e imprime os comandos do que faltar, na ordem. É PowerShell e não
Node de propósito: numa máquina nova o Node pode ser justamente o que falta.

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

- **O agente pode cair no meio do dia, sem erro nenhum no `agent.log`.**
  Em 28/08/2026 ficou mais de 2h parado (o computador continuava ligado
  e em uso) até um pedido de colinha não sair da fila — sem stack trace,
  sem mensagem de erro, só silêncio. `slicer_agents.last_seen_at` é o
  jeito de confirmar: se está velho, ele não está rodando, ponto. Por
  isso existe `instalar-vigia.ps1` (patch de infraestrutura, não SQL) —
  registra uma Tarefa Agendada do Windows via `schtasks.exe` (não o
  módulo `ScheduledTasks`/`Register-ScheduledTask`: esse devolveu
  "Acesso negado" mesmo sem precisar de admin de verdade) que confere a
  cada 5 minutos e religa sozinho. Rode uma vez por máquina; o
  `conferir-maquina.ps1` avisa se falta.

- **`GRANT` é separado de RLS, e vale até pro `service_role`.** Essa mesma
  pegadinha derrubou os patches 06, 09, 17, 19, 26, 34, 35 e 43: sem `grant`, a consulta nem
  chega a ser avaliada pela política (erro 42501, "permission denied"). Tabela
  nova ou coluna nova usada pelo agente ou por Edge Function precisa do `grant`
  correspondente — já inclua no mesmo patch.
  **Conceda o verbo que vai faltar depois, não só os de hoje.** O patch 25
  concedeu `select, insert, update` porque era o que a tela usava, e o
  `delete` só fez falta no 43 — quando descobrimos que nenhum computador
  saía da lista. Grant de tabela cobre coluna nova; grant de coluna não.
  **E `delete` sem grant não estoura**: devolve `permission denied` no
  campo `error`, e quem não conferir segue achando que apagou. Se você
  escreveu no banco por script, confira o resultado — não a sua mensagem
  de sucesso.
- **Cor sozinha na tela é bug.** Sempre `Preto (TPU)`, nunca `Preto` —
  use `rotuloDaCor()`. "Preto" e "Preto" são filamentos diferentes se um
  é PLA e o outro é TPU, e o material decide temperatura, placa e se a
  peça sai ou derrete. Em 28/08 a Fila aprovou imprimir uma peça de PETG
  num rolo de TPU porque os dois eram pretos e a tela só escrevia a cor.
- **Material tem DOIS vocabulários — compare a família.** `products` e
  `project_parts` guardam `pla|petg|tpu|abs` (tem `check`, patch 33);
  `filament_colors` e as receitas guardam o nome comercial (`PLA Silk`,
  `PETG Basic`). Texto exato entre os dois acusa `pla` contra `PLA Silk`
  como conflito — metade do catálogo. `familiaDoMaterial()` compara a
  primeira palavra.
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
   `reconfigurarHi3d3mf()` já injeta os dois quando faltam (achado em
   28/08 com um `.3mf` do Layerpaint) — mas **não resolve sozinho**, ver
   item 4.
3. **`different_settings_to_system` é o que faz os valores valerem.** O Bambu
   não lê os valores soltos: ele carrega o perfil nomeado em
   `print_settings_id` e aplica por cima **só** os campos listados nesse
   vetor (processo, filamento, impressora). Campo alterado que não entra na
   lista é descartado — o sintoma é abrir limpo, sem erro nenhum, e mesmo
   assim vir tudo com os valores do perfil.
   **O vetor nem sempre tem três posições.** Só tem quando é um filamento
   só (arquivo gerado do zero). Peça dividida por cor no Hi3D tem um slot
   de filamento PRA CADA cor — 4 cores vira vetor de 6 posições (processo,
   filamento 1, 2, 3, 4, impressora), e a impressora deixa de ser a
   posição 2 pra virar a última. `aplicarAjustesColinha()` calcula os
   índices pelo tamanho real do vetor (achado com o Chaveiro do Pikachu,
   27/08: índice fixo marcava só a cor 1 como "mexida" e gravava a placa
   na posição da cor 2) — se voltar a escrever índice fixo, o mesmo bug
   volta, só que silencioso de novo.
4. **Nem todo `.3mf` anexado à mão É um projeto do Bambu por baixo — e
   isso não tem conserto no nosso código.** Achado em 28/08 com peças de
   um projeto (Friends) baixadas do Layerpaint (ferramenta de pintura de
   cor, não fatiador): o arquivo original — **mesmo sem nenhuma
   modificação nossa** — já abre no Bambu Studio com "O arquivo 3mf
   contém uma configuração inválida, carregar apenas os dados de
   geometria". Não é o item 2 (isso a gente resolve); é a
   **estrutura interna do modelo**: o Layerpaint grava a peça inteira
   num `3D/3dmodel.model` só, com cor por `<m:colorgroup>` (extensão de
   Materiais do padrão 3MF), sem o esqueleto de
   `3D/Objects/object_N.model` + `3D/_rels/3dmodel.model.rels` que um
   projeto real do Bambu sempre tem (comparado lado a lado com um
   projeto de verdade que abre bem). O Bambu reconhece que tem cor pra
   importar (mostra a janela "Cor padrão 3mf Importada", pra mapear as
   cores do arquivo pros filamentos carregados) mas não trata como
   projeto seu, e por isso descarta a configuração inteira — **de
   propósito**, não é bug do Bambu nem nosso.
   Na prática: a peça abre certinha (malha e cor corretas), só que sem a
   colinha aplicada — quem for imprimir uma peça dessas precisa mapear a
   cor na janela que aparece e digitar brim/temperatura/altura de camada
   à mão, olhando o texto da colinha (💬 "Ver colinha" na tela do
   sistema). Isso só afeta arquivo vindo do Layerpaint; Hi3D, Meshy e
   `.stl`/`.3mf` anexado de um projeto real do Bambu continuam recebendo
   a colinha automática do jeito de sempre.

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
