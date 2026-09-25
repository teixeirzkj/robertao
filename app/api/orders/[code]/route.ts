import { getPublicOrder } from "@/lib/raffle";
import { fail, handleError, ok } from "@/lib/api";
import { limitarOu429 } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

/**
 * Situação do pedido para o comprador. A página consulta este endpoint a cada
 * poucos segundos até o pagamento ser confirmado.
 *
 * Lê apenas o nosso banco, de propósito: quem confirma o pagamento é o aviso
 * do gateway, e a documentação dele pede para não chamá-lo de volta só para
 * conferir. Então o que esta rota faz é mostrar o que o aviso já gravou.
 */
export async function GET(req: Request, { params }: Ctx) {
  // A própria página consulta de poucos em poucos segundos, então o teto é
  // folgado — serve contra quem tentar adivinhar códigos em massa.
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
