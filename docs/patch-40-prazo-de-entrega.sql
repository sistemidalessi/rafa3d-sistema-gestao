-- =====================================================================
-- Patch 40 — prazo de entrega, opcional, pra não perder o fio na Fila
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- Nem todo pedido tem data pra entregar — por isso é opcional (fica
-- null até alguém preencher). Quando existe, a Fila de Impressão usa
-- ele junto com o tempo estimado de impressão da peça (já existe pra
-- catálogo em product_recipes, e pra projeto em order_line_items desde
-- o patch-39) pra calcular até quando a peça precisa ir pra impressora
-- — pedido de 3 dias com peça que demora 2 pra imprimir não pode
-- esperar até o último dia.
--
-- Fica em orders (não em order_line_items) porque a Fila já reúne as
-- peças de um pedido pela mesma tela de "Entrega" que já existe lá —
-- é o cliente que tem um prazo, não a peça individual.
-- =====================================================================

alter table orders add column if not exists needed_by date;

-- Sem grant novo de propósito: quem grava isso é o navegador logado do
-- dono/ajudante (RLS de sempre em orders, já usada por shipping_price e
-- companhia) — nada novo usa service_role aqui.
