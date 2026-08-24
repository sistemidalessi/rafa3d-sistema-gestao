# Continuar daqui

Onde as coisas pararam em **24/08/2026**, à tarde/noite.

## Antes de tudo, se for outra máquina

O agente, o Node e o `.env` não viajam no repositório. Rode:

```
powershell -ExecutionPolicy Bypass -File slicer-agent\conferir-maquina.ps1
```

**As chaves do Hi3D (`HI3D_ACCESS_KEY`/`HI3D_SECRET_KEY`) são por máquina.**
Se a máquina de casa já tinha um par criado antes de hoje, ele continua
válido — não precisa criar de novo. Se for uma máquina nova, crie uma
chave em `platform.hi3d.ai` → API Key → "+ Criar chave" (o segredo só
aparece uma vez, na hora de criar).

## Frente 1 — Hi3D entrou no ar (decidido e construído hoje)

Comprado o pacote Starter (2000 créditos, US$40). A troca de gerador
está feita: botão **"🪄 Gerar e dividir em partes"** na aba Projetos
gera a peça inteira pelo Hi3D e já divide em pedaços coloridos
automaticamente (patch-27, `agent.js`/`gerar3mf.js`). Testado ao vivo,
funcionando — inclusive um bug real (peça saindo toda verde, perdendo
as cores por parte) foi achado e corrigido no mesmo dia.

Detalhe técnico que vale lembrar: o modo `general` do Hi3D divide bem
por cor mas **não tem conector automático** — as juntas saem lisas,
monta na cola, igual já era antes. `docs/decisao-hi3d.md` tem o resto
do mapeamento da API se precisar mexer de novo.

## Frente 2 — Chaveiro de cereja com NFC + abridor de latinha (em andamento, não terminado)

**Encomenda real, já vendida antes do sistema entrar no ar** — o dono
quer isso "perfeito", não é só teste. Foi um dia difícil de CAD —
leia a memória do projeto (entrada de 24/08 "chaveiro de cereja com
NFC + abridor") antes de continuar, tem lição aprendida importante
sobre o que NÃO funcionou.

### O que já está pronto
- **Forma da cereja+laço**: aprovada, gerada pelo Hi3D a partir de
  foto de referência. Tem uma sobra/rampa esquisita de geração (não
  atrapalha o formato principal) — resolve na hora de montar (corta
  com estilete ou esconde colando a base por cima).
- **Base do abridor**: `slicer-agent/base-abridor.js` →
  `downloads/base-abridor.3mf`. Placa retangular, reta de um lado,
  arredondada acompanhando a cereja do outro, com um **vão retangular
  na ponta** (não redondo, não no meio — o dono corrigiu isso duas
  vezes até ficar certo). Peça válida, testada com manifold-3d.
- **Ferramenta da altura de pausa do NFC**:
  `slicer-agent/achar-altura-pausa-nfc.js` — acha a altura Z certa
  pra pausar a impressão e encaixar o chip, sem precisar cortar bolso
  na peça. Ainda **não foi rodada** contra o arquivo final.

### O que NÃO funcionou (não tentar de novo sem uma ideia nova)
Cortar ou reparar a malha que o Hi3D gera — tentado de duas formas
(operação booleana com `manifold-3d`, e apagar+fechar triângulo à
mão), as duas esbarraram em defeito de malha mais fundo que costura
solta. Por isso o abridor virou peça **separada, impressa à parte e
colada na mão** — mesma técnica que o produto real já usa (confirmado
com o próprio dono desde o início da conversa).

### O que falta
1. **Escalar a cereja pra 78mm** de largura final (hoje está na
   escala crua do Hi3D, ~100mm) — decidido com o dono como meio-termo
   entre o tamanho decorativo e o espaço mínimo que o abridor precisa
   pra funcionar de verdade.
2. **Rodar a ferramenta da altura de pausa** contra o arquivo final
   (cereja + base do abridor já no tamanho certo).
3. **Imprimir um teste de verdade** — cereja, base do abridor, colar,
   testar a pausa do NFC. Nada disso foi impresso ainda, só validado
   em arquivo/tela.

## Frente 3 — pagamento no catálogo (ainda pendente, não mexida hoje)

Só falta **testar o botão de copiar o PIX num celular de verdade**
(não dá pra testar por aqui, a automação trava no pedido de permissão
da área de transferência). Detalhe em `docs/continuar-daqui.md`
(versão de 23/08, se ainda estiver por perto) — resumo: tem que
aparecer "✓ Copiado! Agora abra o banco" e o botão do WhatsApp ficar
verde.
