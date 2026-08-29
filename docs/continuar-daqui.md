# Continuar daqui

Onde as coisas pararam em **27/08/2026**.

> **Memória do agente não viaja entre as máquinas.** O que precisa
> sobreviver à troca de computador tem que estar no repositório — aqui
> ou no `CLAUDE.md`. Não deixe recado só na memória.

## ✅ As duas máquinas em dia, e as duas com vigia — 28/08 à noite

O computador do Rafa foi atualizado (estava com o prompt velho da
colinha, o que recomendava "sem brim" e custou duas impressões) e ganhou
o vigia. O do Anderson ganhou o vigia também — ele **não tinha**, apesar
de ser a máquina que motivou o script; foi achado por acaso, com o
agente parado há 119 minutos.

O vigia foi **testado**, não só instalado: matei o agente (PID 30572),
disparei a tarefa na mão com `schtasks /run`, e ele voltou sozinho
(PID 36008) e se anunciou no banco. Mensagem de sucesso de script não é
prova; processo de pé é.

### Dois defeitos do próprio aviso, no mesmo dia

O patch 42 nasceu pra avisar quando uma máquina está com código velho.
Ele errou nas duas direções antes de acertar:

1. **Ficou calado no caso dele.** A folga era de 24h e a diferença entre
   os dois códigos era de 22,4h — o Rafa ligou com o prompt velho e a
   tela não disse nada. A folga agora é de **2h**: cobre o vai-e-vem de
   um mesmo dia e não engole "ontem à noite contra hoje à tarde".
2. **Gritou à toa.** O agente reportava o commit do repositório inteiro,
   então todo commit no `index.html` — a maior parte deles — marcava os
   agentes como antigos sem nada ter mudado pra eles. Agora o `git log`
   é limitado a `slicer-agent/`, que é o que o agente de fato roda.

Os dois juntos importam: com a folga de 2h **e** a versão do repositório
inteiro, o alarme dispararia quase todo dia — e aviso que grita à toa é
aviso que ninguém lê.

## ✅ As duas máquinas estavam com o código de 27/08

Fechado em 27/08 à noite: o computador do Rafa foi atualizado com o
`atualizar-agente.ps1` e os dois agentes apareceram ligados no banco.

Fica aqui o registro do que estava em jogo, porque os dois defeitos são
do tipo que volta calado. Em 27/08, com o Chaveiro do Pikachu (pedido de
verdade), apareceram **dois** problemas seguidos no mesmo arquivo, e os
dois foram corrigidos em `agent.js`/`gerar3mf.js`:

1. **Colinha de produto caía pra erro** quando o `.3mf` não tinha
   miniatura embutida (esse veio de um divisor de peças e nunca tinha
   sido fatiado no Bambu, então não tinha a imagem que o Bambu gera ao
   fatiar). Agora cai pra foto do catálogo no lugar.
2. **Colinha gerada, mas "Abrir no Fatiador" abria sem aplicar nada.**
   O vetor `different_settings_to_system` só tem três posições
   (processo/filamento/impressora) quando é um filamento só — peça de
   várias cores (Hi3D) tem um slot de filamento PRA CADA cor, e a
   impressora deixa de ser a posição 2 pra virar a última. O código
   escrevia em índice fixo, então só a cor 1 saía marcada como "mexida"
   e a placa ia parar na posição da cor 2 — tudo em silêncio, sem erro.
   Testado de ponta a ponta com o arquivo de verdade depois do conserto.

A lição que fica: **nem "Pedir a colinha" nem "Abrir no Fatiador" têm
dono fixo** — qualquer agente ligado pega a tarefa. Uma máquina com o
código velho não é só "uma máquina desatualizada": ela **rouba** a
tarefa da que está certa e refaz o defeito. Consertou o `agent.js`?
Atualize as duas no mesmo dia.

### E agora dá pra ver isso — patches 42 e 43

O ponto cego era que um agente com código velho e um com código novo
apareciam idênticos na lista: os dois "ligado ✅". O **patch 42** fez
cada agente mandar o commit e a data do código junto com o sinal de
vida, lidos **uma vez ao iniciar** — de propósito, porque é isso que o
número precisa refletir. Ler a cada volta mostraria o código do disco,
não o que está rodando, e mentiria justo no caso que isso veio resolver.

A tela compara os computadores **entre si**, não com o GitHub (o
navegador não conhece o GitHub), com um dia de folga pra não virar
barulho. Quem ficou pra trás aparece com `⚠️ programa antigo` na lista e
numa tarja no Dashboard, com o comando pronto — e **continua
escolhível**, porque esconder deixaria alguém sem computador nenhum.

