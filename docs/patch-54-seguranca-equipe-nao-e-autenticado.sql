-- =====================================================================
-- Patch 54 — segurança: "equipe" não é "qualquer autenticado"
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
-- É uma transação: ou entra tudo, ou nada.
--
-- STATUS: JÁ APLICADO EM PRODUÇÃO em 21/09/2026, com o "sim" do Anderson,
-- pelo SQL Editor do painel. Antes: ensaio do patch inteiro + 23 testes numa
-- transação desfeita de propósito (23/23 ok; conferido que nada persistiu).
-- Depois: 5 chamadas de função e 5 leituras de tabela feitas de fora com a
-- chave pública, todas recusadas; catálogo seguiu lendo 208 produtos e 36
-- cores. Este arquivo é o registro do que está no banco.
--
-- POR QUE ISTO EXISTE
--
-- Em 21/09/2026, depois de achar dois buracos críticos no banco da JJ
-- Solene que a auditoria de 11/09 (só de repositório) não tinha como ver,
-- fiz a mesma leitura do banco REAL aqui (pg_policies, pg_get_functiondef,
-- proacl e o endpoint público auth/v1/settings). O Rafa 3D estava bem
-- melhor — RLS ligado nas 17 tabelas, cadastros owner-only, o anon quase
-- sem alcance — mas os mesmos dois padrões aparecem:
--
--  1. VINTE políticas são `to authenticated using (true)`: customers,
--     orders, order_line_items, payments (ler/gravar), orders e
--     order_line_items também APAGAR, lixeira e printer_slots (tudo),
--     filament_spools, filament_stock_movements, slicer_agents e
--     products (ler). E o cadastro público do Supabase Auth está LIGADO
--     (disable_signup = false). "Autenticado" portanto é "qualquer pessoa
--     da internet que crie uma conta com o próprio e-mail": ela leria
--     todos os clientes e pedidos (com CPF, WhatsApp e endereço) e poderia
--     alterar e apagar pedidos. Em 21/09 as 2 contas existentes eram as 2
--     dos donos — ninguém de fora tinha entrado.
--     De carona resolve o achado r3d-04 da auditoria: `profiles.active =
--     false` passa a revogar o acesso do ajudante de verdade (hoje só a aba
--     some).
--
--  2. add_filament_spool e consume_filament são SECURITY DEFINER, sem
--     checagem por dentro, e o EXECUTE está concedido a PUBLIC (o `=X` no
--     proacl) — ou seja, o visitante anônimo do catálogo executa. Com o id
--     de uma cor (público no catálogo) ele cria rolos falsos no estoque.
--     editar_rolo e apagar_rolo já checam is_owner() por dentro; só perdem
--     o EXECUTE do anon. filament_colors_safe e printers_safe entregavam ao
--     anon a lista de cores inativas e o nome/modelo das impressoras.
--
-- O QUE NÃO MUDA PRA QUEM USA: só o app admin (autenticado) chama essas
-- funções — conferido: 0 chamadas no catálogo, no slicer-agent e nas Edge
-- Functions. O agente e as Edge Functions usam a service_role, que ignora
-- RLS e política, então nada muda pra eles. O catálogo público lê products
-- e filament_colors pelas políticas `to anon`, que este patch não toca.
--
-- O QUE MUDA DE PROPÓSITO: ajudante com `active = false` deixa de ler e
-- gravar qualquer coisa na hora.
--
-- FORA DESTE ARQUIVO (clique no painel, SQL não alcança): Authentication >
-- Sign In / Providers > desligar "Allow new users to sign up". Os donos e
-- ajudantes continuam sendo criados por Authentication > Add user. Este
-- patch já fecha o buraco com o cadastro ligado; desligar é a 2a tranca.
--
-- REGRA DAQUI PRA FRENTE
--  - Política nunca usa `using (true)` para `authenticated`: usa is_staff()
--    (ou is_owner()). "Autenticado" não quer dizer "da loja".
--  - Toda função SECURITY DEFINER nova: checagem por dentro E
--    `revoke execute ... from public, anon`. O Postgres dá EXECUTE a PUBLIC
--    em toda função nova, por padrão.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- is_staff(): quem chama é da loja e está ativo? (dono OU ajudante)
-- ---------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and active);
$$;
revoke execute on function public.is_staff() from public, anon;
grant  execute on function public.is_staff() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 1. As 20 políticas `using (true)`: mesmo nome, mesmo comando, mesma
--    role — só a condição muda. drop + create do MESMO nome (create com
--    nome novo SOMARIA uma política permissiva em vez de trocar).
-- ---------------------------------------------------------------------
drop policy if exists customers_select on customers;
drop policy if exists customers_insert on customers;
drop policy if exists customers_update on customers;
create policy customers_select on customers for select to authenticated using (is_staff());
create policy customers_insert on customers for insert to authenticated with check (is_staff());
create policy customers_update on customers for update to authenticated using (is_staff()) with check (is_staff());

