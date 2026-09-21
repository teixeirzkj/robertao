import { getOrder, getRaffle } from "@/lib/raffle";
import { criarLinkDePagamento } from "@/lib/infinitepay";
import { fail, handleError, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

/** URL publica do site, a partir do pedido (funciona na Vercel e local). */
function baseUrl(req: Request) {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Cria o link de pagamento da InfinitePay para este pedido. */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { code } = await params;
    const order = await getOrder(code.trim());
    if (!order) return fail("Pedido nao encontrado.", 404);

    if (order.status === "pago") {
      return fail("Este pedido ja foi pago.", 409);
    }
    if (order.status === "cancelado") {
      return fail("Este pedido foi cancelado.", 409);
    }

    const raffle = await getRaffle();
    const url = await criarLinkDePagamento({ raffle, order, baseUrl: baseUrl(req) });
    return ok({ url });
  } catch (err) {
    return handleError(err);
  }
}
