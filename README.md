# Rafa 3D — Sistema de Gestão

Sistema interno da Rafa 3D Dalessi: pedidos, fila de impressão, estoque de
filamento, custo e preço, catálogo público que **fecha pedido sozinho** (frete
real, PIX, etiqueta de envio) e os pedidos personalizados ("Projetos"), onde o
cliente manda uma foto e a IA gera o modelo 3D.

Sem build, sem framework, sem `npm install` pro site — é HTML e JavaScript
puro, servido como arquivo estático, falando direto com o Supabase.

---

## As peças

| Pasta / arquivo | O que é | Onde roda |
|---|---|---|
| [`index.html`](index.html) | O sistema de gestão inteiro (login + todas as abas) num arquivo só | Navegador, com login |
| [`catalogo/`](catalogo/) | Catálogo público: lê os produtos ao vivo e fecha a compra | Navegador, sem login |
| [`supabase/functions/`](supabase/functions/) | Três Edge Functions (Deno): frete, fechamento do pedido e etiqueta | Servidor do Supabase |
| [`slicer-agent/`](slicer-agent/) | Agente Node que fala com o fatiador e com as APIs de IA | Máquina do Rafael, em segundo plano |
| [`sw.js`](sw.js) | Service worker — deixa a notificação chegar com o sistema fechado | Navegador |
| [`docs/`](docs/) | Schema e patches SQL, rodados à mão no SQL Editor do Supabase | — |

O banco (Postgres + Auth + Storage) é um projeto Supabase. A `anon key` fica
no [`index.html`](index.html) e pode ficar mesmo — quem protege os dados é a
Row Level Security do banco, não o segredo da chave.

---

## O padrão central: fila no banco + agente local

O navegador **nunca** fala com o Bambu Studio, com o OrcaSlicer ou com as APIs
de IA. Ele não tem como — é uma página web numa máquina qualquer, e a chave que
autoriza esse tipo de operação (`service_role`) não pode sair do computador do
Rafael.

Então tudo que precisa do mundo real funciona assim:

1. O usuário clica num botão (ex: "Abrir no Fatiador").
2. O navegador só grava uma coluna de status no banco: `open_slicer_status = 'queued'`.
3. O agente, rodando na máquina do Rafael, vê a linha na fila (polling a cada 5s),
   marca `'processing'`, faz o trabalho de verdade e grava `'done'` ou `'error'`
   junto com a mensagem de erro.
4. A tela do usuário mostra o resultado quando recarrega aquela aba.

São nove filas hoje — as mesmas três operações sobre três tabelas diferentes,
todas no mesmo laço da `main()` em [`agent.js`](slicer-agent/agent.js):

| Operação | Produto do catálogo | Projeto | Parte de projeto |
|---|---|---|---|
| Gerar modelo 3D (Meshy, a partir da foto) | — | `meshy_status` | `meshy_status` |
| Colinha de fatiamento por IA | `ai_analysis_status` | `ai_analysis_status` | `ai_analysis_status` |
| Abrir no Fatiador | `open_slicer_status` | `open_slicer_status` | `open_slicer_status` |
| Fatiamento automático por linha de comando | `slice_status` (sem botão na tela) | — | — |

Tabelas: `products`, `order_line_items` (com `line_type = 'custom'`) e
`project_parts`.

Se o agente estiver desligado, nada quebra — os pedidos ficam parados em
`queued` e são processados quando ele voltar.

### Abrir no Fatiador já configurado

O modelo que a Meshy devolve é `.stl` puro, sem configuração nenhuma. Por isso
[`gerar3mf.js`](slicer-agent/gerar3mf.js) converte esse `.stl` num `.3mf` de
verdade, partindo de um template real já testado
([`template-3mf/`](slicer-agent/template-3mf/)) e trocando só os ~10 valores
que a colinha da IA decidiu — os outros 500+ ajustes ficam como já funcionam.
Se a conversão falhar, cai pro `.stl` puro em vez de travar o pedido.

---

## O que roda no servidor (Edge Functions)

Coisas que não podem rodar no navegador (porque envolvem token de dinheiro ou
precisam revalidar preço) ficam em [`supabase/functions/`](supabase/functions/),
em Deno. O catálogo chama por `fetch` no `SB_FUNC_URL`:

| Função | O que faz |
|---|---|
| `calcular-frete` | Consulta o Melhor Envio de verdade e devolve as opções pro cliente escolher |
| `finalizar-pedido` | **Revalida os preços no servidor** (nunca confia no navegador), cria o pedido e os itens, gera o PIX copia-e-cola e dispara os avisos |
| `gerar-etiqueta` | Compra a etiqueta no Melhor Envio e guarda rastreio + link de impressão. Confere o cargo de quem chamou antes de gastar dinheiro |

