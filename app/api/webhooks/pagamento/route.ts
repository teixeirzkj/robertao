import crypto from "crypto";
import { getOrder, getOrderByPaymentId, verificarPagamento } from "@/lib/raffle";
import { after } from "next/server";
import { fail, handleError, ok, readJson } from "@/lib/api";
import { verifyWebhookToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

/**
 * Aviso de mudanca de pagamento, vindo da SyncPay (ou do n8n).
 *
 * O corpo desta chamada NAO confirma nada. A SyncPay nao documenta o formato
 * do payload nem como assinar, entao tratamos o webhook apenas como um "olhe
 * de novo": achamos o pedido e perguntamos o status para a propria SyncPay.
 * Assim, uma chamada forjada nao libera cota — no maximo faz o servidor
 * consultar uma transacao que nao foi paga.
 *
 * Idempotente: reenviar o mesmo aviso nao sorteia cotas de novo.
 */

/**
 * Autoriza a chamada ANTES de qualquer ida ao banco.
 *
 * A URL registrada na SyncPay carrega o codigo do pedido (`c`) e um HMAC dele
 * (`t`), entao da para conferir a assinatura sem consultar nada. Isso importa:
 * se a busca viesse primeiro, as respostas diferentes para pedido existente e
 * inexistente contariam a quem chutasse quais codigos existem.
 *
 * Integracoes nossas (n8n) usam o segredo global, mas so por header ou corpo
 * — na query ele acabaria em log de acesso.
 */
function autorizar(req: Request, body: Record<string, unknown>): { ok: boolean; code: string } {
  const esperado = process.env.WEBHOOK_SECRET;
  if (!esperado) return { ok: false, code: "" };

  const params = new URL(req.url).searchParams;
  const code = (params.get("c") ?? "").trim();
  const token = params.get("t") ?? "";
  if (code && token) return { ok: verifyWebhookToken(code, token), code };

  const enviado = req.headers.get("x-webhook-secret") || String(body.secret ?? "");
  if (!enviado) return { ok: false, code: "" };
  const a = crypto.createHash("sha256").update(enviado).digest();
  const b = crypto.createHash("sha256").update(esperado).digest();
  return { ok: crypto.timingSafeEqual(a, b), code: "" };
}

/** Acha o pedido pelo que o aviso trouxer: codigo nosso ou UUID da SyncPay. */
async function acharPedido(body: Record<string, unknown>, codeDaUrl: string) {
  if (codeDaUrl) {
    const porCodigo = await getOrder(codeDaUrl);
    if (porCodigo) return porCodigo;
  }

  const dados = (body.data ?? body) as Record<string, unknown>;
  const identifier = String(
    dados.id ?? dados.identifier ?? dados.reference_id ?? dados.transaction_id ?? body.identifier ?? ""
  ).trim();
  if (identifier) {
    const porPagamento = await getOrderByPaymentId(identifier);
    if (porPagamento) return porPagamento;
  }

  const code = String(
    body.code ?? body.order_nsu ?? body.orderId ?? body.order_id ?? body.reference ?? ""
  ).trim();
  if (code) return await getOrder(code);

  return null;
}

export async function POST(req: Request) {
  try {
    const body = await readJson(req);

    if (!process.env.WEBHOOK_SECRET) {
      return fail("WEBHOOK_SECRET nao configurado no servidor.", 503);
    }

    const auth = autorizar(req, body);
    if (!auth.ok) return fail("Nao autorizado.", 401);

    const pedido = await acharPedido(body, auth.code);
    // Aqui so chega quem ja passou pela assinatura, entao dizer que o pedido
    // nao existe nao entrega nada — e evita a SyncPay reenviar para sempre.
    if (!pedido) return ok({ ignorado: true, motivo: "pedido nao encontrado" });

    // A SyncPay corta o webhook em 5 segundos, e conferir o pagamento significa
    // uma ida ate ela mais o sorteio das cotas em transacao — pode nao caber.
    // Entao respondemos ja e fazemos o trabalho depois da resposta: quem decide
    // se foi pago continua sendo a SyncPay, respondendo a nossa consulta.
    after(async () => {
      try {
        await verificarPagamento(pedido.id, { forcar: true });
      } catch (err) {
        // A pagina do pedido consulta sozinha de poucos em poucos segundos,
        // entao uma falha aqui atrasa a confirmacao, nao a perde.
        console.error("[webhook] confirmacao falhou para", pedido.code, err);
      }
    });

    return ok({ recebido: true, code: pedido.code });
  } catch (err) {
    return handleError(err);
  }
}
