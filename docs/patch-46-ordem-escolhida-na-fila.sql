-- =====================================================================
-- Patch 46 — a ordem que a pessoa escolheu manda na sugestão
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- POR QUE ISTO EXISTE
--
-- O "plano do dia" (patch 44) sugere uma ordem boa: primeiro o que não
-- precisa trocar filamento, respeitando prazo. Só que era uma tela de
-- LEITURA — o dono olhava e não conseguia fazer nada. Ele decidiu
-- imprimir a peça número 4 e não tinha como dizer isso pro sistema; a
-- lista continuava afirmando outra coisa.
--
-- Sugestão que não pode ser contrariada não é sugestão, é ordem. E
-- quando a máquina está imprimindo a peça 4, uma tela que insiste na
-- peça 1 está simplesmente errada.
--
-- Nulo = "deixa o sistema decidir", que é como toda peça começa e como
-- todo registro antigo se comporta. Número = "eu quero esta aqui",
-- menor primeiro. As duas convivem: as escolhidas à mão vêm no topo,
-- na ordem escolhida, e o resto segue a sugestão automática.
-- =====================================================================

alter table order_line_items
  add column if not exists ordem_na_fila int;

create index if not exists order_line_items_ordem_fila_idx
  on order_line_items (ordem_na_fila) where ordem_na_fila is not null;

-- ---------------------------------------------------------------------
-- GRANT — a armadilha dos patches 06, 09, 17, 19, 26, 34, 35 e 43.
-- Grant de tabela cobre coluna nova, e order_line_items já tem os seus;
-- ficam repetidos porque é idempotente e ler o grant no patch é mais
-- barato que descobrir o 42501 depois.
-- ---------------------------------------------------------------------
grant select, insert, update, delete on order_line_items to authenticated;
grant select, insert, update, delete on order_line_items to service_role;