O PIX é gerado na mão, pelo padrão aberto do Banco Central — **não há gateway
de pagamento**. Foi decisão explícita: automatizar exigiria conta de gateway no
CPF do responsável, e isso não se mistura com finanças pessoais. O cliente paga
na chave fixa e manda o comprovante por WhatsApp.

Aviso de pedido novo sai por dois canais, porque o Rafa tem 10 anos e não fica
online o dia inteiro: **e-mail** (Resend) e **notificação push** (Web Push API
com chaves VAPID + [`sw.js`](sw.js)). O WhatsApp automático ficou de fora — ele
exigiria conta comercial verificada num número diferente do que já se usa.

### Segredos das funções

Ficam nos secrets do projeto Supabase, nunca no código:

```
MELHOR_ENVIO_TOKEN     MELHOR_ENVIO_ORIGEM
PIX_KEY                PIX_MERCHANT_NAME       PIX_MERCHANT_CITY
RESEND_API_KEY         NOTIFY_EMAILS
VAPID_PUBLIC_KEY       VAPID_PRIVATE_KEY       VAPID_SUBJECT
WHATSAPP_NUMBER
```

Pra publicar uma função depois de mexer nela, é a CLI do Supabase:

```bash
supabase functions deploy finalizar-pedido
```

---

## Papéis de acesso

Dois papéis, na coluna `role` da tabela `profiles`:

- **`owner`** (Rafael) — vê tudo.
- **`helper`** (ajudante) — só Dashboard, Projetos, Pedidos, Fila e Clientes.
  Não vê custo nem preço de custo.

Isso é aplicado em dois lugares, e os dois importam: `HELPER_ALLOWED_TABS` em
[`index.html`](index.html) esconde as abas, e as policies de RLS no banco
impedem de verdade a leitura. Esconder a aba sozinho não protegeria nada.

---

## Trabalhando em duas máquinas

O desenvolvimento acontece em dois computadores (casa e escritório), então vale
conferir o que cada um precisa antes de começar — já aconteceu de faltar Node
numa delas e o agente simplesmente não rodar.

| Precisa | Pra quê | Onde é obrigatório |
|---|---|---|
| **git** | Óbvio | Nas duas |
| **Node.js** | Rodar o agente e o `npx serve` do [`.claude/launch.json`](.claude/launch.json) | Nas duas |
| **Bambu Studio** | "Abrir no Fatiador" de verdade | Onde ficam as impressoras |
| **OrcaSlicer** | Só o fatiamento por linha de comando (hoje sem botão) | Opcional |
| **CLI do Supabase** | Publicar Edge Function (`supabase functions deploy`) | Em quem for mexer nelas |
| **`slicer-agent/.env`** | Segredos do agente | Onde o agente roda |

No Windows, o que falta se instala com:

```bash
winget install OpenJS.NodeJS.LTS
winget install Supabase.CLI
```

Depois de instalar o Node, o agente precisa das dependências dele naquela
máquina (`node_modules` não vai pro repositório):

```bash
cd slicer-agent
npm install
```

O `.env` também não viaja — cada máquina tem o seu, preenchido a partir do
[`.env.example`](slicer-agent/.env.example). É de propósito: ele carrega a
`service_role key`.

O sistema em si (a página) funciona de qualquer máquina, sempre. O que depende
de máquina é só o agente: sem ele ligado, os botões de fatiador e de IA ficam
esperando na fila até alguém ligar.

**O agente pode rodar nos dois** — e desde o patch-25 isso é seguro. Cada
agente se anuncia com o nome do próprio computador, e o sistema pergunta uma
vez em qual deles você está; a janela do fatiador abre só naquele. Antes disso
a fila não tinha destino, e quem pegasse primeiro abria o arquivo — podia ser
o computador vazio da outra sala.

---

## Montando do zero

### 1. Banco (Supabase)

Rode no SQL Editor, **nesta ordem**. Todos são idempotentes — rodar de novo não
duplica nada.

```
docs/schema-inicial.sql
docs/patch-01-grants.sql                     docs/patch-13-fotos-produto-upload.sql
docs/patch-02-custo-automatico.sql           docs/patch-14-permissao-excluir-produto.sql
docs/patch-03-catalogo-publico.sql           docs/patch-15-precificacao-como-planilha.sql
docs/patch-04-biblioteca-3d.sql              docs/patch-16-checkout-catalogo.sql
docs/patch-05-fatiamento-automatico.sql      docs/patch-17-grant-insert-itens-pedido.sql
docs/patch-06-grant-service-role.sql         docs/patch-18-etiqueta-envio.sql
docs/patch-07-analise-ia.sql                 docs/patch-19-grant-profiles-service-role.sql
docs/patch-08-abrir-no-fatiador.sql          docs/patch-20-feedback-colinha.sql
docs/patch-09-projetos-personalizados.sql    docs/patch-21-notificacoes.sql
docs/patch-10-permissao-excluir-projeto.sql  docs/patch-22-colinha-estruturada.sql
docs/patch-11-analise-ia-projetos.sql        docs/patch-23-partes-do-projeto.sql
docs/patch-12-limpeza-colunas-mortas.sql
docs/patch-24-corrige-reativar-avisos.sql        docs/patch-25-abrir-no-computador-certo.sql
```

