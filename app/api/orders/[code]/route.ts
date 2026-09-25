import { getPublicOrder, getRaffle, toPublicOrder, verificarPagamento } from "@/lib/raffle";
import { fail, handleError, ok } from "@/lib/api";
import { limitarOu429 } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

/**
 * Situação do pedido para o comprador. A página consulta este endpoint a cada
 * poucos segundos até o pagamento ser confirmado.
 *
 * O caminho normal é o aviso do gateway gravar o pagamento. Esta rota ainda
 * pergunta ao gateway, espaçado, como rede de segurança: se o aviso se
 * perder, quem pagou não fica esperando sem ninguém perceber.
 *
 * `?forcar=1` pula o intervalo mínimo, para o botão "Já paguei, verificar".
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
