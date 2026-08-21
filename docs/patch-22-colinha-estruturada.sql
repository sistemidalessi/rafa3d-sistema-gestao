-- =====================================================================
-- Patch 22 — colinha da IA também vem em formato de número, não só texto
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- Pra abrir o fatiador já configurado (altura de camada, suporte,
-- aderência etc.), o agente local precisa desses valores em campo
-- separado, não misturado no texto solto que o dono lê. A colinha
-- continua mostrando o texto normal — isso aqui é só uma cópia dela
-- em números, pra máquina usar.
-- =====================================================================

alter table order_line_items add column if not exists ai_slicing_settings jsonb;
alter table products add column if not exists ai_slicing_settings jsonb;
