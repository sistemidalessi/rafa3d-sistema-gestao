# Continuar daqui

Onde as coisas pararam em **24/08/2026**, à noite. O dia foi quase todo
no sistema; o chaveiro parou numa decisão de tamanho.

> **Memória do agente não viaja entre as máquinas.** O que precisa
> sobreviver à troca de computador tem que estar no repositório — aqui
> ou no `CLAUDE.md`. Não deixe recado só na memória.

## Antes de tudo, numa máquina nova

```
powershell -ExecutionPolicy Bypass -File slicer-agent\conferir-maquina.ps1
```

O `.env` não viaja (carrega a `service_role`). A máquina de casa foi
preparada em 24/08 e tem as quatro chaves preenchidas —
`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `HI3D_ACCESS_KEY`,
`HI3D_SECRET_KEY`. **A do escritório tem as dela, criadas antes.**

Chave da Anthropic e do Hi3D só aparecem uma vez. Guarde no gerenciador
de senhas — é o que evita recriar a cada máquina.

Saldo do Hi3D em 24/08: **1630 créditos** (~US$ 32).

## Frente 1 — o chaveiro de cereja (parado numa decisão sua)

**Encomenda real, já vendida.** O arquivo bom é o
`cereja-inteira.3mf`, gerado pelo Hi3D e baixado do workspace em
"Single file". **Não está no repositório** (`downloads/` é ignorado) —
está em `C:\Users\ander\Downloads` na máquina de casa, e dá pra baixar
de novo do Hi3D.

Mede **102,4 × 29,8 × 91,4 mm**, 2 milhões de triângulos, 4 partes
coloridas. Peça em pé: laço em cima, duas cerejas embaixo.

### A descoberta que quase custou caro

Aquela placa retangular saindo da cereja **é a ABA DO ABRIDOR**,
copiada da foto de referência — confirmado pelo dono. Eu passei a tarde
achando que era sobra de geração e cheguei a propor apagar e refazer a
peça no CAD. Era o abridor.

Use `node ver-peca.js arquivo.3mf` antes de julgar qualquer modelo: ele
desenha a peça de quatro ângulos. Foi o que desfez o engano em trinta
segundos, depois de horas de achismo.

### ⏸️ A decisão que falta: 78mm ou 92mm

A aba do abridor mede, no arquivo original: **12–16mm de saliência,
34,5mm de altura, 18,5mm de espessura**.

Tampinha tem 32mm. O entalhe precisa de **20 a 22mm** de abertura.

| Tamanho da peça | Altura da aba | Parede sobrando | Resultado |
|---|---|---|---|
| 78 mm | 26 mm | 2,5 mm | quebra na primeira garrafa |
| **92 mm** | 31 mm | 5 mm | **abridor funciona** |
| 102 mm (original) | 34,5 mm | 6,7 mm | folgado |

A recomendação registrada é **~92mm ou não escalar**: a aba já está na
peça, é só abrir o entalhe — sem cola, sem duas partes pra alinhar.

A 78mm a aba vira enfeite, e aí o abridor de verdade seria a
`base-abridor.3mf` (71 × 36 × 4mm) colada atrás.

### O que já está pronto

- **`ver-peca.js`** — desenha a malha em imagem, sem fatiador.
- **`extrair-stl-do-3mf.js`** — tira a malha do `.3mf` e escala.
- **`achar-altura-pausa-nfc.js`** — acha onde o NFC cabe. Foi
  **reescrito em 24/08**: a versão anterior dava resposta confiante e
  errada (mandava pausar na primeira camada, e media a caixa da fatia
  em vez do material). Agora mede o maior círculo que cabe dentro.
- **`base-abridor.js`** — placa de 71 × 36 × 4mm, só se a peça for 78mm.

### Números do NFC (**refazer se mudar o tamanho**)

Com o **NFC de 23mm** e a peça a **78mm**: pausar em **Z = 1,2mm**,
centro em **X = −9,3 / Y = 15,2**, cabendo 35,4mm de material.

**Esses números valem só pra 78mm.** Decidindo 92mm, rode de novo:

```
node extrair-stl-do-3mf.js downloads/cereja-inteira.3mf --largura=92
node achar-altura-pausa-nfc.js downloads/cereja-inteira-92.stl 23
```

### Como imprimir, quando o tamanho estiver decidido

1. Abrir o **`.3mf`** no Bambu Studio (não o `.stl` — o `.stl` perde as cores)
2. Escalar, se for o caso
3. **Add negative part → Cylinder** pro bolso do NFC: diâmetro **24mm**,
   ~1mm de altura, topo na altura da pausa
4. **Add negative part** pro entalhe do abridor, na aba
5. **Add pause** na altura calculada
6. Imprimir. Na pausa, encaixar o NFC e continuar

O bolso e o entalhe saem por *negative part* de propósito: **cortar a
malha não funciona** — foi tentado de duas formas em 24/08 (booleana com
`manifold-3d` e remendo à mão) e as duas esbarraram em defeito de malha
mais fundo que costura solta. Não tente de novo sem uma ideia nova.

## Frente 2 — o sistema (tudo no ar, nada pendente)

Entrou em 24/08, tudo testado e publicado:

- **Filamento em quilo** — o banco continua em grama; a conversão é só de tela
- **Cor mesclada** — duas cores no mesmo rolo; o Rafa já cadastrou cinco
- **Apagar cor e corrigir/apagar rolo** — com aviso quando tem histórico
- **Aviso de estoque em 50g** nas 35 cores
- **Cores do catálogo vêm do banco** — acabou a lista dupla
- **Pagamento integral** (era metade) — patch 31 + deploy
- **Entrega a combinar corre por conta do cliente**, dito em 4 momentos
- **Cor obrigatória**, escolhida em bolinhas coloridas
- **PIX na hora também pra quem combina a entrega**

Patches 26 a 31 rodados. `finalizar-pedido` publicada.

### O que sobrou de pendente

1. **Ctrl+F5 na tela do Rafa** — ele ainda pode estar vendo a versão antiga.
2. **Testar o botão de copiar o PIX num celular de verdade** — a
   automação trava no pedido de permissão da área de transferência.
3. **Falar com os 4 clientes** de 23/08. Eles ficaram na **regra antiga
   de 50%** de propósito, e as mensagens escritas pra eles falam em
   metade — está coerente, pode mandar como está.

### Pedido novo que chegou durante o trabalho

**SITE-MT7YZQ9T — Jesielle Araújo** (11 91744-7474): 1x Vaso Bloom,
R$ 47,90, cor **Vermelho Marsala**, entrega a combinar, paga o valor
cheio. Foi o primeiro pedido a passar por tudo que foi construído hoje
— e não perguntou como pagar.
