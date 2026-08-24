# Continuar daqui

Onde as coisas pararam em **23/08/2026**, à noite. Duas frentes abertas.

## Antes de tudo, se for outra máquina

O agente, o Node e o `.env` não viajam no repositório. Rode:

```
powershell -ExecutionPolicy Bypass -File slicer-agent\conferir-maquina.ps1
```

Sem isso o sistema abre e parece normal, mas todo botão de fatiador e de
IA fica esperando na fila pra sempre, sem erro nenhum na tela.

**O `.env` desta máquina agora tem `HI3D_ACCESS_KEY` e `HI3D_SECRET_KEY`
preenchidas. A outra máquina não tem** — se for continuar o Hi3D de lá,
copie as duas linhas (à mão; chave não vai pro repositório).

## Frente 1 — Hi3D no lugar da Meshy (esperando uma decisão de compra)

Está tudo mapeado em [decisao-hi3d.md](decisao-hi3d.md). O resumo:

- A API funciona, a chave autentica.
- **Trava:** a assinatura de R$ 49,90/mês do site `hitem3d.ai` não paga
  chamada de API. Precisa de um pacote separado em `platform.hi3d.ai`.
- **Recomendação:** comprar o menor pacote (~US$ 10) e provar a cadeia
  inteira antes de assinar o anual.
- O que mais interessa é a **divisão em partes com encaixe**, que está
  toda disponível na API e inverteria como a aba Projetos funciona.

Cuidado que custa caro se for esquecido: o site gera 2 milhões de
triângulos e isso **quebra o nosso conversor de `.3mf`**. Pela API dá pra
limitar com `face=100000`.

## Frente 2 — pagamento no catálogo (feito, faltando um teste)

Os primeiros pedidos chegaram e vieram junto a pergunta "como faço pra
pagar?". A causa foi encontrada: **os quatro pedidos escolheram "prefiro
combinar a entrega"**, e nesse caminho a tela final não mostrava PIX
nenhum nem falava em pagamento.

Já está no ar:

- Tela de pagamento em **três passos numerados**, com botão de copiar de
  verdade no lugar da caixa de texto.
- O caminho "combinar a entrega" agora explica a sequência (me chame →
  eu mando o PIX da metade → a outra metade no fim).
- O **segundo PIX do rodapé foi removido** — era um QR sem valor e sem
  número de pedido; quem pagasse por ele mandava um PIX que ninguém
  conseguia ligar a nenhum pedido.
- O PIX **não some mais** ao fechar a página: fica guardado no navegador
  e volta numa barra no rodapé por até uma semana.
- A **cor escolhida agora grava no pedido** (patch 26 rodado, função
  publicada, testada com cor válida e inválida).

### O que ficou faltando

1. **Testar o botão de copiar num celular de verdade.** O ambiente de
   teste trava no pedido de permissão da área de transferência. Tem que
   aparecer "✓ Copiado! Agora abra o banco" e o botão do WhatsApp, que
   começa cinza, ficar verde.
2. **Falar com os 4 clientes** que pediram na tela antiga — eles
   continuam sem saber como pagar. As mensagens foram escritas na
   conversa do dia 23/08; se tiverem se perdido, dá pra reescrever a
   partir dos pedidos, que estão em "orçamento".

### Uma armadilha nova, que não existia antes

As cores do catálogo agora são **duas listas que precisam continuar
iguais**: a lista fixa em `catalogo/index.html` (que carrega o degradê de
cada bolinha) e a tabela `filament_colors`. Renomear uma cor na aba
Filamentos faz a escolha do cliente virar nulo, **sem erro nenhum na
tela**. O aviso está no código, junto da lista.
