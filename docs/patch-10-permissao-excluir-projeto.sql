-- =====================================================================
-- Patch 10 — permite excluir projeto (orders/order_line_items)
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- O GRANT de DELETE já existia (schema inicial concede pra todas as
-- tabelas), mas faltava a POLICY de RLS pra permitir de verdade —
-- sem policy de delete, a exclusão é bloqueada mesmo com o GRANT.
-- =====================================================================

drop policy if exists orders_delete on orders;
create policy orders_delete on orders for delete to authenticated using (true);

drop policy if exists order_line_items_delete on order_line_items;
create policy order_line_items_delete on order_line_items for delete to authenticated using (true);
