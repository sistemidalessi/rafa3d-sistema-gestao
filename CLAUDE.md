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

Hoje são **treze** filas: as mesmas quatro operações (gerar modelo, colinha de
IA, abrir no fatiador, e guardar de volta o que foi salvo no fatiador — patch
52) sobre `products`, `order_line_items` e `project_parts`, mais a do Hi3D
(`tickHi3d`, patch-27), que gera a peça inteira e já divide em partes
coloridas. Mexeu numa, confira se as irmãs precisam da mesma coisa.


## Mexendo nas Edge Functions

[`supabase/functions/`](supabase/functions/) é Deno, não Node, e **não sobe com
o `git push`** — precisa de `supabase functions deploy <nome>`. Segredo novo é
secret do projeto Supabase, nunca `.env` nem constante no código.

`finalizar-pedido` **revalida os preços no servidor — dos produtos e, desde
21/09/2026, do frete** (achado `r3d-01`). Nunca passe a confiar no valor que o
navegador mandou: o catálogo é público e qualquer um edita o que sai dali.
Antes, `frete.preco` e `servico_id` eram gravados como vinham: dava pra fechar
pedido com frete de 1 centavo e trocar o serviço por um mais caro, que a
`gerar-etiqueta` compraria depois com o saldo do Melhor Envio.

**A cotação mora em [`_shared/frete.ts`](supabase/functions/_shared/frete.ts)
e é usada pelas duas pontas** — `calcular-frete` mostra as opções,
`finalizar-pedido` refaz a mesma conta com o CEP do pedido e a quantidade que
*ele* validou, e só vale a opção que sair dali (transportadora, serviço, prazo
e preço gravados são os do Melhor Envio). Preço visto pelo cliente diferente do
recotado em mais de 1 centavo, ou serviço que não existe: `409` pedindo pra
calcular de novo, sem criar pedido. Consequências:

- **Mudou pacote, origem ou regra de quantidade? Muda em `_shared/frete.ts` e
  publica AS DUAS funções.** Se só uma for publicada, as duas cotam diferente
  e todo checkout responde "o valor do frete mudou".
- O Melhor Envio fora do ar na hora de fechar = pedido com entrega não fecha
  (`502`, e a mensagem sugere "combinar a entrega", que não depende dele).
- Conferido em 21/09: três cotações seguidas devolvem os mesmos preços, então a
  folga de 1 centavo não recusa cliente honesto. Se um dia recusar, é o Melhor
  Envio variando preço entre chamadas — aumentar a folga, não tirar a conferência.

**Como testar uma Edge Function sem Deno nem Docker na máquina** (foi assim em
21/09): `npx esbuild arquivo.ts` só pra sintaxe; guardar a resposta de produção
*antes*; `supabase functions deploy <nome>`; comparar a resposta *depois* (a do
`calcular-frete` saiu idêntica, byte a byte); mandar as fraudes — elas são
recusadas antes de criar qualquer coisa — e por fim UM pedido honesto de teste,
avisando o Anderson, porque ele dispara push e e-mail de verdade. Pra voltar
atrás: `git checkout <commit anterior> -- supabase/functions` e publicar de novo.


## Segurança do banco: "da loja" não é "autenticado" (patch 54, 21/09/2026)

Duas regras, as duas impostas no banco, as duas aprendidas do jeito ruim:

- **Política nunca usa `using (true)` pra `authenticated`.** Usa `is_staff()`
  (tem linha em `profiles` **e** `active`) ou `is_owner()`. O cadastro público
  do Supabase Auth é uma chave do painel, não algo que a RLS controla: com ele
  ligado — e estava — "autenticado" é *qualquer pessoa da internet que crie uma
  conta com o próprio e-mail*. Até o patch 54, vinte políticas eram
  `using (true)`: essa pessoa leria todos os clientes, pedidos e pagamentos
  (CPF, WhatsApp, endereço) e poderia **alterar e apagar pedidos**. Em 21/09
  as 2 contas existentes eram as dos donos; ninguém de fora tinha entrado.
  De carona, `profiles.active = false` passou a cortar o acesso do ajudante de
  verdade (antes só a aba sumia — achado `r3d-04`).
