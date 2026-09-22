import { getOrder, getRaffle } from "@/lib/raffle";
import { criarLinkDePagamento } from "@/lib/infinitepay";
import { fail, handleError, ok } from "@/lib/api";
import { limitarOu429 } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A InfinitePay recusa chamadas vindas de fora do Brasil, e por padrao a Vercel
// roda as funcoes nos EUA. gru1 = Sao Paulo.
export const preferredRegion = "gru1";

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
  // Cada chamada cria um link na InfinitePay; nao ha porque permitir rajada.
  const bloqueado = await limitarOu429(req, "pagamento", 20, 10 * 60);
  if (bloqueado) return bloqueado;

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
