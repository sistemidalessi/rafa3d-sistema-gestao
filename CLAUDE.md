# Notas pra Claude Code

Contexto, setup e convenções gerais estão no [README.md](README.md) — leia ele
primeiro. Este arquivo só guarda o que dá pra tropeçar ao mexer no código.


## ⏳ TAREFAS EM ABERTO — de 24/08/2026

**Assim que a sessão começar, lembre o Anderson destas duas.** Ele parou no
meio do chaveiro de cereja (encomenda real, já vendida) e vai retomar de
outro computador. O detalhe está em
[docs/continuar-daqui.md](docs/continuar-daqui.md) — leia antes de
responder qualquer coisa sobre o chaveiro ou geração de modelo 3D.

1. **Conferir a máquina.** Rodar `slicer-agent\conferir-maquina.ps1` antes
   de tudo (veja a seção seguinte). **As chaves do Hi3D são por máquina** —
   se a de casa não tiver `HI3D_ACCESS_KEY`/`HI3D_SECRET_KEY` preenchidas,
   crie uma chave nova em platform.hi3d.ai (o segredo só aparece uma vez).
2. **Terminar o chaveiro de cereja com NFC + abridor.** Já tem a forma da
   cereja aprovada e a base do abridor pronta — falta escalar pra 78mm,
   rodar a ferramenta da altura de pausa do NFC, e imprimir um teste de
   verdade. Detalhe completo, incluindo o que **não** funcionou (não tentar
   de novo sem ideia nova), em docs/continuar-daqui.md e na memória do
   projeto.

Também ainda pendente, mas antigo (23/08): **testar o botão de copiar o
PIX num celular de verdade** (tem que aparecer "✓ Copiado! Agora abra o
banco" e o botão do WhatsApp ficar verde) e **falar com os 4 clientes**
que compraram na tela antiga e não souberam como pagar — isso é com o
Anderson, não com o agente.

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

[`index.html`](index.html) é o sistema de gestão inteiro em ~3400 linhas, nesta
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

Hoje são nove filas: as mesmas três operações (Meshy, colinha de IA, abrir no
fatiador) sobre `products`, `order_line_items` e `project_parts`. Mexeu numa,
confira se as outras duas precisam da mesma coisa.


## Mexendo nas Edge Functions

[`supabase/functions/`](supabase/functions/) é Deno, não Node, e **não sobe com
o `git push`** — precisa de `supabase functions deploy <nome>`. Segredo novo é
secret do projeto Supabase, nunca `.env` nem constante no código.

`finalizar-pedido` **revalida os preços no servidor**. Nunca passe a confiar no
valor que o navegador mandou: o catálogo é público e qualquer um edita o que
sai dali.


## Pegadinhas conhecidas

- **`GRANT` é separado de RLS, e vale até pro `service_role`.** Essa mesma
  pegadinha derrubou os patches 06, 09, 17 e 19: sem `grant`, a consulta nem
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
- **Colunas mortas:** `post_processing_minutes` e `post_processing_labor_rate`
  ficaram órfãs quando o patch-15 trocou a conta de custo por `has_painting` —
  nenhuma linha de código as usa. As `ai_viability_*` do patch 09 tiveram o
  mesmo destino e já foram apagadas pelo patch 12.
- **`unit_cost_estimate` quase nunca está preenchido.** Só recebe valor em
  item personalizado, quando o dono aprova o orçamento. Item de catálogo nunca
  preenche — `salvarItem()` não toca nele. Por isso a aba "Quanto sobrou" tem
  quatro fontes de custo em cascata em vez de simplesmente ler essa coluna.
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
campo. Por isso `aplicarAjustesColinha()` traduz por lista fechada e ignora o
que não conhece: `normal` → `normal(auto)`, e todo modo de brim → `auto_brim`
(esta versão recusou `outer_brim_only`; o menu tem "Apenas brim externo", mas
com outro nome interno que ainda não foi identificado — a largura do brim
continua valendo de qualquer forma).
