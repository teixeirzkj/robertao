import crypto from "crypto";
import { confirmPayment, getOrder } from "@/lib/raffle";
import { fail, handleError, ok, readJson } from "@/lib/api";
import { verifyWebhookToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

/**
 * Confirmação de pagamento vinda de fora (InfinitePay via n8n, por exemplo).
 *
 * Ao receber a confirmação, o pedido é marcado como pago e **só então** as
 * cotas são sorteadas e gravadas. É idempotente: reenviar o mesmo pedido não
 * gera cotas novas, então retentativas do n8n são seguras.
 *
 * Autenticacao: a InfinitePay traz na URL um token proprio do pedido (`t`),
 * derivado do WEBHOOK_SECRET. Integracoes nossas (n8n) podem usar o segredo
 * direto, mas so pelo header `x-webhook-secret` ou pelo corpo.
 *
 *   POST /api/webhooks/pagamento
 *   { "code": "RBAB12CD", "status": "paid" }
 */
function authorized(req: Request, body: Record<string, unknown>, code: string) {
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected) return false;

  // Token proprio deste pedido, que e o que a InfinitePay recebe na URL.
  const token = new URL(req.url).searchParams.get("t");
  if (token && code) return verifyWebhookToken(code, token);

  // Segredo global: so por header ou corpo, para nao acabar em log de acesso.
  const provided = req.headers.get("x-webhook-secret") || String(body.secret ?? "");
  if (!provided) return false;
  const a = crypto.createHash("sha256").update(provided).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

const PAID = new Set(["paid", "pago", "approved", "aprovado", "succeeded", "confirmed", "success"]);

export async function POST(req: Request) {
  try {
    const body = await readJson(req);

    if (!process.env.WEBHOOK_SECRET) {
      return fail("WEBHOOK_SECRET nao configurado no servidor.", 503);
    }
    // A InfinitePay envia `order_nsu`; outros gateways usam `code`/`orderId`.
    // Precisa vir antes da autorizacao: o token da URL e derivado deste codigo.
    const code = String(
      body.order_nsu ?? body.code ?? body.orderId ?? body.order_id ?? body.reference ?? ""
    ).trim();
    if (!code) return fail("Informe o codigo do pedido em 'order_nsu' ou 'code'.");

    if (!authorized(req, body, code)) return fail("Nao autorizado.", 401);

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
