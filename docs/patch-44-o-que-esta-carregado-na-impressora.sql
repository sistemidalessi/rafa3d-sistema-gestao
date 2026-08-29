-- =====================================================================
-- Patch 44 — a impressora sabe quais cores estão carregadas nela
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- POR QUE ISTO EXISTE
--
-- A Fila hoje lista peças na ordem do prazo, e ignora o custo real de
-- trocar de cor: 10 a 15 minutos por troca, na mão. Imprimir preto,
-- amarelo, preto, amarelo desperdiça meia hora que ninguém contou.
--
-- Pra sugerir uma ordem que evita troca, o sistema precisa saber o que
-- está carregado agora — e isso ele não sabe: a tabela `printers` só
-- tinha nome, modelo e custo de energia.
--
-- O AMS Lite da A1 segura 4 rolos ao mesmo tempo e escolhe entre eles
-- sozinho durante a impressão. Então "a cor está carregada" não é uma
-- cor por máquina: são até 4, e é isso que decide se uma peça entra
-- agora ou espera uma troca.
-- =====================================================================

-- Quantos rolos cabem ao mesmo tempo nesta máquina. 4 é o AMS Lite;
-- uma impressora sem AMS tem 1. Fica na impressora e não fixo no
-- código porque a loja vai ter máquinas diferentes.
alter table printers add column if not exists slots_count int not null default 4;

-- O que está em cada gaveta do AMS, agora.
--
-- Tabela e não quatro colunas (slot1..slot4) de propósito: com colunas,
-- uma máquina de 1 slot carregaria três campos mortos, e mudar o número
-- de gavetas viraria patch novo toda vez. Aqui, a máquina sem AMS
-- simplesmente tem uma linha.
create table if not exists printer_slots (
  printer_id uuid not null references printers(id) on delete cascade,
  slot_number int not null check (slot_number between 1 and 8),
  filament_color_id uuid references filament_colors(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (printer_id, slot_number)
);

-- filament_color_id fica NULO quando a gaveta está vazia. Vazia é
-- diferente de "não sei o que tem": gaveta sem linha nenhuma é a que
-- nunca foi preenchida, e a tela pergunta por ela.
create index if not exists printer_slots_cor_idx
  on printer_slots (filament_color_id) where filament_color_id is not null;

alter table printer_slots enable row level security;

-- Quem lê e escreve aqui é o navegador logado (dono ou ajudante): é o
-- Rafael que troca o rolo e diz o que pôs. Mesma política das outras
-- tabelas de operação.
drop policy if exists printer_slots_todos on printer_slots;
create policy printer_slots_todos on printer_slots
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- GRANT — a armadilha que já derrubou os patches 06, 09, 17, 19, 26,
-- 34, 35 e 43. Sem isto a consulta nem chega a ser avaliada pela
-- política acima (erro 42501, "permission denied").
--
-- O `delete` vai junto mesmo sem ninguém apagar slot hoje: foi
-- exatamente essa economia no patch 25 que deixou a lista de
-- computadores sem saída até o 43. Conceda o verbo que vai faltar
-- depois, não só os de hoje.
-- ---------------------------------------------------------------------
grant select, insert, update, delete on printer_slots to authenticated;
grant select, insert, update, delete on printer_slots to service_role;
grant select, update on printers to authenticated;
grant select, insert, update on printers to service_role;
