-- =====================================================================
-- Patch 16 — pedido nasce sozinho quando o cliente fecha compra no catálogo
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- Antes, fechar compra abria um Google Form e ninguém no sistema ficava
-- sabendo — alguém tinha que checar o Form e digitar o pedido na mão.
-- Agora o próprio catálogo cria o pedido direto (via Edge Function
-- finalizar-pedido, que usa a chave de serviço — por isso NENHUMA policy
-- nova de RLS pra anônimo é necessária aqui, a Edge Function já passa
-- por cima do RLS com segurança, validando os preços no servidor).
--
-- O pagamento continua manual (PIX fixo do Rafa, cliente manda
-- comprovante pelo WhatsApp) — decisão explícita do Anderson pra não
-- misturar o CPF dele com o dinheiro do Rafa.
-- =====================================================================

-- Pedido vindo do checkout do catálogo é um canal novo, distinto de
-- 'app' (que já existia mas nunca foi usado pra isso).
alter table orders drop constraint if exists orders_channel_check;
alter table orders add constraint orders_channel_check
  check (channel in ('whatsapp', 'google_form', 'presencial', 'app', 'catalogo'));

-- Contato e endereço de entrega ficam direto no pedido, sem exigir um
-- cadastro em customers — assim o checkout público não precisa de
-- permissão nenhuma pra ler/escrever a tabela customers (superfície
-- menor pra alguém abusar). O dono pode ligar a um cliente cadastrado
-- depois, na mão, se quiser.
alter table orders add column if not exists customer_name text;
alter table orders add column if not exists customer_contact text;
alter table orders add column if not exists shipping_cep text;
alter table orders add column if not exists shipping_street text;
alter table orders add column if not exists shipping_number text;
alter table orders add column if not exists shipping_complement text;
alter table orders add column if not exists shipping_district text;
alter table orders add column if not exists shipping_city text;
alter table orders add column if not exists shipping_state text;
alter table orders add column if not exists shipping_combinar boolean not null default false;
alter table orders add column if not exists shipping_carrier text;
alter table orders add column if not exists shipping_service text;
alter table orders add column if not exists shipping_price numeric(10,2);
alter table orders add column if not exists shipping_days integer;
