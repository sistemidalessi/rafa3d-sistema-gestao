# Continuar daqui

Onde as coisas pararam em **27/08/2026**.

> **Memória do agente não viaja entre as máquinas.** O que precisa
> sobreviver à troca de computador tem que estar no repositório — aqui
> ou no `CLAUDE.md`. Não deixe recado só na memória.

## ✅ As duas máquinas estão com o código de 27/08

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

## 🔴 O catálogo vende 155 peças que o sistema não sabe imprimir

Medido em 27/08, e é a raiz de quase toda a confusão do dia:

```
166 produtos ativos    11 com arquivo 3D    10 com colinha    9 com ficha de custo
```

O catálogo foi montado com **fotos**. Quando alguém compra, o sistema
não tem arquivo, não tem colinha e não sabe o tempo — e todo esse
trabalho cai de uma vez na tela do pedido. Não era a tela que estava
confusa: era a venda acontecendo antes do preparo.

Isso não é bug, é decisão de negócio, e é do Anderson:

1. **Deixar como está** e preparar peça por peça conforme vende (é o que
   o "Preparar pra imprimir" agora organiza).
2. **Desativar no catálogo** o que não tem arquivo, e ir ativando à
   medida que prepara.

Enquanto for a opção 1, "sem tempo estimado" na Fila é o normal, não é
defeito — e a primeira impressão de cada peça ensina o sistema, porque o
"Terminei" grava as horas reais na receita.

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
