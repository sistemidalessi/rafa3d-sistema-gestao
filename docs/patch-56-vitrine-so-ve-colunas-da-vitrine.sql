-- =====================================================================
-- Patch 56 — quem não fez login só enxerga as colunas da vitrine
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- STATUS: AINDA NÃO APLICADO. Só pode rodar DEPOIS que o catálogo novo (o que
-- pede COLUNAS_DA_VITRINE em vez de "*") estiver publicado E o cache de 10
-- minutos do GitHub Pages tiver vencido. Rodar antes faz o catálogo ANTIGO,
-- que pede "*", abrir vazio.
--
-- POR QUE ISTO EXISTE (auditoria de 11/09/2026, achado r3d-03)
--
-- A política de `products` pro anon filtra LINHAS (active = true). RLS não
-- filtra COLUNAS, e o anon tinha SELECT na tabela inteira. Com a chave pública
-- que está no HTML do catálogo, qualquer pessoa lia de todos os produtos:
-- ai_slicing_tips e ai_slicing_settings (o jeito de fatiar cada peça, que é o
-- que a loja sabe fazer), model_file_path / sliced_file_path, o estado das
-- filas do agente, e open_slicer_agent / save_back_agent — o NOME dos
-- computadores do Rafa.
--
-- A CORREÇÃO é a mesma que o patch 30 já fez em filament_colors: privilégio
-- por coluna. O anon perde o SELECT da tabela e ganha SELECT só nas 16 colunas
-- que a vitrine mostra.
--
-- O QUE NÃO MUDA: dono e ajudante (papel authenticated) continuam lendo tudo;
-- o slicer-agent e as Edge Functions usam a service_role.
--
-- ARMADILHA PRA FRENTE: coluna NOVA em products nasce SEM permissão pro anon.
-- Se a vitrine precisar dela: (1) `grant select (coluna) on products to anon`
-- e (2) acrescentar em COLUNAS_DA_VITRINE no catalogo/index.html. Pedir coluna
-- sem permissão, ou "*", devolve 42501 e a loja abre VAZIA — sem erro na tela.
-- =====================================================================

begin;

revoke select on public.products from anon;
grant select (
  id, catalog_code, category, name, height_cm, sale_price, price_unit_note, promo_note, extra_note,
  image_path, active, created_at, updated_at, badge_label, material, size_note
) on public.products to anon;

commit;

-- CONFERÊNCIA (de fora, com a chave pública)
--   GET /rest/v1/products?select=ai_slicing_tips   -> 401 / 42501
--   GET /rest/v1/products?select=*                 -> 401 / 42501
--   GET /rest/v1/products?select=<as 16 colunas>   -> 200
