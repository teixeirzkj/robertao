import { getPublicOrder } from "@/lib/raffle";
import { fail, handleError, ok } from "@/lib/api";
import { limitarOu429 } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

/**
 * Situação do pedido para o comprador. A página do pedido consulta este
 * endpoint a cada poucos segundos até o pagamento ser confirmado.
 */
export async function GET(req: Request, { params }: Ctx) {
  // A propria pagina consulta de poucos em poucos segundos, entao o teto e
  // folgado — serve so contra quem tentar adivinhar codigos em massa.
  const bloqueado = await limitarOu429(req, "pedido-status", 120, 5 * 60);
  if (bloqueado) return bloqueado;

  try {
    const { code } = await params;
    const order = await getPublicOrder(code.trim());
    if (!order) return fail("Pedido nao encontrado.", 404);
    return ok(order);
  } catch (err) {
    return handleError(err);
  }
}
