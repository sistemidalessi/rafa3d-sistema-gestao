-- =====================================================================
-- Patch 18 — dados pra gerar a etiqueta de envio de verdade
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- Pra comprar e gerar a etiqueta pelo Melhor Envio de verdade, faltavam
-- duas coisas que o checkout não coletava: o id do serviço de frete
-- escolhido (não é só o nome "SEDEX", é um número que o Melhor Envio
-- usa) e o CPF de quem recebe (exigido pra declaração da encomenda).
-- =====================================================================

alter table orders add column if not exists shipping_service_id integer;
alter table orders add column if not exists customer_document text;

-- Depois de gerada, a etiqueta fica registrada aqui — pra não gerar
-- (e pagar) duas vezes o mesmo pedido sem querer.
alter table orders add column if not exists shipping_label_status text
  check (shipping_label_status in ('gerada', 'erro')) default null;
alter table orders add column if not exists shipping_label_error text;
alter table orders add column if not exists shipping_tracking_code text;
alter table orders add column if not exists shipping_label_url text;
alter table orders add column if not exists shipping_melhorenvio_id text;

-- select/insert/update em orders pro service_role já foi concedido no
-- patch-09 — não precisa repetir aqui.
