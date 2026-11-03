-- =====================================================================
-- Patch 62 — dados pessoais de pedidos e clientes são apagados 5 anos depois
-- (achado r3d-06 da auditoria de 11/09/2026, LGPD; decisão do Anderson em
-- 03/11/2026: 5 anos, o prazo de guarda fiscal e de reclamação do consumidor).
--
-- STATUS: PREPARADO E ENSAIADO em 03/11/2026 (transação desfeita; conferido depois que
-- função, extensão e dados ficaram como estavam). Ensaio: com 5 anos, 0 pedidos, 0
-- clientes, 0 na lixeira (nada tão antigo); com prazo 0 (só no ensaio), 16 pedidos e 9
-- clientes ficaram "Cliente (dados apagados)" sem contato, CPF e rua, com o valor
-- mantido; agendamento "15 4 1 * *" ativo; authenticated não executa a função.
-- NÃO APLICADO: espera o "sim" do Anderson.
--
-- O QUE A ROTINA FAZ, todo dia 1º às 04:15 (agendador pg_cron do próprio banco):
--   * pedido sem mexer há mais de 5 anos: some o nome (vira "Cliente (dados
--     apagados)"), WhatsApp, CPF, CEP, rua, número, complemento, bairro, link da
--     etiqueta e código de rastreio. Ficam valor, itens, datas, cidade e estado —
--     o que a loja precisa para os números, sem dizer de quem era;
--   * cliente sem pedido e sem cadastro novo há mais de 5 anos: mesmo tratamento
--     (o nome é obrigatório na tabela, então vira o mesmo texto);
--   * lixeira: o que foi apagado há mais de 5 anos sai de vez (a lixeira guarda
--     cópia inteira do registro, com os dados pessoais).
-- O checkout do catálogo avisa: "servem só pra este pedido e são apagados 5 anos
-- depois". Em 03/11/2026 o pedido mais antigo é de 24/08/2026: a primeira coisa
-- apagada de verdade será em 2031. Rodar à mão: select public.anonimizar_dados_antigos();
-- =====================================================================

begin;

create or replace function public.anonimizar_dados_antigos(p_anos integer default 5)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limite   timestamptz := now() - make_interval(years => p_anos);
  v_texto    constant text := 'Cliente (dados apagados)';
  v_pedidos  integer;
  v_clientes integer;
  v_lixeira  integer;
begin
  update public.orders
     set customer_name = v_texto, customer_contact = null, customer_document = null,
         shipping_cep = null, shipping_street = null, shipping_number = null, shipping_complement = null,
         shipping_district = null, shipping_label_url = null, shipping_tracking_code = null
   where greatest(created_at, coalesce(updated_at, created_at)) < v_limite
     and (customer_name is distinct from v_texto or customer_contact is not null or customer_document is not null
          or shipping_street is not null or shipping_cep is not null);
  get diagnostics v_pedidos = row_count;

  update public.customers c
     set name = v_texto, phone = null, email = null, instagram = null, notes = null
   where c.created_at < v_limite
     and c.name is distinct from v_texto
     and not exists (select 1 from public.orders o
                      where o.customer_id = c.id
                        and greatest(o.created_at, coalesce(o.updated_at, o.created_at)) >= v_limite);
  get diagnostics v_clientes = row_count;

  delete from public.lixeira where apagado_em < v_limite;
  get diagnostics v_lixeira = row_count;

  return json_build_object('pedidos', v_pedidos, 'clientes', v_clientes, 'lixeira', v_lixeira, 'limite', v_limite);
end;
$$;
-- ninguém de fora chama: só a rotina agendada (que roda como postgres) e quem estiver no SQL Editor
revoke execute on function public.anonimizar_dados_antigos(integer) from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule('anonimizar-dados-antigos', '15 4 1 * *', $cron$select public.anonimizar_dados_antigos();$cron$);

commit;

-- CONFERÊNCIA
-- select jobname, schedule, command, active from cron.job where jobname = 'anonimizar-dados-antigos';
-- select has_function_privilege('authenticated','public.anonimizar_dados_antigos(integer)','EXECUTE');  -- false
-- Histórico das execuções: select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
