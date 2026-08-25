# Chegou um pedido. E agora?

O caminho do pedido que entra pelo catálogo até a peça sair da
impressora. Escrito pra ser seguido sozinho, sem ninguém do lado.

## 1. Abrir o pedido

Aba **Pedidos** → botão **Abrir** na linha do pedido.

Lá dentro está tudo o que você precisa saber:

- **Qual peça** e o **código** dela (ex: `01.27`)
- **De que cor** o cliente quer 🎨
- **Quanto** ele paga, e se **já pagou**
- **Como entrega**: pelos Correios ou ele vem buscar

## 2. Conferir se o dinheiro entrou

O selo do pagamento fica no alto: **"Ainda não pagou"** ou **"Pagou tudo"**.

**Só comece a imprimir depois que ele pagar.** Quando o comprovante
chegar no WhatsApp, clique em **+ Anotar pagamento** e registre.

## 3. O arquivo da peça

Aqui tem dois caminhos, e da segunda venda em diante é sempre o rápido.

### Primeira vez que essa peça é vendida

Primeiro **guarde o arquivo na pasta certa**:

```
Documentos\Rafa 3D\pecas-do-catalogo\
```

E dê o nome **começando pelo código do catálogo**:

```
01.27 - Arvore do Amor.3mf
04.11 - Organizador de Controle Remoto II.3mf
```

O código na frente faz a lista ficar na mesma ordem do catálogo — e é
por ele que você acha a peça quando o próximo pedido dela chegar.

> `.3mf` é melhor que `.stl` quando você tiver os dois: ele guarda a
> miniatura da peça dentro dele, e a IA usa essa imagem pra escrever a
> colinha. O `.stl` não tem miniatura.

Aí sim, no pedido, clique em **📎 Anexar o arquivo 3D**. A tela de
anexar abre direto, já no produto certo — é só escolher o arquivo.

**Isso é uma vez só por peça.** Depois de anexado, fica no sistema pra
sempre, e a pasta vira só a sua bancada de trabalho.

### Peça que já foi vendida antes

O botão já é **🖨️ Abrir no Fatiador**. Pule pro passo 5.

## 4. Pedir a colinha (só uma vez por peça)

Clique em **🤖 Pedir a colinha**. A IA olha a peça e escreve como
imprimir ela: altura de camada, preenchimento, se precisa de suporte,
temperatura.

Demora alguns instantes — o botão vira **"Analisando..."** e a tela se
atualiza sozinha quando fica pronta. Aí ele vira **📋 Ver a colinha**.

Se a peça já tem colinha, não peça de novo: gasta IA à toa e o resultado
é o mesmo.

## 5. Mandar pro fatiador

Clique em **🖨️ Abrir no Fatiador**.

O Bambu Studio abre sozinho **no computador que você escolher**, com a
peça já carregada e a colinha já aplicada.

> Se o botão ficar girando pra sempre, o agente está parado. Dois
> cliques em `slicer-agent\start-hidden.vbs` resolve. Sem o agente,
> nenhum botão de fatiador ou de IA funciona — e não aparece erro
> nenhum na tela, que é o que confunde.

## 6. Imprimir

No Bambu Studio:

1. Coloque o filamento **da cor que o cliente pediu** (está no pedido)
2. Confira o tamanho da peça
3. Fatie e mande imprimir

## 7. Ir marcando o status

Na linha da peça, dentro do pedido, tem uma lista de status. Vá mudando
conforme anda: **imprimindo → pós-processamento → pronto**.

É por ela que dá pra saber, sem perguntar pra ninguém, o que está na
impressora agora.

## 8. Avisar o cliente

Peça pronta:

- **Vai pelos Correios** → o pedido tem o botão de **gerar etiqueta**
- **Ele vem buscar** → chame no WhatsApp e combine

---

## Por que o arquivo não vem junto

O catálogo foi montado com **fotos** das peças. O arquivo que a
impressora lê nunca subiu pro sistema — são 161 peças, e subir todas de
uma vez seria um dia inteiro de trabalho pra arquivos que talvez nunca
sejam vendidos.

Então sobe conforme vende. Cada peça dá esse trabalho **uma vez na
vida**.
