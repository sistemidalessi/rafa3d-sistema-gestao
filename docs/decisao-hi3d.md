# Trocar a Meshy pelo Hi3D — decisão em aberto

Parado em 23/08/2026, esperando uma decisão de compra. Este arquivo existe
pra retomar sem refazer a investigação.

## Por que trocar

O que convenceu não foi a malha: foi o Hi3D **dividir a peça em partes e
colocar os conectores sozinho**.

Hoje, na aba Projetos, cada parte é criada à mão — descreve a parte 1,
gera, descreve a parte 2, gera. É o passo mais difícil da tela, e é
justamente o que o Rafa faz sozinho. Com o Hi3D o caminho inverte: gera a
peça inteira e depois corta. Viram duas perguntas:

> **Em quantos pedaços?** 2 · 3 · 4 · 5 · 6
> **Como os pedaços se juntam?** bolinha · rabo de andorinha · pino

## O que já foi verificado

- **A API funciona.** Chave autentica, token sai (`Basic base64(ak:sk)` em
  `POST /open-api/v1/auth/token`).
- **A Meshy gerou o Scooby** em 1,9 min, 30.688 triângulos, 1,46 MB.
  O arquivo está em `slicer-agent/comparacao/` (fora do repositório).
- **O Hi3D pelo site gerou 2.000.000 de triângulos, 95 MB** — e isso
  **quebra o nosso conversor**: `gerarModelo3mfConfigurado()` estoura com
  `Invalid string length` (limite de texto do V8) usando 2,2 GB de RAM.
  Pela API dá pra pedir `face=100000`, 20× mais leve. **Esse limite tem
  que entrar junto com a troca**, senão o botão quebra na primeira peça.

## O que trava

**São dois saldos separados.** A assinatura de R$ 49,90/mês do site
`hitem3d.ai` (500 créditos, "Plano atual") **não paga chamada de API**. A
API tem pacote próprio em `platform.hi3d.ai` → `Resource Packages`, em
dólar. Sem isso, `submit-task` responde
`{"code":30010000,"msg":"balance is not enough"}` — e recusa não cobra.

O preço por crédito é praticamente o mesmo nos dois (≈ US$ 0,02).

## A recomendação registrada

**Comprar o menor pacote de API primeiro** (~US$ 10), não o anual. Tudo
que foi aprovado até agora saiu do *site*, e o arquivo de 95 MB prova que
o site faz escolhas próprias. Ninguém verificou ainda que a *API* entrega
igual. Depois de rodar a cadeia inteira uma vez, aí sim o plano anual.

## Custo por projeto completo (gerar + cortar)

| | Gerar | Cortar | Total | ~R$ |
|---|---|---|---|---|
| `1536fast` | 10 | 20 | 30 créditos | 3,00 |
| `2048quality` | 90 | 20 | 110 créditos | 11,00 |

500 créditos dão 16 projetos completos no rápido, ou 4 no caprichado.

## A API, já mapeada

Base: `https://api.hitem3d.ai`

| Para | Endereço |
|---|---|
| Token | `POST /open-api/v1/auth/token` — `Basic base64(ak:sk)` |
| Saldo | `GET /open-api/v1/balance` |
| Gerar | `POST /open-api/v1/submit-task` — multipart |
| Consultar | `GET /open-api/v1/query-task?task_id=` |
| Cortar | `POST /open-api/v1/split/create-task` — multipart |
| Consultar corte | `GET /open-api/v1/split/query-task?task_id=` |

Gerar, para o nosso caso: `request_type=1` (só geometria — a peça sai em
`.stl` e o Rafa pinta à mão, então textura é dinheiro jogado fora),
`format=3` (stl), `face=100000`, `model=hi3dv3.0` ou `hitem3dv2.1`.

Cortar: `model=character`, `part` de `a` (6 partes) a `f` (2 partes),
`joint` entre `none`/`ball`/`dovetail`/`pin`, `merge=yes|no`, e aceita
sair direto em `.3mf` (`format=6`). Custa 20 créditos.

Duas pegadinhas anotadas da documentação: o `query-task` do corte aparece
com `Authorization: Token` em vez de `Bearer` (pode ser erro deles — vale
tentar os dois), e o `submit-task` responde **HTTP 200 mesmo recusando**,
com o erro só dentro do `code` do JSON.

Aceita ainda **2 a 4 fotos** da mesma peça (frente obrigatória), coisa que
a Meshy não faz. Hoje o sistema guarda uma foto por projeto.

## Como testar quando decidir

```
node slicer-agent/comparar-geradores.js --foto=../catalogo/assets/mini_scooby_doo.jpg
```

Roda os dois geradores na mesma foto ao mesmo tempo e mede os dois. Aceita
`--so=hi3d`, `--ignorar-saldo`, e o modelo/resolução como argumentos soltos.

## Como eu construiria

1. **Trocar o gerador** — duas funções no agente, `face=100000`, e a Meshy
   fica como alternativa ("tentar com o outro gerador") em vez de sumir.
2. **A divisão em partes** — fila nova, patch de banco e a tela das duas
   perguntas. A linguagem precisa ser combinada antes: "rabo de andorinha"
   não quer dizer nada pra uma criança de 10 anos, provavelmente vira
   desenho em vez de palavra.
