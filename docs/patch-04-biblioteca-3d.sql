-- =====================================================================
-- Patch 04 — biblioteca de arquivos 3D (Fase 1 da Fabricação Automática)
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
-- Pré-requisito de tudo: fatiar sozinho, mandar pra impressora e gerar
-- modelo via Meshy só fazem sentido depois que existir onde guardar o
-- arquivo .stl/.3mf de cada produto.
-- =====================================================================

-- Onde o arquivo 3D do produto está guardado, e se veio de upload manual
-- ou foi gerado por IA (Meshy) — feito na Fase 4, campo já preparado aqui.
alter table products add column if not exists model_file_path text;
alter table products add column if not exists model_source text check (model_source in ('manual_upload', 'meshy_generated'));

-- Bucket de Storage pros arquivos 3D — privado (não é como as fotos do
-- catálogo, que são públicas). Só o dono (owner) acessa.
insert into storage.buckets (id, name, public)
values ('modelos-3d', 'modelos-3d', false)
on conflict (id) do nothing;

drop policy if exists modelos_3d_select on storage.objects;
create policy modelos_3d_select on storage.objects
  for select to authenticated
  using (bucket_id = 'modelos-3d' and is_owner());

drop policy if exists modelos_3d_insert on storage.objects;
create policy modelos_3d_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'modelos-3d' and is_owner());

drop policy if exists modelos_3d_update on storage.objects;
create policy modelos_3d_update on storage.objects
  for update to authenticated
  using (bucket_id = 'modelos-3d' and is_owner());

drop policy if exists modelos_3d_delete on storage.objects;
create policy modelos_3d_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'modelos-3d' and is_owner());
