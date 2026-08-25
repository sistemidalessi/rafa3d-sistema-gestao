-- =====================================================================
-- Patch 31 — o pedido passa a ser pago inteiro na hora
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- Até 24/08/2026 a loja cobrava metade adiantado e metade quando a peça
-- ficava pronta. Passou a cobrar tudo de uma vez.
--
-- Isto aqui muda só o PADRÃO, pros pedidos que ainda vão nascer. Pedido
-- que já existe fica como está de propósito: ele guarda a regra que
-- valia no dia em que foi feito, e reescrever isso mudaria o que foi
-- combinado com um cliente de verdade.
-- =====================================================================

alter table orders alter column expected_deposit_pct set default 100.00;

comment on column orders.expected_deposit_pct is
  'Quanto o cliente paga adiantado, em %. Era 50 (metade agora, metade na entrega) até 24/08/2026; virou 100. Fica gravado no pedido pra que pedido antigo continue contando a regra dele.';

-- ---------------------------------------------------------------------
-- Conferência 1: o padrão novo.
-- ---------------------------------------------------------------------
select column_default as padrao_novo
  from information_schema.columns
  where table_name = 'orders' and column_name = 'expected_deposit_pct';

-- ---------------------------------------------------------------------
-- Conferência 2: quais pedidos ficaram na regra antiga.
--
-- São os que foram feitos antes da mudança. Se algum deles ainda não
-- foi pago e você quiser cobrar o valor cheio, converse com o cliente
-- primeiro — e aí sim mude na mão, um por um.
-- ---------------------------------------------------------------------
select order_number, status, total_amount, expected_deposit_pct
  from orders
  where expected_deposit_pct <> 100
  order by created_at desc;
