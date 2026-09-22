import { findPublicOrdersByDocument, getPublicOrder } from "@/lib/raffle";
import { fail, handleError, ok } from "@/lib/api";
import { limitarOu429 } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Meus numeros": pedidos de um CPF, telefone ou codigo.
 *
 * E a rota publica mais sensivel do site. CPF valido se gera por algoritmo,
 * entao sem limite alguem varreria a base inteira de compradores — por isso o
 * teto por IP, e por isso a resposta nao traz dado pessoal nenhum.
 */
export async function GET(req: Request) {
  const bloqueado = await limitarOu429(req, "lookup", 20, 60);
  if (bloqueado) return bloqueado;

  try {
    const { searchParams } = new URL(req.url);

    const code = searchParams.get("code");
    if (code) {
      const order = await getPublicOrder(code.trim());
      if (!order) return fail("Pedido nao encontrado.", 404);
      return ok({ orders: [order] });
    }

    const doc = searchParams.get("doc");
    if (!doc) return fail("Informe o CPF, telefone ou codigo do pedido.");
    return ok({ orders: await findPublicOrdersByDocument(doc) });
  } catch (err) {
    return handleError(err);
  }
}
