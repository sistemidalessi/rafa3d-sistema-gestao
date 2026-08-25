-- =====================================================================
-- Patch 30 — o catálogo lê as cores do banco, em vez de ter uma cópia
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- Até agora eram duas listas de cor: a tabela filament_colors, que o
-- Rafa edita na tela, e uma cópia fixa dentro de catalogo/index.html com
-- o degradê de cada bolinha. Cadastrar ou apagar uma cor no sistema não
-- mudava nada no catálogo — e renomear uma fazia a escolha do cliente
-- virar nulo na hora de fechar o pedido, sem erro nenhum na tela.
--
-- Com este patch a tabela vira a única fonte. Some o trabalho de manter
-- as duas iguais, e some junto a classe de erro que vinha disso.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Quem visita o catálogo (anon) pode ver as cores ATIVAS.
--
--    "using (active)" é o que faz a cor guardada sumir da loja sozinha:
--    o dono aperta "guardar" no sistema e ela deixa de ser oferecida,
--    sem ninguém mexer no site.
-- ---------------------------------------------------------------------
drop policy if exists filament_colors_publico on filament_colors;
create policy filament_colors_publico on filament_colors
  for select to anon using (active);

-- ---------------------------------------------------------------------
-- 2. O grant, que é separado da política — e aqui ele é POR COLUNA.
--
--    cost_per_kg fica de fora de propósito: é quanto o Rafa paga pelo
--    filamento, não é da conta de quem compra. Grant por coluna é a
--    única forma de garantir isso; com grant na tabela inteira,
--    bastaria alguém pedir a coluna pra ela vir.
--
--    Efeito colateral esperado: "select *" passa a falhar pro anon. O
--    catálogo pede as colunas pelo nome, de propósito.
-- ---------------------------------------------------------------------
grant select (id, name, hex_or_gradient, active) on filament_colors to anon;

-- ---------------------------------------------------------------------
-- Conferência: tem que listar as cores ativas, e NÃO pode ter custo.
-- (rode como está; se aparecer cost_per_kg em algum lugar, me avise)
-- ---------------------------------------------------------------------
select id, name, hex_or_gradient, active
  from filament_colors
  where active
  order by name;