O agente sobrevive ao patch não ter rodado: na primeira falha ele
desiste da versão e segue mandando só o sinal de vida. Sem isso o
`upsert` falharia inteiro e a máquina **sumiria da lista** — bem pior
que não saber a versão.

O **patch 43** saiu de um erro meu no meio disso: testei o 42 contra o
banco de verdade, apaguei a linha de teste, imprimi "limpo" — e o
`delete` tinha falhado com `permission denied` num campo que eu não
olhei. Ficou um computador de mentira na lista do Rafa. A causa é o
`GRANT` de sempre: o patch 25 concedeu `select, insert, update` e não
`delete`. **Sem ele nenhum computador sai da lista, nunca** — máquina
trocada, formatada ou aposentada ficaria ali pra sempre como opção
válida.

Coisas menores do mesmo dia:
- `NOTIFY_EMAILS` (secret do Supabase) estava com um e-mail que o Resend
  sandbox (`onboarding@resend.dev`) não aceita mandar — ele só entrega
  pro e-mail dono da conta Resend. Corrigido pra `afdalessi@gmail.com`.
- Erro de Modelo 3D / Colinha / Fatiador (produto e projeto) só
  aparecia no `title` (tooltip) do badge — invisível em celular, e por
  isso um erro real parecia "não fez nada". Agora fica um texto sempre
  visível embaixo do badge, nas duas telas.


## Atualizar o agente depois de um `git pull`

Numa máquina que já está preparada, quando o `agent.js` ou o
`gerar3mf.js` mudaram:

```
powershell -ExecutionPolicy Bypass -File slicer-agent\atualizar-agente.ps1
```

Ele puxa o código, reinstala dependências se o `package.json` mudou,
mata o agente antigo e sobe o novo. Existe porque o agente **lê o
código uma vez só, ao iniciar** — depois de um `git pull` ele segue
rodando a versão velha sem avisar nada, e o sintoma é um defeito já
consertado voltando do túmulo.

## ✔️ DECIDIDO: o catálogo fica como está, com os 155 sem arquivo

**Decisão do Anderson em 28/08: não mexer.** O catálogo continua
vendendo tudo, e cada peça é preparada quando é vendida — é o caminho 1
abaixo. **Não proponha desativar produto de novo**; a pergunta já foi
feita e respondida.

O que isso implica, e é normal, não é defeito:

- **"Primeira vez — fica sabido no Terminei"** na coluna de tempo da
  Fila é o estado esperado da maioria das peças.
- **⚠️ "pegar o arquivo da peça"** na aba Pedidos é o primeiro passo
  normal de quase toda venda nova, não um alerta de erro.
- O sistema aprende sozinho: a primeira impressão de cada peça grava as
  horas reais na receita pelo "Terminei", e daí em diante ela tem tempo.

O resto desta seção fica como registro do porquê.

Medido em 27/08, e é a raiz de quase toda a confusão daquele dia:

```
166 produtos ativos    11 com arquivo 3D    10 com colinha    9 com ficha de custo
```

O catálogo foi montado com **fotos**. Quando alguém compra, o sistema
não tem arquivo, não tem colinha e não sabe o tempo — e todo esse
trabalho cai de uma vez na tela do pedido. Não era a tela que estava
confusa: era a venda acontecendo antes do preparo.

Os dois caminhos possíveis eram:

1. **Deixar como está** e preparar peça por peça conforme vende (é o que
   o "Preparar pra imprimir" organiza). ← **escolhido**
2. Desativar no catálogo o que não tem arquivo, e ir ativando à medida
   que prepara. ← descartado

## Preparar pra imprimir — 27/08

A linha do item no pedido tinha **cinco botões** do mesmo tamanho, sem
ordem. Virou **um**: `🔧 Preparar pra imprimir (1 de 3)`, que abre os
passos numerados com visto no que já está pronto, e só deixa clicar o
próximo possível — sem arquivo, "pedir colinha" e "abrir no fatiador"
ficam apagados em vez de sumir (sumir faria o passo parecer opcional).

O quarto passo é o que **faltava no sistema inteiro**: `Mandar pra fila`
como ato explícito, liberado só com os três prontos. Antes a peça caía
na Fila só por ter um certo status, sem ninguém garantir que dava pra
imprimir — e a Fila enchia de peça sem arquivo e sem tempo. O dono tem
uma saída discreta ("mandar assim mesmo"); travar de vez viraria beco
sem saída.

