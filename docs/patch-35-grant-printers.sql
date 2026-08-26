-- =====================================================================
-- Patch 35 — libera o service_role pra ler printers
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- Achado conferindo a receita de custo do Organizador de Controle
-- Remoto II logo depois do patch 34: product_recipes.printer_id
-- resolvia certinho, mas buscar o NOME da impressora batia em
-- "permission denied for table printers" — mesma classe de bug dos
-- patches 06, 09, 17, 19 e 34, só que numa tabela diferente.
-- =====================================================================

grant select on printers to service_role;
