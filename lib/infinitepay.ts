import { RaffleError } from "@/lib/raffle";
import type { Order, Raffle } from "@/lib/types";
import { isValidPhone, normalizePhone } from "@/lib/utils";
import { webhookToken } from "@/lib/auth";

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

/** Valor mínimo aceito pelo checkout da InfinitePay (verificado na API). */
export const MINIMO_CENTAVOS = 100;

/** Traduz a recusa da InfinitePay em algo que dê para agir. */
function explicarRecusa(status: number, corpo: unknown, texto = ""): string {
  const c = (corpo ?? {}) as Record<string, any>;

  // Bloqueio de borda (Cloudflare/geo) nao vem em JSON.
  if (!corpo && (status === 403 || status === 401 || status === 429)) {
    return `A InfinitePay bloqueou a chamada do servidor (HTTP ${status}). ` +
      `Isso costuma ser bloqueio por regiao — fale com o suporte da InfinitePay. Use o Pix enquanto isso.`;
  }

  if (c.error === "external_checkout_not_enabled") {
    return (
      "O checkout externo não está habilitado na sua conta InfinitePay. " +
      "Ative em app.infinitepay.io, nas configurações do checkout."
    );
  }

  // A InfinitePay agrupa os erros por campo: { errors: { items: [...], customer: [...] } }
  const porCampo: string[] = [];
  if (c.errors && typeof c.errors === "object") {
    for (const [campo, valor] of Object.entries(c.errors as Record<string, unknown>)) {
      const lista = Array.isArray(valor) ? valor : [valor];
      for (const v of lista) porCampo.push(`${campo}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
    }
  }
  const itens: string[] = Array.isArray(c.errors?.items) ? c.errors.items : [];
  if (itens.some((e) => /total price must be greater/i.test(e))) {
    return `O pagamento online exige no mínimo ${(MINIMO_CENTAVOS / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. Escolha mais cotas.`;
  }

  const detalhe = [c.message, ...porCampo].filter(Boolean).join(" — ");
  if (detalhe) return `A InfinitePay recusou o pagamento: ${detalhe}`;

  // Sem JSON: mostra o inicio do corpo, que e o unico indicio do motivo.
  const pista = texto.replace(/<[^>]*>/g, " ").replace(/s+/g, " ").trim().slice(0, 120);
  return `A InfinitePay recusou a criação do link (HTTP ${status})${pista ? `: ${pista}` : "."}`;
}

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

  if (order.totalCents < MINIMO_CENTAVOS) {
    const minimo = (MINIMO_CENTAVOS / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    const cotasMinimas = Math.ceil(MINIMO_CENTAVOS / raffle.priceCents);
    throw new RaffleError(
      `O pagamento online começa em ${minimo}. Volte e escolha pelo menos ` +
        `${cotasMinimas} cota(s) — ou pague pelo Pix, que aceita qualquer valor.`,
      400
    );
  }

  // Pedidos antigos podem ter telefone que a InfinitePay nao aceita.
  if (!isValidPhone(order.phone)) {
    throw new RaffleError(
      `O telefone do pedido (${order.phone}) nao e um celular valido e o pagamento online o exige. ` +
        "Refaca o pedido com um celular com DDD, ou pague pelo Pix e envie o comprovante.",
      400
    );
  }

  const webhookUrl = new URL("/api/webhooks/pagamento", baseUrl);
  // Vai um token derivado deste pedido, nunca o WEBHOOK_SECRET em si: a URL
  // fica gravada em logs e no painel do gateway.
  const token = webhookToken(order.code);
  if (token) webhookUrl.searchParams.set("t", token);

  const payload = {
    handle,
    order_nsu: order.code,
    redirect_url: new URL(`/pedido/${order.code}`, baseUrl).toString(),
    webhook_url: webhookUrl.toString(),
    customer: {
      name: order.name,
      email: order.email,
      phone_number: normalizePhone(order.phone),
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
    // 4xx e erro do pedido/configuracao; 5xx e problema do lado deles.
    throw new RaffleError(explicarRecusa(res.status, corpo, texto), res.status < 500 ? 400 : 502);
  }

  const url = extrairUrl(corpo);
  if (!url) {
    console.error("[infinitepay] resposta sem url:", texto.slice(0, 500));
    throw new RaffleError("A InfinitePay respondeu sem o link de pagamento.", 502);
  }
  return url;
}
