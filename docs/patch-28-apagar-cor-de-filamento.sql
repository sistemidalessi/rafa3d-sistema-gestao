-- =====================================================================
-- Patch 28 — apagar cor de filamento, e avisar de estoque baixo em 50 g
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- A tela de Filamentos deixava criar e editar cor, mas não apagar. Dava
-- pra cadastrar errado e conviver com a sobra pra sempre.
--
-- O grant de delete já existe desde o schema inicial (linha "grant
-- select, insert, update, delete on all tables ... to authenticated"),
-- mas faltava a POLÍTICA — e sem ela a RLS bloqueia por padrão. É o par
-- que sempre confunde neste projeto: grant e política são duas coisas
-- separadas, e as duas precisam existir.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Só o dono apaga. O ajudante não mexe em cadastro de filamento, do
-- mesmo jeito que já não podia criar nem editar.
-- ---------------------------------------------------------------------
drop policy if exists filament_colors_delete on filament_colors;
create policy filament_colors_delete on filament_colors
  for delete to authenticated using (is_owner());

-- ---------------------------------------------------------------------
-- Não existe "apagar em cascata" aqui, e é de propósito.
--
-- Três tabelas apontam pra filament_colors:
--   filament_spools.color_id                     (not null)
--   product_recipes.filament_color_id            (aceita nulo)
--   order_line_items.requested_filament_color_id (aceita nulo)
--
-- Apagar uma cor que tem rolo comprado ou pedido pedindo ela apagaria
-- histórico de dinheiro e de venda. O banco recusa (erro de chave
-- estrangeira), e a tela confere antes: se a cor estiver em uso, ela
-- oferece DESATIVAR em vez de apagar. Cor desativada some das listas
-- novas mas continua explicando os pedidos antigos.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- Aviso de estoque baixo passa a ser 50 g, em todas as cores.
--
-- O padrão antigo era 200 g — cerca de um quinto de rolo, cedo demais
-- pra avisar. Com 50 g o aviso chega quando o rolo está mesmo no fim.
--
-- Roda aqui e não pelo agente de propósito: o service_role só tem
-- SELECT nesta tabela (patch 26), e escrever em cadastro de filamento
-- não é trabalho dele — é do dono, pela tela.
-- ---------------------------------------------------------------------
update filament_colors set low_stock_threshold_g = 50
  where low_stock_threshold_g is distinct from 50;

-- Conferência: tem que voltar uma linha só, com 50.
select distinct low_stock_threshold_g as limite_em_gramas from filament_colors;
