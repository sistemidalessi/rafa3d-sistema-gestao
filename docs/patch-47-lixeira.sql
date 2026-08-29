-- =====================================================================
-- Patch 47 — lixeira: dá pra trazer de volta o que foi apagado
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- POR QUE ISTO EXISTE
--
-- Em 28/08 a Cesta Suspensa foi excluída pela aba Projetos estando
-- "esperando pra imprimir", e levou o PEDIDO INTEIRO junto. Não havia
-- lixeira, nem auditoria, nem PITR: o dado sumiu do banco. Só deu pra
-- remontar porque o agente tinha consultado aquele pedido na mesma
-- sessão e os valores estavam no histórico da conversa. Isso não é
-- backup, é sorte.
--
-- POR QUE UMA TABELA DE CÓPIAS, E NÃO UM `deleted_at`
--
-- Exclusão lógica (`deleted_at` + `where deleted_at is null`) obrigaria
-- CADA consulta a filtrar: são 34 leituras no navegador e 19 no agente.
-- Uma esquecida mostra dado apagado — e no agente é pior, ele pegaria
-- uma peça apagada pra imprimir. A superfície de erro é grande demais
-- pro ganho.
--
-- Aqui a linha é apagada de verdade, como sempre foi, e uma CÓPIA dela
-- (mais as filhas) fica guardada em JSON. Nenhuma consulta do sistema
-- muda. Trazer de volta é reinserir a cópia com os mesmos ids.
-- =====================================================================

create table if not exists lixeira (
  id uuid primary key default gen_random_uuid(),
  -- 'pedido' guarda o pedido e as peças dele; 'peca' guarda uma linha só.
  tipo text not null check (tipo in ('pedido', 'peca')),
  -- Pra tela mostrar o que é sem precisar abrir o JSON.
  descricao text not null,
  -- A cópia: { "order": {...}, "items": [{...}] } ou { "item": {...} }.
  dados jsonb not null,
  apagado_em timestamptz not null default now(),
  apagado_por uuid references auth.users(id) on delete set null,
  -- Preenchido quando alguém traz de volta — a linha fica no histórico
  -- em vez de sumir, senão a lixeira viraria outra coisa que apaga sem
  -- deixar rastro.
  restaurado_em timestamptz
);

create index if not exists lixeira_recentes_idx
  on lixeira (apagado_em desc) where restaurado_em is null;

alter table lixeira enable row level security;

-- Quem apaga e quem traz de volta é o navegador logado.
drop policy if exists lixeira_todos on lixeira;
create policy lixeira_todos on lixeira
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- GRANT — a armadilha dos patches 06, 09, 17, 19, 26, 34, 35 e 43.
-- O `delete` vai junto mesmo sem ninguém apagar da lixeira hoje: foi
-- essa economia no patch 25 que deixou a lista de computadores sem
-- saída até o 43.
-- ---------------------------------------------------------------------
grant select, insert, update, delete on lixeira to authenticated;
grant select, insert, update, delete on lixeira to service_role;
