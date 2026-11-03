-- =====================================================================
-- Patch 61 — o ajudante não vê quanto custou cada rolo de filamento
-- (achado r3d-07 da auditoria de 11/09/2026; decisão do Anderson em 03/11/2026:
-- esconder só o custo do filamento — custo estimado e custo extra continuam,
-- porque o ajudante usa nas telas de Projetos e Pedidos).
--
-- STATUS: PREPARADO E ENSAIADO em 03/11/2026 (as duas etapas numa transação desfeita;
-- conferido depois que nada ficou). Ensaio: dono recebe o valor pago dos 25 rolos pela
-- RPC; ler cost_paid direto na tabela dá 42501 pra qualquer authenticated; as colunas
-- da Fila seguem legíveis; conta sem perfil recebe 0 linhas da RPC. Não havia ajudante
-- ativo cadastrado. O index.html novo (getSpools) já foi publicado ANTES, com reserva:
-- sem a RPC, lê o valor direto — testado na sessão do dono (Filamentos e Margem ok).
-- NÃO APLICADO: espera o "sim" do Anderson.
--
-- O QUE MUDA: filament_spools.cost_paid deixa de chegar a quem não é dono. Como
-- RLS escolhe linhas e não colunas, e dono e ajudante são o mesmo papel do banco
-- (authenticated), o caminho é: authenticated lê a tabela só pelas colunas sem o
-- valor pago (grant por coluna), e o dono busca o valor pago pela RPC
-- spools_custo(), que confere is_owner() por dentro. O sistema (getSpools no
-- index.html) já pede as colunas certas e junta o valor pago quando é dono.
--
-- EM DOIS TEMPOS, como toda mudança que aperta o que o site lê:
--   ETAPA 1 (aditiva): cria spools_custo(). Rodar ANTES de publicar o index.html novo.
--   (publicar o index.html, esperar ~10 min do cache do GitHub Pages)
--   ETAPA 2: tira o SELECT da tabela inteira e dá SELECT só nas colunas sem custo.
-- Se a etapa 2 rodar antes do site novo, o select('*') antigo dá 42501 e a Fila e
-- os Filamentos quebram até o cache vencer.
-- =====================================================================

-- ---------- ETAPA 1 ----------
begin;
create or replace function public.spools_custo()
returns table (id uuid, cost_paid numeric)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.cost_paid from public.filament_spools s where public.is_owner();
$$;
revoke execute on function public.spools_custo() from public, anon;
grant  execute on function public.spools_custo() to authenticated, service_role;
commit;

-- ---------- ETAPA 2 (depois do index.html novo no ar + 10 min) ----------
begin;
revoke select on public.filament_spools from authenticated;
grant  select (id, color_id, purchased_at, initial_weight_g, remaining_weight_g, supplier, status)
  on public.filament_spools to authenticated;
commit;

-- CONFERÊNCIA
-- select has_column_privilege('authenticated','public.filament_spools','cost_paid','SELECT');  -- false
-- select has_column_privilege('authenticated','public.filament_spools','remaining_weight_g','SELECT'); -- true
-- Como ajudante: select cost_paid from filament_spools → 42501; select * from spools_custo() → 0 linhas.
-- Como dono: select * from spools_custo() → todos os rolos com o valor pago.
