-- =====================================================================
-- Patch 01 — grants de tabela pro papel authenticated
-- Rode só isto (não precisa rodar o schema-inicial.sql de novo — ele já
-- foi aplicado e rodar de novo daria erro nas políticas, que já existem).
--
-- Motivo: "Automatically expose new tables" foi desativado na criação do
-- projeto (mais seguro), então as tabelas não ganharam GRANT automático
-- pro papel authenticated. Sem GRANT, a consulta nem chega a ser avaliada
-- pela RLS — dá erro 42501 "permission denied" direto. RLS continua
-- sendo quem decide QUAIS LINHAS aparecem; isto aqui só libera a consulta
-- na tabela em si.
-- =====================================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
