// Fecha um pedido vindo do checkout público do catálogo: valida os
// preços de verdade no servidor (nunca confia no preço que o navegador
// manda), cria o pedido e os itens já no sistema, e devolve um código
// PIX pronto pra pagar — sem gateway nenhum, é o mesmo formato "copia e
// cola" que qualquer banco lê, gerado aqui na mão (padrão aberto do
// Banco Central, não precisa de conta em lugar nenhum pra isso).
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import webpush from "web-push";

function tlv(id: string, value: string): string {
  return id + String(value.length).padStart(2, "0") + value;
}

// Manda notificação push pra todo aparelho que ativou os avisos
// (aba "🔔 Ativar avisos" no Dashboard) — funciona mesmo com o sistema
// fechado. Se um aparelho não existe mais (celular trocado, notificação
// desativada no navegador), o Web Push devolve erro 410 e a gente
// aproveita pra limpar aquela inscrição velha.
async function avisarPedidoNovo(supabaseAdmin: any, orderNumber: string, total: number, combinar: boolean) {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT");
  if (!publicKey || !privateKey || !subject) return { motivo: "sem VAPID configurado" };
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const { data: subs, error: erroSubs } = await supabaseAdmin.from("push_subscriptions").select("*");
  if (erroSubs) return { motivo: "erro buscando inscrições", erro: erroSubs.message };
  if (!subs || !subs.length) return { motivo: "nenhuma inscrição cadastrada" };

  const payload = JSON.stringify({
    title: "🎁 Pedido novo — " + orderNumber,
    body: combinar
      ? "Cliente fechou pedido e quer combinar a entrega."
      : "Cliente fechou pedido de " + total.toFixed(2).replace(".", ",") + " — aguardando comprovante do PIX.",
    url: "./",
  });

  const resultados = [];
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      );
      resultados.push({ id: sub.id, ok: true });
    } catch (e: any) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
        resultados.push({ id: sub.id, ok: false, apagada: true, statusCode: e.statusCode });
      } else {
        resultados.push({ id: sub.id, ok: false, statusCode: e.statusCode, erro: String(e && e.message || e) });
      }
    }
  }
  return { totalInscricoes: subs.length, resultados };
}

