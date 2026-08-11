-- =====================================================================
-- Patch 09 — aba Projetos (pedido personalizado com foto + IA)
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- Não cria tabela nova pra "projeto" — reaproveita order_line_items com
-- line_type = 'custom', que já existia pra isso (custom_description,
-- custom_reference_image_path já estavam no schema inicial). Só
-- adiciona os campos de IA (viabilidade + geração de modelo via Meshy)
-- e o fluxo de fatiamento, espelhando o que já existe em products.
-- =====================================================================

-- unit_price era obrigatório desde a criação do pedido — mas um projeto
-- nasce sem preço (só depois da IA/análise é que o dono define). Sem
-- isso, não dá nem pra inserir a linha personalizada no início do fluxo.
alter table order_line_items alter column unit_price drop not null;

-- Nome/contato de quem pediu, pra projeto que ainda não tem customer_id
-- cadastrado (a equipe cadastra rápido, sem precisar criar cliente
-- primeiro toda vez — pode virar customer_id depois, se quiser).
alter table order_line_items add column if not exists requester_name text;
alter table order_line_items add column if not exists requester_contact text;

-- Análise de viabilidade por IA (primeira etapa: "dá pra imprimir isso?").
alter table order_line_items add column if not exists ai_viability_status text
  check (ai_viability_status in ('queued', 'processing', 'done', 'error'));
alter table order_line_items add column if not exists ai_viability_notes text;
alter table order_line_items add column if not exists ai_viability_error text;
alter table order_line_items add column if not exists ai_viability_requested_at timestamptz;
alter table order_line_items add column if not exists ai_viability_done_at timestamptz;

-- Geração do modelo 3D via Meshy (segunda etapa, só depois de aprovado
-- seguir). model_source distingue gerado por IA de anexado à mão (ex:
-- Rafael modelou ele mesmo em vez de usar a Meshy).
alter table order_line_items add column if not exists model_file_path text;
alter table order_line_items add column if not exists model_source text
  check (model_source in ('manual_upload', 'meshy_generated'));
alter table order_line_items add column if not exists meshy_status text
  check (meshy_status in ('queued', 'processing', 'done', 'error'));
alter table order_line_items add column if not exists meshy_error text;
alter table order_line_items add column if not exists meshy_task_id text;
alter table order_line_items add column if not exists meshy_requested_at timestamptz;

-- Mesmo par usado em products pro botão "Abrir no Fatiador" — depois que
-- o projeto tem um arquivo 3D (gerado ou anexado), o fluxo de abrir no
-- Bambu Studio é idêntico ao dos produtos do catálogo.
alter table order_line_items add column if not exists open_slicer_status text
  check (open_slicer_status in ('queued', 'done', 'error'));
alter table order_line_items add column if not exists open_slicer_error text;
alter table order_line_items add column if not exists open_slicer_requested_at timestamptz;

create index if not exists order_line_items_ai_viability_queued_idx on order_line_items(ai_viability_requested_at)
  where ai_viability_status = 'queued';
create index if not exists order_line_items_meshy_queued_idx on order_line_items(meshy_requested_at)
  where meshy_status = 'queued';
create index if not exists order_line_items_open_slicer_queued_idx on order_line_items(open_slicer_requested_at)
  where open_slicer_status = 'queued';

-- ---------------------------------------------------------------------
-- Bucket de Storage pras fotos de referência que o cliente manda — bucket
-- separado do 'modelos-3d' (que é só arquivo .stl/.3mf), privado, só o
-- dono acessa (mesmo padrão do patch-04).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('projetos-fotos', 'projetos-fotos', false)
on conflict (id) do nothing;

drop policy if exists projetos_fotos_select on storage.objects;
create policy projetos_fotos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'projetos-fotos' and is_owner());

drop policy if exists projetos_fotos_insert on storage.objects;
create policy projetos_fotos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'projetos-fotos' and is_owner());

drop policy if exists projetos_fotos_update on storage.objects;
create policy projetos_fotos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'projetos-fotos' and is_owner());

drop policy if exists projetos_fotos_delete on storage.objects;
create policy projetos_fotos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'projetos-fotos' and is_owner());

-- service_role (agente local) precisa do mesmo acesso de leitura/escrita
-- que já foi concedido em products no patch-06, agora pra order_line_items
-- e orders também (o agente cria/atualiza projeto e o pedido por trás dele).
grant select, update on order_line_items to service_role;
grant select, insert, update on orders to service_role;
