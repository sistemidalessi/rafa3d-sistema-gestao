-- =====================================================================
-- Patch 57 — o agente do fatiador entra com usuário próprio, não com a service_role
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
-- É uma transação: ou entra tudo, ou nada.
--
-- STATUS: APLICADO EM PRODUÇÃO em 30/10/2026, com o "sim" do Anderson, pelo SQL
-- Editor do painel, depois de ele criar o usuário agente@rafa3ddalessi.com.br em
-- Authentication › Users › Add user (Auto Confirm). Ensaio 23/23 numa transação
-- desfeita (agente lê/atualiza as filas e grava em modelos-3d; vê 0 clientes, 0
-- pedidos, 0 pagamentos, só o próprio perfil; não apaga nem insere produto; não
-- grava em produtos-fotos; estranho logado vê 0; dono segue vendo tudo). Depois
-- de aplicar: 16 políticas agent_*, perfil agent/true, is_staff exclui o agente.
--
-- POR QUE ISTO EXISTE (auditoria de 11/09/2026, achado r3d-05)
--
-- O slicer-agent roda em dois computadores — o do escritório e o do Rafael,
-- que tem 10 anos — e até hoje entra no banco com a service_role em texto puro
-- no `.env`. A service_role passa por cima de TODA a RLS: quem lê aquele
-- arquivo tem o banco inteiro, inclusive clientes com CPF, pedidos, pagamentos
-- e perfis. Os patches 54/55/56 fecharam o banco pra visitante e pra estranho
-- logado, mas essa chave continuava sendo a porta que ignora tudo isso.
--
-- O que o agente REALMENTE precisa (levantado no agent.js em 30/10/2026):
--   - products, order_line_items, project_parts: ler (as filas) e atualizar
--     (status/erro/caminho das filas, dicas da IA, sliced_at...)
--   - slicer_agents: upsert do sinal de vida (name, last_seen_at, versão)
--   - print_feedback: ler (histórico pra colinha da IA)
--   - storage: ler e gravar em modelos-3d e projetos-fotos
--   - NADA de customers, orders, payments, profiles, filament_*, printers,
--     e NENHUM delete em lugar nenhum.
--
-- A SOLUÇÃO: um usuário do Auth com papel 'agent' em profiles. is_agent()
-- liga esse usuário a políticas só do que está acima. is_staff() passa a
-- EXCLUIR o agente de propósito — senão ele herdaria tudo o que dono e
-- ajudante podem (clientes, pedidos, pagamentos), e a redução seria só de
-- aparência. O agente faz login com e-mail e senha (supabase-js, anon key),
-- e a service_role sai do `.env` dos dois computadores.
--
-- O QUE MUDA PRA QUEM USA: nada na tela. O agente continua fazendo o mesmo;
-- se faltar permissão em algo que este patch não previu, o sintoma é o botão
-- girar e o agent.log mostrar "permission denied for table X" ou
-- "new row violates row-level security policy" — aí é acrescentar a política
-- aqui, não voltar pra service_role.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Ajuste aqui ANTES de rodar: o e-mail do usuário criado no painel.
-- ---------------------------------------------------------------------
create temporary table _patch57 (agent_email text);
insert into _patch57 values ('agente@rafa3ddalessi.com.br');

do $$
begin
  if not exists (select 1 from auth.users u join _patch57 p on u.email = p.agent_email) then
    raise exception 'Crie antes o usuario % em Authentication > Users > Add user (Auto Confirm), ou ajuste o e-mail no topo do patch.', (select agent_email from _patch57);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Papel 'agent' em profiles + o perfil do agente
-- ---------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('owner', 'helper', 'agent'));

insert into public.profiles (id, full_name, role, active)
select u.id, 'Agente do fatiador', 'agent', true
  from auth.users u join _patch57 p on u.email = p.agent_email
on conflict (id) do update set role = 'agent', active = true, full_name = 'Agente do fatiador';

-- ---------------------------------------------------------------------
-- 2. is_agent(), e is_staff() deixa o agente de fora
-- ---------------------------------------------------------------------
create or replace function public.is_agent() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'agent' and active);
$$;
revoke execute on function public.is_agent() from public, anon;
grant  execute on function public.is_agent() to authenticated, service_role;

