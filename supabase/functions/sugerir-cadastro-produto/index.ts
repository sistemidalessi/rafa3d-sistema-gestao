// Olha a foto (e o nome) de um produto novo e sugere duas coisas que
// hoje ficam por conta do Rafael decidir sozinho, com 10 anos: em qual
// categoria do catálogo ela entra, e como descrever o tamanho dela —
// nem toda peça tem "altura" como medida que importa (um porta-anel
// baixo e largo, por exemplo, é melhor descrito pela largura ou pelo
// diâmetro).
//
// Não mexe no banco — só recebe a foto, chama a IA, devolve a
// sugestão. Quem decide o que fazer com ela é a tela (o Rafael
// continua podendo trocar tudo).
//
// As categorias são fixas no código, não vêm do banco. A lista abaixo
// precisa ficar igual à de CATEGORY_LABELS no index.html — e ela é só
// UM dos CINCO lugares onde uma categoria vive (o resto está no
// CLAUDE.md, em "Categoria do catálogo vive em CINCO lugares").
//
// ⚠️ E esta aqui só vale depois de `supabase functions deploy` — não
// sobe com git push. Sem o deploy, a IA nunca sugere a categoria nova.
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const CATEGORIAS: Record<string, string> = {
  products: "Vasos & Decoração",
  cars: "Brinquedos & Expositores",
  holders: "Porta Cards",
  utils: "Suportes & Utilidades",
  wines: "Bar & Vinhos",
  keychains: "Chaveiros",
  phoneStands: "Suportes para Celular",
  deskOrganizers: "Organizadores de Mesa",
  books: "Livros & Leitura",
  minis: "Miniaturas & Personagens",
  garden: "Jardim & Externos",
  jewelry: "Porta Joias",
  signs: "Placas & Quadros",
};

const listaCategorias = Object.entries(CATEGORIAS)
  .map(([chave, nome]) => `"${chave}" = ${nome}`)
  .join("\n");

const PROMPT = `Você ajuda a cadastrar um produto novo numa loja de peças impressas em 3D. ` +
  `Olhe a foto do produto (nome dado pelo lojista: "{NOME}") e responda SÓ com um JSON, sem texto ` +
  `antes nem depois, exatamente neste formato:\n\n` +
  `{\n` +
  `  "categoria": "uma das chaves da lista abaixo",\n` +
  `  "boa_correspondencia": true ou false,\n` +
  `  "nota_categoria": "uma frase curta explicando a escolha, ou dizendo que nenhuma categoria encaixa bem e qual é a mais próxima",\n` +
  `  "tamanho_sugerido": "uma descrição curta e concreta do tamanho, tipo \\"18cm de altura\\" ou \\"9 × 9cm\\" ou \\"12cm de diâmetro\\" — escolha a MEDIDA QUE MAIS AJUDA o cliente a entender o tamanho real dessa peça específica, não sempre a altura. Se a peça for baixa e larga, largura ou diâmetro importam mais que altura. Não invente um número exato — se não der pra estimar direito pela foto, deixe uma faixa aproximada ou o formato sem número (ex: \\"cabe na palma da mão\\")."\n` +
  `}\n\n` +
  `Categorias disponíveis:\n${listaCategorias}\n\n` +
  `"boa_correspondencia" é false quando a peça realmente não se parece com nada da lista (ex: utensílio de cozinha, ` +
  `luminária, peça para pet) — nesse caso ainda escolha a categoria mais parecida em "categoria", mas avise em "nota_categoria" ` +
  `que talvez valha criar uma categoria nova pra esse tipo de peça.`;

function extrairJSON(texto: string): any {
  const semCerca = texto.replace(/```json\s*|```/gi, "").trim();
  const inicio = semCerca.indexOf("{");
  const fim = semCerca.lastIndexOf("}");
  if (inicio === -1 || fim === -1) throw new Error("resposta da IA não trouxe um JSON reconhecível");
  return JSON.parse(semCerca.slice(inicio, fim + 1));
}

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ error: "Use POST." }, { status: 405 });
    }

    // Só gente logada no sistema (dono ou ajudante) — não é uma tela
    // pública, e cada chamada custa um pouquinho de verdade na API da
    // Anthropic.
    const authHeader = req.headers.get("Authorization") || "";
    const tokenUsuario = authHeader.replace(/^Bearer\s+/i, "");
    if (!tokenUsuario) return Response.json({ error: "Não autenticado." }, { status: 401 });
    const { data: userData, error: erroUser } = await ctx.supabaseAdmin.auth.getUser(tokenUsuario);
    if (erroUser || !userData?.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });

    let corpo;
    try { corpo = await req.json(); } catch { return Response.json({ error: "Corpo inválido." }, { status: 400 }); }

    const nome = String(corpo.nome || "").trim();
    const imagemBase64 = String(corpo.imagem_base64 || "");
    const mediaType = String(corpo.media_type || "image/jpeg");
    if (!nome) return Response.json({ error: "Falta o nome do produto." }, { status: 400 });
    if (!imagemBase64) return Response.json({ error: "Falta a foto do produto." }, { status: 400 });

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY não configurada.");
      return Response.json({ error: "Sugestão por IA não está configurada no servidor ainda." }, { status: 500 });
    }

    const respAnthropic = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imagemBase64 } },
            { type: "text", text: PROMPT.replace("{NOME}", nome) },
          ],
        }],
      }),
    });

    if (!respAnthropic.ok) {
      const detalhe = await respAnthropic.text();
      console.error("Anthropic respondeu com erro:", respAnthropic.status, detalhe);
      return Response.json({ error: "Não consegui pedir a sugestão agora. Tenta de novo em instantes." }, { status: 502 });
    }

    const dadosResposta = await respAnthropic.json();
    const textoResposta = (dadosResposta.content || []).map((b: any) => b.text || "").join("");

    let sugestao;
    try {
      sugestao = extrairJSON(textoResposta);
    } catch (e) {
      console.error("Não consegui ler o JSON da IA:", (e as Error).message, textoResposta.slice(0, 500));
      return Response.json({ error: "A IA respondeu num formato que não entendi. Tenta de novo." }, { status: 502 });
    }

    if (!CATEGORIAS[sugestao.categoria]) {
      console.error("Categoria sugerida não existe:", sugestao.categoria);
      return Response.json({ error: "A IA sugeriu uma categoria que não existe no catálogo." }, { status: 502 });
    }

    return Response.json({
      categoria: sugestao.categoria,
      boa_correspondencia: sugestao.boa_correspondencia !== false,
      nota_categoria: String(sugestao.nota_categoria || ""),
      tamanho_sugerido: String(sugestao.tamanho_sugerido || ""),
    });
  }),
};
