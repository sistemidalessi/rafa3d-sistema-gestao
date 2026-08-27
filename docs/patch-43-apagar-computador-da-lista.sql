-- =====================================================================
-- Patch 43 — dá pra apagar um computador da lista
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- Duas coisas, e a segunda é a que interessa a longo prazo.
--
-- 1. LIMPEZA. Sobrou uma linha `__teste__` de quando o patch 42 foi
--    testado contra o banco de verdade. Ela aparece pro Rafa como um
--    computador de mentira na hora de escolher onde abrir o fatiador.
--
-- 2. O GRANT QUE FALTAVA. O patch 25 criou a tabela com
--    `grant select, insert, update` — sem `delete`. Ninguém tinha
--    percebido porque nada apagava agente até agora. Só que sem isso
--    **nenhum computador sai da lista, nunca**: máquina trocada,
--    formatada ou aposentada fica ali pra sempre, oferecida como opção
--    válida pra uma criança de 10 anos escolher.
--
--    É a mesma armadilha que já derrubou os patches 06, 09, 17, 19, 26,
--    34 e 35, e desta vez ela se disfarçou melhor: o delete não deu
--    erro na cara, devolveu "permission denied" num campo que quem
--    chamou não estava olhando, e o código seguiu como se tivesse
--    apagado.
-- =====================================================================

delete from slicer_agents where name = '__teste__';

-- Agora dá pra tirar da lista um computador que não existe mais.
-- Continua sendo coisa de service_role: o navegador não apaga agente.
grant delete on slicer_agents to service_role;
