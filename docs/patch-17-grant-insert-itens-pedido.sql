-- =====================================================================
-- Patch 17 — falta grant de INSERT em order_line_items pro service_role
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- Mesma pegadinha do patch-06: GRANT é por cima de RLS, vale até pra
-- service_role. O patch-09 deu select/update em order_line_items pro
-- agente local (que só atualiza item que já existe) — a Edge Function
-- finalizar-pedido é a primeira coisa que precisa CRIAR item novo como
-- service_role, e faltava esse grant.
-- =====================================================================

grant insert on order_line_items to service_role;
