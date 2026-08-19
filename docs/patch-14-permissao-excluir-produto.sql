-- =====================================================================
-- Patch 14 — permite excluir produto do catálogo
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- Faltava a POLICY de RLS de delete em products (só existia pra
-- orders/order_line_items, patch-10). Sem ela, um DELETE roda sem erro
-- mas não apaga nada de verdade. Só o dono pode excluir — igual ao
-- padrão já usado nos buckets de Storage (is_owner()).
-- =====================================================================

drop policy if exists products_delete on products;
create policy products_delete on products
  for delete to authenticated
  using (is_owner());
