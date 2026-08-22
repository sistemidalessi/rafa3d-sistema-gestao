# Notas pra Claude Code

Contexto, setup e convenções gerais estão no [README.md](README.md) — leia ele
primeiro. Este arquivo só guarda o que dá pra tropeçar ao mexer no código.


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
