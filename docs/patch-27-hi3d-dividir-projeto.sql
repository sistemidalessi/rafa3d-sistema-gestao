-- =====================================================================
-- Patch 27 — Hi3D gera a peça inteira e já divide em pedaços coloridos
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- Alternativa ao fluxo manual de "Partes do projeto" (patch 23): em vez
-- do Rafa descrever e mandar foto de cada pedaço, ele manda só a foto
-- de referência (a de sempre, lá no topo do projeto) e o Hi3D gera a
-- peça inteira e corta sozinho em partes por cor. Guarda no mesmo lugar
-- que o fluxo antigo da Meshy (model_file_path / model_source), só que
-- o resultado é um .3mf com várias partes dentro, não um .stl de uma
-- peça só.
-- =====================================================================

alter table order_line_items add column if not exists hi3d_status text
  check (hi3d_status in ('queued', 'processing', 'done', 'error'));
alter table order_line_items add column if not exists hi3d_error text;
alter table order_line_items add column if not exists hi3d_requested_at timestamptz;
-- Quantos pedaços a peça deve virar — escolha simples que o dono faz na
-- tela ("poucos pedaços grandes" ou "vários pedaços"), sem falar em
-- "nível" pra ele. 'high' existe pra abrir espaço no futuro, mas a tela
-- hoje só oferece low/medium (foi o que testamos de verdade).
alter table order_line_items add column if not exists hi3d_nivel text
  check (hi3d_nivel in ('low', 'medium', 'high'));

create index if not exists idx_order_line_items_hi3d_queued
  on order_line_items(hi3d_status) where hi3d_status = 'queued';

-- model_source só aceitava 'manual_upload' e 'meshy_generated' (patch 09)
-- — precisa abrir espaço pro novo valor.
alter table order_line_items drop constraint if exists order_line_items_model_source_check;
alter table order_line_items add constraint order_line_items_model_source_check
  check (model_source in ('manual_upload', 'meshy_generated', 'hi3d_dividido'));

-- Mesma pegadinha de sempre: GRANT é separado de RLS, mesmo pra quem
-- ignora RLS.
grant select, insert, update on order_line_items to service_role;
