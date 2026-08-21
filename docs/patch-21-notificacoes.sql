-- =====================================================================
-- Patch 21 — aviso instantâneo (e-mail + notificação no celular) de pedido novo
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- Sem WhatsApp automático (decisão do Anderson — precisaria de conta
-- comercial verificada, número diferente do que já é usado), os dois
-- avisos instantâneos viáveis sem burocracia são e-mail e notificação
-- push no navegador. Essa tabela guarda os "celulares/navegadores"
-- que pediram pra receber a notificação push.
-- =====================================================================

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

drop policy if exists push_subscriptions_insert on push_subscriptions;
create policy push_subscriptions_insert on push_subscriptions
  for insert to authenticated with check (is_owner());

drop policy if exists push_subscriptions_select on push_subscriptions;
create policy push_subscriptions_select on push_subscriptions
  for select to authenticated using (is_owner());

drop policy if exists push_subscriptions_delete on push_subscriptions;
create policy push_subscriptions_delete on push_subscriptions
  for delete to authenticated using (is_owner());

-- A Edge Function finalizar-pedido lê essa tabela (como service_role)
-- pra saber pra quem mandar a notificação quando um pedido novo chega,
-- e apaga inscrição que não existe mais (celular trocado, notificação
-- desativada) quando o envio devolve erro 404/410.
grant select, delete on push_subscriptions to service_role;