Editar, personalizar e remover foram pro `⋯ Mais`.

⚠️ **Consequência:** peça em "recebido" ou "preço combinado" **não
aparece mais na Fila** — ela fica em Pedidos até alguém mandar. A Fila
mostra uma linha no rodapé dizendo quantas estão nesse estado.

## O plano do dia: a Fila sugere a ordem — 28/08, patches 44 e 45

A Fila listava por prazo e ignorava que **trocar filamento custa 10 a 15
minutos na mão**. Imprimir preto, amarelo, preto, amarelo jogava meia
hora fora sem ninguém contar.

Agora o topo da Fila mostra, por impressora, o que fazer primeiro:

```
🖨️ Impressora 1 — o que fazer primeiro      carregado: Preto, Amarelo, Verde
⏰ Vaso de Folha tem prazo apertado e precisa de troca de cor.
👉 Sem trocar nada — 10h42 de impressão
🔄 Só depois de mexer no filamento
⛔ Estas ainda não dá
```

**A base** (patch 44): `printer_slots` guarda o que está em cada gaveta
do AMS, e `printers.slots_count` diz quantas gavetas a máquina tem. É
tabela e não colunas `slot1..slot4` porque máquina sem AMS teria três
campos mortos. Gaveta sem linha é "não sei"; gaveta com cor nula é
"vazia" — só uma das duas é pergunta pro Rafael.

**A cor de cada parte** (patch 45): peça dividida por cor precisa de
TODAS as cores carregadas ao mesmo tempo, e `project_parts` não tinha
cor nenhuma. Fica na parte porque é a parte que é de uma cor só.

**A conta**, em minutos: cor já carregada = 0; cor faltando com gaveta
livre = 3 min por rolo; cor faltando com AMS cheio = 12 min por rolo,
porque é preciso tirar um pra pôr o outro. Peça que pede mais cores do
que a máquina tem gavetas fica bloqueada, com o motivo escrito.

### E dá pra contrariar a sugestão — patch 46

A primeira versão do plano era **só leitura**, e o dono ficou (palavra
dele) *engessado*: viu a sugestão, decidiu imprimir outra peça, e não
tinha como contar isso pro sistema — a lista continuava afirmando outra
coisa. **Sugestão que não pode ser contrariada não é sugestão, é
ordem.**

- **"Na máquina agora"** é seção própria no topo, e sai da sugestão.
- **Cada linha age**: `▶️ Pus pra imprimir`, `✅ Terminei`, `Deu errado`.
- **`⬆️` fixa a peça** numa seção *"Você escolheu fazer estas primeiro"*,
  acima das automáticas; `✖️` devolve pra ordem sugerida.

⚠️ **O `⬆️` precisa levar a peça pra seção de cima, não só pro primeiro
lugar da seção dela.** Foi o primeiro jeito que fiz e não resolvia: a
peça fixada precisava de troca de cor, caía na seção de baixo e
continuava aparecendo embaixo — que é exatamente a sensação de não
conseguir mexer em nada.

Sem arrastar, de propósito: arrastar no celular, numa lista que se
redesenha a cada mudança de status, erra mais do que acerta.

**E o "Comecei" voltou** — eu tinha removido demais. O dono reclamou do
controle de HORÁRIO, não do botão: marcar o que está na máquina é
informação que todo mundo precisa; medir duração pelo relógio é que
estragava o custo. O tempo continua vindo do fatiador, sempre.

### Isso é conta, e NÃO é IA — decidido em 28/08

O dono pediu "uma IA bem inteligente" pra sugerir a ordem. Ordenar por
cor carregada e prazo é aritmética, não julgamento: precisa ser
instantânea, de graça e **dar sempre o mesmo resultado**. Uma lista que
muda de ordem sozinha entre duas visitas é pior que lista nenhuma pra
quem tem 10 anos — e uma IA não garante a frase "comece por estas
porque o preto já está na gaveta 1" sempre certa. A IA fica onde ela é
boa: a colinha, que é julgamento sobre a peça.

## O relógio de parede saiu de vez — 28/08

**"Comecei" foi removido** (viveu um dia) e **o "Terminei" parou de
perguntar quantas horas a impressora ficou ligada.**

O motivo é do dono, e é definitivo: ele aperta "comecei", sai de casa, e
só volta quatro horas depois de a peça ficar pronta. Marcar relógio ali
grava quatro horas a mais — e daí em diante toda venda daquela peça sai
com o custo errado, **com toda a cara de número medido**.

