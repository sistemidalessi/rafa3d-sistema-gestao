-- =====================================================================
-- Patch 06 — concede acesso à tabela products pro service_role
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- Por que isso é necessário: tabelas criadas pelo SQL Editor (como todas
-- as deste projeto) não recebem os GRANTs automáticos que o Supabase
-- aplica sozinho quando a tabela é criada pela interface visual (Table
-- Editor) — isso vale até pro service_role, mesmo ele ignorando RLS.
-- Sem isso, o agente de fatiamento local (slicer-agent, que usa a chave
-- service_role) recebe "permission denied for table products" ao tentar
-- ler a fila de fatiamento.
-- =====================================================================

grant usage on schema public to service_role;
grant select, update on products to service_role;
