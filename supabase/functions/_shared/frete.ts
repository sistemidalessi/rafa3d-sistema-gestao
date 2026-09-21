// Cotação de frete no Melhor Envio — UM lugar só, usado por duas funções:
//   calcular-frete     mostra as opções pro cliente escolher;
//   finalizar-pedido   REFAZ a mesma cotação na hora de fechar o pedido e só
//                      aceita a opção e o preço que saírem daqui.
//
// Por que as duas usam o mesmo código (auditoria de 11/09/2026, achado r3d-01):
// até 21/09/2026 o finalizar-pedido gravava o `frete.preco` e o `servico_id`
// que o NAVEGADOR mandava. O catálogo é público — qualquer um edita o que sai
// dali — então dava pra fechar pedido com frete de 1 centavo (o PIX saía
// menor) e trocar o serviço pra um mais caro, que a gerar-etiqueta depois
// compraria com o saldo da carteira do Melhor Envio. O preço dos produtos já
// era conferido no servidor; o frete era o que faltava.
//
// Se mudar o pacote, a origem ou a regra de quantidade, muda pros dois de uma
// vez — é esse o ponto. Se as duas funções cotassem diferente, todo checkout
// daria "o valor do frete mudou".

// Nenhum produto tem peso/medida próprios ainda — todo mundo usa esse
// pacote-padrão por enquanto. O frete sai aproximado, não exato por peça.
export const PACOTE_PADRAO = { altura_cm: 10, largura_cm: 15, comprimento_cm: 20, peso_kg: 0.3 };

const MELHOR_ENVIO_API = "https://melhorenvio.com.br/api/v2/me/shipment/calculate";

export type OpcaoFrete = {
  id: number | string;
  transportadora: string;
  servico: string;
  preco: number;
  prazo_dias: number | null;
};

export type ResultadoCotacao =
  | { ok: true; opcoes: OpcaoFrete[] }
  | { ok: false; status: number; erro: string };

export function limparCep(bruto: unknown): string {
  return String(bruto ?? "").replace(/\D/g, "");
}

// qtdItens = soma das quantidades do carrinho (é o que o catálogo manda em
// `quantidade_itens` e o que o finalizar-pedido soma das linhas que validou).
export async function cotarFrete(cepDestino: unknown, qtdItens: unknown): Promise<ResultadoCotacao> {
  const cepLimpo = limparCep(cepDestino);
  if (cepLimpo.length !== 8) {
    return { ok: false, status: 400, erro: "CEP de destino inválido." };
  }
  const qtd = Math.max(1, Math.min(500, parseInt(String(qtdItens), 10) || 1));

  const token = Deno.env.get("MELHOR_ENVIO_TOKEN");
  const origemRaw = Deno.env.get("MELHOR_ENVIO_ORIGEM");
  if (!token || !origemRaw) {
    console.error("MELHOR_ENVIO_TOKEN ou MELHOR_ENVIO_ORIGEM não configurados.");
    return { ok: false, status: 500, erro: "Frete não está configurado no servidor ainda." };
  }
  const origem = JSON.parse(origemRaw);

  let resp: Response;
  try {
    resp = await fetch(MELHOR_ENVIO_API, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
        "Accept": "application/json",
        // O Melhor Envio exige um User-Agent identificando a aplicação e um contato.
        "User-Agent": "Rafa 3D Sistema de Gestão (dalessi.rafa@gmail.com)",
      },
      body: JSON.stringify({
        from: { postal_code: origem.postal_code },
        to: { postal_code: cepLimpo },
        package: {
          height: PACOTE_PADRAO.altura_cm,
          width: PACOTE_PADRAO.largura_cm,
          length: PACOTE_PADRAO.comprimento_cm,
          weight: PACOTE_PADRAO.peso_kg * qtd,
        },
      }),
    });
  } catch (e) {
    console.error("Não consegui falar com o Melhor Envio:", e);
    return { ok: false, status: 502, erro: "Não consegui calcular o frete agora. Tenta de novo em instantes." };
  }

  if (!resp.ok) {
    const detalhe = await resp.text();
    console.error("Melhor Envio respondeu com erro:", resp.status, detalhe);
    return { ok: false, status: 502, erro: "Não consegui calcular o frete agora. Tenta de novo em instantes." };
  }

  const cotacoes = await resp.json();
  const opcoes: OpcaoFrete[] = (Array.isArray(cotacoes) ? cotacoes : [])
    // deno-lint-ignore no-explicit-any
    .filter((c: any) => !c.error && c.price)
    // deno-lint-ignore no-explicit-any
    .map((c: any) => ({
      id: c.id,
      transportadora: c.company && c.company.name ? c.company.name : "",
      servico: c.name,
      preco: parseFloat(c.price),
      prazo_dias: c.delivery_time ?? null,
    }))
    .sort((a: OpcaoFrete, b: OpcaoFrete) => a.preco - b.preco);

  return { ok: true, opcoes };
}