// CRC16-CCITT (poly 0x1021, init 0xFFFF) — checksum exigido no final do
// código Pix, pra quem escaneia confirmar que não veio corrompido.
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function gerarPixCopiaECola(valor: number, txid: string): string {
  const chave = Deno.env.get("PIX_KEY") || "";
  const nome = (Deno.env.get("PIX_MERCHANT_NAME") || "").slice(0, 25);
  const cidade = (Deno.env.get("PIX_MERCHANT_CITY") || "").slice(0, 15);
  const txidLimpo = (txid.replace(/[^A-Za-z0-9]/g, "") || "***").slice(0, 25);

  const merchantAccountInfo = tlv("00", "br.gov.bcb.pix") + tlv("01", chave);
  const additionalData = tlv("05", txidLimpo);

  let payload =
    tlv("00", "01") +
    tlv("26", merchantAccountInfo) +
    tlv("52", "0000") +
    tlv("53", "986") +
    tlv("54", valor.toFixed(2)) +
    tlv("58", "BR") +
    tlv("59", nome) +
    tlv("60", cidade) +
    tlv("62", additionalData);

  payload += "6304";
  return payload + crc16(payload);
}

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ error: "Use POST." }, { status: 405 });
    }

    let corpo;
    try {
      corpo = await req.json();
    } catch {
      return Response.json({ error: "Corpo da requisição inválido." }, { status: 400 });
    }

    const itens = Array.isArray(corpo.itens) ? corpo.itens : [];
    const nomeCliente = String(corpo.nome_cliente || "").trim();
    const contatoCliente = String(corpo.contato_cliente || "").trim();
    const documentoCliente = String(corpo.documento_cliente || "").replace(/\D/g, "");
    const combinar = !!corpo.frete_combinar;

    if (!itens.length) return Response.json({ error: "Carrinho vazio." }, { status: 400 });
    if (!nomeCliente) return Response.json({ error: "Falta o nome de quem está comprando." }, { status: 400 });
    if (!contatoCliente) return Response.json({ error: "Falta um WhatsApp pra contato." }, { status: 400 });
    if (documentoCliente.length !== 11) return Response.json({ error: "CPF inválido." }, { status: 400 });
    if (!combinar && (!corpo.endereco || !corpo.endereco.cep)) {
      return Response.json({ error: "Falta o endereço de entrega." }, { status: 400 });
    }

    // Nunca confia no preço que veio do navegador — busca de novo no
    // banco, com a service key (ignora RLS, mas só lê o que já é
    // público mesmo via o site: produto ativo).
    const codigosProdutos = itens.map((it: any) => it.codigo).filter(Boolean);
    if (!codigosProdutos.length) return Response.json({ error: "Carrinho sem produtos válidos." }, { status: 400 });

    const { data: produtos, error: erroProdutos } = await ctx.supabaseAdmin
      .from("products")
      .select("id, name, catalog_code, sale_price, active")
      .in("catalog_code", codigosProdutos);
    if (erroProdutos) {
      console.error("Erro buscando produtos:", erroProdutos);
      return Response.json({ error: "Não consegui conferir os produtos agora." }, { status: 500 });
    }

    const linhas: { product_id: string; quantity: number; unit_price: number }[] = [];
    let totalProdutos = 0;
    for (const item of itens) {
      const produto = produtos.find((p: any) => p.catalog_code === item.codigo);
      const quantidade = Math.max(1, Math.min(50, parseInt(item.quantidade, 10) || 1));
      if (!produto || !produto.active) {
        return Response.json({ error: "Um dos itens do carrinho não está mais disponível." }, { status: 409 });
      }
      linhas.push({ product_id: produto.id, quantity: quantidade, unit_price: produto.sale_price });
      totalProdutos += produto.sale_price * quantidade;
    }

    const freteValor = combinar ? 0 : Math.max(0, parseFloat(corpo.frete?.preco) || 0);
    const total = totalProdutos + freteValor;
    const orderNumber = "SITE-" + Date.now().toString(36).toUpperCase();

    const dadosPedido: Record<string, unknown> = {
      order_number: orderNumber,
      order_type: "catalogo",
      status: "orcamento",
      channel: "catalogo",
      total_amount: total,
      customer_name: nomeCliente,
      customer_contact: contatoCliente,
      customer_document: documentoCliente,
      shipping_combinar: combinar,
    };
    if (!combinar) {
      const end = corpo.endereco || {};
      Object.assign(dadosPedido, {
        shipping_cep: end.cep || null,
        shipping_street: end.rua || null,
        shipping_number: end.numero || null,
        shipping_complement: end.complemento || null,
        shipping_district: end.bairro || null,
        shipping_city: end.cidade || null,
        shipping_state: end.estado || null,
        shipping_carrier: corpo.frete?.transportadora || null,
        shipping_service: corpo.frete?.servico || null,
        shipping_service_id: corpo.frete?.servico_id || null,
        shipping_price: freteValor,
        shipping_days: corpo.frete?.prazo_dias || null,
      });
    }

    const { data: pedido, error: erroPedido } = await ctx.supabaseAdmin
      .from("orders").insert(dadosPedido).select().single();
    if (erroPedido) {
      console.error("Erro criando pedido:", erroPedido);
      return Response.json({ error: "Não consegui criar o pedido agora." }, { status: 500 });
    }

    const itensParaGravar = linhas.map((l) => ({
      order_id: pedido.id, line_type: "catalog", product_id: l.product_id,
      quantity: l.quantity, unit_price: l.unit_price, line_status: "recebido",
    }));
    const { error: erroItens } = await ctx.supabaseAdmin.from("order_line_items").insert(itensParaGravar);
    if (erroItens) {
      console.error("Erro criando itens do pedido:", erroItens);
      // O pedido já existe mas ficou sem item — melhor cancelar ele do que deixar pela metade.
      await ctx.supabaseAdmin.from("orders").update({ status: "cancelado" }).eq("id", pedido.id);
      return Response.json({ error: "Não consegui salvar os itens do pedido." }, { status: 500 });
    }

    // Avisa o dono na hora, no celular — nunca deixa isso quebrar a
    // resposta pro cliente, o pedido já está criado de qualquer jeito.
    await avisarPedidoNovo(ctx.supabaseAdmin, orderNumber, total, combinar).catch((e) =>
      console.error("Erro mandando notificação push:", e));

    const whatsappNumero = Deno.env.get("WHATSAPP_NUMBER") || "";
    const mensagem = combinar
      ? `Olá! Fechei o pedido ${orderNumber} no catálogo e escolhi combinar a entrega. Podemos combinar?`
      : `Olá! Fechei o pedido ${orderNumber} no catálogo (total ${total.toFixed(2).replace(".", ",")}) e já vou pagar o PIX. Assim que pagar, mando o comprovante aqui!`;
    const whatsappUrl = "https://wa.me/" + whatsappNumero + "?text=" + encodeURIComponent(mensagem);

    return Response.json({
      pedido_numero: orderNumber,
      total,
      pix_copia_cola: combinar ? null : gerarPixCopiaECola(total, orderNumber),
      whatsapp_url: whatsappUrl,
      combinar,
    });
  }),
};
