# Ambiente de demonstração

Como montar uma versão pública do sistema, com dados inventados, para mostrar a
clientes em potencial sem expor nada da Rafa 3D.

## O caminho aqui é mais simples que o da JJ Solene

No sistema da JJ Solene a demonstração precisa **copiar** o banco de produção e
anonimizar depois, porque lá o schema não é versionado — recriar à mão sairia
diferente do que está no ar.

Aqui não. O schema deste projeto está inteiro em `docs/`, em patches
idempotentes, e os dois imports trazem os 161 produtos do catálogo e as 30 cores
de filamento. Dá para montar um projeto de demonstração **do zero, sem encostar
na produção**.

A diferença importa: como nada é copiado, **nenhum dado real de cliente passa em
momento nenhum pelo projeto de demonstração**, e não existe script de
anonimização para rodar (nem risco de esquecer de rodar). O que falta para a
demonstração parecer viva — clientes, pedidos, fila, projetos — vem inventado de
[`demo-dados.sql`](demo-dados.sql).

As fotos dos produtos também não são problema: `products.image_path` aponta para
`assets/` dentro do próprio repositório, não para o Storage. O catálogo aparece
completo desde o primeiro minuto.

## 1. Criar o projeto

No painel do Supabase, **New project**, nome `rafa3d-demo`, mesma região do
projeto de produção. Guarde a senha do banco.

## 2. Montar o banco

No SQL Editor do projeto novo, rode na ordem descrita no
[README](../README.md#1-banco-supabase): `schema-inicial.sql`, depois os patches
`01` a `11`, depois `import-filamentos.sql` e `import-produtos.sql`.

Os patches `04` e `09` criam sozinhos os buckets de Storage (`modelos-3d` e
`projetos-fotos`) com as policies certas. Eles nascem vazios, que é exatamente o
que se quer: as fotos de referência de projeto são fotos que clientes de verdade
mandaram, e nenhuma vem para cá.

## 3. Marcar como demonstração e popular

```sql
create table if not exists este_banco_e_demo ();
```

Depois rode [`demo-dados.sql`](demo-dados.sql) inteiro: 8 clientes, 7 pedidos
espalhados pelos status, 12 itens de catálogo, 2 projetos personalizados,
3 impressoras, 6 rolos de filamento e 5 pagamentos — tudo inventado.

A tabela `este_banco_e_demo` é uma trava: sem ela o script se recusa a rodar.
Ela não existe no projeto de produção e não deve ser criada lá, senão a proteção
some. Serve para o dia em que as duas abas do SQL Editor estiverem abertas lado
a lado.

No fim do arquivo há as consultas de conferência — rode e confira as contagens.

## 4. Criar o usuário de demonstração

Em **Authentication → Add user**:

- E-mail: `demo@sistemidalessi.com.br`
- Senha: uma simples, de uso público — ela vai ficar escrita no README
- Marque **Auto Confirm User**

Copie o `id` do usuário e rode:

```sql
insert into profiles (id, full_name, role)
values ('COLE_O_ID_AQUI', 'Visitante', 'owner');
```

Papel `owner` de propósito: numa base inventada não há custo nem margem a
proteger, e a graça é a pessoa ver o sistema inteiro. O papel `helper` esconde
justamente as telas de dinheiro, que são as que impressionam.

Sem essa linha o login funciona mas o sistema mostra "Acesso não liberado" —
existe usuário, mas não existe perfil.

## 5. O agente fica de fora

O `slicer-agent` **não roda** contra o projeto de demonstração, e a
`service_role key` dele nunca sai daqui — é a chave que passa por cima de toda a
RLS.

A consequência é conhecida e está contornada: sem agente, qualquer botão que
enfileira trabalho ("Abrir no Fatiador", "Analisar com IA", geração Meshy)
deixaria a linha em `queued` para sempre, girando na tela. Por isso o
`demo-dados.sql` já entrega dois projetos e dois produtos com a colinha de
fatiamento **pronta e com status `done`** — o visitante vê o resultado da
funcionalidade em vez de uma fila travada.

O que ainda acontece: se o visitante clicar num desses botões durante a
demonstração, aquele item entra em `queued` e fica. Não quebra nada e some
rodando o bloco de limpeza no fim do `demo-dados.sql`, mas convém saber antes de
mostrar. Se isso incomodar, dá para esconder esses botões quando o sistema
estiver apontando para o projeto de demonstração — me peça que eu faço.

## 6. Publicar

Com o projeto pronto, me passe **a URL e a chave anônima** dele (Settings →
API). A chave anônima pode ser pública — quem protege o banco é a RLS, e aqui
não há nada real a proteger de qualquer forma.

Com esses dois valores eu monto a versão de demonstração servida pelo GitHub
Pages junto com o resto do repositório, já entrando logada, e acrescento o link
no README da Sistemi Dalessi.

## 7. Atualizar depois

Quando o sistema ganhar patch novo de banco, rode o patch também no projeto de
demonstração — é a mesma sequência de sempre, e como os patches são idempotentes
não tem risco de rodar de novo. Os dados inventados continuam valendo; só é
preciso mexer no `demo-dados.sql` se a mudança criar uma tela que fique vazia
sem dado novo.
