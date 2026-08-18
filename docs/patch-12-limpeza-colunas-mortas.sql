-- =====================================================================
-- Patch 12 — apaga as colunas de Viabilidade, que ficaram mortas
-- Rode este arquivo no SQL Editor do Supabase (projeto Rafa 3D).
--
-- O patch 09 criou uma etapa de "Viabilidade por IA" nos Projetos ("dá
-- pra imprimir isso?"), que foi removida da tela pouco depois. As
-- colunas continuaram no banco desde então, sem ninguém escrever nem
-- ler nada nelas — hoje não existe uma linha sequer de código no
-- sistema ou no agente que mencione ai_viability_*.
--
-- ATENÇÃO: drop column não tem desfazer. Por isso este arquivo tem dois
-- passos separados — NÃO rode tudo de uma vez.
-- =====================================================================


-- ---------------------------------------------------------------------
-- PASSO 1 — confira se tem alguma coisa guardada aí. Rode SÓ este
-- select primeiro (selecione o bloco e dê Run).
--
-- Se vier tudo 0, pode seguir tranquilo pro passo 2.
-- Se vier algum número diferente de 0, são análises de verdade da época
-- em que a etapa existia: copie o que interessa (ou jogue pro campo de
-- observações do projeto) ANTES de apagar.
-- ---------------------------------------------------------------------
select
  count(*) filter (where ai_viability_status       is not null) as com_status,
  count(*) filter (where ai_viability_notes        is not null) as com_analise_escrita,
  count(*) filter (where ai_viability_error        is not null) as com_erro,
  count(*) filter (where ai_viability_requested_at is not null) as com_data_pedido,
  count(*) filter (where ai_viability_done_at      is not null) as com_data_conclusao
from order_line_items
where line_type = 'custom';


-- ---------------------------------------------------------------------
-- PASSO 2 — a limpeza em si. Só rode depois de conferir o passo 1.
-- ---------------------------------------------------------------------
drop index if exists order_line_items_ai_viability_queued_idx;

alter table order_line_items drop column if exists ai_viability_status;
alter table order_line_items drop column if exists ai_viability_notes;
alter table order_line_items drop column if exists ai_viability_error;
alter table order_line_items drop column if exists ai_viability_requested_at;
alter table order_line_items drop column if exists ai_viability_done_at;
