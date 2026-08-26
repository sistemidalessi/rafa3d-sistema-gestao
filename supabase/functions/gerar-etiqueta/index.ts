// Compra e gera a etiqueta de envio de verdade no Melhor Envio pra um
// pedido já pago. Só o dono pode chamar isso — gera custo real (sai da
// carteira do Melhor Envio). A verificação de dono é feita aqui dentro,
// validando o token de sessão de quem chamou contra profiles.role,
// sem depender de nenhum modo de auth pronto do runtime.
//
// AVISO: escrita com o máximo de cuidado possível a partir da
// documentação pública do Melhor Envio, mas nunca testada de ponta a
// ponta de verdade — a carteira do Melhor Envio está com saldo zero
// (não dá pra comprar etiqueta sem saldo). Na primeira tentativa real,
// é bem possível que algum nome de campo precise de ajuste; o erro cru
// da API do Melhor Envio é devolvido pra facilitar esse ajuste.
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const ME_API = "https://melhorenvio.com.br/api/v2/me";
const PACOTE_PADRAO = { altura_cm: 10, largura_cm: 15, comprimento_cm: 20, peso_kg: 0.3 };

// Pega o link de impressão e o código de rastreio de uma etiqueta que
// JÁ foi comprada e gerada.
//
// Duas coisas que a primeira versão errava:
//
//   mode=public, não private. O link privado exige estar logado no
//   Melhor Envio pra abrir — inútil pra quem só quer imprimir.
//
//   O rastreio vem DEPOIS de gerar, não na criação do carrinho. Lendo
//   do carrinho ele vinha sempre nulo, porque naquele momento o envio
//   ainda nem tinha sido comprado.
async function buscarEtiquetaPronta(cartItemId: string, token: string) {
  let url: string | null = null;
  let tracking: string | null = null;
  let motivo: string | null = null;

  try {
    // POST com o corpo, não GET com parâmetros na URL — é o que a
    // documentação manda, e chamar do jeito errado era o motivo real de
    // o link nunca chegar. "mode: public" porque o link privado exige
    // estar logado no Melhor Envio pra abrir.
    const impressao = await chamarMelhorEnvio("/shipment/print", token, "POST", {
      mode: "public",
      orders: [cartItemId],
    });
    url = impressao?.url || null;
    if (!url) motivo = "o Melhor Envio respondeu sem link: " + JSON.stringify(impressao).slice(0, 200);
  } catch (e) {
    // Guarda o motivo pra tela poder mostrar. Engolir o erro aqui foi o
    // que fez a primeira tentativa dizer só "não consegui agora", sem
    // dar pista nenhuma de por quê.
    const det = (e as any).detalhe;
    motivo = (e as Error).message + (det ? " — " + JSON.stringify(det).slice(0, 300) : "");
    console.error("Não consegui o link de impressão:", motivo);
  }

  try {
    const info = await chamarMelhorEnvio("/shipment/tracking", token, "POST", { orders: [cartItemId] });
    const envio = info?.[cartItemId] || (info && typeof info === "object" ? Object.values(info)[0] : null);
    tracking = (envio as any)?.tracking || (envio as any)?.self_tracking || null;
  } catch (e) {
    console.error("Não consegui o código de rastreio:", (e as Error).message);
  }

  return { url, tracking, motivo };
}

