-- =====================================================================
-- Patch 51 — printers_safe() esqueceu de trazer slots_count
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- POR QUE ISTO EXISTE
--
-- O plano do dia (patch 44) decide se uma peça encaixa numa gaveta
-- vazia ou precisa de troca olhando `impressora.slots_count` — e a tela
-- (renderFila) lê a impressora por getImpressorasSafe(), que chama a
-- função printers_safe(). Essa função foi escrita ANTES do patch 44
-- (está no schema-inicial.sql) e o `returns table(...)` dela nunca
-- ganhou a coluna nova: ela devolve id/name/model/active/hourly_cost,
-- sem slots_count.
--
-- Resultado: `impressora.slots_count` chega `undefined` no navegador, e
-- `custoDeMontagem()` sempre cai no valor padrão (`|| 4`). Hoje isso não
-- dá pra perceber porque a única impressora cadastrada tem 4 gavetas de
-- verdade -- mas a primeira impressora sem AMS (1 gaveta) ou com número
-- diferente vai ter a conta errada, calada, sem erro nenhum na tela.
-- Achado testando o plano do dia direto contra o banco, fora do
-- navegador (31/08/2026).
-- =====================================================================

-- Muda o tipo de retorno (ganhou uma coluna) -- o Postgres não deixa
-- fazer isso com CREATE OR REPLACE, precisa apagar e criar de novo.
drop function if exists printers_safe();

create or replace function printers_safe()
returns table(id uuid, name text, model text, active boolean, hourly_cost numeric, slots_count int)
language sql
security definer
set search_path = public
stable
as $$
  select id, name, model, active,
    case when is_owner() then hourly_cost else null end as hourly_cost,
    slots_count
  from printers
  order by name;
$$;

grant execute on function printers_safe() to authenticated;
