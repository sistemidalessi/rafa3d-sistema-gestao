-- =====================================================================
-- Patch 64 (06/11/2026): tabela nova não nasce aberta ao visitante
--
-- APLICADO em 06/11/2026 com o "sim" do Anderson.
--
-- Hoje nenhuma das 18 tabelas dá privilégio ao anon (patches 54 e 59), e o
-- padrão de sequência e de função do postgres já não dá nada a ele. O padrão
-- de TABELA do postgres ainda dava ao anon REFERENCES, TRIGGER e MAINTAIN
-- ("xtm"; ler, gravar, apagar e TRUNCATE já tinham saído). Nada disso é
-- alcançável pela API, mas é resto: agora tabela nova nasce sem nada do anon.
-- Conferido no mesmo dia em que o CRM da OneClean tinha 37 tabelas abertas por
-- causa do padrão. (A primeira descrição deste patch dizia "dá tudo ao anon":
-- estava errada, a consulta não separava os privilégios; o ensaio mostrou.)
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
declare antes text; depois text; auth_depois boolean;
begin
  create table public.ensaio_padrao_antes (id int);
  select concat_ws(',', case when has_table_privilege('anon', 'public.ensaio_padrao_antes', 'REFERENCES') then 'REFERENCES' end,
                        case when has_table_privilege('anon', 'public.ensaio_padrao_antes', 'TRIGGER') then 'TRIGGER' end,
                        case when has_table_privilege('anon', 'public.ensaio_padrao_antes', 'SELECT') then 'SELECT' end) into antes;

  alter default privileges for role postgres in schema public revoke all on tables from anon;

  create table public.ensaio_padrao_depois (id int);
  select concat_ws(',', case when has_table_privilege('anon', 'public.ensaio_padrao_depois', 'REFERENCES') then 'REFERENCES' end,
                        case when has_table_privilege('anon', 'public.ensaio_padrao_depois', 'TRIGGER') then 'TRIGGER' end,
                        case when has_table_privilege('anon', 'public.ensaio_padrao_depois', 'SELECT') then 'SELECT' end) into depois;
  auth_depois := has_table_privilege('authenticated', 'public.ensaio_padrao_depois', 'SELECT');

  raise exception 'ENSAIO >> visitante na tabela nova: antes [%], depois [%]; conta logada lê a tabela nova: %', antes, depois, auth_depois;
end $$;
-- Resultado em 06/11: antes [REFERENCES,TRIGGER], depois [], conta logada lê: true.
*/
