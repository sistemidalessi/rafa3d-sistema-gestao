-- =====================================================================
-- Patch 24 — conserta reativar o aviso de pedido novo no mesmo aparelho
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- O botão "Ativar avisos neste aparelho" grava com upsert: se aquele
-- aparelho já estava cadastrado (mesmo endpoint), a linha é atualizada
-- em vez de duplicada. Mas o patch-21 criou política de insert, select
-- e delete — e nenhuma de update. Resultado: funcionava na primeira vez
-- e falhava em toda reativação, que é justamente o que acontece quando
-- alguém troca de navegador, limpa os dados do site ou desativa e liga
-- os avisos de novo.
--
-- Só isso: nada de tabela nem coluna nova.
-- =====================================================================

drop policy if exists push_subscriptions_update on push_subscriptions;
create policy push_subscriptions_update on push_subscriptions
  for update to authenticated
  using (is_owner()) with check (is_owner());
