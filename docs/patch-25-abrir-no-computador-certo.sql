-- =====================================================================
-- Patch 25 — "Abrir no Fatiador" abre no computador certo
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- Até agora a fila de abrir-no-fatiador não dizia pra quem era: o
-- registro só marcava open_slicer_status = 'queued', e qualquer agente
-- que estivesse rodando pegava. Com um computador só isso funcionava por
-- sorte. Com dois (o Anderson e o Rafa trabalham e imprimem dos dois),
-- vira sorteio: clicar no computador da sala podia abrir o arquivo no
-- computador do escritório, onde não tem ninguém sentado.
--
-- Duas partes: cada pedido passa a carregar o computador de destino, e
-- os computadores que têm o agente ligado se anunciam numa tabela, pra
-- tela poder oferecer a lista em vez de pedir pra digitar um nome (nome
-- digitado à mão erra, e quem opera tem 10 anos).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Pra qual computador vai este pedido de abrir no fatiador.
--    null = "qualquer um que estiver ligado", que é como todo registro
--    antigo se comporta — nada quebra com o que já está no banco.
-- ---------------------------------------------------------------------
alter table products         add column if not exists open_slicer_agent text;
alter table order_line_items add column if not exists open_slicer_agent text;
alter table project_parts    add column if not exists open_slicer_agent text;

-- ---------------------------------------------------------------------
-- 2. Os computadores que têm o agente rodando.
--
--    O agente se cadastra sozinho ao iniciar e vai atualizando o sinal
--    a cada volta do laço. A tela usa isso pra mostrar quais estão
--    ligados agora — sem ninguém precisar cadastrar computador na mão.
-- ---------------------------------------------------------------------
create table if not exists slicer_agents (
  name text primary key,           -- nome do computador (vem do próprio Windows)
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table slicer_agents enable row level security;

-- Leitura liberada pros dois papéis: é só nome de computador, e o
-- ajudante também precisa escolher onde abrir o arquivo.
drop policy if exists slicer_agents_select on slicer_agents;
create policy slicer_agents_select on slicer_agents
  for select to authenticated using (true);

-- Quem escreve aqui é o agente (service_role), nunca o navegador.
grant select, insert, update on slicer_agents to service_role;
