-- =====================================================================
-- Patch 20 — feedback de impressão pra colinha de IA ir aprendendo
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- Guarda se a colinha sugerida pela IA funcionou de verdade na hora de
-- imprimir. Da próxima vez que a mesma peça (produto ou projeto) for
-- analisada, o agente local lê esse histórico e avisa a IA do que já
-- deu errado antes, pra ela não repetir o mesmo erro.
-- =====================================================================

create table if not exists print_feedback (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  order_line_item_id uuid references order_line_items(id) on delete cascade,
  colinha_usada text, -- ficha técnica que estava valendo nessa tentativa
  funcionou boolean not null,
  nota text, -- ex: "a base soltou", "suporte quebrou na retirada"
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  constraint print_feedback_tem_alvo check (product_id is not null or order_line_item_id is not null)
);

create index if not exists idx_print_feedback_product on print_feedback(product_id);
create index if not exists idx_print_feedback_line_item on print_feedback(order_line_item_id);

alter table print_feedback enable row level security;

drop policy if exists print_feedback_select on print_feedback;
create policy print_feedback_select on print_feedback
  for select to authenticated using (is_owner());

drop policy if exists print_feedback_insert on print_feedback;
create policy print_feedback_insert on print_feedback
  for insert to authenticated with check (is_owner());

-- O agente local (service_role) precisa ler o histórico antes de gerar
-- uma colinha nova.
grant select on print_feedback to service_role;
