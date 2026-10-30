-- =====================================================================
-- Patch 58 — limite de requisições no checkout público (calcular-frete e
-- finalizar-pedido). Rode este arquivo inteiro no SQL Editor do Supabase.
--
-- STATUS: APLICADO EM PRODUÇÃO em 30/10/2026, com o "sim" do Anderson, pelo SQL
-- Editor do painel (ensaio 6/6 numa transação desfeita). As duas Edge Functions
-- foram publicadas em seguida e provadas de fora: a 61ª cotação de frete do mesmo
-- IP voltou 429; no fechar pedido, 3 tentativas (recusadas pela conferência do
-- frete) e a 4ª voltou 429 pela regra de IP+CPF. Nenhum pedido criado.
--
-- POR QUE ISTO EXISTE (auditoria de 11/09/2026, achado r3d-02)
--
-- As duas funções do checkout são públicas de propósito (quem compra não faz
-- login). Sem limite, um script cria pedidos em série — cada um dispara push e
-- e-mail pro Anderson e pro Rafael e grava um pedido com CPF de terceiro — e
-- cada cotação de frete gasta a cota da conta do Melhor Envio.
--
-- COMO FUNCIONA: um contador por chave (IP, ou IP+CPF) e janela de tempo, numa
-- tabela que só a service_role alcança (as Edge Functions usam ctx.supabaseAdmin;
-- anon e authenticated não têm grant nem política — a tabela nem aparece pra
-- eles). A função `limite_checkout_tentar` incrementa e devolve se ainda cabe.
-- Quem decide os números é a Edge Function (_shared/limite.ts):
--   calcular-frete:    60 cotações por IP a cada 10 min (uma pessoa digitando
--                      CEP e mudando quantidade não chega perto)
--   finalizar-pedido:   5 pedidos por IP por hora, e 3 por IP+CPF por dia
-- Se a função SQL não existir ainda (patch não rodou) ou der erro, a Edge
-- Function DEIXA PASSAR e loga — limite nunca derruba uma venda honesta.
--
-- Linhas velhas são apagadas pela própria função a cada chamada (as que já
-- venceram há mais de 1 dia), então a tabela não cresce.
-- =====================================================================

begin;

create table if not exists public.limite_checkout (
  chave        text        not null,   -- ex.: 'frete:ip:203.0.113.7' ou 'pedido:cpf:<sha>'
  janela_ini   timestamptz not null,   -- início da janela corrente
  janela_s     integer     not null,   -- tamanho da janela em segundos
  tentativas   integer     not null default 0,
  primary key (chave)
);
alter table public.limite_checkout enable row level security;
-- sem política nenhuma: só a service_role (que ignora RLS) lê/grava
revoke all on public.limite_checkout from public, anon, authenticated;

-- Devolve true se a tentativa cabe no limite (e a conta), false se estourou.
create or replace function public.limite_checkout_tentar(p_chave text, p_limite integer, p_janela_s integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agora timestamptz := now();
  v_row limite_checkout%rowtype;
begin
  -- faxina barata: janelas vencidas há mais de 1 dia
  delete from limite_checkout where janela_ini + (janela_s || ' seconds')::interval < v_agora - interval '1 day';

  select * into v_row from limite_checkout where chave = p_chave for update;
  if not found or v_row.janela_ini + (v_row.janela_s || ' seconds')::interval <= v_agora then
    insert into limite_checkout (chave, janela_ini, janela_s, tentativas) values (p_chave, v_agora, p_janela_s, 1)
    on conflict (chave) do update set janela_ini = v_agora, janela_s = p_janela_s, tentativas = 1;
    return true;
  end if;
  if v_row.tentativas >= p_limite then
    return false;
  end if;
  update limite_checkout set tentativas = tentativas + 1 where chave = p_chave;
  return true;
end;
$$;
revoke execute on function public.limite_checkout_tentar(text, integer, integer) from public, anon, authenticated;
grant  execute on function public.limite_checkout_tentar(text, integer, integer) to service_role;

commit;

-- CONFERÊNCIA
-- select has_table_privilege('anon','public.limite_checkout','SELECT');            -- false
-- select has_function_privilege('anon','public.limite_checkout_tentar(text,integer,integer)','EXECUTE'); -- false
-- select limite_checkout_tentar('teste', 2, 60), limite_checkout_tentar('teste', 2, 60), limite_checkout_tentar('teste', 2, 60);  -- t, t, f
-- delete from limite_checkout where chave = 'teste';
