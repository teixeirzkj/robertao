import { getRaffle, getPublicOrder, toPublicOrder, verificarPagamento } from "@/lib/raffle";
import { fail, handleError, ok } from "@/lib/api";
import { limitarOu429 } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

type Ctx = { params: Promise<{ code: string }> };

/**
 * Situação do pedido para o comprador. A página consulta este endpoint a cada
 * poucos segundos até o pagamento ser confirmado.
 *
 * Aproveita a consulta para perguntar à SyncPay se o Pix caiu — com intervalo
 * mínimo entre perguntas, definido em `verificarPagamento`. É a rede de
 * segurança: se o webhook falhar ou atrasar, o pagamento é reconhecido do
 * mesmo jeito, sem depender de ninguém bater na nossa porta.
 *
 * `?forcar=1` pula esse intervalo, para o botão "Já paguei, verificar".
 */
export async function GET(req: Request, { params }: Ctx) {
  // A própria página consulta de poucos em poucos segundos, então o teto é
  // folgado — serve contra quem tentar adivinhar códigos em massa.
  const bloqueado = await limitarOu429(req, "pedido-status", 120, 5 * 60);
  if (bloqueado) return bloqueado;

  try {
    const { code } = await params;
    const forcar = new URL(req.url).searchParams.get("forcar") === "1";

    const order = await verificarPagamento(code.trim(), { forcar });
    if (!order) {
      // Sem cobrança criada ainda, `verificarPagamento` devolve o pedido; um
      // null aqui significa que ele não existe mesmo.
      const fallback = await getPublicOrder(code.trim());
      if (!fallback) return fail("Pedido nao encontrado.", 404);
      return ok(fallback);
    }

    const raffle = await getRaffle();
    return ok(toPublicOrder(order, raffle.reservationMinutes));
  } catch (err) {
    return handleError(err);
  }
}
