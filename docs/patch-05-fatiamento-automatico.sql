-- =====================================================================
-- Patch 05 — fatiamento automático (Fase 2 da Fabricação Automática)
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
-- Depende do patch-04 (biblioteca de arquivos 3D) já ter sido rodado —
-- precisa de products.model_file_path pra saber o que fatiar.
-- =====================================================================

-- Estado do pedido de fatiamento. null = nunca foi pedido.
-- queued: dono clicou "Fatiar" no sistema, esperando o agente local pegar.
-- processing: agente local pegou e está rodando o OrcaSlicer agora.
-- done: fatiou com sucesso, sliced_file_path aponta pro resultado.
-- error: falhou, slice_error tem o motivo (ex: OrcaSlicer travou nessa peça).
alter table products add column if not exists slice_status text
  check (slice_status in ('queued', 'processing', 'done', 'error'));
alter table products add column if not exists slice_error text;
alter table products add column if not exists slice_requested_at timestamptz;
alter table products add column if not exists sliced_at timestamptz;

-- Onde o .3mf já fatiado (com g-code embutido, pronto pra Bambu Handy/
-- impressora) fica guardado — mesmo bucket privado 'modelos-3d' do
-- patch-04, só que numa subpasta separada do arquivo original.
alter table products add column if not exists sliced_file_path text;

-- Índice parcial: o agente local só precisa varrer quem está 'queued',
-- então indexar só essas linhas mantém a consulta rápida mesmo com o
-- catálogo crescendo.
create index if not exists products_slice_queued_idx on products(slice_requested_at)
  where slice_status = 'queued';
