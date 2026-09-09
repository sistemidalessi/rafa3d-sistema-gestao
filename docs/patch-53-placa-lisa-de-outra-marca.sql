-- =====================================================================
-- Patch 53 — placa lisa de outra marca (holográfica, Stellar, Chameleon)
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- POR QUE ISTO EXISTE
--
-- O Anderson imprime na placa holográfica Essor Stellar/Chameleon, que
-- não é da Bambu: é LISA e quer PLA a 55°C. O sistema só conhecia as
-- quatro placas da Bambu, então a "Vovó Rosana" foi marcada como placa
-- fria e a colinha saiu com mesa a 40°C — a peça soltou nas primeiras
-- camadas (09/09/2026). A opção nova entra em PLACAS_DA_LOJA (tela),
-- PLACAS_PRA_IA (prompt) e PLACAS (gerar3mf.js, grava em
-- textured_plate_temp e curr_bed_type "Textured PEI Plate", que é o
-- perfil que se escolhe no Bambu pra essa placa).
--
-- O patch 32 travou bed_plate com CHECK nas três tabelas; sem alterar
-- o CHECK, gravar 'smooth_other' dá erro 23514. Mesma armadilha do
-- model_source no patch 27.
-- =====================================================================

alter table products         drop constraint if exists products_bed_plate_check;
alter table products         add constraint products_bed_plate_check
  check (bed_plate is null or bed_plate in ('cool', 'textured', 'engineering', 'high_temp', 'smooth_other'));

alter table order_line_items drop constraint if exists order_line_items_bed_plate_check;
alter table order_line_items add constraint order_line_items_bed_plate_check
  check (bed_plate is null or bed_plate in ('cool', 'textured', 'engineering', 'high_temp', 'smooth_other'));

alter table project_parts    drop constraint if exists project_parts_bed_plate_check;
alter table project_parts    add constraint project_parts_bed_plate_check
  check (bed_plate is null or bed_plate in ('cool', 'textured', 'engineering', 'high_temp', 'smooth_other'));
