-- =====================================================================
-- Patch 45 — cada parte de um projeto tem a sua cor
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- POR QUE ISTO EXISTE
--
-- Peça dividida por cor (o Hi3D já entrega assim) precisa de TODAS as
-- cores dela carregadas ao mesmo tempo pra poder imprimir — o AMS tem
-- 4 gavetas, e uma peça de 4 cores ocupa as 4.
--
-- Só que o sistema não tinha onde guardar isso: `order_line_items` tem
-- uma cor só (`requested_filament_color_id`, a que o cliente pediu no
-- catálogo) e `project_parts` não tinha cor nenhuma. Sem esta coluna,
-- a Fila não consegue responder "dá pra imprimir esta peça agora, com
-- o que está carregado?" — que é a pergunta inteira da sugestão de
-- ordem (patch 44 em diante).
--
-- Fica na PARTE e não no item porque é a parte que é de uma cor só —
-- é exatamente essa a divisão que o Hi3D faz.
-- =====================================================================

alter table project_parts
  add column if not exists filament_color_id uuid references filament_colors(id) on delete set null;

-- Nulo = ainda não foi dito de que cor é esta parte. A Fila trata isso
-- como "não sei", não como "qualquer cor": chutar faria a sugestão
-- mandar imprimir algo que na hora não dá.
create index if not exists project_parts_cor_idx
  on project_parts (filament_color_id) where filament_color_id is not null;

-- ---------------------------------------------------------------------
-- GRANT — mesma armadilha dos patches 06, 09, 17, 19, 26, 34, 35 e 43.
-- Grant de TABELA cobre coluna nova, e project_parts já tinha os seus
-- desde o patch 23; ficam repetidos aqui de propósito, porque é
-- idempotente, custa nada, e ler o grant no patch é mais barato que
-- descobrir o 42501 com o agente calado na frente.
-- ---------------------------------------------------------------------
grant select, insert, update, delete on project_parts to authenticated;
grant select, insert, update, delete on project_parts to service_role;
