-- =====================================================================
-- Patch 63 (06/11/2026): visitante não lista mais o bucket produtos-fotos
--
-- Achado pela consulta docs/auditoria-storage.sql do sistemi-dalessi, rodada
-- no painel em 06/11/2026: a política produtos_fotos_select (SELECT para
-- anon e authenticated, só com bucket_id) deixava qualquer visitante LISTAR
-- o bucket. A foto no catálogo abre pela URL pública, que não passa por
-- política; nada no site nem no agente lista o bucket. Risco baixo (as fotos
-- já são públicas), mas é o único achado de Storage do Rafa: o resto (18
-- políticas, os 3 buckets com limite desde o patch 60) está certo.
--
-- O admin sobe a foto com upload(..., { upsert: true }), que exige SELECT de
-- quem sobe: por isso a política não some, passa a valer só para o dono
-- (o mesmo is_owner() do insert/update/delete deste bucket).
--
-- Como aplicar: 1) rodar o ENSAIO (bloco DO no fim, sozinho) e conferir a
-- mensagem; 2) com o "sim" do Anderson, rodar o bloco begin/commit;
-- 3) provar de fora com a chave pública: a URL pública de uma foto abre (200)
-- e a listagem do bucket volta vazia.
-- =====================================================================

begin;

drop policy if exists produtos_fotos_select on storage.objects;
create policy produtos_fotos_select on storage.objects for select to authenticated
  using (bucket_id = 'produtos-fotos' and public.is_owner());

commit;

-- =====================================================================
-- ENSAIO: aplica, mede como visitante e como dono, e desfaz tudo no fim
-- (o raise exception derruba a transação). Rodar SOZINHO, antes do bloco acima.
-- =====================================================================
/*
do $$
declare
  dono uuid; p record;
  anon_antes int; anon_depois int; dono_depois int;
  politica text;
begin
  -- acha uma conta de dono perguntando ao próprio is_owner()
  for p in select id from public.profiles loop
    perform set_config('request.jwt.claims', json_build_object('sub', p.id, 'role', 'authenticated')::text, true);
    if public.is_owner() then dono := p.id; exit; end if;
  end loop;
  perform set_config('request.jwt.claims', '', true);

  execute 'set local role anon';
  select count(*) into anon_antes from storage.objects where bucket_id = 'produtos-fotos';
  execute 'reset role';

  drop policy if exists produtos_fotos_select on storage.objects;
  create policy produtos_fotos_select on storage.objects for select to authenticated
    using (bucket_id = 'produtos-fotos' and public.is_owner());

  execute 'set local role anon';
  select count(*) into anon_depois from storage.objects where bucket_id = 'produtos-fotos';
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', dono, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into dono_depois from storage.objects where bucket_id = 'produtos-fotos';
  execute 'reset role';

  select policyname || ' (' || cmd || ' ' || array_to_string(roles, ',') || '): ' || qual
    into politica from pg_policies where schemaname = 'storage' and policyname = 'produtos_fotos_select';

  raise exception 'ENSAIO >> dono achado: %; visitante listava % e passa a listar %; dono lista %; política: %',
    dono is not null, anon_antes, anon_depois, dono_depois, politica;
end $$;
*/
