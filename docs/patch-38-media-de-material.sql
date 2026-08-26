-- =====================================================================
-- Patch 38 — escolher só o material (PLA/PETG...), não uma cor específica
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- Na hora de estimar custo, a cor exata quase nunca importa — o que
-- muda o preço por quilo é o MATERIAL (PLA vs PETG), não se é vermelho
-- ou azul. Escolher uma cor específica só pra ter algum número pra
-- calcular era um passo a mais sem necessidade.
--
-- filament_material_media guarda qual material foi escolhido quando a
-- pessoa pediu a MÉDIA em vez de uma cor exata (fica null quando
-- escolheu uma cor de verdade — os dois nunca valem ao mesmo tempo).
-- =====================================================================

alter table product_recipes add column if not exists filament_material_media text;
