-- =====================================================================
-- Patch 03 — libera leitura pública dos produtos + campo "tipo" (badge)
-- Rode este arquivo inteiro no SQL Editor. Necessário pro catálogo
-- público (visitante sem login) passar a ler direto do banco.
-- =====================================================================

-- Campo genérico de "selo" no card do produto — hoje só usado pelas
-- peças de Brinquedos & Expositores (Brinquedo / Expositor), mas
-- qualquer categoria pode usar no futuro.
alter table products add column if not exists badge_label text;

-- O catálogo público é visitado por gente sem login (anon). Só
-- products precisa disso, e só leitura, e só produto ativo — o resto
-- do banco (pedidos, filamento, custo) continua exigindo login.
grant usage on schema public to anon;
grant select on products to anon;

drop policy if exists products_select_public on products;
create policy products_select_public on products
  for select to anon using (active = true);

-- Backfill do "tipo" das 17 peças de Brinquedos & Expositores, exatamente
-- como estava no catálogo estático.
update products set badge_label = 'Brinquedo' where catalog_code = '02.01';
update products set badge_label = 'Expositor' where catalog_code = '02.02';
update products set badge_label = 'Brinquedo' where catalog_code = '02.03';
update products set badge_label = 'Brinquedo' where catalog_code = '02.04';
update products set badge_label = 'Brinquedo' where catalog_code = '02.05';
update products set badge_label = 'Brinquedo' where catalog_code = '02.06';
update products set badge_label = 'Brinquedo' where catalog_code = '02.07';
update products set badge_label = 'Brinquedo' where catalog_code = '02.08';
update products set badge_label = 'Brinquedo' where catalog_code = '02.09';
update products set badge_label = 'Brinquedo' where catalog_code = '02.10';
update products set badge_label = 'Brinquedo' where catalog_code = '02.11';
update products set badge_label = 'Brinquedo' where catalog_code = '02.12';
update products set badge_label = 'Brinquedo' where catalog_code = '02.13';
update products set badge_label = 'Brinquedo' where catalog_code = '02.14';
update products set badge_label = 'Brinquedo' where catalog_code = '02.15';
update products set badge_label = 'Brinquedo' where catalog_code = '02.16';
update products set badge_label = 'Expositor' where catalog_code = '02.17';