O tempo de impressão é o que o **fatiador** calcula, digitado uma vez na
tela de dar preço ("o fatiador mostra em horas e minutos"). O "Terminei"
só pergunta o que o fatiador não sabe: qual rolo saiu do estoque e
quantos gramas gastou. As horas continuam indo pra receita — o que mudou
foi a **fonte** do número, não o destino.

**Não reintroduza medição por relógio**, em nenhuma tela.

### E o número entra onde ele aparece: passo 4 do preparo

"Preparar pra imprimir" ganhou um quarto passo — **"Anotar o que o
fatiador disse"** (tempo e gramas) — logo depois de "abrir no fatiador",
de propósito: é nesse momento que os dois números estão na tela do
Bambu. Perguntar depois é perguntar de memória.

Hora e minuto em campos separados, do jeito que o Bambu mostra ("17h
31min"): pedir 17,52 obriga a converter de cabeça, e é aí que entra
número errado.

Onde grava: item de catálogo vai pra **receita do produto** (serve pra
toda venda futura); personalizado vai pra própria linha. É isso que faz
os 155 produtos sem ficha irem ganhando tempo sozinhos, conforme forem
vendidos — sem ninguém preencher 155 fichas de uma vez, que era o
trabalho que ninguém ia fazer.

## A tela fala o que fazer, não o que o banco guarda — 27/08

Três rodadas de "ainda está confuso" até chegar aqui. O que mudou de
princípio: **a tela diz a próxima ação, em português, não o estado
interno.**

- A coluna da aba Pedidos era "Falta" e dizia `1 pra mandar pra fila`,
  `1 sem arquivo` — e listava três coisas ao mesmo tempo, quando só a
  primeira dá pra fazer agora. Virou **"O que fazer agora"**: uma frase
  no infinitivo (`pegar o arquivo da peça`, `pedir a colinha`, `mandar
  pra imprimir`, `entregar pro cliente`), a mais atrasada das peças do
  pedido, com contagem só quando é mais de uma.
- Cores por tipo de ação: 🟡 trava, 🔵 dá pra fazer agora, ⚪ a máquina
  está trabalhando, 🟢 acabou.
- O cartão do rodapé da Fila dizia "falta preparar" e mandava clicar em
  Preparar — só que aquelas peças **não tinham nada faltando**: os três
  passos apareciam verdes e o que faltava era apertar "mandar pra fila".
  Agora cada linha mostra a própria falta, e peça pronta ganha um botão
  que **resolve num clique** em vez de abrir janela.

⚠️ **Dois bugs desta rodada valem como aviso permanente:**

1. **Semáforo que mente é pior que semáforo nenhum.** A primeira versão
   ignorava as peças já na fila, e os pedidos do Marco e do Bernardo
   apareciam VERDES com peça sem arquivo nenhum. Estar na fila não
   significa estar preparada — peça entrou na Fila por anos só mudando
   de status. Só `entregue` e `cancelado` saem da conta.
2. **`embalado` já passou da impressão.** Contar tudo que não está na
   fila como "falta mandar pra fila" fez o pedido do Batista, embalado,
   pedir uma coisa impossível. E ele continua na lista porque pedido só
   sai quando está **entregue** — embalado é "pronto pra sair".

## Cabeçalho que ordena, como no Excel — 27/08

Cinco telas: Pedidos, Produtos, Clientes, Filamentos e Financeiro.
Clica no título, organiza; clica de novo, inverte; a seta diz por onde
está e pra que lado.

Mecanismo único em `ORDENS` / `ordenarTabela()` / `aplicarOrdem()` —
Pedidos e Produtos começaram com um estado cada e foram unificados
antes da terceira cópia.

Detalhes que só aparecem com dado de verdade, e que valem pra qualquer
ordenação nova:

- **`localeCompare` com `'pt-BR'`**, senão "Ângela" vai pro fim da lista.
- **Empate sempre desempatado** (nome ou data), senão ordenar por uma
  coluna repetida embaralha a lista a cada redesenho.
- **Valor desconhecido vai pro fim**, nunca pro topo: margem sem receita
  é `-1` (não zero — com 157 produtos sem ficha, eles se misturariam com
  quem dá prejuízo), campo de texto vazio vira `'￿'`, e peça sem
  tempo fica atrás nas duas direções.
- **Ordem de fluxo, não alfabética**, pra status e ações: por letra,
  "Cancelado" viria antes de "Imprimindo".

Financeiro abre por **"Falta", do maior** — antes vinha na ordem que o
banco devolvia, que é nenhuma.

## A Fila agora agrupa por cliente — 27/08

Antes a Fila era organizada por impressora, e uma encomenda de três
peças aparecia espalhada em três lugares. Agora cada pessoa é um bloco:
imprimir uma peça e deixar a outra pra depois não adianta nada, porque
**quem comprou junto recebe junto**.

O bloco soma o tempo de impressão da encomenda inteira e avisa nos dois
jeitos de furar isso: quando são **duas compras da mesma pessoa** (dá
pra mandar num frete só) e quando as peças estão em **impressoras
diferentes**. Também mostra `✅ 2 de 3 já saíram da fila` — as peças
prontas somem da consulta (o filtro é por `line_status`), e sem buscar
as irmãs o bloco diria "1 peça" pra um pedido de três.

"O que cada impressora tem pela frente" virou um resumo de uma linha por
máquina, no topo.

Colunas e ordem: entrou **Tempo** (total, e "cada uma" quando a
quantidade passa de 1), e um seletor de ordem — prazo, mais rápidas,
mais demoradas, chegada. **Peça sem tempo estimado vai pro fim nas duas
direções**: não é rápida nem demorada, é desconhecida, e no topo de "as
mais rápidas" faria o Rafa começar pela que ninguém sabe quanto demora.

⚠️ **Venda pelo catálogo não cria ficha de cliente** — o nome fica solto
em `orders.customer_name` e o `customer_id` vem vazio. Por isso a chave
de agrupamento tem três degraus (ficha → nome → pedido), e o terceiro é
o que importa: sem nome, cada pedido vira seu próprio bloco. Sem esse
degrau, todo mundo sem ficha viraria um bloco "Sem cliente" só —
aconteceu no teste com os dados reais, duas compras de pessoas
diferentes juntas.

## Antes de tudo, numa máquina nova

```
powershell -ExecutionPolicy Bypass -File slicer-agent\conferir-maquina.ps1
```

O `.env` não viaja (carrega a `service_role`), e as chaves da Anthropic e
do Hi3D só aparecem na hora de criar — guarde no gerenciador de senhas.

`MESHY_API_KEY` pode ficar vazia: o Hi3D tomou o lugar dela.

Depois, suba o agente (`start-hidden.vbs`). Sem ele, todo botão de
colinha e de fatiador fica girando pra sempre, **sem erro nenhum na
tela** — o sintoma mais confuso do projeto.

## ✅ O computador do Rafa está preparado — 26/08, à noite

Ele clicou em "abrir no fatiador" e nada aconteceu. **Nunca foi
permissão** — a escrita funcionou e a peça entrou na fila. Aquela máquina
simplesmente nunca tinha rodado o agente, então nem aparecia na lista de
escolher computador; a única opção era a do Anderson, desligada, e a peça
foi pra lá esperar.

Resolvido de ponta a ponta: Node, repositório, dependências, `.env` com
as chaves, atalho no `shell:startup` e o agente de pé. A peça da **Joice**
que estava parada há 71 minutos foi redirecionada e saiu em **15
segundos**.

Duas coisas que valem pra qualquer máquina nova:

- **`AGENT_NAME=Rafa`.** Sem isso o agente usa o nome de rede do Windows,
  e a lista de escolher computador mostra algo tipo `DESKTOP-4F2K9` —
  ilegível pra quem tem 10 anos. Nome de gente resolve.
- **Preencha TODAS as chaves, não só a do banco.** Com dois agentes
  ligados, quem pega o serviço primeiro é quem faz. Se for a máquina sem
  `ANTHROPIC_API_KEY` ou `HI3D_*`, o agente **marca o pedido como erro**
  em vez de deixar a outra fazer.
- **Suba o agente visível na primeira vez** (`node agent.js`). O
  `start-hidden.vbs` esconde o erro junto com a janela; visível, ele diz
  na hora o que está errado no `.env`.

## O chaveiro de cereja está CANCELADO

Encomenda real, já vendida, cancelada sem querer. Existe o botão
**"Reabrir orçamento"** pra desfazer sem apagar nada.

Falta o mesmo de sempre, e nada disso foi impresso — só validado em
arquivo:

1. **O entalhe do abridor.** A aba já está na peça (é ela a placa
   retangular — **não apague**). Tampinha tem 32mm, o entalhe precisa de
   20 a 22mm de abertura com 5mm de parede em volta. A 78mm sobra 2,5mm
   e quebra; a partir de 92mm funciona.
2. **O bolso do NFC de 23mm** e a pausa pra encaixar o chip.
3. **Imprimir e testar**: colar, abrir uma garrafa, encostar o celular.

Bolso e entalhe saem por **Add negative part** no Bambu Studio. **Cortar
a malha não funciona** — tentado de duas formas em 24/08.

Ferramentas: `ver-peca.js` (desenha a peça de 4 ângulos, **use antes de
julgar qualquer modelo**), `extrair-stl-do-3mf.js`, `achar-altura-pausa-nfc.js`.

## O que entrou em 26/08 — 24 commits

Foi o dia que ligou **preço, custo e produção** de ponta a ponta.

### Dinheiro e custo

- **Custo extra** (embalagem, gravação, personalização) entra em toda
  conta — patch 36. Diferente da pintura, é valor em R$, porque
  embalagem não escala com o tamanho da peça.
- **Preço sugerido virou ponto de partida editável.** A conta continua
  igual, mas "vendeu por quanto?" aceita o valor real da negociação. O
  custo salvo continua sendo o calculado — lucro precisa de custo
  verdadeiro pra fazer sentido.
- **"Terminei" grava o número REAL** em `product_recipes`: antes a
  estimativa da IA ficava congelada pra sempre; agora cada impressão
  corrige o custo, e é esse número que "Quanto sobrou" lê.
- **Escolher o material em vez da cor** (patch 38): cor quase nunca muda
  o custo, material muda.
- **Projeto guarda gramas/horas por peça** (patch 39), pro "Terminei"
  puxar sozinho — item de catálogo já fazia isso pela receita.
- **"Quanto sobrou" virou porcentagem**, e pedido finalizado sumiu da
  lista principal.

### Produção

- **Botão "Pedido pronto"**: ponto final de verdade. "Terminei" só marca
  o fim da impressão e deixava peça simples presa em "dando o acabamento".
- **Ponte Pedidos → Projetos**: item personalizado dentro de um pedido
  não tinha ação nenhuma; agora o "🪄 Gerenciar" abre o mesmo modal da
  aba Projetos, sem duplicar lógica.
- **Colinha extrai miniatura de dentro do `.3mf`** anexado à mão — só
  funciona se o arquivo já foi fatiado alguma vez no Bambu.
- **Módulo de Projetos repensado**: calcular preço deixou de aprovar o
  pedido sozinho; cancelado tem volta; nome/contato viraram editáveis;
  excluir avisa antes quando há estoque ou pagamento; finalizado sai da
  lista.

### Cliente

- **Cartinha ganhou cor, confete, foto e QR.** O nome saiu do desenho de
  propósito: virou molde com "Para" e assinatura em branco, pra dar pra
  imprimir um lote inteiro numa gráfica.
- **Arte de orçamento** pra mandar no WhatsApp — e "Mandar a arte" envia
  a **imagem de verdade** (html2canvas + Web Share API), não só o texto.
- **IA sugere categoria e tamanho** ao cadastrar produto, olhando a foto.
  Edge Function nova (`sugerir-cadastro-produto`), síncrona, sem fila.
  O campo "altura" virou texto livre (patch 37) — nem toda peça é
  descrita pela altura.
- **Cards do Dashboard viraram atalho** pra aba onde aquilo se resolve.

### Patches 34 a 39 — todos rodados

34 e 35 são mais do mesmo `GRANT` que já derrubou meia dúzia de patches:
`product_recipes` e `printers` nunca tiveram permissão pro `service_role`.

## O negócio andou

- **Porta Anel — 60 peças — R$ 834,00 — ENTREGUE** ✅
- Três projetos novos, todos com colinha e estimativa: **Vovó Alice**
  (cesta suspensa, R$ 95,90), **Joice** (vaso 25cm, R$ 109,90), **Dayane**
  (lembrancinha de casamento, R$ 19,90).
- Os quatro pedidos do catálogo de 23–24/08 continuam sem pagar.

## Pendências que são do Anderson, não do agente

1. **Testar o "Sugerir categoria e tamanho" logado de verdade** — a
   função foi testada por fora, o caminho navegador→função não.
2. **Testar o botão de copiar o PIX num celular.**
3. **Falar com os clientes de 23/08** — ficaram na regra antiga de 50% de
   propósito, e as mensagens escritas pra eles falam em metade.
