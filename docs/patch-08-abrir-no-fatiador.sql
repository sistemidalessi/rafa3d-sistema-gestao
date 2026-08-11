-- =====================================================================
-- Patch 08 — botão "Abrir no Fatiador"
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- Substitui a ideia de fatiar 100% sozinho (que na prática falha na
-- maioria das peças reais, por limitação do OrcaSlicer com projetos
-- complexos) por algo mais realista: o agente local baixa o arquivo e
-- já abre ele no OrcaSlicer, pronto pra terminar a configuração com a
-- colinha da IA do lado — só falta clicar em "Fatiar Placa" de verdade.
-- =====================================================================

alter table products add column if not exists open_slicer_status text
  check (open_slicer_status in ('queued', 'done', 'error'));
alter table products add column if not exists open_slicer_error text;
alter table products add column if not exists open_slicer_requested_at timestamptz;

create index if not exists products_open_slicer_queued_idx on products(open_slicer_requested_at)
  where open_slicer_status = 'queued';
