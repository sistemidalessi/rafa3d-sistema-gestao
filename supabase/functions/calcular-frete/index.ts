// Calcula as opções de frete (Correios, Jadlog etc.) pro carrinho do
// catálogo, chamando o Melhor Envio — o catálogo (que roda no navegador
// de qualquer visitante, sem login) nunca pode ter o token do Melhor
// Envio no código dele, por isso essa conta fica em segredo aqui e o
// catálogo só chama essa função.
//
// A cotação em si mora em ../_shared/frete.ts, porque o finalizar-pedido
// refaz exatamente a mesma conta pra conferir o frete que o navegador mandou.
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { cotarFrete } from "../_shared/frete.ts";

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req) => {
    if (req.method !== "POST") {
      return Response.json({ error: "Use POST." }, { status: 405 });
    }

    let corpo;
    try {
      corpo = await req.json();
    } catch {
      return Response.json({ error: "Corpo da requisição inválido." }, { status: 400 });
    }

    const cotacao = await cotarFrete(corpo.cep_destino, corpo.quantidade_itens);
    if (!cotacao.ok) {
      return Response.json({ error: cotacao.erro }, { status: cotacao.status });
    }
    return Response.json({ opcoes: cotacao.opcoes });
  }),
};
