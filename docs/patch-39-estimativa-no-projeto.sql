-- =====================================================================
-- Patch 39 — projeto guarda a gramatura/horas estimadas, não só o custo
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- Item de catálogo tem product_recipes pra guardar gramas/horas por
-- peça e reaproveitar em qualquer pedido futuro. Projeto personalizado
-- (line_type = 'custom') não tem product_id, então não tem onde guardar
-- isso — a pessoa digitava os números em "Aprovar esse pedido", eles
-- viravam só um valor em R$ (unit_cost_estimate) e sumiam depois.
-- Resultado: "Terminei de imprimir" pedia tudo de novo do zero, mesmo
-- pra uma encomenda de 60 peças que já tinha passado por essa conta.
--
-- estimated_grams / estimated_print_hours aqui guardam o valor POR
-- PEÇA, na mesma convenção de product_recipes — "Terminei" multiplica
-- pela quantidade igual já faz com a receita de produto.
-- =====================================================================

alter table order_line_items add column if not exists estimated_grams numeric(10,2);
alter table order_line_items add column if not exists estimated_print_hours numeric(10,2);

-- Sem grant novo de propósito: quem grava isso é o navegador logado do
-- dono/ajudante (RLS de sempre em order_line_items, já usada por
-- unit_price/unit_cost_estimate) — nada novo usa service_role aqui.

-- ---------------------------------------------------------------------
-- Conferência: as duas colunas têm que aparecer.
-- ---------------------------------------------------------------------
select column_name from information_schema.columns
  where table_name = 'order_line_items' and column_name in ('estimated_grams', 'estimated_print_hours');
