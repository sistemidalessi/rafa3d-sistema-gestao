-- =====================================================================
-- Patch 26 — a cor escolhida no catálogo fica gravada no pedido
-- Rode este arquivo inteiro no SQL Editor do Supabase (projeto Rafa 3D).
--
-- O catálogo já pergunta "em qual cor você quer cada peça?", mas a
-- resposta só viajava dentro da mensagem do WhatsApp. Quem fechasse o
-- pedido e não clicasse no botão do WhatsApp perdia a escolha, e a peça
-- ia pra impressão sem ninguém saber de que cor era.
--
-- Não precisa de coluna nova: order_line_items.requested_filament_color_id
-- já existe e a aba Fila já mostra ela numa coluna "Cor". O que faltava
-- era a Edge Function conseguir traduzir o nome que vem do catálogo
-- ("Azul Céu") no id do filamento correspondente — e pra isso ela
-- precisa poder LER filament_colors, que hoje ela não pode.
--
-- Sem este grant o sintoma é confuso: o pedido fecha normalmente, sem
-- erro nenhum na tela, e a cor simplesmente não aparece no sistema.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Deixar a Edge Function ler a lista de cores.
--
-- O grant é separado da RLS e vale até pro service_role: sem ele a
-- consulta nem chega a ser avaliada pela política (erro 42501,
-- "permission denied for table filament_colors"). Foi essa mesma
-- pegadinha que derrubou os patches 06, 09, 17 e 19.
--
-- É só leitura, e de nome de cor — quem escreve em filament_colors
-- continua sendo apenas o dono, pela tela de Filamentos.
-- ---------------------------------------------------------------------
grant select on filament_colors to service_role;

-- ---------------------------------------------------------------------
-- Conferência: depois de rodar, esta consulta tem que devolver as cores.
-- Se vier vazia, a lista do catálogo está com nomes diferentes dos do
-- banco e a tradução não vai casar.
-- ---------------------------------------------------------------------
select name from filament_colors order by name;
