import { findOrdersByDocument, getOrder } from "@/lib/raffle";
import { fail, handleError, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    if (code) {
      const order = await getOrder(code.trim());
      if (!order) return fail("Pedido nao encontrado.", 404);
      return ok({ orders: [order] });
    }

    const doc = searchParams.get("doc");
    if (!doc) return fail("Informe o CPF, telefone ou codigo do pedido.");
    return ok({ orders: await findOrdersByDocument(doc) });
  } catch (err) {
    return handleError(err);
  }
}
