-- =====================================================================
-- Patch 02 — custo automático (potência da impressora + receita de custo)
-- Rode só isto no SQL Editor (não precisa rodar o schema-inicial.sql de novo).
-- =====================================================================

-- Impressora passa a guardar potência (W) e preço da energia (R$/kWh) em vez
-- de custo/hora digitado à mão — o sistema calcula sozinho.
alter table printers add column if not exists power_watts numeric(10,2);
alter table printers add column if not exists energy_price_per_kwh numeric(10,4) default 1.20;

-- Receita de custo pode fixar qual impressora usar na estimativa (você só
-- tem uma hoje, mas o campo já fica pronto pra quando tiver mais de uma).
alter table product_recipes add column if not exists printer_id uuid references printers(id);
