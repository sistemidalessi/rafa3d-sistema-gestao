-- =====================================================================
-- Patch 32 — a colinha passa a saber em qual placa a peça vai
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- A Bambu A1 usa placas diferentes, e cada uma tem a SUA temperatura de
-- mesa — e o seu próprio campo dentro do arquivo de projeto:
--
--   Placa fria (Cool Plate)      -> cool_plate_temp      ~35°C pra PLA
--   Placa texturizada PEI        -> textured_plate_temp  ~60°C pra PLA
--   Placa de engenharia          -> eng_plate_temp
--   Placa de alta temperatura    -> hot_plate_temp
--
-- Sem saber a placa, a IA chutava um número e o sistema gravava sempre
-- em hot_plate_temp. Como o perfil está em "Cool Plate", o Bambu lia
-- cool_plate_temp e IGNORAVA a temperatura da colinha — sem erro, sem
-- aviso, e ninguém percebia.
--
-- Guarda em cada uma das três tabelas que pedem colinha, pra peça
-- lembrar em qual placa foi pensada.
-- =====================================================================

alter table products         add column if not exists bed_plate text;
alter table order_line_items add column if not exists bed_plate text;
alter table project_parts    add column if not exists bed_plate text;

-- Só as placas que a loja realmente tem. Valor errado aqui vira
-- temperatura no campo errado, que é justamente o problema que este
-- patch existe pra resolver.
alter table products         drop constraint if exists products_bed_plate_check;
alter table products         add constraint products_bed_plate_check
  check (bed_plate is null or bed_plate in ('cool', 'textured', 'engineering', 'high_temp'));
alter table order_line_items drop constraint if exists order_line_items_bed_plate_check;
alter table order_line_items add constraint order_line_items_bed_plate_check
  check (bed_plate is null or bed_plate in ('cool', 'textured', 'engineering', 'high_temp'));
alter table project_parts    drop constraint if exists project_parts_bed_plate_check;
alter table project_parts    add constraint project_parts_bed_plate_check
  check (bed_plate is null or bed_plate in ('cool', 'textured', 'engineering', 'high_temp'));

-- Grant e política são coisas separadas, e o grant vale até pro
-- service_role — é o que derrubou os patches 06, 09, 17 e 19. Aqui as
-- três tabelas já têm grant no nível da tabela, então a coluna nova
-- entra junto; estas linhas ficam só como garantia.
grant select, insert, update on products         to service_role;
grant select, insert, update on order_line_items to service_role;
grant select, insert, update on project_parts    to service_role;

-- ---------------------------------------------------------------------
-- Conferência: as três colunas têm que aparecer.
-- ---------------------------------------------------------------------
select table_name, column_name
  from information_schema.columns
  where column_name = 'bed_plate'
  order by table_name;
