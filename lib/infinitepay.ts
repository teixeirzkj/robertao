import { RaffleError } from "@/lib/raffle";
import type { Order, Raffle } from "@/lib/types";

/**
 * Link de pagamento da InfinitePay (Checkout API).
 *
 * POST https://api.checkout.infinitepay.io/links
 *   { handle, items[{quantity, price(centavos), description}],
 *     order_nsu, redirect_url, webhook_url, customer }
 *
 * Depois do pagamento a InfinitePay:
 *  - chama `webhook_url` com { order_nsu, paid_amount, capture_method, ... };
 *  - devolve o comprador para `redirect_url` com os mesmos dados na query.
 *
 * Docs: https://www.infinitepay.io/checkout-documentacao
 */
const ENDPOINT = "https://api.checkout.infinitepay.io/links";

/** A resposta nao e documentada, entao aceitamos os nomes de campo plausiveis. */
function extrairUrl(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const raiz = body as Record<string, unknown>;
  const candidatos = [
    raiz.url,
    raiz.link,
    raiz.checkout_url,
    raiz.payment_url,
    (raiz.data as Record<string, unknown> | undefined)?.url,
    (raiz.data as Record<string, unknown> | undefined)?.link,
  ];
  for (const c of candidatos) {
    if (typeof c === "string" && /^https?:\/\//.test(c)) return c;
  }
  return null;
}

export async function criarLinkDePagamento({
  raffle,
  order,
  baseUrl,
}: {
  raffle: Raffle;
  order: Order;
  baseUrl: string;
}): Promise<string> {
  const handle = raffle.infinitepayHandle.trim().replace(/^\$/, "");
  if (!handle) {
    throw new RaffleError(
      "O pagamento online ainda nao foi configurado. Use o Pix ou fale com a organizacao.",
      503
    );
  }

  const webhookUrl = new URL("/api/webhooks/pagamento", baseUrl);
  // A InfinitePay nao envia headers nossos, entao o segredo vai na query.
  if (process.env.WEBHOOK_SECRET) {
    webhookUrl.searchParams.set("secret", process.env.WEBHOOK_SECRET);
  }

  const payload = {
    handle,
    order_nsu: order.code,
    redirect_url: new URL(`/pedido/${order.code}`, baseUrl).toString(),
    webhook_url: webhookUrl.toString(),
    customer: {
      name: order.name,
      email: order.email,
      phone_number: order.phone.replace(/\D+/g, ""),
    },
    items: [
      {
        quantity: 1,
        price: order.totalCents,
        description: `${order.quantity} cota(s) — ${raffle.title}`,
      },
    ],
  };

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new RaffleError("Nao conseguimos falar com a InfinitePay. Tente de novo.", 502);
  }

  const texto = await res.text();
  let corpo: unknown = null;
  try {
    corpo = JSON.parse(texto);
  } catch {
    /* resposta nao-JSON */
  }

  if (!res.ok) {
    console.error("[infinitepay]", res.status, texto.slice(0, 500));
    throw new RaffleError(
      "A InfinitePay recusou a criacao do link de pagamento. Confira a InfiniteTag na aba Rifa.",
      502
    );
  }

  const url = extrairUrl(corpo);
  if (!url) {
    console.error("[infinitepay] resposta sem url:", texto.slice(0, 500));
    throw new RaffleError("A InfinitePay respondeu sem o link de pagamento.", 502);
  }
  return url;
}
