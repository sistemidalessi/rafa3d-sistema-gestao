-- =====================================================================
-- Dados de demonstração — clientes, pedidos, fila e projetos inventados
-- =====================================================================
--
-- Roda no projeto Supabase de DEMONSTRAÇÃO, depois do schema-inicial e dos
-- patches 01 a 11, e depois dos dois imports (filamentos e produtos).
--
-- Nada aqui vem da produção. Todo nome, telefone e pedido deste arquivo é
-- inventado — é por isso que a demonstração da Rafa 3D não precisa de
-- script de anonimização, diferente da JJ Solene. Ver demo-setup.md.
--
-- Idempotente: os ids são fixos e tudo usa `on conflict do nothing`, então
-- rodar de novo não duplica nada. Pra recomeçar do zero, o fim do arquivo
-- tem o bloco de limpeza (comentado).
--
-- Trava de segurança: só roda em banco marcado como demonstração.
--     create table if not exists este_banco_e_demo ();
-- Essa tabela não existe em produção, e não deve ser criada lá.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.este_banco_e_demo') is null then
    raise exception
      'ABORTADO: este banco não está marcado como demonstração. Se ele É o de demonstração, rode "create table este_banco_e_demo ();" e tente de novo.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Clientes
--
-- Telefone na faixa (11) 9xxxx-xxxx, todos inventados. O Instagram segue
-- o mesmo padrão de nome falso — a aba Clientes mostra essa coluna.
-- ---------------------------------------------------------------------
insert into customers (id, name, phone, email, instagram, notes, created_at) values
  ('d0000000-0000-4000-8000-000000000001','Camila Nogueira','(11) 98412-3307','camila.nogueira@exemplo.com.br','@camila.nogueira','Prefere cores foscas. Já comprou 3 vezes.', now() - interval '120 days'),
  ('d0000000-0000-4000-8000-000000000002','Rodrigo Esteves','(11) 99127-4482','rodrigo.esteves@exemplo.com.br','@rodrigo.esteves','Encontrou pelo Instagram.', now() - interval '96 days'),
  ('d0000000-0000-4000-8000-000000000003','Beatriz Cardoso','(11) 97733-1290','beatriz.cardoso@exemplo.com.br','@bia.cardoso','Comprou como presente de aniversário.', now() - interval '74 days'),
  ('d0000000-0000-4000-8000-000000000004','Felipe Machado','(11) 96604-8851','felipe.machado@exemplo.com.br',null,'Pediu orçamento de peça sob encomenda.', now() - interval '52 days'),
  ('d0000000-0000-4000-8000-000000000005','Larissa Duarte','(11) 98890-2216','larissa.duarte@exemplo.com.br','@lari.duarte',null, now() - interval '38 days'),
  ('d0000000-0000-4000-8000-000000000006','Gustavo Ramos','(11) 97245-6033','gustavo.ramos@exemplo.com.br',null,'Papelaria do bairro — comprou expositores.', now() - interval '27 days'),
  ('d0000000-0000-4000-8000-000000000007','Helena Teixeira','(11) 99518-7724','helena.teixeira@exemplo.com.br','@helena.teixeira','Quer a peça até o fim do mês.', now() - interval '11 days'),
  ('d0000000-0000-4000-8000-000000000008','Diego Barbosa','(11) 96371-9948','diego.barbosa@exemplo.com.br',null,'Primeiro contato pelo WhatsApp.', now() - interval '4 days')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Impressoras
--
-- power_watts é a média DURANTE a impressão, não o pico do fabricante —
-- é o que faz o custo de energia sair realista (ver schema-inicial).
-- ---------------------------------------------------------------------
insert into printers (id, name, model, active, power_watts, energy_price_per_kwh, hourly_cost) values
  ('e0000000-0000-4000-8000-000000000001','Impressora 1','Bambu Lab A1', true, 105, 1.20, 0.13),
  ('e0000000-0000-4000-8000-000000000002','Impressora 2','Bambu Lab A1 mini', true, 85, 1.20, 0.10),
  ('e0000000-0000-4000-8000-000000000003','Impressora 3 (reserva)','Ender 3 V2', false, 130, 1.20, 0.16)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Rolos de filamento
