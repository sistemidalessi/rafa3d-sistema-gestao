// Limite de requisições do checkout público (auditoria de 11/09/2026, achado
// r3d-02). O contador mora no banco (tabela limite_checkout, patch 58) e só a
// service_role alcança — por isso recebe o ctx.supabaseAdmin.
//
// REGRA DE OURO: limite NUNCA derruba uma venda honesta. Se a função SQL não
// existir (patch não rodou), se o banco demorar ou der erro, deixa passar e
// loga. O custo de um falso "bloqueado" é uma venda perdida; o de um falso
// "liberado" é uma requisição a mais.

// IP real de quem chamou. O Supabase coloca o IP do cliente em x-forwarded-for;
// quando há mais de um, o PRIMEIRO é o do cliente (o resto são proxies do
// próprio Supabase/Cloudflare). Sem cabeçalho, agrupa tudo em "sem-ip" — ruim,
// mas não quebra.
export function ipDe(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  const ip = xff.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "";
  return (ip || "sem-ip").slice(0, 64);
}

export async function sha256Curto(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf)).slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// true = pode seguir; false = estourou o limite (responder 429).
// deno-lint-ignore no-explicit-any
export async function cabeNoLimite(supabaseAdmin: any, chave: string, limite: number, janelaS: number): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin.rpc("limite_checkout_tentar", {
      p_chave: chave, p_limite: limite, p_janela_s: janelaS,
    });
    if (error) {
      console.error("limite_checkout_tentar falhou (deixando passar):", error.message);
      return true;
    }
    return data !== false;
  } catch (e) {
    console.error("limite_checkout_tentar exceção (deixando passar):", e);
    return true;
  }
}

export const RESPOSTA_429 = (msg: string) =>
  Response.json({ error: msg }, { status: 429, headers: { "Retry-After": "600" } });
