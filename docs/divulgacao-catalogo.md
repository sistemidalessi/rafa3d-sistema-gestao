# Divulgação do catálogo

O que mandar nos grupos, e onde estão os arquivos. Guardado aqui porque a
arte vive no repositório e o texto não pode ficar só na cabeça de alguém.

## A arte

| | |
|---|---|
| Pra enviar como imagem | [`catalogo/assets/arte-catalogo.png`](../catalogo/assets/arte-catalogo.png) — 1080×1080 |
| Pelo celular | https://rafa3ddalessi.com.br/catalogo/assets/arte-catalogo.png |
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

👉 https://rafa3ddalessi.com.br/catalogo/

"Tenho 10 anos e essa loja é minha: eu desenho, imprimo, embalo e mando.
Obrigado de coração por prestigiar o meu trabalho! 💙" — Rafa
```

Anexe a imagem e cole o texto como legenda. **O link no texto é o que
leva à loja** — imagem enviada no WhatsApp nunca é clicável, em aplicativo
nenhum. O botão desenhado na arte é convite, não link.

## Se a arte mudar

A arte foi gerada por script, não editada à mão — mas **esse gerador não
está no repositório** (só o resultado). O que existe é
[`docs/atualizar-rodape-arte-catalogo.py`](atualizar-rodape-arte-catalogo.py),
que troca só o **link do rodapé**: apaga a faixa do texto antigo
(interpolando o fundo, sem deixar retângulo) e renderiza o texto novo com
o Blender em segundo plano. Foi assim que o rodapé passou de
`sistemidalessi.github.io/...` pra `rafa3ddalessi.com.br` em 11/09/2026.
Ele parte de `arte-catalogo-original.png` (a arte sem rodapé novo, guardada
ao lado) e grava o PNG e o JPEG leve de uma vez.

Pra mudar qualquer outra coisa na arte (fotos, texto, retrato), é refazer
a arte inteira em outra ferramenta — e depois rodar o script do rodapé de
novo. Ao trocar a arte, confira que o `og:image` no
[`catalogo/index.html`](../catalogo/index.html) continua apontando pro JPEG.

## O que a mensagem promete, e por isso não pode mudar sozinho

- **"a partir de R$ 9,90"** — é o menor preço ativo do catálogo hoje
- **"mais de 160 peças"** — são 161 produtos ativos
- **"paga por PIX na hora"** — desde 24/08/2026 o PIX é do valor cheio, e não
  de metade; quem gera é a Edge Function `finalizar-pedido`, e ela precisa
  estar publicada
- **"escolhe a peça e a cor"** — o seletor de cor fica no checkout

Mexeu em algum desses, confira a mensagem antes de divulgar de novo.

## Instagram — 11/09/2026

Decisão do Anderson: ter um Instagram da Rafa 3D com o link do catálogo,
peças prontas e posts. Divisão do trabalho, dita com todas as letras:

- **Criar a conta e publicar é da pessoa.** Não existe caminho gratuito e
  confiável pra postar no Instagram por API, e conta é coisa dela.
- **Produzir o post é do sistema.** Em Produtos → ⚙️ Gerenciar → **📸 Post
  pro Instagram**: abre a imagem quadrada (1080×1080, identidade do
  catálogo — fundo `#000817`, azul `#0061f7`, Space Grotesk) com foto,
  nome, preço e seção, mais a legenda pronta (link direto pra seção da
  peça no catálogo + hashtags da categoria). "Mandar a imagem" usa o
  compartilhar do celular; "Copiar legenda" cola no post. O @ digitado
  fica salvo no aparelho e entra no rodapé da arte.
  Mesma mecânica da cartinha (html2canvas + Web Share API), em
  `preencherPostInstagram()`. Categoria nova entra em `SECAO_DO_CATALOGO`
  e `HASHTAGS_DA_CATEGORIA` além dos cinco lugares de sempre.

### Textos da conta (pra criar como "Profissional → Empresa")

- **Nome de usuário** (o primeiro livre): `rafa3d.dalessi` · `rafa3d.oficial`
  · `rafa3d.camadaporcamada`
- **Nome:** Rafa 3D · Impressão 3D
- **Categoria:** Loja de presentes (ou "Serviço de impressão")
- **Bio** (133 caracteres — o limite é 150; a versão com a linha
  "Vasos, chaveiros, suportes…" passava de 170 e não cabia):
  ```
  Peças impressas em 3D, camada por camada 💙
  Tenho 10 anos e essa loja é minha: eu desenho, imprimo e mando.
  👇 catálogo com preço e PIX
  ```
- **Pronomes:** em branco (é loja, não pessoa). **Banners:** nenhum.
- **Links** (campo próprio, fora da bio): 1) `https://rafa3ddalessi.com.br/catalogo/`
  com título "Catálogo com preço e PIX"; 2) `https://wa.me/5511987190466`
  com título "Falar no WhatsApp".
- **Destaques (stories fixos):** Catálogo · Peças prontas · Bastidores ·
  Como pedir
- **Foto de perfil:** [`catalogo/assets/perfil-instagram.png`](../catalogo/assets/perfil-instagram.png)
  (1080×1080 — o Instagram corta em círculo sozinho) e a versão redonda
  com fundo transparente, [`perfil-redondo.png`](../catalogo/assets/perfil-redondo.png),
  pra WhatsApp Business, etiqueta e cartão. Geradas pelo Blender em
  segundo plano (`blender --background --python`): a `logo_clean.png`
  **não tem transparência** — vem com fundo escuro próprio —, então o
  script recorta esse fundo pela cor do canto antes de assentar a logo no
  degradê `#000817 → #0061f7`. Refazer = rodar
  [`docs/gerar-perfil-instagram.py`](gerar-perfil-instagram.py) de novo
  (o comando está no cabeçalho dele); não editar o PNG à mão.

### Ritmo

3 posts por semana: uma peça do catálogo (o botão), um bastidor
(impressora rodando, peça saindo da mesa — em vídeo/Reel vale mais que
foto, e o Rafael operando a máquina é o melhor conteúdo que a marca tem),
uma peça entregue com a história do cliente. Agendar de graça no **Meta
Business Suite**. Começar pelo que já tem foto boa — post sem foto boa
não salva ninguém.
