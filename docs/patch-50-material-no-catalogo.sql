-- =====================================================================
-- Patch 50 — o catálogo pode ler o material do filamento
-- Rode este arquivo inteiro: no site do Supabase → SQL Editor → cola e
-- aperta Run.
--
-- POR QUE ISTO EXISTE
--
-- A vitrine de cores do catálogo mostra só o NOME, e agora existem dois
-- filamentos chamados "Verde" — um PLA Silk e um PETG Basic. Pro
-- cliente aparecem duas bolinhas verdes iguais, uma do lado da outra,
-- sem nada explicando a diferença.
--
-- É a mesma regra que o sistema já segue por dentro desde 28/08 ("cor
-- sozinha na tela é bug", no CLAUDE.md): "Verde" e "Verde" são
-- filamentos diferentes se um é PLA e o outro é PETG. O catálogo era o
-- último lugar que ainda mostrava a cor sem o material.
--
-- O acesso público a filament_colors é POR COLUNA, de propósito —
-- `cost_per_kg` não é da conta de quem compra. Por isso não bastava
-- mudar a consulta: a coluna precisa ser liberada aqui.
--
-- Material é informação de produto, não de custo: quem compra tem
-- interesse legítimo em saber (PETG aguenta mais calor e sol que PLA).
-- =====================================================================

grant select (material) on filament_colors to anon;
grant select (material) on filament_colors to authenticated;
