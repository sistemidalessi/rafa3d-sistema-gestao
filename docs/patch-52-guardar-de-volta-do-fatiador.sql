-- =====================================================================
-- Patch 52 — o que foi salvo no Bambu Studio volta pro sistema
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- POR QUE ISTO EXISTE
--
-- Em 09/09/2026 o Anderson abriu o projeto "Vovó Rosana" pelo sistema,
-- mexeu em tudo no Bambu Studio (separou partes, trocou parâmetros),
-- salvou (Ctrl+S) e perdeu tudo: o caminho do arquivo era só de IDA
-- (Storage → computador → Bambu). O "Salvar" do Bambu grava no arquivo
-- local, e nada leva isso de volta pro sistema — o próximo "Abrir no
-- Fatiador" baixa o original de novo e passa por cima do que ele salvou.
--
-- Duas coisas mudam, e este patch dá o lugar no banco pra segunda:
--
--   1. O agente para de passar por cima de arquivo local que a pessoa
--      salvou (isso é só código, no agent.js — não precisa de coluna).
--   2. Um botão "Guardar o que eu mudei no Bambu" manda o agente subir o
--      arquivo salvo de volta pro Storage, no lugar do original. É uma
--      fila igual às outras (queued → done/error), sem 'processing':
--      o trabalho é um upload só, como a fila de abrir-no-fatiador.
--
-- `slicer_saved_at` marca que o arquivo do Storage JÁ É a versão que a
-- pessoa salvou no Bambu. A partir daí o agente abre ele como está, sem
-- reaplicar a colinha — reaplicar jogaria fora justamente os parâmetros
-- que a pessoa mudou (a colinha entra por cima do project_settings).
--
-- GRANT: as três tabelas já têm grant de tabela pra authenticated e
-- service_role (patches 04, 09, 23 e seguintes), e grant de tabela cobre
-- coluna nova — ver CLAUDE.md. Nada a conceder aqui.
-- =====================================================================

-- --- products ----------------------------------------------------------
alter table products add column if not exists save_back_status text
  check (save_back_status in ('queued', 'done', 'error'));
alter table products add column if not exists save_back_error text;
alter table products add column if not exists save_back_requested_at timestamptz;
alter table products add column if not exists save_back_agent text;
alter table products add column if not exists slicer_saved_at timestamptz;
create index if not exists products_save_back_queued_idx
  on products (save_back_requested_at) where save_back_status = 'queued';

-- --- order_line_items (projetos) ----------------------------------------
alter table order_line_items add column if not exists save_back_status text
  check (save_back_status in ('queued', 'done', 'error'));
alter table order_line_items add column if not exists save_back_error text;
alter table order_line_items add column if not exists save_back_requested_at timestamptz;
alter table order_line_items add column if not exists save_back_agent text;
alter table order_line_items add column if not exists slicer_saved_at timestamptz;
create index if not exists order_line_items_save_back_queued_idx
  on order_line_items (save_back_requested_at) where save_back_status = 'queued';

-- --- project_parts -------------------------------------------------------
alter table project_parts add column if not exists save_back_status text
  check (save_back_status in ('queued', 'done', 'error'));
alter table project_parts add column if not exists save_back_error text;
alter table project_parts add column if not exists save_back_requested_at timestamptz;
alter table project_parts add column if not exists save_back_agent text;
alter table project_parts add column if not exists slicer_saved_at timestamptz;
create index if not exists project_parts_save_back_queued_idx
  on project_parts (save_back_requested_at) where save_back_status = 'queued';
