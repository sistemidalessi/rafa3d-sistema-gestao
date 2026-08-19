-- =====================================================================
-- Patch 13 — upload de foto de produto direto pela tela
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- Diferente de modelos-3d e projetos-fotos (privados, só o dono acessa),
-- este bucket é PÚBLICO — o catálogo é visitado por gente sem login, e
-- as fotos de produto precisam aparecer pra qualquer visitante. Escrita
-- continua só pro dono (quem cadastra produto).
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('produtos-fotos', 'produtos-fotos', true)
on conflict (id) do nothing;

drop policy if exists produtos_fotos_select on storage.objects;
create policy produtos_fotos_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'produtos-fotos');

drop policy if exists produtos_fotos_insert on storage.objects;
create policy produtos_fotos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'produtos-fotos' and is_owner());

drop policy if exists produtos_fotos_update on storage.objects;
create policy produtos_fotos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'produtos-fotos' and is_owner());

drop policy if exists produtos_fotos_delete on storage.objects;
create policy produtos_fotos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'produtos-fotos' and is_owner());

-- authenticated já tem insert em products (grant amplo do schema inicial),
-- mas o catálogo público lido pelo anon (patch-03) precisa continuar
-- enxergando produto novo assim que for criado e ativado — RLS de
-- products_select_public (active = true) já cobre isso sozinha.
