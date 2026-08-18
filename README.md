# Rafa 3D — Sistema de Gestão

Sistema interno da Rafa 3D Dalessi: pedidos, fila de impressão, estoque de
filamento, custo/margem, catálogo público e os pedidos personalizados
("Projetos"), onde o cliente manda uma foto e a IA gera o modelo 3D.

Sem build, sem framework, sem `npm install` pro site — é HTML e JavaScript
puro, servido como arquivo estático, falando direto com o Supabase.

---

## As três peças

| Pasta / arquivo | O que é | Onde roda |
|---|---|---|
| [`index.html`](index.html) | O sistema de gestão inteiro (login + todas as abas) num arquivo só | Navegador, com login |
| [`catalogo/`](catalogo/) | Catálogo público, lê os produtos do Supabase ao vivo | Navegador, sem login |
| [`slicer-agent/`](slicer-agent/) | Agente Node que fala com o fatiador e com as APIs de IA | Máquina do Rafael, em segundo plano |
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

São seis filas hoje, todas no mesmo laço em [`agent.js`](slicer-agent/agent.js):

| Fila | Tabela | Coluna de status | O que faz |
|---|---|---|---|
| Fatiamento automático | `products` | `slice_status` | Fatia por linha de comando no OrcaSlicer (sem botão na tela hoje) |
| Análise IA — produto | `products` | `ai_analysis_status` | Colinha de fatiamento pela Claude, a partir da miniatura de dentro do `.3mf` |
| Abrir no Fatiador — produto | `products` | `open_slicer_status` | Baixa o arquivo e abre no Bambu Studio |
| Geração Meshy | `order_line_items` | `meshy_status` | Foto do cliente → modelo `.stl` (Image-to-3D) |
| Abrir no Fatiador — projeto | `order_line_items` | `open_slicer_status` | Igual ao de produto, lendo do projeto |
| Análise IA — projeto | `order_line_items` | `ai_analysis_status` | Colinha de fatiamento do projeto |

Se o agente estiver desligado, nada quebra — os pedidos ficam parados em
`queued` e são processados quando ele voltar.

---

## Papéis de acesso

Dois papéis, na coluna `role` da tabela `profiles`:

- **`owner`** (Rafael) — vê tudo.
- **`helper`** (ajudante) — só Dashboard, Projetos, Pedidos, Fila e Clientes.
  Não vê custo nem margem.

Isso é aplicado em dois lugares, e os dois importam: `HELPER_ALLOWED_TABS` em
[`index.html`](index.html) esconde as abas, e as policies de RLS no banco
impedem de verdade a leitura. Esconder a aba sozinho não protegeria nada.

---

## Montando do zero

### 1. Banco (Supabase)

Rode no SQL Editor, **nesta ordem**. Todos são idempotentes — rodar de novo não
duplica nada.

```
docs/schema-inicial.sql
docs/patch-01-grants.sql
docs/patch-02-custo-automatico.sql
docs/patch-03-catalogo-publico.sql
docs/patch-04-biblioteca-3d.sql
docs/patch-05-fatiamento-automatico.sql
docs/patch-06-grant-service-role.sql
docs/patch-07-analise-ia.sql
docs/patch-08-abrir-no-fatiador.sql
docs/patch-09-projetos-personalizados.sql
docs/patch-10-permissao-excluir-projeto.sql
docs/patch-11-analise-ia-projetos.sql
docs/patch-12-limpeza-colunas-mortas.sql
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
de build. Pra testar local, qualquer servidor estático serve (abrir o arquivo
direto com `file://` não funciona por causa do CORS do Supabase):

```bash
npx serve .
```

### 4. Agente local (só na máquina do Rafael)

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

O `.env` do agente carrega a `service_role key`, que passa por cima de toda a
RLS — quem tem essa chave tem acesso total ao banco. Ela está no
[`.gitignore`](.gitignore) e nunca deve ser commitada, colada em chat ou
copiada pro navegador. As chaves da Anthropic e da Meshy ficam no mesmo arquivo
pelo mesmo motivo.

A `anon key` no `index.html` é outra coisa: ela é feita pra ser pública.

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
- **Mensagem de erro é lida pelo Rafael, não por um programador.** Diga o que
  aconteceu e o que fazer ("Fatie esta manualmente no programa"), não o stack
  trace.
