-- =====================================================================
-- Patch 36 — custo extra (embalagem, personalização...) na receita
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- Mesma ideia da pergunta "tem pintura?" (patch-15), mas pra tudo que
-- não é filamento, luz nem pintura e mesmo assim sai do bolso: caixa
-- especial, fita, cartão, gravação de nome, personalização de foto.
-- Diferente da pintura (sempre 20% do filamento+luz), aqui é um valor
-- em R$ direto — embalagem não escala com o tamanho da peça do mesmo
-- jeito que tinta escala.
-- =====================================================================

alter table product_recipes add column if not exists extra_cost numeric(10,2) not null default 0;

grant select, insert, update on product_recipes to service_role;

-- ---------------------------------------------------------------------
-- Conferência: a coluna tem que aparecer.
-- ---------------------------------------------------------------------
select column_name from information_schema.columns
  where table_name = 'product_recipes' and column_name = 'extra_cost';