--
-- Um deles fica com pouco material de propósito, pra demonstração mostrar
-- o aviso de estoque baixo funcionando.
-- ---------------------------------------------------------------------
insert into filament_spools (id, color_id, purchased_at, initial_weight_g, remaining_weight_g, cost_paid, supplier, status)
select v.id, c.id, v.purchased_at, v.initial_weight_g, v.remaining_weight_g, v.cost_paid, v.supplier, v.status
  from (values
    ('f0000000-0000-4000-8000-000000000001'::uuid,'Preto Fosco', current_date - 90, 1000::numeric, 240::numeric, 99::numeric,'Fornecedor Exemplo','in_use'),
    ('f0000000-0000-4000-8000-000000000002'::uuid,'Branco',      current_date - 75, 1000::numeric, 610::numeric, 99::numeric,'Fornecedor Exemplo','in_use'),
    ('f0000000-0000-4000-8000-000000000003'::uuid,'Prata Alumínio', current_date - 60, 1000::numeric, 120::numeric, 99::numeric,'Fornecedor Exemplo','in_use'),
    ('f0000000-0000-4000-8000-000000000004'::uuid,'Preto Brilhante', current_date - 45, 1000::numeric, 0::numeric,  99::numeric,'Fornecedor Exemplo','empty'),
    ('f0000000-0000-4000-8000-000000000005'::uuid,'Crystal Clear (Transparente)', current_date - 20, 1000::numeric, 980::numeric, 99::numeric,'Fornecedor Exemplo','stored'),
    ('f0000000-0000-4000-8000-000000000006'::uuid,'Branco Marmorizado', current_date - 8, 1000::numeric, 870::numeric, 99::numeric,'Fornecedor Exemplo','in_use')
  ) as v(id, cor, purchased_at, initial_weight_g, remaining_weight_g, cost_paid, supplier, status)
  join filament_colors c on c.name = v.cor
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Pedidos
--
-- Espalhados pelos status pra que Dashboard, Pedidos e Fila tenham o que
-- mostrar: um orçamento parado, um aprovado esperando produção, dois em
-- produção, um concluído e um cancelado.
-- ---------------------------------------------------------------------
insert into orders (id, order_number, customer_id, order_type, status, channel, total_amount, expected_deposit_pct, created_at) values
  ('a0000000-0000-4000-8000-000000000001','2026-001','d0000000-0000-4000-8000-000000000001','catalogo','concluido','whatsapp', 143.70, 50, now() - interval '54 days'),
  ('a0000000-0000-4000-8000-000000000002','2026-002','d0000000-0000-4000-8000-000000000003','catalogo','concluido','app', 97.80, 50, now() - interval '41 days'),
  ('a0000000-0000-4000-8000-000000000003','2026-003','d0000000-0000-4000-8000-000000000006','catalogo','em_producao','presencial', 259.60, 50, now() - interval '16 days'),
  ('a0000000-0000-4000-8000-000000000004','2026-004','d0000000-0000-4000-8000-000000000004','sob_encomenda','em_producao','whatsapp', 180.00, 50, now() - interval '12 days'),
  ('a0000000-0000-4000-8000-000000000005','2026-005','d0000000-0000-4000-8000-000000000007','misto','aprovado','whatsapp', 214.80, 50, now() - interval '6 days'),
  ('a0000000-0000-4000-8000-000000000006','2026-006','d0000000-0000-4000-8000-000000000008','catalogo','orcamento','app', 92.80, 50, now() - interval '2 days'),
  ('a0000000-0000-4000-8000-000000000007','2026-007','d0000000-0000-4000-8000-000000000002','catalogo','cancelado','whatsapp', 47.90, 50, now() - interval '33 days')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Itens de catálogo