async function chamarMelhorEnvio(caminho: string, token: string, metodo: string, corpo?: unknown) {
  const resp = await fetch(ME_API + caminho, {
    method: metodo,
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "Rafa 3D Sistema de Gestão (dalessi.rafa@gmail.com)",
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await resp.text();
  let dados;
  try { dados = JSON.parse(texto); } catch { dados = texto; }
  if (!resp.ok) {
    const erro = new Error("Melhor Envio " + caminho + " falhou (" + resp.status + ")");
    (erro as any).detalhe = dados;
    throw erro;
  }
  return dados;
}

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ error: "Use POST." }, { status: 405 });
    }

    // Confere se quem chamou é o dono de verdade — valida o token de
    // sessão contra o Auth do Supabase, depois olha o papel na tabela
    // profiles. Não confia em nada que o corpo da requisição diga.
    const authHeader = req.headers.get("Authorization") || "";
    const tokenUsuario = authHeader.replace(/^Bearer\s+/i, "");
    if (!tokenUsuario) return Response.json({ error: "Não autenticado." }, { status: 401 });
    const { data: userData, error: erroUser } = await ctx.supabaseAdmin.auth.getUser(tokenUsuario);
    if (erroUser || !userData?.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });
    const { data: perfil } = await ctx.supabaseAdmin.from("profiles").select("role").eq("id", userData.user.id).single();
    if (!perfil || perfil.role !== "owner") return Response.json({ error: "Só o dono pode gerar etiqueta." }, { status: 403 });

    let corpo;
    try { corpo = await req.json(); } catch { return Response.json({ error: "Corpo inválido." }, { status: 400 }); }
    const orderId = corpo.order_id;
    if (!orderId) return Response.json({ error: "Falta o id do pedido." }, { status: 400 });

    const { data: pedido, error: erroPedido } = await ctx.supabaseAdmin.from("orders").select("*").eq("id", orderId).single();
    if (erroPedido || !pedido) return Response.json({ error: "Pedido não encontrado." }, { status: 404 });
    if (pedido.shipping_combinar) return Response.json({ error: "Esse pedido é de entrega combinada, não tem etiqueta pelo Melhor Envio." }, { status: 400 });
    // Etiqueta já gerada mas SEM o link de impressão é o caso do pedido
    // que foi comprado antes de 25/08/2026, quando o link vinha em modo
    // privado (que exige login no Melhor Envio) e acabava salvo como
    // nulo. Recuperar aqui é obrigatório: a etiqueta já foi PAGA, e
    // mandar comprar de novo seria cobrar duas vezes pelo mesmo envio.
    const precisaRecuperar = pedido.shipping_label_status === "gerada" &&
      !pedido.shipping_label_url && pedido.shipping_melhorenvio_id;
    if (pedido.shipping_label_status === "gerada" && !precisaRecuperar) {
      return Response.json({ error: "Esse pedido já tem etiqueta gerada." }, { status: 409 });
    }
    if (!pedido.shipping_service_id) return Response.json({ error: "Esse pedido não tem o serviço de frete registrado (pedido antigo, de antes dessa função existir)." }, { status: 400 });

    const { data: itens, error: erroItens } = await ctx.supabaseAdmin
      .from("order_line_items").select("quantity, unit_price, products(name)").eq("order_id", orderId);
    if (erroItens || !itens?.length) return Response.json({ error: "Não achei os itens desse pedido." }, { status: 404 });

    const token = Deno.env.get("MELHOR_ENVIO_TOKEN");
    const origemRaw = Deno.env.get("MELHOR_ENVIO_ORIGEM");
    if (!token || !origemRaw) return Response.json({ error: "Melhor Envio não está configurado no servidor." }, { status: 500 });
    const origem = JSON.parse(origemRaw);

    const qtdTotal = itens.reduce((s: number, it: any) => s + it.quantity, 0);

    // Recuperação: a etiqueta já existe e já foi paga, só falta o link.
    // Não passa por carrinho, checkout nem generate — nada é comprado.
    if (precisaRecuperar) {
      const { url, tracking, motivo } = await buscarEtiquetaPronta(pedido.shipping_melhorenvio_id, token);
      if (!url) {
        // O motivo vai junto: sem ele, a tela dizia "tente de novo" pra
        // um erro que não passava com tentativa nenhuma.
        return Response.json({
          error: "A etiqueta existe no Melhor Envio, mas não consegui o link de impressão.",
          detalhe: motivo || "sem detalhe",
        }, { status: 502 });
      }
      await ctx.supabaseAdmin.from("orders").update({
        shipping_label_url: url,
        shipping_tracking_code: tracking ?? pedido.shipping_tracking_code,
        updated_at: new Date().toISOString(),
      }).eq("id", orderId);
      return Response.json({ ok: true, recuperada: true, tracking, label_url: url });
    }

    try {
      const carrinho = await chamarMelhorEnvio("/cart", token, "POST", {
        service: pedido.shipping_service_id,
        from: {
          name: "Rafa 3D Dalessi",
          postal_code: origem.postal_code,
          address: origem.address,
          number: origem.number,
          district: origem.district,
          city: origem.city,
          state_abbr: origem.state_abbr,
        },
        to: {
          name: pedido.customer_name,
          document: pedido.customer_document,
          phone: (pedido.customer_contact || "").replace(/\D/g, ""),
          postal_code: (pedido.shipping_cep || "").replace(/\D/g, ""),
          address: pedido.shipping_street,
          number: pedido.shipping_number,
          complement: pedido.shipping_complement || undefined,
          district: pedido.shipping_district,
          city: pedido.shipping_city,
          state_abbr: pedido.shipping_state,
        },
        products: itens.map((it: any) => ({
          name: it.products?.name || "Peça impressa em 3D",
          quantity: it.quantity,
          unitary_value: it.unit_price,
        })),
        volumes: [{
          height: PACOTE_PADRAO.altura_cm,
          width: PACOTE_PADRAO.largura_cm,
          length: PACOTE_PADRAO.comprimento_cm,
          weight: PACOTE_PADRAO.peso_kg * qtdTotal,
        }],
        options: { insurance_value: pedido.total_amount, receipt: false, own_hand: false, non_commercial: true },
      });

      const cartItemId = carrinho.id;
      await chamarMelhorEnvio("/shipment/checkout", token, "POST", { orders: [cartItemId] });
      await chamarMelhorEnvio("/shipment/generate", token, "POST", { orders: [cartItemId] });

      const { url, tracking } = await buscarEtiquetaPronta(cartItemId, token);

      await ctx.supabaseAdmin.from("orders").update({
        shipping_label_status: "gerada",
        shipping_label_error: null,
        shipping_tracking_code: tracking,
        shipping_label_url: url,
        shipping_melhorenvio_id: cartItemId,
        updated_at: new Date().toISOString(),
      }).eq("id", orderId);

      return Response.json({ ok: true, tracking, label_url: url });
    } catch (e: any) {
      console.error("Erro gerando etiqueta:", e.message, e.detalhe);
      await ctx.supabaseAdmin.from("orders").update({
        shipping_label_status: "erro",
        shipping_label_error: (e.message || "erro desconhecido") + (e.detalhe ? " — " + JSON.stringify(e.detalhe) : ""),
        updated_at: new Date().toISOString(),
      }).eq("id", orderId);
      return Response.json({ error: "Não consegui gerar a etiqueta.", detalhe: e.detalhe || e.message }, { status: 502 });
    }
  }),
};
