-- =====================================================================
-- Patch 11 — colinha de fatiamento por IA também nos Projetos
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- Mesma "ficha técnica" que já existe em products (patch-05/07), agora
-- pra order_line_items — faltava depois que o projeto já tem um modelo
-- 3D pronto (gerado ou anexado).
-- =====================================================================

alter table order_line_items add column if not exists ai_analysis_status text
  check (ai_analysis_status in ('queued', 'processing', 'done', 'error'));
alter table order_line_items add column if not exists ai_analysis_error text;
alter table order_line_items add column if not exists ai_slicing_tips text;
alter table order_line_items add column if not exists ai_analysis_requested_at timestamptz;
alter table order_line_items add column if not exists ai_analysis_done_at timestamptz;

-- Miniatura renderizada pela própria Meshy do modelo gerado (thumbnail_url
-- da resposta da tarefa) — usada como imagem de entrada pra IA analisar,
-- já que arquivo .stl (ao contrário de .3mf) não carrega miniatura dentro
-- dele. Se o modelo foi anexado manualmente (sem passar pela Meshy), a
-- análise cai de volta pra foto de referência do cliente.
alter table order_line_items add column if not exists meshy_thumbnail_path text;

create index if not exists order_line_items_ai_analysis_queued_idx on order_line_items(ai_analysis_requested_at)
  where ai_analysis_status = 'queued';
