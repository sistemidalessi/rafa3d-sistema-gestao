-- =====================================================================
-- Patch 34 — libera o service_role pra ler/gravar product_recipes
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- Grant é separado de RLS, e vale até pro service_role — é o que já
-- derrubou os patches 06, 09, 17 e 19 antes deste. product_recipes
-- nunca precisou disso porque só o navegador logado (dono) mexia nela;
-- só que aí toda checagem por script/local (tipo conferir o custo real
-- de um produto sem abrir a tela) batia em "permission denied".
-- =====================================================================

grant select, insert, update on product_recipes to service_role;
