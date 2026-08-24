-- =====================================================================
-- Patch 29 — poder corrigir e apagar um rolo já cadastrado
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- A tela de Filamentos só deixava ADICIONAR rolo. Errou a data, o valor
-- pago ou o peso? Ficava errado pra sempre, e o jeito de "consertar" era
-- cadastrar outro rolo — que estraga o estoque em dobro.
--
-- Por que função e não update direto pela tela: o schema tem uma regra
-- explícita de "nunca escrever direto em filament_spools.remaining_weight_g
-- fora daqui". O peso que sobra é a base do controle de estoque; mudar
-- ele sem registrar o movimento faria a conta de filamento parar de
-- fechar, sem ninguém perceber. Estas funções mudam o rolo E registram o
-- movimento, na mesma transação — igual add_filament_spool já fazia.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Corrigir um rolo.
--
--    Mexer no peso vira um movimento 'manual_correction' (razão que já
--    existia no check da tabela, e nunca tinha sido usada). Os outros
--    campos são cadastro puro e não afetam estoque.
-- ---------------------------------------------------------------------
create or replace function editar_rolo(
  p_spool_id uuid,
  p_remaining_weight_g numeric,
  p_cost_paid numeric,
  p_supplier text,
  p_purchased_at date,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes numeric;
begin
  if not is_owner() then
    raise exception 'só o dono pode corrigir rolo de filamento';
  end if;
  if p_status not in ('in_use', 'empty', 'stored') then
    raise exception 'status inválido pra rolo: %', p_status;
  end if;
  if p_remaining_weight_g < 0 then
    raise exception 'o peso que sobra não pode ser negativo';
  end if;

  select remaining_weight_g into v_antes from filament_spools where id = p_spool_id;
  if v_antes is null then
    raise exception 'rolo não encontrado';
  end if;

  update filament_spools
    set remaining_weight_g = p_remaining_weight_g,
        cost_paid = p_cost_paid,
        supplier = p_supplier,
        purchased_at = p_purchased_at,
        status = p_status
    where id = p_spool_id;

  -- Só registra movimento se o peso realmente mudou. Corrigir o nome do
  -- fornecedor não é movimentação de estoque.
  if p_remaining_weight_g is distinct from v_antes then
    insert into filament_stock_movements (spool_id, grams_delta, reason, created_by)
      values (p_spool_id, p_remaining_weight_g - v_antes, 'manual_correction', auth.uid());
  end if;
end;
$$;

grant execute on function editar_rolo(uuid, numeric, numeric, text, date, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Apagar um rolo cadastrado por engano.
--
--    Só sai se ninguém tiver usado ele ainda. Rolo que já imprimiu peça
--    carrega histórico de custo — apagar reescreveria quanto cada peça
--    vendida custou pra fazer. Nesse caso a tela oferece marcar como
--    "acabou" ou "guardado", que resolve o problema real de não querer
--    mais ver ele na lista.
--
--    O movimento de 'new_spool' é apagado junto: ele existe só porque o
--    rolo foi cadastrado, e o cadastro é justamente o engano.
-- ---------------------------------------------------------------------
create or replace function apagar_rolo(p_spool_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_owner() then
    raise exception 'só o dono pode apagar rolo de filamento';
  end if;

  if exists (
    select 1 from filament_stock_movements
    where spool_id = p_spool_id and reason <> 'new_spool'
  ) then
    raise exception 'esse rolo já foi usado — guarde ele em vez de apagar';
  end if;

  if exists (select 1 from order_line_items where filament_spool_id = p_spool_id) then
    raise exception 'esse rolo está ligado a uma peça de pedido — guarde ele em vez de apagar';
  end if;

  delete from filament_stock_movements where spool_id = p_spool_id;
  delete from filament_spools where id = p_spool_id;
end;
$$;

grant execute on function apagar_rolo(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Conferência: as duas funções têm que aparecer.
-- ---------------------------------------------------------------------
select proname from pg_proc where proname in ('editar_rolo', 'apagar_rolo') order by proname;
