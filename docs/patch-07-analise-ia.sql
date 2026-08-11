-- =====================================================================
-- Patch 07 — análise de fatiamento por IA ("colinha" de configuração)
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
-- Depende do patch-04 (biblioteca de arquivos 3D) já ter sido rodado.
-- =====================================================================

-- Mesmo padrão de slice_status/slice_error do patch-05, só que pra
-- análise por IA em vez de fatiamento.
alter table products add column if not exists ai_analysis_status text
  check (ai_analysis_status in ('queued', 'processing', 'done', 'error'));
alter table products add column if not exists ai_analysis_error text;
alter table products add column if not exists ai_analysis_requested_at timestamptz;
alter table products add column if not exists ai_analysis_done_at timestamptz;

-- A "colinha" em si: texto pronto (suporte, brim, avisos) pra copiar
-- pro fatiador. Guardado como texto simples, não estruturado — mais
-- fácil de ler na tela e de ajustar o formato depois sem migração.
alter table products add column if not exists ai_slicing_tips text;

create index if not exists products_ai_queued_idx on products(ai_analysis_requested_at)
  where ai_analysis_status = 'queued';
