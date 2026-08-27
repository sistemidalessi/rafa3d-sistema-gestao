-- =====================================================================
-- Patch 41 — custo extra que só aparece DEPOIS da venda
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- product_recipes.extra_cost (patch-36) é o custo extra que você já
-- sabe ANTES de vender — entra na conta que sugere o preço. Esse aqui é
-- diferente: um gasto que só aparece DEPOIS, numa venda específica —
-- a argola e a corrente que faltou contar num chaveiro, uma embalagem
-- de cortesia que o cliente pediu depois de já ter pago. Não pode subir
-- o preço (o cliente já pagou ou já combinou), mas ainda sai do seu
-- bolso — por isso entra na conta de "Quanto sobrou" sem mexer no
-- unit_price.
-- =====================================================================

alter table order_line_items add column if not exists post_sale_extra_cost numeric(10,2);

-- Sem grant novo de propósito: quem grava isso é o navegador logado do
-- dono/ajudante (RLS de sempre em order_line_items) — nada novo usa
-- service_role aqui.
