-- =====================================================================
-- Patch 48 — dá pra tirar o projeto da tela sem apagar o pedido
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- POR QUE ISTO EXISTE
--
-- "Projeto" não é uma coisa separada no banco: é a MESMA linha do
-- pedido (order_line_items com line_type='custom'), vista pela aba
-- Projetos. Por isso apagar o projeto apagava o pedido do cliente —
-- são a mesma linha.
--
-- Só que o trabalho de projeto tem fim: quando a peça foi desenhada,
-- aprovada e virou pedido, não há mais nada a fazer NAQUELA tela. O
-- pedido segue vivo em Pedidos, na Fila, no Financeiro. Sem um jeito
-- de tirar da vista, a aba Projetos vira uma lista de centenas de
-- coisas terminadas e ninguém acha mais o que está em andamento.
--
-- Esta coluna separa as duas ideias que estavam grudadas:
--   arquivar = sai da tela de Projetos, o pedido continua igual
--   excluir  = some tudo (e agora vai pra lixeira, patch 47)
--
-- Só a aba Projetos olha esta coluna. Pedidos, Fila, Financeiro e o
-- agente continuam vendo a peça normalmente — arquivar é sobre a
-- ARRUMAÇÃO de uma tela, não sobre o estado do trabalho.
-- =====================================================================

alter table order_line_items
  add column if not exists projeto_arquivado_em timestamptz;

create index if not exists order_line_items_projeto_arquivado_idx
  on order_line_items (projeto_arquivado_em) where projeto_arquivado_em is not null;

-- ---------------------------------------------------------------------
-- GRANT — a armadilha dos patches 06, 09, 17, 19, 26, 34, 35 e 43.
-- Grant de tabela cobre coluna nova; ficam repetidos porque é
-- idempotente e ler o grant no patch é mais barato que descobrir o
-- 42501 depois.
-- ---------------------------------------------------------------------
grant select, insert, update, delete on order_line_items to authenticated;
grant select, insert, update, delete on order_line_items to service_role;