- **Toda função `security definer` tem checagem por dentro E
  `revoke execute ... from public, anon`.** Função `security definer` ignora a
  RLS, e o Postgres dá `EXECUTE` a `PUBLIC` em toda função nova por padrão (é o
  `=X` no começo do `proacl`). `add_filament_spool` e `consume_filament` não
  checavam nada: o visitante do catálogo, com o id de uma cor (público), criava
  rolo falso no estoque. Agora a primeira exige `is_owner()`, a segunda
  `is_staff()`, e nenhuma função do schema `public` é executável pelo `anon`
  (conferência no fim do arquivo do patch).

Quem **não** é afetado por política nenhuma: o `slicer-agent` e as Edge
Functions, que usam a `service_role`. É por isso que o patch não mudou nada
pra eles — e é também por isso que a `service_role` em texto puro no PC do
Rafael (`r3d-05`) continua sendo o ponto mais sensível do sistema.

**Como essa leitura foi feita, pra repetir:** a auditoria de 11/09 leu só o
repositório e não viu nada disto, porque o que vale é o banco. Ler o banco
real: `pg_policies` (procurar `qual = 'true'`), `pg_get_functiondef` +
`has_function_privilege('anon', oid, 'EXECUTE')`, e
`GET /auth/v1/settings` com a chave pública (campo `disable_signup`). Aplicar:
ensaiar o patch inteiro + testes numa transação que termina num
`raise exception` proposital com o resultado (desfaz tudo, inclusive o rolo de
teste), conferir que nada ficou, aplicar, e atacar de fora com a chave pública
via `curl`. O conector do Supabase da sessão não enxergava este projeto (só o
da JJ Solene); foi pelo editor SQL do painel, no Chrome do Anderson.

**View também conta (patch 55, 21/09/2026).** View sem `security_invoker` roda
com o privilégio de quem a criou e **ignora a RLS das tabelas por baixo**.
`orders_payment_status` era assim, e `authenticated` tinha SELECT nela: no
instante em que o patch 54 fechou `orders` e `payments`, a view virou o desvio
por onde uma conta de fora ainda leria valor e status de todos os pedidos.
Toda view nova nasce `with (security_invoker = true)`; depois de apertar
política, procurar view sem isso (`select relname, reloptions from pg_class
where relkind = 'v'`).

**A vitrine só enxerga as colunas da vitrine (patch 56, 21/09/2026).** A política de
`products` pro visitante escolhe LINHAS (`active`), não COLUNAS, e o `anon` tinha
SELECT na tabela inteira: com `select('*')` qualquer pessoa recebia as dicas e a
configuração de fatiamento da IA, o caminho dos modelos, o estado das filas e o
nome dos computadores do Rafa. Agora o `anon` só tem SELECT nas 16 colunas de
`COLUNAS_DA_VITRINE` ([`catalogo/index.html`](catalogo/index.html)) — o mesmo
que o patch 30 já fazia em `filament_colors`. **Coluna nova que a vitrine
precise entra nos DOIS lugares**: na lista do catálogo e num
`grant select (coluna) on products to anon`. Esquecer o grant, ou pedir `*`,
devolve 42501 e a loja abre **vazia, sem erro na tela**. E mudança assim é
sempre em dois tempos: publica o catálogo que pede menos, espera o cache de 10
min do GitHub Pages vencer, só então aperta o banco.

**Cadastro público desligado em 21/09/2026** (Authentication › Sign In /
Providers › "Allow new users to sign up"): `auth/v1/settings` responde
`disable_signup: true` e uma tentativa real de `signup` devolve
`signup_disabled`. Donos e ajudantes continuam sendo criados por Add user.
**Não religar** — se um dia precisar de cadastro de cliente, é outro
projeto de Auth ou outra tabela, não esta chave.
