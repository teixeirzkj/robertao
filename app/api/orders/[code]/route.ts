import { getPublicOrder } from "@/lib/raffle";
import { fail, handleError, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

/**
 * Situação do pedido para o comprador. A página do pedido consulta este
 * endpoint a cada poucos segundos até o pagamento ser confirmado.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { code } = await params;
    const order = await getPublicOrder(code.trim());
    if (!order) return fail("Pedido nao encontrado.", 404);
    return ok(order);
  } catch (err) {
    return handleError(err);
  }
}
