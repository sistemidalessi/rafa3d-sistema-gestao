# Continuar daqui

Onde as coisas pararam em **26/08/2026**, à noite.

> **Memória do agente não viaja entre as máquinas.** O que precisa
> sobreviver à troca de computador tem que estar no repositório — aqui
> ou no `CLAUDE.md`. Não deixe recado só na memória.

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

## 🔴 O computador do Rafa não está preparado

Ele clicou em "abrir no fatiador" e nada aconteceu. **Não é permissão** —
a escrita funcionou e a peça entrou na fila.

O problema: **aquela máquina nunca rodou o agente**, então nem aparece na
lista de escolher computador. A única opção oferecida era a do Anderson,
desligada — e a peça foi pra lá esperar.

A tela agora explica isso (avisa quando nenhum está ligado, diz o que
fazer quando o seu não está na lista, e o aviso de "parado" passou a
olhar o computador *escolhido* em vez de "algum ligado"). Mas a solução é
física: rodar o `conferir-maquina.ps1` na máquina dele. O `.env` precisa
do Anderson, porque as chaves são por máquina.

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

1. **Preparar o computador do Rafa** (acima).
2. **Testar o "Sugerir categoria e tamanho" logado de verdade** — a
   função foi testada por fora, o caminho navegador→função não.
3. **Testar o botão de copiar o PIX num celular.**
4. **Falar com os clientes de 23/08** — ficaram na regra antiga de 50% de
   propósito, e as mensagens escritas pra eles falam em metade.
