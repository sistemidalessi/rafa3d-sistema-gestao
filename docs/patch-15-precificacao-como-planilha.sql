-- =====================================================================
-- Patch 15 — precificação passa a seguir a planilha que o Anderson já usa
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- A conta de custo trocou "quanto tempo você mexe na peça depois" por
-- "teve pintura?" (soma 20% em cima do filamento+luz quando sim), igual
-- à planilha real que já é usada pra precificar. Por isso product_recipes
-- ganha has_painting.
--
-- post_processing_minutes e post_processing_labor_rate ficam pra trás
-- (não são mais lidos nem escritos pela tela) mas não foram apagados —
-- mesma cautela do patch-12 com as colunas ai_viability_*: só dropar
-- depois de confirmar que ninguém precisa mais desses dados antigos.
-- =====================================================================

alter table product_recipes add column if not exists has_painting boolean not null default false;