--
-- unit_price é snapshot do preço no momento do pedido — de propósito não
-- lê sale_price ao vivo (ver comentário da coluna no schema-inicial).
-- ---------------------------------------------------------------------
insert into order_line_items (id, order_id, line_type, product_id, quantity, unit_price, unit_cost_estimate, line_status, printer_id, created_at)
select v.id, v.order_id, 'catalog', p.id, v.quantity, v.unit_price, v.unit_cost, v.line_status, v.printer_id, v.created_at
  from (values
    ('b0000000-0000-4000-8000-000000000001'::uuid,'a0000000-0000-4000-8000-000000000001'::uuid,'01.01', 2, 47.90::numeric, 14.20::numeric,'entregue','e0000000-0000-4000-8000-000000000001'::uuid, now() - interval '54 days'),
    ('b0000000-0000-4000-8000-000000000002'::uuid,'a0000000-0000-4000-8000-000000000001'::uuid,'01.05', 1, 91.90::numeric, 27.40::numeric,'entregue','e0000000-0000-4000-8000-000000000001'::uuid, now() - interval '54 days'),
    ('b0000000-0000-4000-8000-000000000003'::uuid,'a0000000-0000-4000-8000-000000000002'::uuid,'01.03', 2, 49.90::numeric, 13.10::numeric,'entregue','e0000000-0000-4000-8000-000000000002'::uuid, now() - interval '41 days'),
    ('b0000000-0000-4000-8000-000000000004'::uuid,'a0000000-0000-4000-8000-000000000003'::uuid,'01.06', 2, 79.90::numeric, 22.80::numeric,'embalado','e0000000-0000-4000-8000-000000000001'::uuid, now() - interval '16 days'),
    ('b0000000-0000-4000-8000-000000000005'::uuid,'a0000000-0000-4000-8000-000000000003'::uuid,'01.08', 1, 84.90::numeric, 25.60::numeric,'imprimindo','e0000000-0000-4000-8000-000000000001'::uuid, now() - interval '16 days'),
    ('b0000000-0000-4000-8000-000000000006'::uuid,'a0000000-0000-4000-8000-000000000003'::uuid,'01.11', 1, 44.90::numeric, 12.90::numeric,'fila_impressao', null, now() - interval '16 days'),
    ('b0000000-0000-4000-8000-000000000007'::uuid,'a0000000-0000-4000-8000-000000000005'::uuid,'01.04', 1, 54.90::numeric, 16.30::numeric,'fila_impressao', null, now() - interval '6 days'),
    ('b0000000-0000-4000-8000-000000000008'::uuid,'a0000000-0000-4000-8000-000000000006'::uuid,'01.02', 1, 47.90::numeric, 14.20::numeric,'orcamento_pendente', null, now() - interval '2 days'),
    ('b0000000-0000-4000-8000-000000000009'::uuid,'a0000000-0000-4000-8000-000000000006'::uuid,'01.09', 1, 47.90::numeric, 13.80::numeric,'orcamento_pendente', null, now() - interval '2 days'),
    ('b0000000-0000-4000-8000-00000000000a'::uuid,'a0000000-0000-4000-8000-000000000007'::uuid,'01.07', 1, 49.90::numeric, 14.60::numeric,'cancelado', null, now() - interval '33 days')
  ) as v(id, order_id, catalog_code, quantity, unit_price, unit_cost, line_status, printer_id, created_at)
  join products p on p.catalog_code = v.catalog_code
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Projetos (pedido personalizado)
--
-- Projeto não é tabela própria: é order_line_items com line_type='custom'
-- (ver CLAUDE.md). Ficam SEM foto e SEM modelo 3D porque os buckets do
-- Storage começam vazios no projeto de demonstração — a foto de referência
-- de um projeto real é uma foto que o cliente mandou, e nada disso é
-- copiado pra cá.
--
-- A colinha de fatiamento por IA já vem preenchida e com status 'done' de
-- propósito: sem o agente rodando, um projeto em 'queued' ficaria girando
-- pra sempre na tela. Assim o visitante vê o resultado da funcionalidade
-- em vez de uma fila travada.
-- ---------------------------------------------------------------------
insert into order_line_items (
  id, order_id, line_type, custom_description, requester_name, requester_contact,
  quantity, unit_price, unit_cost_estimate, line_status, printer_id,
  ai_analysis_status, ai_slicing_tips, ai_analysis_requested_at, ai_analysis_done_at, created_at
) values
  ('b0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000004','custom',
   'Troféu personalizado para campeonato de futebol de várzea — base redonda com plaquinha para gravar o nome do time.',
   'Felipe Machado','(11) 96604-8851', 1, 180.00, 52.40,'imprimindo','e0000000-0000-4000-8000-000000000002',
   'done',
   E'Peça alta e estreita: imprimir em pé, com balsa (raft) para não descolar da mesa.\n- Camada: 0,20 mm\n- Preenchimento: 15% giroide (leve, mas segura a base)\n- Suporte: só na plaquinha, ângulo acima de 55°\n- Velocidade reduzida nos últimos 2 cm, onde a peça fica mais fina e balança.\nCuidado: a alça do troféu tem uma ponte de 18 mm — se descair, aumente o resfriamento para 100% nessa faixa.',
   now() - interval '12 days', now() - interval '12 days', now() - interval '12 days'),

  ('b0000000-0000-4000-8000-000000000102','a0000000-0000-4000-8000-000000000005','custom',
   'Miniatura do cachorro da cliente (dachshund), cerca de 12 cm, para colocar na estante.',
   'Helena Teixeira','(11) 99518-7724', 1, 159.90, 41.80,'orcamento_aprovado', null,
   'done',
   E'Modelo orgânico, com detalhe fino no focinho e nas patas.\n- Camada: 0,12 mm (o detalhe do focinho some em 0,20)\n- Preenchimento: 10% — peça decorativa, não estrutural\n- Suporte: em árvore, só embaixo do queixo e do rabo\n- Orientação: deitada de lado reduz suporte, mas deixa marca no flanco; em pé fica melhor de acabamento e vale a hora a mais.\nCuidado: as patas têm 3 mm de espessura, abaixo do bico de 0,4 em 2 perímetros — reforce para 3 perímetros.',
   now() - interval '5 days', now() - interval '5 days', now() - interval '6 days')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Colinha de IA também em dois produtos do catálogo, pelo mesmo motivo:
-- mostrar a funcionalidade pronta em vez de uma fila parada.
-- ---------------------------------------------------------------------
update products set
  ai_analysis_status = 'done',
  ai_analysis_requested_at = now() - interval '30 days',
  ai_analysis_done_at = now() - interval '30 days',
  ai_slicing_tips = E'Vaso em espiral, parede fina — candidato natural a modo vaso (spiral vase).\n- Camada: 0,20 mm, 1 perímetro\n- Preenchimento: 0% (modo vaso)\n- Sem suporte\n- Bico de 0,4 dá parede de 0,45 mm: fica translúcido no contraluz, o que valoriza a peça.\nCuidado: em modo vaso não existe reforço no fundo — deixe 5 camadas sólidas na base ou a peça vaza se usarem com água.'
 where catalog_code = '01.01';

update products set
  ai_analysis_status = 'done',
  ai_analysis_requested_at = now() - interval '30 days',
  ai_analysis_done_at = now() - interval '30 days',
  ai_slicing_tips = E'Geometria com laço fechado e vãos internos.\n- Camada: 0,16 mm\n- Preenchimento: 20% grade\n- Suporte: em árvore, só nos vãos internos\n- Vale imprimir uma unidade de teste antes de uma leva: o laço tem duas pontes longas e o resultado muda bastante com o resfriamento da sala.'
 where catalog_code = '01.05';

-- ---------------------------------------------------------------------
-- Pagamentos
-- ---------------------------------------------------------------------
insert into payments (id, order_id, payment_type, amount, method, status, pix_reference, paid_at, created_at) values
  ('c0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','pagamento_integral', 143.70,'pix','confirmado','DEMO-0001', now() - interval '54 days', now() - interval '54 days'),
  ('c0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002','pagamento_integral',  97.80,'pix','confirmado','DEMO-0002', now() - interval '41 days', now() - interval '41 days'),
  ('c0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000003','sinal',              129.80,'pix','confirmado','DEMO-0003', now() - interval '16 days', now() - interval '16 days'),
  ('c0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000004','sinal',               90.00,'dinheiro','confirmado', null, now() - interval '12 days', now() - interval '12 days'),
  ('c0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000005','sinal',              107.40,'pix','pendente', null, null, now() - interval '6 days')
on conflict (id) do nothing;

commit;

-- =====================================================================
-- CONFERÊNCIA
-- =====================================================================
select 'clientes' as tabela, count(*) from customers
union all select 'pedidos', count(*) from orders
union all select 'itens', count(*) from order_line_items
union all select 'projetos', count(*) from order_line_items where line_type = 'custom'
union all select 'impressoras', count(*) from printers
union all select 'rolos', count(*) from filament_spools
union all select 'pagamentos', count(*) from payments
union all select 'produtos (do import)', count(*) from products
union all select 'cores (do import)', count(*) from filament_colors;

-- Nenhuma fila pode estar parada esperando um agente que não existe.
-- As três devem voltar zero.
select 'produtos em fila' as onde, count(*) from products
 where ai_analysis_status in ('queued','processing') or slice_status in ('queued','processing')
    or open_slicer_status in ('queued','processing')
union all
select 'projetos em fila', count(*) from order_line_items
 where ai_analysis_status in ('queued','processing') or meshy_status in ('queued','processing')
    or open_slicer_status in ('queued','processing');

-- =====================================================================
-- RECOMEÇAR DO ZERO (descomente e rode antes de reinserir)
-- =====================================================================
-- delete from payments          where id::text like 'c0000000-%';
-- delete from order_line_items  where id::text like 'b0000000-%';
-- delete from orders            where id::text like 'a0000000-%';
-- delete from filament_spools   where id::text like 'f0000000-%';
-- delete from printers          where id::text like 'e0000000-%';
-- delete from customers         where id::text like 'd0000000-%';
