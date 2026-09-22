import { query } from "@/lib/db";

/**
 * Limite de requisicoes por chave (normalmente o IP de quem chamou).
 *
 * O contador vive no Postgres, nao em memoria: na Vercel cada requisicao pode
 * cair em uma instancia nova, e um Map local so protegeria aquela instancia —
 * quem quisesse forcar bruta a senha ou varrer CPFs so precisaria de sorte com
 * o balanceador.
 *
 * O `INSERT ... ON CONFLICT` faz incremento e renovacao da janela em uma unica
 * ida ao banco, entao duas requisicoes simultaneas nao se atropelam.
 */
export type ResultadoLimite = { permitido: boolean; restam: number; esperarSegundos: number };

export async function consumirLimite(
  chave: string,
  limite: number,
  janelaSegundos: number
): Promise<ResultadoLimite> {
  const { rows } = await query<{ count: number; reset_at: string }>(
    `INSERT INTO rate_limits (key, count, reset_at)
     VALUES ($1, 1, now() + ($2::int * interval '1 second'))
     ON CONFLICT (key) DO UPDATE SET
       count    = CASE WHEN rate_limits.reset_at < now() THEN 1 ELSE rate_limits.count + 1 END,
       reset_at = CASE WHEN rate_limits.reset_at < now()
                       THEN now() + ($2::int * interval '1 second')
                       ELSE rate_limits.reset_at END
     RETURNING count, reset_at`,
    [chave, janelaSegundos]
  );

  // Faxina eventual: sem isso a tabela so cresce, uma linha por IP que ja
  // passou pelo site. Uma vez a cada cem chamadas e barato e suficiente.
  if (Math.random() < 0.01) {
    query("DELETE FROM rate_limits WHERE reset_at < now() - interval '1 hour'").catch(() => {});
  }

  const usado = rows[0].count;
  const esperar = Math.max(
    0,
    Math.ceil((new Date(rows[0].reset_at).getTime() - Date.now()) / 1000)
  );
  return { permitido: usado <= limite, restam: Math.max(0, limite - usado), esperarSegundos: esperar };
}

/**
 * Identifica quem chamou.
 *
 * `x-vercel-forwarded-for` vem primeiro porque e a plataforma que o escreve —
 * quem chama nao consegue forjar. `x-forwarded-for` fica como alternativa para
 * outros ambientes, mas e um header que o proprio cliente pode mandar, entao
 * sozinho ele permitiria trocar de "IP" a cada requisicao e furar o limite.
 */
export function identificarCliente(req: Request): string {
  const daPlataforma = req.headers.get("x-vercel-forwarded-for");
  if (daPlataforma) return daPlataforma.split(",")[0].trim();
  const encaminhado = req.headers.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "desconhecido";
}

/**
 * Aplica o limite e devolve a resposta 429 pronta quando estourou, ou null
 * quando pode seguir. O `Retry-After` e o que faz um cliente educado esperar
 * em vez de insistir.
 */
export async function limitarOu429(
  req: Request,
  escopo: string,
  limite: number,
  janelaSegundos: number
): Promise<Response | null> {
  let r: ResultadoLimite;
  try {
    r = await consumirLimite(`${escopo}:${identificarCliente(req)}`, limite, janelaSegundos);
  } catch {
    // Se o contador falhar, nao derruba o site — mas registra, porque sem ele
    // a rota fica desprotegida.
    console.error("[rate-limit] contador indisponivel para", escopo);
    return null;
  }
  if (r.permitido) return null;
  return new Response(
    JSON.stringify({ error: "Muitas tentativas. Aguarde alguns instantes e tente de novo." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(r.esperarSegundos || janelaSegundos),
      },
    }
  );
}
