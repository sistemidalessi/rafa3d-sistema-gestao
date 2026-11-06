-- =====================================================================
-- Patch 64 (06/11/2026): tabela nova não nasce aberta ao visitante
--
-- Hoje nenhuma das 18 tabelas dá privilégio ao anon (patches 54 e 59), e o
-- padrão de sequência e de função do postgres já não dá nada a ele. Mas o
-- padrão de TABELA do postgres continua dando tudo ao anon: a próxima tabela
-- criada pelo SQL Editor nasce com SELECT/INSERT/UPDATE/DELETE/TRUNCATE do
-- visitante, e só o RLS segura. Achado ao conferir, no mesmo dia, o que o CRM
-- da OneClean tinha (37 tabelas abertas por esse motivo).
--
-- Tabela nova que o catálogo precise ler: grant por coluna, de propósito,
-- como no patch 54 (products).
--
-- Como aplicar: 1) rodar o ENSAIO (bloco DO no fim, sozinho) e conferir a
-- mensagem; 2) com o "sim" do Anderson, rodar o bloco begin/commit.
-- =====================================================================

begin;

alter default privileges for role postgres in schema public revoke all on tables from anon;

commit;

-- =====================================================================
-- ENSAIO: cria uma tabela de teste antes e depois para ver o padrão, e
-- desfaz tudo no fim (o raise exception derruba a transação).
-- =====================================================================
/*
do $$
declare nova_antes boolean; nova_depois boolean; auth_depois boolean;
begin
  create table public.ensaio_padrao_antes (id int);
  nova_antes := has_table_privilege('anon', 'public.ensaio_padrao_antes', 'SELECT');

  alter default privileges for role postgres in schema public revoke all on tables from anon;

  create table public.ensaio_padrao_depois (id int);
  nova_depois := has_table_privilege('anon', 'public.ensaio_padrao_depois', 'SELECT');
  auth_depois := has_table_privilege('authenticated', 'public.ensaio_padrao_depois', 'SELECT');

  raise exception 'ENSAIO >> tabela nova abre ao visitante: antes %, depois %; conta logada na tabela nova: %',
    nova_antes, nova_depois, auth_depois;
end $$;
*/
