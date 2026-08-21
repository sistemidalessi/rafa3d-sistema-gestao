-- =====================================================================
-- Patch 23 — projeto com várias partes (peça montada em pedaços)
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- Até agora um Projeto só tinha uma foto de referência e um modelo 3D.
-- Quando a peça de referência foi impressa em partes separadas (ex:
-- base, corpo, tampa, encaixe), cada parte precisa da própria foto,
-- do próprio modelo gerado pela Meshy e da própria colinha — são
-- objetos diferentes, cada um pode precisar de ajuste diferente.
--
-- O projeto "de uma foto só" continua funcionando exatamente como
-- hoje (as colunas antigas em order_line_items não mudam nem saem de
-- uso) — "partes" é um jeito adicional, só usado quando o dono clica
-- em "+ Adicionar parte".
-- =====================================================================

create table if not exists project_parts (
  id uuid primary key default gen_random_uuid(),
  order_line_item_id uuid not null references order_line_items(id) on delete cascade,
  ordem integer not null default 1,
  nome text, -- ex: "Base", "Tampa" — opcional, mostra "Parte N" se vazio

  reference_image_path text, -- bucket projetos-fotos

  model_file_path text, -- bucket modelos-3d
  model_source text check (model_source in ('meshy_generated', 'manual_upload')),
  meshy_status text check (meshy_status in ('queued', 'processing', 'done', 'error')),
  meshy_error text,
  meshy_requested_at timestamptz,
  meshy_task_id text,
  meshy_thumbnail_path text,

  ai_analysis_status text check (ai_analysis_status in ('queued', 'processing', 'done', 'error')),
  ai_analysis_error text,
  ai_analysis_requested_at timestamptz,
  ai_analysis_done_at timestamptz,
  ai_slicing_tips text,
  ai_slicing_settings jsonb,

  open_slicer_status text check (open_slicer_status in ('queued', 'done', 'error')),
  open_slicer_error text,
  open_slicer_requested_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_parts_line_item on project_parts(order_line_item_id);
create index if not exists idx_project_parts_meshy_queued on project_parts(meshy_status) where meshy_status = 'queued';
create index if not exists idx_project_parts_analise_queued on project_parts(ai_analysis_status) where ai_analysis_status = 'queued';
create index if not exists idx_project_parts_fatiador_queued on project_parts(open_slicer_status) where open_slicer_status = 'queued';

alter table project_parts enable row level security;

drop policy if exists project_parts_select on project_parts;
create policy project_parts_select on project_parts
  for select to authenticated using (is_owner());

drop policy if exists project_parts_insert on project_parts;
create policy project_parts_insert on project_parts
  for insert to authenticated with check (is_owner());

drop policy if exists project_parts_update on project_parts;
create policy project_parts_update on project_parts
  for update to authenticated using (is_owner());

drop policy if exists project_parts_delete on project_parts;
create policy project_parts_delete on project_parts
  for delete to authenticated using (is_owner());

-- O agente local (service_role) processa as filas de partes igual já
-- faz com produtos/projetos — mesma pegadinha de sempre, GRANT é
-- separado de RLS mesmo pra quem ignora RLS.
grant select, insert, update on project_parts to service_role;