drop policy if exists orders_select on orders;
drop policy if exists orders_insert on orders;
drop policy if exists orders_update on orders;
drop policy if exists orders_delete on orders;
create policy orders_select on orders for select to authenticated using (is_staff());
create policy orders_insert on orders for insert to authenticated with check (is_staff());
create policy orders_update on orders for update to authenticated using (is_staff()) with check (is_staff());
create policy orders_delete on orders for delete to authenticated using (is_staff());

drop policy if exists order_line_items_select on order_line_items;
drop policy if exists order_line_items_insert on order_line_items;
drop policy if exists order_line_items_update on order_line_items;
drop policy if exists order_line_items_delete on order_line_items;
create policy order_line_items_select on order_line_items for select to authenticated using (is_staff());
create policy order_line_items_insert on order_line_items for insert to authenticated with check (is_staff());
create policy order_line_items_update on order_line_items for update to authenticated using (is_staff()) with check (is_staff());
create policy order_line_items_delete on order_line_items for delete to authenticated using (is_staff());

drop policy if exists payments_select on payments;
drop policy if exists payments_insert on payments;
drop policy if exists payments_update on payments;
create policy payments_select on payments for select to authenticated using (is_staff());
create policy payments_insert on payments for insert to authenticated with check (is_staff());
create policy payments_update on payments for update to authenticated using (is_staff()) with check (is_staff());

drop policy if exists lixeira_todos on lixeira;
create policy lixeira_todos on lixeira for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists printer_slots_todos on printer_slots;
create policy printer_slots_todos on printer_slots for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists filament_spools_select on filament_spools;
create policy filament_spools_select on filament_spools for select to authenticated using (is_staff());

drop policy if exists filament_stock_movements_select on filament_stock_movements;
create policy filament_stock_movements_select on filament_stock_movements for select to authenticated using (is_staff());

drop policy if exists slicer_agents_select on slicer_agents;
create policy slicer_agents_select on slicer_agents for select to authenticated using (is_staff());

-- products: a política `to anon` (active = true) continua servindo o
-- catálogo; esta é a do app admin, que vê também os inativos.
drop policy if exists products_select on products;
create policy products_select on products for select to authenticated using (is_staff());

