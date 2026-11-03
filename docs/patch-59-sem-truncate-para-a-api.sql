-- =====================================================================
-- Patch 59 — tira o TRUNCATE de anon e authenticated em todas as tabelas.
--
-- STATUS: PREPARADO E ENSAIADO em 03/11/2026 no banco de produção, pelo SQL Editor
-- (bloco DO que termina em erro proposital: o Postgres desfez tudo; conferido
-- depois que nenhuma permissão mudou). APLICADO EM PRODUÇÃO no mesmo dia, com o
-- "sim" do Anderson: 0 tabelas com TRUNCATE para anon/authenticated. De fora, com a
-- chave pública: vitrine 200 (208 produtos, 36 cores), customers 401/42501. Site
-- publicado aberto no navegador: produtos e preços na tela (os 2 erros 404 são do
-- image-slot.js, que já faltava antes).
-- Resultado do ensaio: tabelas com TRUNCATE para anon ou authenticated: 0;
-- vitrine como visitante, antes = depois: 208 produtos ativos e 36 cores.
--
-- POR QUÊ (conferência do banco real em 03/11/2026, com a auditoria.sql do
-- repositório-modelo): os padrões graves de 21/09 não voltaram. Sobrou o
-- privilégio TRUNCATE do visitante (anon) em todas as tabelas — herança do
-- padrão antigo do Supabase, que dava "ALL" em toda tabela nova. TRUNCATE apaga
-- a tabela inteira e NÃO passa pelo RLS. A API (PostgREST) não emite TRUNCATE,
-- então hoje ninguém consegue usar isso; é defesa em profundidade para o dia em
-- que alguma função ou caminho novo executar SQL com o papel de quem chama.
-- A equipe e o agente (authenticated) também não precisam: perdem junto.
-- As Edge Functions usam service_role, que não é afetada.
--
-- O QUE NÃO MUDA: nada do que o sistema faz hoje. O catálogo lê `products` e
-- `filament_colors` por coluna (patch 56) e continua lendo igual — o ensaio
-- confere contando as linhas antes e depois, como visitante.
-- =====================================================================

-- ---------- APLICAR (depois do "sim") ----------
begin;
revoke truncate on all tables in schema public from anon, authenticated;
-- e para as tabelas criadas daqui pra frente
alter default privileges for role postgres in schema public revoke truncate on tables from anon, authenticated;
commit;

-- ---------- CONFERÊNCIA (depois de aplicar) ----------
-- select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname = 'public' and c.relkind in ('r','p')
--    and (has_table_privilege('anon', c.oid, 'TRUNCATE') or has_table_privilege('authenticated', c.oid, 'TRUNCATE'));
--   (nenhuma linha)

-- ---------- ENSAIO (rodar sozinho; termina em erro de propósito e desfaz tudo) ----------
-- do $ensaio$
-- declare
--   r text := '';
--   n_prod_antes bigint; n_cor_antes bigint; n_prod bigint; n_cor bigint; sobrou int;
-- begin
--   perform set_config('request.jwt.claims', '', true);
--   execute 'set local role anon';
--   select count(*) into n_prod_antes from (select id, catalog_code, category, name, height_cm, sale_price, price_unit_note, promo_note, extra_note, image_path, active, created_at, updated_at, badge_label, material, size_note from products where active) x;
--   select count(*) into n_cor_antes from (select id, name, material, hex_or_gradient, active from filament_colors where active) x;
--   execute 'reset role';
--
--   revoke truncate on all tables in schema public from anon, authenticated;
--   alter default privileges for role postgres in schema public revoke truncate on tables from anon, authenticated;
--
--   select count(*) into sobrou from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
--    where ns.nspname = 'public' and c.relkind in ('r','p')
--      and (has_table_privilege('anon', c.oid, 'TRUNCATE') or has_table_privilege('authenticated', c.oid, 'TRUNCATE'));
--   execute 'set local role anon';
--   select count(*) into n_prod from (select id, catalog_code, category, name, height_cm, sale_price, price_unit_note, promo_note, extra_note, image_path, active, created_at, updated_at, badge_label, material, size_note from products where active) x;
--   select count(*) into n_cor from (select id, name, material, hex_or_gradient, active from filament_colors where active) x;
--   execute 'reset role';
--   r := format('tabelas com TRUNCATE p/ anon ou authenticated: %s | vitrine produtos antes/depois: %s/%s | cores antes/depois: %s/%s',
--               sobrou, n_prod_antes, n_prod, n_cor_antes, n_cor);
--   raise exception 'ENSAIO >> %', r;
-- end $ensaio$;
