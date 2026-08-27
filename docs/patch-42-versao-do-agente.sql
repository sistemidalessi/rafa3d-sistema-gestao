-- =====================================================================
-- Patch 42 — cada computador diz em qual versão do código ele está
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- POR QUE ISTO EXISTE
--
-- O agente lê o código UMA vez, ao iniciar. Depois de um `git pull` ele
-- continua rodando a versão velha até alguém reiniciar — e um agente
-- com código velho é indistinguível de um com código novo: os dois
-- aparecem "ligado ✅" na mesma lista.
--
-- Isso não é teórico. Em 27/08 dois defeitos foram consertados no
-- agent.js/gerar3mf.js, e a máquina do Rafa passou o dia inteiro com o
-- código velho. Como nem "Pedir a colinha" nem "Abrir no Fatiador" têm
-- dono fixo, ela podia pegar a tarefa PRIMEIRO e refazer o defeito já
-- consertado — em silêncio, porque nada na tela mostrava a diferença.
--
-- Com estas duas colunas, a tela compara os computadores entre si: se
-- um está com código mais velho que o outro, ele aparece marcado, e
-- ninguém precisa lembrar de perguntar.
-- =====================================================================

-- Qual commit este agente está rodando. Fica null quando não dá pra
-- saber (máquina que baixou o ZIP em vez de clonar, e portanto não tem
-- git) — nesse caso a data abaixo ainda vem preenchida.
alter table slicer_agents add column if not exists code_commit text;

-- Data do código que está rodando. Vem da data do commit; sem git, cai
-- pra data de modificação do próprio agent.js, que é grosseira mas
-- responde a pergunta que importa ("esse aí está atrás?").
alter table slicer_agents add column if not exists code_date timestamptz;

-- ---------------------------------------------------------------------
-- GRANT
--
-- O grant do patch 25 é de TABELA (`grant select, insert, update on
-- slicer_agents to service_role`), e grant de tabela já cobre coluna
-- nova — diferente de grant de coluna, que não cobre. Então aqui não
-- falta nada.
--
-- Fica repetido mesmo assim, e de propósito: é idempotente, custa nada,
-- e a armadilha de esquecer o grant já derrubou os patches 06, 09, 17,
-- 19, 26, 34 e 35. Ler o grant no patch é mais barato que descobrir o
-- 42501 ("permission denied") com o agente calado na frente.
-- ---------------------------------------------------------------------
grant select, insert, update on slicer_agents to service_role;
