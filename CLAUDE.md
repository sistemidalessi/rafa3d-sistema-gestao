# Notas pra Claude Code

Contexto, setup e convenções gerais estão no [README.md](README.md) — leia ele
primeiro. Este arquivo só guarda o que dá pra tropeçar ao mexer no código.

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
- **O OrcaSlicer sai com código 0 mesmo falhando.** A única checagem confiável
  é ver se o arquivo de saída existe.
