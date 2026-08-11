-- =====================================================================
-- Rafa 3D Dalessi — Sistema de Gestão — schema inicial (Fase 1)
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto do Rafa 3D).
-- Não precisa rodar em partes — é seguro rodar tudo de uma vez (idempotente).
--
-- Cobre: perfis/papéis, clientes, estoque de filamento (cor/rolo/movimento),
-- impressoras, produtos do catálogo + receita de custo, pedidos (catálogo e
-- sob encomenda no mesmo pedido) e pagamentos (sinal/saldo).
--
-- Depois de rodar: crie o primeiro usuário owner em Authentication → Add user,
-- pegue o id dele e rode manualmente:
--   insert into profiles (id, full_name, role) values ('<uuid-do-usuario>', 'Rafael Dalessi', 'owner');
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabela: profiles
-- Espelha auth.users, carrega a role (owner = Rafael, helper = ajudante).
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null check (role in ('owner', 'helper')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Tabela: customers
-- Cadastro simples de cliente — sem CRM completo, só o essencial pra pedido.
-- ---------------------------------------------------------------------
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text, -- WhatsApp do cliente, principal canal de contato
  email text,
  instagram text,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Tabela: filament_colors
-- Uma linha por cor/material de filamento (seed a partir do array
-- `filaments` do catalogo-rafa-3d/index.html — só nome e cor, o resto é
-- dado novo que o Rafael cadastra).
-- ---------------------------------------------------------------------
create table if not exists filament_colors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  material text not null default 'PLA',
  hex_or_gradient text, -- reaproveita o `bg` do array atual, só pra manter a cor na UI
  cost_per_kg numeric(10,2) not null default 0,
  active boolean not null default true,
  low_stock_threshold_g numeric(10,2) not null default 200
);

-- ---------------------------------------------------------------------
-- Tabela: filament_spools
-- Estoque rastreado por ROLO físico, não só por cor agregada — permite
-- manter cost_paid histórico mesmo com o preço variando entre compras.
-- ---------------------------------------------------------------------
create table if not exists filament_spools (
  id uuid primary key default gen_random_uuid(),
  color_id uuid not null references filament_colors(id),
  purchased_at date,
  initial_weight_g numeric(10,2) not null,
  remaining_weight_g numeric(10,2) not null,
  cost_paid numeric(10,2),
  supplier text,
  status text not null default 'in_use' check (status in ('in_use', 'empty', 'stored'))
);

-- ---------------------------------------------------------------------
-- Tabela: printers
-- Hoje só 1 impressora, mas o sistema já nasce pensado pra várias.
-- ---------------------------------------------------------------------
create table if not exists printers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  model text,
  active boolean not null default true,
  power_watts numeric(10,2), -- potência média DURANTE a impressão (não o pico do fabricante), pra custo de energia realista
  energy_price_per_kwh numeric(10,4) default 1.20, -- R$/kWh, ver conta de luz
  hourly_cost numeric(10,2) -- calculado no app a partir de power_watts × energy_price_per_kwh; alimenta o cálculo de custo
);

-- ---------------------------------------------------------------------
-- Tabela: products
-- Os produtos do catálogo público. catalog_code CONGELA o código
-- "01.01" etc. no momento da importação — hoje esse código é recalculado
-- pela posição no array a cada render (index.html:949-955), o que
-- renumera tudo se um item é inserido no meio de uma categoria. Aqui
-- vira campo fixo, editável só pelo dono.
-- ---------------------------------------------------------------------
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  catalog_code text unique,
  category text not null,
  name text not null,
  height_cm numeric(6,2),
  sale_price numeric(10,2) not null,
  price_unit_note text, -- ex: "cada"
  promo_note text,
  extra_note text,
  badge_label text, -- selo pequeno no card (ex: "Brinquedo"/"Expositor"), opcional, qualquer categoria pode usar
  image_path text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Tabela: product_recipes
-- Receita de custo por produto: transforma "custo = gramas × R$/kg +
-- tempo de máquina + mão de obra" em cálculo automático, comparável
-- direto contra sale_price. Um produto tem 0 ou 1 receita por enquanto.
-- ---------------------------------------------------------------------
create table if not exists product_recipes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  filament_color_id uuid references filament_colors(id), -- null = cor qualquer, estimativa usa cor padrão
  printer_id uuid references printers(id), -- qual impressora usar na estimativa de custo/hora
  estimated_grams numeric(10,2) not null,
  estimated_print_hours numeric(6,2) not null,
  post_processing_minutes numeric(6,2) not null default 0,
  post_processing_labor_rate numeric(10,2) -- R$/hora de mão de obra
);