-- ---------------------------------------------------------------------
-- 2. Funções: checagem por dentro nas duas que não tinham, e ninguém de
--    fora executa nenhuma. Corpos = os de produção em 21/09/2026 + a
--    checagem no começo.
-- ---------------------------------------------------------------------
create or replace function public.add_filament_spool(
  p_color_id uuid, p_initial_weight_g numeric, p_cost_paid numeric, p_supplier text, p_purchased_at date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_spool_id uuid;
begin
  -- mesma regra da política filament_spools_insert: só o dono cadastra rolo
  if not is_owner() then
    raise exception 'só o dono pode cadastrar rolo de filamento' using errcode = '42501';
  end if;

  insert into filament_spools (color_id, purchased_at, initial_weight_g, remaining_weight_g, cost_paid, supplier)
    values (p_color_id, p_purchased_at, p_initial_weight_g, p_initial_weight_g, p_cost_paid, p_supplier)
    returning id into v_spool_id;

  insert into filament_stock_movements (spool_id, grams_delta, reason, created_by)
    values (v_spool_id, p_initial_weight_g, 'new_spool', auth.uid());

  return v_spool_id;
end;
$$;

create or replace function public.consume_filament(
  p_spool_id uuid, p_order_line_item_id uuid, p_grams numeric, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- dono ou ajudante ativo: quem está na bancada registra o consumo
  if not is_staff() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  if p_reason not in ('print_job_consumption', 'waste_failed_print') then
    raise exception 'reason inválido pra consumo de filamento: %', p_reason;
  end if;

  update filament_spools
    set remaining_weight_g = remaining_weight_g - p_grams,
        status = case when remaining_weight_g - p_grams <= 0 then 'empty' else status end
    where id = p_spool_id;

  insert into filament_stock_movements (spool_id, order_line_item_id, grams_delta, reason, created_by)
    values (p_spool_id, p_order_line_item_id, -p_grams, p_reason, auth.uid());
end;
$$;

revoke execute on function public.add_filament_spool(uuid, numeric, numeric, text, date) from public, anon;
revoke execute on function public.consume_filament(uuid, uuid, numeric, text)            from public, anon;
revoke execute on function public.filament_colors_safe()                                 from public, anon;
revoke execute on function public.printers_safe()                                        from public, anon;
revoke execute on function public.is_owner()                                             from public, anon;
grant  execute on function public.add_filament_spool(uuid, numeric, numeric, text, date) to authenticated, service_role;
grant  execute on function public.consume_filament(uuid, uuid, numeric, text)            to authenticated, service_role;
grant  execute on function public.filament_colors_safe()                                 to authenticated, service_role;
grant  execute on function public.printers_safe()                                        to authenticated, service_role;
grant  execute on function public.is_owner()                                             to authenticated, service_role;

-- editar_rolo / apagar_rolo já checam is_owner() por dentro; as assinaturas
-- são longas e já mudaram entre patches, então o revoke vai pelo nome.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.proname in ('editar_rolo', 'apagar_rolo') loop
    execute format('revoke execute on function %s from public, anon', f.assinatura);
    execute format('grant execute on function %s to authenticated, service_role', f.assinatura);
  end loop;
end $$;

-- As `_safe` devolvem a lista inteira pra qualquer autenticado; passam a
-- devolver só pra equipe (o custo já era só do dono).
create or replace function public.filament_colors_safe()
returns table(id uuid, name text, material text, hex_or_gradient text, active boolean, low_stock_threshold_g numeric, cost_per_kg numeric)
language sql
stable
security definer
set search_path = public
as $$
  select id, name, material, hex_or_gradient, active, low_stock_threshold_g,
    case when is_owner() then cost_per_kg else null end as cost_per_kg
  from filament_colors
  where is_staff()
  order by name;
$$;

create or replace function public.printers_safe()
returns table(id uuid, name text, model text, active boolean, hourly_cost numeric, slots_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select id, name, model, active,
    case when is_owner() then hourly_cost else null end as hourly_cost,
    slots_count
  from printers
  where is_staff()
  order by name;
$$;

commit;

-- =====================================================================
-- CONFERÊNCIA (rodar depois)
-- =====================================================================
-- select count(*) from pg_policies where schemaname='public' and (qual='true' or with_check='true');
--   (esperado: 0)
-- select proname, has_function_privilege('anon', oid, 'EXECUTE') from pg_proc
--   where pronamespace='public'::regnamespace and prokind='f' and prorettype <> 'event_trigger'::regtype;
--   (esperado: false em todas)
