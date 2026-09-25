import { confirmarPagamentoPorAviso } from "@/lib/raffle";
import { fail, handleError, ok, readJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// O gateway e brasileiro; sair dos EUA evita latencia e bloqueio por regiao.
export const preferredRegion = "gru1";

/**
 * Aviso de pagamento do gateway (SigiloPay).
 *
 *   { event: "TRANSACTION_PAID", token, transaction: { identifier, status, amount } }
 *
 * Aqui o aviso E a confirmacao: a documentacao do gateway pede para nao
 * chamar de volta so para conferir o evento. Quem sustenta a seguranca e o
 * `token`, que nasce junto com a cobranca e vale so para aquele pedido —
 * guardamos o nosso e comparamos em tempo constante.
 *
 * O `transaction.identifier` e o codigo do pedido que nos mesmos enviamos ao
 * criar a cobranca, entao nao ha mapeamento a manter.
 *
 * Idempotente: reenviar o mesmo aviso nao sorteia cotas de novo.
 */
const EVENTO_PAGO = "TRANSACTION_PAID";
const STATUS_PAGO = "COMPLETED";

export async function POST(req: Request) {
  try {
    const body = await readJson(req);

    const evento = String(body.event ?? "").toUpperCase();
    if (evento !== EVENTO_PAGO) {
      // Outros eventos nao mexem em cota; responder 200 evita reenvio eterno.
      return ok({ ignorado: true, motivo: `evento "${evento || "vazio"}" nao tratado` });
    }

    const transacao = (body.transaction ?? {}) as Record<string, unknown>;
    const code = String(transacao.identifier ?? "").trim();
    const token = String(body.token ?? "");
    if (!code || !token) return fail("Nao autorizado.", 401);

    const status = String(transacao.status ?? "").toUpperCase();
    if (status && status !== STATUS_PAGO) {
      return ok({ ignorado: true, motivo: `status "${status}" nao indica pagamento` });
    }

    // O valor vem em reais, na moeda de recebimento do produtor.
    const valor = Number(transacao.amount);
    const valorCentavos = Number.isFinite(valor) ? Math.round(valor * 100) : null;

    const r = await confirmarPagamentoPorAviso({ code, token, valorCentavos });

    if (!r.ok) {
      // Token errado e a unica recusa que merece 401; o resto o gateway nao
      // resolve reenviando. Nao registramos o token nem o codigo em log.
      if (r.motivo === "token invalido") {
        console.error("[webhook] token invalido");
        return fail("Nao autorizado.", 401);
      }
      console.error("[webhook] aviso recusado:", r.motivo);
      return ok({ ignorado: true, motivo: r.motivo });
    }

    return ok({ code: r.order?.code, status: r.order?.status });
  } catch (err) {
    return handleError(err);
  }
}
