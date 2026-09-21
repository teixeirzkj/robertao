import crypto from "crypto";
import { confirmPayment, getOrder } from "@/lib/raffle";
import { fail, handleError, ok, readJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Confirmação de pagamento vinda de fora (InfinitePay via n8n, por exemplo).
 *
 * Ao receber a confirmação, o pedido é marcado como pago e **só então** as
 * cotas são sorteadas e gravadas. É idempotente: reenviar o mesmo pedido não
 * gera cotas novas, então retentativas do n8n são seguras.
 *
 * Requer o segredo em `WEBHOOK_SECRET`, enviado no header
 * `x-webhook-secret` ou no campo `secret` do corpo.
 *
 *   POST /api/webhooks/pagamento
 *   { "code": "RBAB12CD", "status": "paid" }
 */
function authorized(req: Request, body: Record<string, unknown>) {
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected) return false;
  const provided =
    req.headers.get("x-webhook-secret") ||
    new URL(req.url).searchParams.get("secret") ||
    String(body.secret ?? "");
  if (!provided) return false;
  const a = Buffer.from(crypto.createHash("sha256").update(provided).digest());
  const b = Buffer.from(crypto.createHash("sha256").update(expected).digest());
  return crypto.timingSafeEqual(a, b);
}

const PAID = new Set(["paid", "pago", "approved", "aprovado", "succeeded", "confirmed", "success"]);

export async function POST(req: Request) {
  try {
    const body = await readJson(req);

    if (!process.env.WEBHOOK_SECRET) {
      return fail("WEBHOOK_SECRET nao configurado no servidor.", 503);
    }
    if (!authorized(req, body)) return fail("Nao autorizado.", 401);

    // A InfinitePay envia `order_nsu`; outros gateways usam `code`/`orderId`.
    const code = String(
      body.order_nsu ?? body.code ?? body.orderId ?? body.order_id ?? body.reference ?? ""
    ).trim();
    if (!code) return fail("Informe o codigo do pedido em 'order_nsu' ou 'code'.");

    // A InfinitePay so chama o webhook quando o pagamento e aprovado e nao
    // envia campo de status, por isso o padrao e "paid".
    const status = String(body.status ?? "paid").toLowerCase();
    if (!PAID.has(status)) {
      return ok({ ignored: true, reason: "status '" + status + "' nao indica pagamento" });
    }

    // Confere o valor pago, para ninguem liberar cotas pagando menos.
    const pago = Number(body.paid_amount ?? body.amount ?? NaN);
    if (Number.isFinite(pago)) {
      const pedido = await getOrder(code);
      if (!pedido) return fail("Pedido nao encontrado.", 404);
      if (Math.round(pago) < pedido.totalCents) {
        console.error(
          "[webhook] valor pago abaixo do pedido",
          pedido.code,
          pago,
          pedido.totalCents
        );
        return fail("Valor pago menor que o total do pedido.", 409);
      }
    }

    const order = await confirmPayment(code);
    return ok({
      code: order.code,
      status: order.status,
      quantity: order.quantity,
      numbers: order.numbers,
      prizes: order.prizes,
      receiptUrl: body.receipt_url ?? null,
    });
  } catch (err) {
    return handleError(err);
  }
}
