import crypto from "crypto";
import { RaffleError } from "@/lib/raffle";
import type { Order } from "@/lib/types";
import { onlyDigits } from "@/lib/utils";

/**
 * Cobranca Pix pelo Mercado Pago (API de Orders).
 *
 *   POST /v1/orders
 *     headers: Authorization: Bearer <access token>, X-Idempotency-Key
 *     body:    { type, total_amount, external_reference, processing_mode,
 *                transactions:{ payments:[{ amount, payment_method:{id:"pix"} }] },
 *                payer:{ email } }
 *     -> transactions.payments[0].payment_method.qr_code  (copia-e-cola)
 *
 * Tres diferencas em relacao aos gateways anteriores:
 *
 *  - os valores viajam como STRING ("3.60"), nao como numero;
 *  - `external_reference` e o nosso codigo de pedido e volta na consulta, entao
 *    nao ha mapeamento a manter;
 *  - o aviso de pagamento e assinado de verdade (HMAC-SHA256 sobre um manifesto
 *    com id, request-id e timestamp), e traz apenas um id — o status a gente
 *    busca na API. Isso e melhor do que confiar no corpo do aviso.
 *
 * Docs: mercadopago.com.br/developers — Checkout API (Orders) / Pix
 */
const HOST = process.env.MERCADOPAGO_HOST || "https://api.mercadopago.com";
const TIMEOUT_MS = 20_000;

/** Quanto tempo o codigo Pix vale. Cabe dentro da reserva de 60 minutos. */
const EXPIRACAO = "PT30M";

export function mercadopagoConfigurado() {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
}

function token() {
  const t = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!t) {
    throw new RaffleError(
      "O pagamento ainda nao foi configurado. Fale com a organizacao da rifa.",
      503
    );
  }
  return t;
}

