-- =====================================================================
-- Patch 33 — a colinha passa a saber de qual material a peça é
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- Material muda quase tudo: bico, mesa, ventoinha, velocidade. PLA sai
-- a ~220°C; PETG precisa de ~245°C e de mesa bem mais quente. Sem saber
-- o material, a IA assumia PLA e devolvia números que não servem pra
-- uma peça que precisa aguentar esforço.
--
-- E material e placa CONVERSAM: PETG não vai na placa fria — gruda
-- forte demais e leva pedaço do revestimento junto ao soltar. Por isso
-- a tela avisa quando a combinação não fecha.
--
-- Companheiro do patch 32 (bed_plate), nas mesmas três tabelas.
-- =====================================================================

alter table products         add column if not exists material text;
alter table order_line_items add column if not exists material text;
alter table project_parts    add column if not exists material text;

-- Só o que a loja usa. Valor solto aqui viraria temperatura errada na
-- peça, que é exatamente o que este patch existe pra evitar.
alter table products         drop constraint if exists products_material_check;
alter table products         add constraint products_material_check
  check (material is null or material in ('pla', 'petg', 'tpu', 'abs'));
alter table order_line_items drop constraint if exists order_line_items_material_check;
alter table order_line_items add constraint order_line_items_material_check
  check (material is null or material in ('pla', 'petg', 'tpu', 'abs'));
alter table project_parts    drop constraint if exists project_parts_material_check;
alter table project_parts    add constraint project_parts_material_check
  check (material is null or material in ('pla', 'petg', 'tpu', 'abs'));

grant select, insert, update on products         to service_role;
grant select, insert, update on order_line_items to service_role;
grant select, insert, update on project_parts    to service_role;

-- ---------------------------------------------------------------------
-- Conferência: as três colunas têm que aparecer.
-- ---------------------------------------------------------------------
select table_name, column_name
  from information_schema.columns
  where column_name = 'material'
  order by table_name;
