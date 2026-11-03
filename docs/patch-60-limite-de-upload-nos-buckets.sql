-- =====================================================================
-- Patch 60 — limite de tamanho (e de tipo, nas fotos de produto) nos buckets do
-- Storage. Achado r3d-14 da auditoria de 11/09/2026, conferido em 03/11/2026.
--
-- STATUS: PREPARADO E ENSAIADO em 03/11/2026 (transação desfeita; conferido depois
-- que os buckets seguem sem limite). Ensaio: modelos-3d=100MB tipo livre,
-- produtos-fotos=10MB 3 tipos, projetos-fotos=15MB tipo livre. APLICADO EM
-- PRODUÇÃO no mesmo dia, com o "sim" do Anderson; conferência igual ao ensaio.
--
-- POR QUÊ: os três buckets estavam sem limite de tamanho nem de tipo. Só a
-- equipe sobe arquivo (políticas do patch 54/57), então o risco é baixo; o
-- limite evita que um arquivo errado (vídeo, arquivo gigante) encha o Storage,
-- que é cobrado. Os números têm folga sobre o maior arquivo de cada bucket no
-- banco real em 03/11/2026:
--   produtos-fotos  93 arquivos, maior 2,8 MB, só JPEG e PNG  → 10 MB, JPEG/PNG/WebP
--   projetos-fotos  29 arquivos, maior 2,0 MB, 3 tipos        → 15 MB, tipo livre
--   modelos-3d      39 arquivos, maior 26,4 MB, 3+ tipos      → 100 MB, tipo livre
-- (o limite global do projeto, em Storage → Settings, continua valendo por cima)
-- Nada que existe hoje passa a ser recusado: o limite vale para upload novo.
-- =====================================================================

begin;
update storage.buckets set file_size_limit = 10 * 1024 * 1024,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'produtos-fotos';
update storage.buckets set file_size_limit = 15 * 1024 * 1024 where id = 'projetos-fotos';
update storage.buckets set file_size_limit = 100 * 1024 * 1024 where id = 'modelos-3d';
commit;

-- CONFERÊNCIA
-- select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id;