O patch 12 é o único que não se roda de olhos fechados: ele apaga colunas, e
`drop column` não tem desfazer. O arquivo é dividido em dois passos — o passo 1
mostra se há algo guardado ali, o passo 2 apaga. Leia o cabeçalho dele antes.

Depois, os dados iniciais (opcional, só num banco novo):

```
docs/import-filamentos.sql   -- as 30 cores a R$ 99,00/kg
docs/import-produtos.sql     -- os 161 produtos do catálogo
```

### 2. Primeiro usuário

Crie em **Authentication → Add user** e depois rode, trocando o UUID:

```sql
insert into profiles (id, full_name, role)
values ('<uuid-do-usuario>', 'Rafael Dalessi', 'owner');
```

Sem essa linha o login funciona mas o sistema mostra "Acesso não liberado" —
existe usuário, mas não existe perfil.

### 3. Site

É arquivo estático: `index.html` na raiz e `catalogo/index.html`. Não tem passo
de build. Abrir o arquivo direto com `file://` não funciona por causa do CORS
do Supabase — precisa de um servidor estático. O
[`.claude/launch.json`](.claude/launch.json) já deixa os dois prontos
(`sistema-local` na 8081, `catalogo-local` na 8080), ou na mão:

```bash
npx serve .
```

### 4. Funções e segredos

Publique as três funções e cadastre os secrets listados acima, pela CLI do
Supabase. Sem `MELHOR_ENVIO_TOKEN` o checkout não calcula frete; sem
`RESEND_API_KEY`/VAPID os avisos não saem, mas o pedido é criado do mesmo jeito.

### 5. Agente local (só na máquina do Rafael)

Precisa do Node.js instalado, do Bambu Studio (pro "Abrir no Fatiador") e do
OrcaSlicer (pro fatiamento por linha de comando).

```bash
cd slicer-agent
npm install
copy .env.example .env
```

Preencha o `.env` — as instruções de cada variável estão dentro do próprio
[`.env.example`](slicer-agent/.env.example). O mínimo é `SUPABASE_URL` e
`SUPABASE_SERVICE_ROLE_KEY`; sem `ANTHROPIC_API_KEY` e `MESHY_API_KEY` o agente
roda normal, só com a IA desligada.

Pra rodar vendo o que ele está fazendo:

```bash
npm start
```

Pra rodar no dia a dia, sem janela nenhuma, dê dois cliques em
`start-hidden.vbs` — a saída vai pro `agent.log` na mesma pasta. Pra ele subir
sozinho junto com o Windows, coloque um atalho desse `.vbs` na pasta de
inicialização (`Win+R` → `shell:startup`).

---

## Segredos

Três lugares, e nenhum deles é o repositório:

- **`slicer-agent/.env`** — a `service_role key`, que passa por cima de toda a
  RLS, mais as chaves da Anthropic e da Meshy. Está no
  [`.gitignore`](.gitignore) e nunca deve ser commitada, colada em chat ou
  copiada pro navegador.
- **Secrets do projeto Supabase** — token do Melhor Envio (compra etiqueta com
  dinheiro de verdade), Resend, VAPID e os dados do PIX.
- **`anon key` no `index.html`** — essa é a exceção: ela é feita pra ser
  pública, e quem protege os dados é a RLS.

---

## Convenções do projeto

- **Sem build, sem framework.** Se uma mudança pedir bundler, transpilador ou
  `node_modules` no site, provavelmente tem um jeito mais simples.
- **Comentário explica o *porquê*, não o *o quê*.** O código diz o que faz;
  o comentário existe pra registrar a decisão e o motivo — de preferência com
  o sintoma real que causou ela ("chegou a 99MB num teste, pra um chaveiro").
- **Português em tudo:** comentários, mensagens de erro, nome de coluna nova
  quando for de domínio, e mensagem de commit.
- **Mudança de banco vira um patch numerado novo** em `docs/`, com cabeçalho
  explicando o porquê. Nunca edite um patch já rodado — o banco de produção já
  passou por ele.
- **Todo texto de tela é lido por uma criança de 10 anos**, não por um
  programador. Diga o que aconteceu e o que fazer ("Fatie esta manualmente no
  programa"), não o stack trace. O [CLAUDE.md](CLAUDE.md) tem a regra inteira.
