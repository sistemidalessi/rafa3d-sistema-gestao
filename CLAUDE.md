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
  Troque por "quanto sobra pra você", "depois de pronta, quanto tempo você
  mexe nela", "o seu trabalho".
- **O sistema faz a conta.** Nunca peça um número que dê pra calcular a partir
  dos outros — e mostre o resultado por extenso ("desses R$ 75,90, R$ 30,00
  pagam o filamento, a luz e o seu tempo") em vez de só uma porcentagem.
- **Dinheiro vai na ordem custo → preço.** Primeiro se monta quanto custa
  fazer, depois o preço sai da conta e um botão aplica. Digitar um preço e
  conferir a margem depois exige adivinhar.

`openCustoForm()` é o modelo a seguir — é a tela mais recente feita com essas
regras.
## Onde as coisas ficam

[`index.html`](index.html) é o sistema inteiro em ~2000 linhas, nesta ordem:
`<style>` no topo → HTML das abas → `<script>` com todo o JavaScript, dividido
por faixas de comentário (`/* ====== FILA ====== */`). Pra achar uma tela,
procure pela faixa da aba, não pelo nome do arquivo.

Padrão de nome das funções: `renderX()` desenha a aba, `openXForm()` /
`abrirX()` abre modal, `saveX()` / `salvarX()` grava. A tela é montada com
concatenação de string em `innerHTML` — **todo dado vindo do banco passa por
`escapeHtml()`**.

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

O agente usa `service_role`, então tabela nova ou coluna nova precisa do
`grant` correspondente (foi o que os patches 06 e 09 fizeram).

## Pegadinhas conhecidas

- **São dois fatiadores, de propósito.** `SLICER_APP_PATH` (Bambu Studio) é o
  que abre pro Rafael trabalhar; `ORCA_PATH` (OrcaSlicer) é só pro fatiamento
  por linha de comando. Não unifique.
- **`.stl` não tem miniatura embutida; `.3mf` tem.** Por isso a análise de IA
  do produto extrai a imagem de dentro do `.3mf`, e a do projeto usa a
  miniatura que a Meshy devolveu (ou cai pra foto do cliente).
- **Projeto não é tabela própria.** É `order_line_items` com
  `line_type = 'custom'` — sempre filtre por isso ao consultar projetos.
- **Colunas mortas:** `ai_viability_*` (patch 09) ficaram órfãs quando a etapa
  de Viabilidade saiu da tela. O patch 12 apaga elas — se ainda estiverem no
  banco, é porque ele não foi rodado. Não use, nunca são alimentadas.
- **`unit_cost_estimate` quase nunca está preenchido.** Só recebe valor em
  item personalizado, quando o dono digita o custo ao aprovar o orçamento (e
  o campo é opcional). Item de catálogo nunca preenche — `salvarItem()` não
  toca nele. Por isso a aba Margem tem quatro fontes de custo em cascata em
  vez de simplesmente ler essa coluna.
- **O OrcaSlicer sai com código 0 mesmo falhando.** A única checagem confiável
  é ver se o arquivo de saída existe.