-- ---------------------------------------------------------------------
-- Tabela: orders
-- Um pedido só, podendo misturar item de catálogo e item personalizado
-- (ver order_line_items). status aqui é o ciclo de vida geral do pedido;
-- o status de PRODUÇÃO real vive por item, em order_line_items.line_status.
-- ---------------------------------------------------------------------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique,
  customer_id uuid references customers(id),
  order_type text not null check (order_type in ('catalogo', 'sob_encomenda', 'misto')),
  status text not null default 'orcamento' check (status in (
    'orcamento', 'aguardando_aprovacao', 'aprovado', 'em_producao', 'concluido', 'cancelado'
  )),
  channel text check (channel in ('whatsapp', 'google_form', 'presencial', 'app')),
  total_amount numeric(10,2) not null default 0,
  expected_deposit_pct numeric(5,2) not null default 50.00, -- % de sinal esperado, hoje só existe como texto fixo no WhatsApp do carrinho
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Tabela: order_line_items
-- line_type distingue item de catálogo vs. personalizado dentro do MESMO
-- pedido. line_status carrega o fluxo real de produção por PEÇA (não por
-- pedido): recebido → [orçamento pendente/aprovado, só personalizado] →
-- fila → imprimindo → pós-processamento → embalado → enviado → entregue.
-- reprint_of_line_item_id: uma impressão que falha vira um item novo
-- ligado ao original, sem perder o histórico do pedido.
-- ---------------------------------------------------------------------
create table if not exists order_line_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  line_type text not null check (line_type in ('catalog', 'custom')),
  product_id uuid references products(id), -- setado quando line_type = 'catalog'
  custom_description text, -- setado quando line_type = 'custom'
  custom_reference_image_path text, -- foto que o cliente mandou (upload no Supabase Storage), quando houver
  custom_reference_link text, -- link (Pinterest, site) que o cliente mandou, quando houver
  requested_filament_color_id uuid references filament_colors(id),
  quantity integer not null default 1,
  unit_price numeric(10,2) not null, -- snapshot no momento do pedido — nunca ler sale_price ao vivo pra pedido já feito
  unit_cost_estimate numeric(10,2), -- snapshot do custo calculado no momento do pedido, pra manter histórico de margem
  line_status text not null default 'recebido' check (line_status in (
    'recebido', 'orcamento_pendente', 'orcamento_aprovado', 'fila_impressao', 'imprimindo',
    'pos_processamento', 'embalado', 'enviado', 'entregue', 'falhou_reimprimir', 'cancelado'
  )),
  printer_id uuid references printers(id),
  filament_spool_id uuid references filament_spools(id),
  grams_used_actual numeric(10,2),
  reprint_of_line_item_id uuid references order_line_items(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Tabela: filament_stock_movements
-- Ledger de auditoria do estoque — nunca sobrescrever remaining_weight_g
-- direto, sempre passar pelas RPCs consume_filament/add_filament_spool
-- lá embaixo, que gravam o movimento e atualizam o rolo na mesma transação.
-- ---------------------------------------------------------------------
create table if not exists filament_stock_movements (
  id uuid primary key default gen_random_uuid(),
  spool_id uuid not null references filament_spools(id),
  order_line_item_id uuid references order_line_items(id), -- null pra ajuste manual/rolo novo
  grams_delta numeric(10,2) not null, -- negativo = consumo, positivo = rolo novo/correção
  reason text not null check (reason in (
    'print_job_consumption', 'new_spool', 'manual_correction', 'waste_failed_print'
  )),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Tabela: payments
-- Sinal/saldo do pedido. Status calculado por pedido (aguardando sinal /
-- sinal pago / quitado) vem da view orders_payment_status lá embaixo,
-- nunca de um campo manual que pode dessincronizar.
-- ---------------------------------------------------------------------
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  payment_type text not null check (payment_type in ('sinal', 'saldo', 'pagamento_integral', 'reembolso')),
  amount numeric(10,2) not null,
  method text check (method in ('pix', 'dinheiro', 'cartao', 'outro')),
  status text not null default 'pendente' check (status in ('pendente', 'confirmado', 'estornado')),
  pix_reference text,
  paid_at timestamptz,
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Índices
-- =====================================================================
create index if not exists filament_spools_color_id_idx on filament_spools(color_id);
create index if not exists product_recipes_product_id_idx on product_recipes(product_id);
create index if not exists orders_customer_id_idx on orders(customer_id);
create index if not exists order_line_items_order_id_idx on order_line_items(order_id);
create index if not exists order_line_items_line_status_idx on order_line_items(line_status, printer_id);
create index if not exists filament_stock_movements_spool_id_idx on filament_stock_movements(spool_id, created_at);
create index if not exists payments_order_id_idx on payments(order_id);

-- =====================================================================
-- Função auxiliar: is_owner()
-- Reaproveitada em todas as políticas de RLS abaixo, em vez de repetir a
-- subquery em cada uma (mesmo padrão do is_admin() do jjsolene-sistema-gestao).
-- =====================================================================
create or replace function is_owner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(
    select 1 from profiles where id = auth.uid() and role = 'owner' and active
  );
$$;

grant execute on function is_owner() to authenticated;

-- =====================================================================
-- Grants de tabela
-- "Automatically expose new tables" foi desativado na criação do projeto
-- (mais seguro, é o recomendado pelo próprio Supabase) — isso significa
-- que tabela nova não ganha GRANT automático pro papel authenticated, e
-- sem GRANT a consulta nem chega a ser avaliada pela RLS (erro 42501
-- "permission denied", antes de qualquer política rodar). RLS continua
-- sendo quem decide QUAIS LINHAS aparecem; isso aqui só libera a
-- consulta na tabela em si. Só authenticated por enquanto — anon entra
-- quando o catálogo público (Fase 7) precisar ler/gravar direto.
-- =====================================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;

-- catálogo público (index.html em /catalogo/) é visitado sem login —
-- só products precisa ser lido por anon, e só leitura (RLS acima
-- restringe a active = true).
grant usage on schema public to anon;
grant select on products to anon;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table profiles enable row level security;
alter table customers enable row level security;
alter table filament_colors enable row level security;
alter table filament_spools enable row level security;
alter table printers enable row level security;
alter table products enable row level security;
alter table product_recipes enable row level security;
alter table orders enable row level security;
alter table order_line_items enable row level security;
alter table filament_stock_movements enable row level security;
alter table payments enable row level security;

-- profiles: cada um vê o próprio perfil; owner vê e gerencia todos.
-- Novo ajudante: criar o login em Authentication → Add user, depois o
-- owner insere a linha em profiles pela tela de Equipe do app.
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or is_owner());
create policy profiles_insert on profiles for insert to authenticated
  with check (is_owner());
create policy profiles_update on profiles for update to authenticated
  using (is_owner()) with check (is_owner());

-- customers: owner e helper cadastram/consultam livremente — sem delete
-- por enquanto (evita perder histórico de pedido por engano).
create policy customers_select on customers for select to authenticated using (true);
create policy customers_insert on customers for insert to authenticated with check (true);
create policy customers_update on customers for update to authenticated using (true) with check (true);

-- filament_colors: tabela base (com cost_per_kg) só pro owner. Helper lê
-- a projeção segura via a função filament_colors_safe() lá embaixo.
create policy filament_colors_select on filament_colors for select to authenticated using (is_owner());
create policy filament_colors_insert on filament_colors for insert to authenticated with check (is_owner());
create policy filament_colors_update on filament_colors for update to authenticated using (is_owner()) with check (is_owner());

-- filament_spools: leitura liberada pra ambos (operação da fila precisa
-- saber o que tem de rolo disponível); escrita só via as RPCs abaixo ou
-- pelo owner diretamente (cadastro de rolo novo).
create policy filament_spools_select on filament_spools for select to authenticated using (true);
create policy filament_spools_insert on filament_spools for insert to authenticated with check (is_owner());
create policy filament_spools_update on filament_spools for update to authenticated using (is_owner());

-- printers: tabela base (com hourly_cost) só pro owner, mesmo raciocínio
-- de filament_colors — helper lê a projeção segura via printers_safe().
create policy printers_select on printers for select to authenticated using (is_owner());
create policy printers_insert on printers for insert to authenticated with check (is_owner());
create policy printers_update on printers for update to authenticated using (is_owner()) with check (is_owner());

-- products: leitura liberada (preço de venda é informação que o helper
-- precisa pra conversar com cliente); escrita só pro owner.
create policy products_select on products for select to authenticated using (true);
-- catálogo público (visitante sem login) só lê produto ativo
create policy products_select_public on products for select to anon using (active = true);
create policy products_insert on products for insert to authenticated with check (is_owner());
create policy products_update on products for update to authenticated using (is_owner()) with check (is_owner());

-- product_recipes: é dado de custo — só o owner enxerga e mantém.
create policy product_recipes_select on product_recipes for select to authenticated using (is_owner());
create policy product_recipes_insert on product_recipes for insert to authenticated with check (is_owner());
create policy product_recipes_update on product_recipes for update to authenticated using (is_owner()) with check (is_owner());

-- orders / order_line_items: leitura e escrita liberadas pra ambos —
-- pedido e fila de produção são operação do dia a dia do helper também.
-- unit_cost_estimate fica visível na linha por simplicidade nesta fase;
-- o relatório de margem (Fase 5) é uma RPC própria restrita a is_owner().
create policy orders_select on orders for select to authenticated using (true);
create policy orders_insert on orders for insert to authenticated with check (true);
create policy orders_update on orders for update to authenticated using (true) with check (true);

create policy order_line_items_select on order_line_items for select to authenticated using (true);
create policy order_line_items_insert on order_line_items for insert to authenticated with check (true);
create policy order_line_items_update on order_line_items for update to authenticated using (true) with check (true);

-- filament_stock_movements: leitura liberada (histórico/auditoria é útil
-- pra ambos verem); escrita só através das RPCs abaixo, nunca insert direto.
create policy filament_stock_movements_select on filament_stock_movements for select to authenticated using (true);

-- payments: leitura liberada (helper precisa saber se o sinal já caiu
-- pra liberar produção); registrar pagamento também liberado pra ambos,
-- já que normalmente é quem atende o WhatsApp que confere o PIX.
create policy payments_select on payments for select to authenticated using (true);
create policy payments_insert on payments for insert to authenticated with check (true);
create policy payments_update on payments for update to authenticated using (true) with check (true);

-- =====================================================================
-- Funções: projeções seguras (owner vê custo, helper vê null)
-- =====================================================================
create or replace function filament_colors_safe()
returns table(
  id uuid, name text, material text, hex_or_gradient text,
  active boolean, low_stock_threshold_g numeric, cost_per_kg numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select id, name, material, hex_or_gradient, active, low_stock_threshold_g,
    case when is_owner() then cost_per_kg else null end as cost_per_kg
  from filament_colors
  order by name;
$$;

grant execute on function filament_colors_safe() to authenticated;

create or replace function printers_safe()
returns table(id uuid, name text, model text, active boolean, hourly_cost numeric)
language sql
security definer
set search_path = public
stable
as $$
  select id, name, model, active,
    case when is_owner() then hourly_cost else null end as hourly_cost
  from printers
  order by name;
$$;

grant execute on function printers_safe() to authenticated;

-- =====================================================================
-- Funções: movimentação de estoque de filamento (nunca escrever direto
-- em filament_spools.remaining_weight_g fora daqui)
-- =====================================================================
create or replace function add_filament_spool(
  p_color_id uuid, p_initial_weight_g numeric, p_cost_paid numeric,
  p_supplier text, p_purchased_at date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_spool_id uuid;
begin
  insert into filament_spools (color_id, purchased_at, initial_weight_g, remaining_weight_g, cost_paid, supplier)
    values (p_color_id, p_purchased_at, p_initial_weight_g, p_initial_weight_g, p_cost_paid, p_supplier)
    returning id into v_spool_id;

  insert into filament_stock_movements (spool_id, grams_delta, reason, created_by)
    values (v_spool_id, p_initial_weight_g, 'new_spool', auth.uid());

  return v_spool_id;
end;
$$;

grant execute on function add_filament_spool(uuid, numeric, numeric, text, date) to authenticated;

create or replace function consume_filament(
  p_spool_id uuid, p_order_line_item_id uuid, p_grams numeric, p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
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

grant execute on function consume_filament(uuid, uuid, numeric, text) to authenticated;

-- =====================================================================
-- View: orders_payment_status
-- Calcula aguardando_sinal / sinal_pago / quitado a partir da soma real
-- de payments confirmados vs. total_amount × expected_deposit_pct —
-- nunca um campo manual que pode dessincronizar.
-- =====================================================================
create or replace view orders_payment_status as
select
  o.id as order_id,
  o.total_amount,
  o.expected_deposit_pct,
  coalesce(sum(p.amount) filter (where p.status = 'confirmado'), 0) as total_paid,
  round(o.total_amount * o.expected_deposit_pct / 100, 2) as expected_deposit_amount,
  case
    when coalesce(sum(p.amount) filter (where p.status = 'confirmado'), 0) <= 0 then 'aguardando_sinal'
    when coalesce(sum(p.amount) filter (where p.status = 'confirmado'), 0) >= o.total_amount then 'quitado'
    else 'sinal_pago'
  end as payment_status
from orders o
left join payments p on p.order_id = o.id
group by o.id, o.total_amount, o.expected_deposit_pct;
