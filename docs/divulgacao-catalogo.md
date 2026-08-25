# Divulgação do catálogo

O que mandar nos grupos, e onde estão os arquivos. Guardado aqui porque a
arte vive no repositório e o texto não pode ficar só na cabeça de alguém.

## A arte

| | |
|---|---|
| Pra enviar como imagem | [`catalogo/assets/arte-catalogo.png`](../catalogo/assets/arte-catalogo.png) — 1080×1080 |
| Pelo celular | https://sistemidalessi.github.io/rafa3d-sistema-gestao/catalogo/assets/arte-catalogo.png |
| Cartão do link | `arte-catalogo-link.jpg` — a mesma arte em versão leve |

São dois arquivos de propósito. O PNG é o que se manda como foto. O JPEG é
o que o WhatsApp busca pra montar o cartão quando alguém cola só o link —
acima de uns 300 KB ele desiste de baixar e o cartão sai sem imagem.

O botão azul foi posicionado acima da linha onde o WhatsApp corta a prévia
no chat. Se a arte for refeita, **mantenha nada importante no rodapé**.

## A mensagem

```
🖨️ O catálogo da Rafa 3D está no ar!

Mais de 160 peças impressas em 3D — action figures, vasos, chaveiros,
porta-treco e muito mais, a partir de R$ 9,90.

Escolhe a peça e a cor, o site calcula o frete e você paga por PIX na
hora — o código já vem pronto, é só copiar e colar no banco.

👉 https://sistemidalessi.github.io/rafa3d-sistema-gestao/catalogo/

"Tenho 10 anos e essa loja é minha: eu desenho, imprimo, embalo e mando.
Obrigado de coração por prestigiar o meu trabalho! 💙" — Rafa
```

Anexe a imagem e cole o texto como legenda. **O link no texto é o que
leva à loja** — imagem enviada no WhatsApp nunca é clicável, em aplicativo
nenhum. O botão desenhado na arte é convite, não link.

## Se a arte mudar

A arte é gerada por script, não editada à mão. Ele monta o fundo, encaixa
as fotos das peças (aparando a borda vazia de cada uma pra a figura não
ficar pequena), recorta o retrato e escreve os textos.

Ao trocar a arte, refaça também o JPEG leve e confira que o `og:image` no
[`catalogo/index.html`](../catalogo/index.html) continua apontando pra ele.

## O que a mensagem promete, e por isso não pode mudar sozinho

- **"a partir de R$ 9,90"** — é o menor preço ativo do catálogo hoje
- **"mais de 160 peças"** — são 161 produtos ativos
- **"paga por PIX na hora"** — desde 24/08/2026 o PIX é do valor cheio, e não
  de metade; quem gera é a Edge Function `finalizar-pedido`, e ela precisa
  estar publicada
- **"escolhe a peça e a cor"** — o seletor de cor fica no checkout

Mexeu em algum desses, confira a mensagem antes de divulgar de novo.
