-- =====================================================================
-- Patch 49 — a mesma cor pode existir em materiais diferentes
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- POR QUE ISTO EXISTE
--
-- O dono tentou cadastrar "Verde" em PETG Basic e o sistema recusou
-- dizendo que já existe — mas o Verde que existe é PLA Silk. São dois
-- filamentos diferentes: material decide temperatura, placa, e se a
-- peça sai ou derrete.
--
-- A culpa é de um índice criado em `import-filamentos.sql`, quando as
-- 30 cores foram importadas de uma vez e TODAS eram PLA. Ali
-- `unique(name)` servia pro `on conflict` não duplicar. Hoje ele impede
-- exatamente o cadastro certo — e é o mesmo erro de fundo que fez a
-- Fila aprovar imprimir uma peça de PETG num rolo de TPU: tratar "a
-- cor" como se fosse identidade suficiente.
--
-- Nome + material é a identidade de verdade: é isso que corresponde a
-- um rolo que dá pra comprar.
-- =====================================================================

drop index if exists filament_colors_name_uq;

-- Continua impedindo o duplicado de verdade: "Verde PLA" duas vezes.
create unique index if not exists filament_colors_nome_material_uq
  on filament_colors (name, material);

-- Nada de grant novo: a tabela já tem os dela, e índice não muda
-- permissão. (Confirmado antes de rodar: nenhuma cor do banco repete o
-- par nome+material, então o índice sobe sem conflito.)
