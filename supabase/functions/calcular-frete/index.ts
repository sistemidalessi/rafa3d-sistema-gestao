// Calcula as opções de frete (Correios, Jadlog etc.) pro carrinho do
// catálogo, chamando o Melhor Envio — o catálogo (que roda no navegador
// de qualquer visitante, sem login) nunca pode ter o token do Melhor
// Envio no código dele, por isso essa conta fica em segredo aqui e o
// catálogo só chama essa função.
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

// Nenhum produto tem peso/medida próprios ainda — todo mundo usa esse
// pacote-padrão por enquanto. O frete sai aproximado, não exato por peça.
const PACOTE_PADRAO = { altura_cm: 10, largura_cm: 15, comprimento_cm: 20, peso_kg: 0.3 };

const MELHOR_ENVIO_API = "https://melhorenvio.com.br/api/v2/me/shipment/calculate";

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

    const cepLimpo = String(corpo.cep_destino || "").replace(/\D/g, "");
    if (cepLimpo.length !== 8) {
      return Response.json({ error: "CEP de destino inválido." }, { status: 400 });
    }
    const qtd = Math.max(1, parseInt(corpo.quantidade_itens, 10) || 1);

    const token = Deno.env.get("MELHOR_ENVIO_TOKEN");
    const origemRaw = Deno.env.get("MELHOR_ENVIO_ORIGEM");
    if (!token || !origemRaw) {
      console.error("MELHOR_ENVIO_TOKEN ou MELHOR_ENVIO_ORIGEM não configurados.");
      return Response.json({ error: "Frete não está configurado no servidor ainda." }, { status: 500 });
    }
    const origem = JSON.parse(origemRaw);

    const melhorEnvioResp = await fetch(MELHOR_ENVIO_API, {
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

    if (!melhorEnvioResp.ok) {
      const detalhe = await melhorEnvioResp.text();
      console.error("Melhor Envio respondeu com erro:", melhorEnvioResp.status, detalhe);
      return Response.json({ error: "Não consegui calcular o frete agora. Tenta de novo em instantes." }, { status: 502 });
    }

    const cotacoes = await melhorEnvioResp.json();
    const opcoes = (Array.isArray(cotacoes) ? cotacoes : [])
      .filter((c) => !c.error && c.price)
      .map((c) => ({
        id: c.id,
        transportadora: c.company && c.company.name ? c.company.name : "",
        servico: c.name,
        preco: parseFloat(c.price),
        prazo_dias: c.delivery_time,
      }))
      .sort((a, b) => a.preco - b.preco);

    return Response.json({ opcoes });
  }),
};