-- "da loja" = dono ou ajudante ATIVO. O agente NÃO é da loja: ele é uma
-- máquina, e só pode o que is_agent() libera abaixo.
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('owner', 'helper') and active);
$$;

-- ---------------------------------------------------------------------
-- 3. Políticas do agente (só ler e atualizar; nunca inserir linha de
--    negócio, nunca apagar). Nomes novos, prefixo agent_, pra não mexer nas
--    políticas de dono/ajudante.
-- ---------------------------------------------------------------------
drop policy if exists agent_products_select on products;
drop policy if exists agent_products_update on products;
create policy agent_products_select on products for select to authenticated using (is_agent());
create policy agent_products_update on products for update to authenticated using (is_agent()) with check (is_agent());

drop policy if exists agent_order_line_items_select on order_line_items;
drop policy if exists agent_order_line_items_update on order_line_items;
create policy agent_order_line_items_select on order_line_items for select to authenticated using (is_agent());
create policy agent_order_line_items_update on order_line_items for update to authenticated using (is_agent()) with check (is_agent());

drop policy if exists agent_project_parts_select on project_parts;
drop policy if exists agent_project_parts_update on project_parts;
create policy agent_project_parts_select on project_parts for select to authenticated using (is_agent());
create policy agent_project_parts_update on project_parts for update to authenticated using (is_agent()) with check (is_agent());

drop policy if exists agent_print_feedback_select on print_feedback;
create policy agent_print_feedback_select on print_feedback for select to authenticated using (is_agent());

-- sinal de vida: upsert = insert + update na própria linha (name = AGENT_NAME)
drop policy if exists agent_slicer_agents_select on slicer_agents;
drop policy if exists agent_slicer_agents_insert on slicer_agents;
drop policy if exists agent_slicer_agents_update on slicer_agents;
create policy agent_slicer_agents_select on slicer_agents for select to authenticated using (is_agent());
create policy agent_slicer_agents_insert on slicer_agents for insert to authenticated with check (is_agent());
create policy agent_slicer_agents_update on slicer_agents for update to authenticated using (is_agent()) with check (is_agent());

-- storage: os dois buckets privados que o agente usa. upload com upsert:true
-- faz insert OU update do objeto, por isso os dois. Sem delete.
drop policy if exists agent_modelos_3d_select  on storage.objects;
drop policy if exists agent_modelos_3d_insert  on storage.objects;
drop policy if exists agent_modelos_3d_update  on storage.objects;
drop policy if exists agent_projetos_fotos_select on storage.objects;
drop policy if exists agent_projetos_fotos_insert on storage.objects;
drop policy if exists agent_projetos_fotos_update on storage.objects;
create policy agent_modelos_3d_select on storage.objects for select to authenticated using (bucket_id = 'modelos-3d' and public.is_agent());
create policy agent_modelos_3d_insert on storage.objects for insert to authenticated with check (bucket_id = 'modelos-3d' and public.is_agent());
create policy agent_modelos_3d_update on storage.objects for update to authenticated using (bucket_id = 'modelos-3d' and public.is_agent()) with check (bucket_id = 'modelos-3d' and public.is_agent());
create policy agent_projetos_fotos_select on storage.objects for select to authenticated using (bucket_id = 'projetos-fotos' and public.is_agent());
create policy agent_projetos_fotos_insert on storage.objects for insert to authenticated with check (bucket_id = 'projetos-fotos' and public.is_agent());
create policy agent_projetos_fotos_update on storage.objects for update to authenticated using (bucket_id = 'projetos-fotos' and public.is_agent()) with check (bucket_id = 'projetos-fotos' and public.is_agent());

drop table _patch57;
commit;

-- =====================================================================
-- CONFERÊNCIA (rodar depois)
-- =====================================================================
-- select p.role, p.active, p.full_name from profiles p order by 1;       -- 1 linha 'agent'
-- (ao juntar com auth.users, qualifique: auth.users TAMBÉM tem coluna "role")
-- select count(*) from pg_policies where policyname like 'agent\_%';     -- 14
-- E o teste de verdade é o agente subir, dar sinal de vida (slicer_agents
-- com last_seen_at novo) e processar um item da fila com o .env SEM a
-- service_role. Depois disso: apagar SUPABASE_SERVICE_ROLE_KEY do .env dos
-- DOIS computadores.
