-- =====================================================================
-- Patch 37 — tamanho da peça vira texto livre, não só "altura"
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- height_cm sempre assumiu que altura é a medida que importa — mas pra
-- peça baixa e larga (porta-anel, porta-joia, um prato) o que ajuda o
-- cliente a entender o tamanho é a largura ou o diâmetro, não a altura.
-- size_note é texto livre ("18cm de altura", "9 × 9cm", "12cm de
-- diâmetro") pra descrever do jeito que fizer sentido pra CADA peça.
--
-- height_cm continua existindo, sem mexer — é o que os produtos antigos
-- já têm preenchido, e o catálogo cai pra ele quando size_note está
-- vazio (produto que ninguém editou desde este patch).
-- =====================================================================

alter table products add column if not exists size_note text;

-- Sem grant novo de propósito: quem grava isso é o navegador logado do
-- dono/ajudante (RLS de sempre em products), e a função que sugere o
-- tamanho por IA não toca no banco — só devolve a sugestão pra tela
-- preencher. Nada novo usa service_role aqui.

-- ---------------------------------------------------------------------
-- Conferência: a coluna tem que aparecer.
-- ---------------------------------------------------------------------
select column_name from information_schema.columns
  where table_name = 'products' and column_name = 'size_note';