async function pedirJson(
  caminho: string,
  init: RequestInit
): Promise<{ res: Response; corpo: any }> {
  let res: Response;
  try {
    res = await fetch(`${HOST}${caminho}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...init.headers,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new RaffleError("Nao conseguimos falar com o gateway. Tente de novo em instantes.", 502);
  }
  const texto = await res.text();
  let corpo: any = null;
  try {
    corpo = JSON.parse(texto);
  } catch {
    /* resposta nao-JSON */
  }
  if (!res.ok) console.error("[mercadopago]", init.method, caminho, res.status, texto.slice(0, 400));
  return { res, corpo };
}

/** Traduz a recusa em algo que de para agir. */
function explicarRecusa(status: number, corpo: any): string {
  if (status === 401 || status === 403) {
    return "As credenciais do gateway foram recusadas. Confira MERCADOPAGO_ACCESS_TOKEN.";
  }
  const causas: string[] = [];
  for (const c of corpo?.cause ?? corpo?.errors ?? []) {
    const d = c?.description ?? c?.message ?? c?.code;
    if (d) causas.push(String(d));
  }
  const detalhe = [corpo?.message, ...causas].filter(Boolean).join(" — ");
  if (detalhe) return `O gateway recusou a cobranca: ${detalhe}`;
  return `O gateway recusou a cobranca (HTTP ${status}).`;
}

/** Reais com duas casas, como string — o formato que a API exige. */
function emReais(centavos: number) {
  return (centavos / 100).toFixed(2);
}

export type CobrancaPix = {
  /** Id da Order no gateway. */
  orderId: string;
  pixCode: string;
  expiresAt: string | null;
};

export async function criarCobrancaPix({
  order,
  descricao,
}: {
  order: Order;
  descricao: string;
}): Promise<CobrancaPix> {
  const valor = emReais(order.totalCents);
  const [nome, ...resto] = order.name.trim().split(/\s+/);

  const { res, corpo } = await pedirJson("/v1/orders", {
    method: "POST",
    // Impede cobranca duplicada se a chamada for repetida: mesma chave, mesma
    // Order. A chave e o pedido, entao duas abas nao geram dois Pix.
    headers: { "X-Idempotency-Key": `pedido-${order.code}` },
    body: JSON.stringify({
      type: "online",
      processing_mode: "automatic",
      total_amount: valor,
      // Volta na consulta e no aviso: e por aqui que reconhecemos o pedido.
      external_reference: order.code,
      transactions: {
        payments: [
          {
            amount: valor,
            payment_method: { id: "pix", type: "bank_transfer" },
            expiration_time: EXPIRACAO,
          },
        ],
      },
      payer: {
        email: order.email,
        first_name: nome,
        last_name: resto.join(" ") || nome,
        identification: { type: "CPF", number: onlyDigits(order.cpf) },
      },
      description: descricao.slice(0, 255),
    }),
  });

  if (!res.ok) {
    throw new RaffleError(explicarRecusa(res.status, corpo), res.status < 500 ? 400 : 502);
  }

  const pagamento = corpo?.transactions?.payments?.[0];
  const pixCode = pagamento?.payment_method?.qr_code;
  if (!pixCode || !corpo?.id) {
    console.error("[mercadopago] resposta sem qr_code:", JSON.stringify(corpo).slice(0, 400));
    throw new RaffleError("O gateway respondeu sem o codigo Pix.", 502);
  }

  return {
    orderId: String(corpo.id),
    pixCode: String(pixCode),
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
  };
}

/* ----------------------------------------------------------------- status */

/** Status que significam "o dinheiro entrou". */
const PAGO = new Set(["processed", "approved", "accredited", "paid"]);

export type SituacaoPagamento = {
  pago: boolean;
  status: string;
  valorCentavos: number | null;
};

function lerSituacao(corpo: any): SituacaoPagamento {
  const pagamento = corpo?.transactions?.payments?.[0] ?? {};
  // A Order fica "processed" quando o pagamento entra; o pagamento em si vira
  // "processed"/"approved". Olhamos os dois, porque os nomes variam entre a
  // API de Orders e a de Pagamentos.
  const status = String(pagamento.status ?? corpo?.status ?? "").toLowerCase();
  const valor = Number(pagamento.amount ?? corpo?.total_amount);
  return {
    pago: PAGO.has(status),
    status,
    valorCentavos: Number.isFinite(valor) ? Math.round(valor * 100) : null,
  };
}

/** Le a situacao de uma Order pelo id dela. */
export async function consultarOrder(orderId: string): Promise<SituacaoPagamento | null> {
  const { res, corpo } = await pedirJson(`/v1/orders/${encodeURIComponent(orderId)}`, {
    method: "GET",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new RaffleError(`Nao foi possivel consultar o pagamento (HTTP ${res.status}).`, 502);
  }
  return lerSituacao(corpo);
}

/* -------------------------------------------------------------- webhook */

/**
 * Confere a assinatura do aviso.
 *
 * O Mercado Pago manda `x-signature: ts=<numero>,v1=<hash>` e assina o
 * manifesto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` com HMAC-SHA256
 * usando a chave secreta do webhook. Diferente dos gateways anteriores, aqui
 * a assinatura e de verdade — um aviso forjado nao passa.
 *
 * Partes ausentes saem do manifesto, e a comparacao e em tempo constante.
 */
export function assinaturaValida(req: Request, dataId: string): boolean {
  const segredo = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!segredo) return false;

  const cabecalho = req.headers.get("x-signature");
  if (!cabecalho) return false;

  let ts = "";
  let v1 = "";
  for (const parte of cabecalho.split(",")) {
    const [chave, valor] = parte.split("=").map((s) => s?.trim());
    if (chave === "ts") ts = valor ?? "";
    if (chave === "v1") v1 = valor ?? "";
  }
  if (!ts || !v1) return false;

  const requestId = req.headers.get("x-request-id") ?? "";
  const manifesto =
    (dataId ? `id:${dataId.toLowerCase()};` : "") +
    (requestId ? `request-id:${requestId};` : "") +
    `ts:${ts};`;

  const esperado = crypto.createHmac("sha256", segredo).update(manifesto).digest("hex");
  const a = Buffer.from(v1);
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
