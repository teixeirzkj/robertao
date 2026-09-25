import { RaffleError } from "@/lib/raffle";
import type { Order } from "@/lib/types";
import { formatPhone, isValidPhone, onlyDigits } from "@/lib/utils";

/**
 * Cobranca Pix pela SigiloPay.
 *
 *   POST /api/v1/gateway/pix/receive
 *     headers: x-public-key, x-secret-key
 *     body:    { identifier, amount, client:{name,email,phone,document}, callbackUrl }
 *     -> { transactionId, status, webhookToken, fee, pix:{ code, image, expiresAt } }
 *
 * Duas coisas boas em relacao ao gateway anterior:
 *
 *  - o `identifier` e NOSSO. Mandamos o codigo do pedido, e ele volta no aviso
 *    de pagamento — nao ha mapeamento a manter nem busca por id do gateway;
 *  - a resposta traz um `webhookToken` por transacao, que e o que permite
 *    validar o aviso. Guardamos junto do pedido.
 *
 * O QR Code e desenhado por nos a partir de `pix.code`, como a propria
 * documentacao deles recomenda (o campo `base64` esta descontinuado e volta
 * vazio). Isso tambem evita depender de uma imagem hospedada por terceiro.
 *
 * Docs: app.sigilopay.com.br (documentacao interna, exige login)
 */
const HOST = process.env.SIGILOPAY_HOST || "https://app.sigilopay.com.br";
const TIMEOUT_MS = 20_000;

/** Valor minimo aceito, conforme a validacao da propria API. */
export const MINIMO_CENTAVOS = 1;

export function sigilopayConfigurada() {
  return Boolean(process.env.SIGILOPAY_PUBLIC_KEY && process.env.SIGILOPAY_SECRET_KEY);
}

function credenciais() {
  const publica = process.env.SIGILOPAY_PUBLIC_KEY;
  const secreta = process.env.SIGILOPAY_SECRET_KEY;
  if (!publica || !secreta) {
    throw new RaffleError(
      "O pagamento ainda nao foi configurado. Fale com a organizacao da rifa.",
      503
    );
  }
  return { "x-public-key": publica, "x-secret-key": secreta };
}

async function pedirJson(
  caminho: string,
  init: RequestInit
): Promise<{ res: Response; corpo: any }> {
  let res: Response;
  try {
    res = await fetch(`${HOST}${caminho}`, {
      ...init,
      headers: { "Content-Type": "application/json", Accept: "application/json", ...init.headers },
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
  if (!res.ok) console.error("[sigilopay]", init.method, caminho, res.status, texto.slice(0, 400));
  return { res, corpo };
}

/** Traduz a recusa em algo que de para agir. */
function explicarRecusa(status: number, corpo: any): string {
  if (status === 401) {
    return "As credenciais do gateway foram recusadas. Confira SIGILOPAY_PUBLIC_KEY e SIGILOPAY_SECRET_KEY.";
  }
  if (status === 429) {
    return "O gateway pediu para esperar um pouco. Tente de novo em alguns segundos.";
  }

  // `details` vem do Zod deles: [{ path, error:{ message } }] ou [{ path:[], message }]
  const campos: string[] = [];
  if (Array.isArray(corpo?.details)) {
    for (const d of corpo.details) {
      const caminho = Array.isArray(d?.path) ? d.path.join(".") : d?.path;
      const msg = d?.error?.message ?? d?.message;
      if (msg) campos.push(caminho ? `${caminho}: ${msg}` : String(msg));
    }
  }
  const detalhe = [corpo?.message, ...campos].filter(Boolean).join(" — ");
  if (detalhe) return `O gateway recusou a cobranca: ${detalhe}`;
  return `O gateway recusou a cobranca (HTTP ${status}).`;
}

export type CobrancaPix = {
  /** Id da transacao do lado do gateway. */
  transactionId: string;
  /** Copia-e-cola, de onde o QR Code e desenhado. */
  pixCode: string;
  /** Token que valida o aviso de pagamento deste pedido. */
  webhookToken: string | null;
  /** Quando o codigo perde a validade, se informado. */
  expiresAt: string | null;
  /** Taxa cobrada pelo gateway, em centavos. */
  feeCents: number | null;
};

export async function criarCobrancaPix({
  order,
  callbackUrl,
  descricao,
}: {
  order: Order;
  callbackUrl: string;
  descricao: string;
}): Promise<CobrancaPix> {
  if (!isValidPhone(order.phone)) {
    throw new RaffleError(
      `O telefone do pedido (${order.phone}) nao e um celular valido. ` +
        "Refaca o pedido com um celular com DDD.",
      400
    );
  }
  if (order.totalCents < MINIMO_CENTAVOS) {
    throw new RaffleError("O valor do pedido e menor que o minimo aceito pelo gateway.", 400);
  }

  const { res, corpo } = await pedirJson("/api/v1/gateway/pix/receive", {
    method: "POST",
    headers: credenciais(),
    body: JSON.stringify({
      // O identificador e nosso: o codigo do pedido volta no aviso de pagamento.
      identifier: order.code,
      // Eles trabalham em reais, nao em centavos.
      amount: Number((order.totalCents / 100).toFixed(2)),
      client: {
        name: order.name,
        email: order.email,
        phone: formatPhone(order.phone),
        document: onlyDigits(order.cpf),
      },
      products: [
        { id: order.code, name: descricao.slice(0, 120), quantity: 1, price: Number((order.totalCents / 100).toFixed(2)) },
      ],
      callbackUrl,
    }),
  });

  if (!res.ok) {
    throw new RaffleError(explicarRecusa(res.status, corpo), res.status < 500 ? 400 : 502);
  }

  const pixCode = corpo?.pix?.code;
  const transactionId = corpo?.transactionId;
  if (!pixCode || !transactionId) {
    console.error("[sigilopay] resposta sem pix.code/transactionId:", JSON.stringify(corpo).slice(0, 400));
    throw new RaffleError("O gateway respondeu sem o codigo Pix.", 502);
  }

  // `status` OK/PENDING sao normais na criacao; os demais sao recusa.
  const status = String(corpo.status ?? "").toUpperCase();
  if (status && !["OK", "PENDING"].includes(status)) {
    throw new RaffleError(
      `O gateway devolveu a cobranca como "${status}"${corpo.errorDescription ? `: ${corpo.errorDescription}` : "."}`,
      400
    );
  }

  const fee = Number(corpo.fee);
  return {
    transactionId: String(transactionId),
    pixCode: String(pixCode),
    webhookToken: corpo.webhookToken ? String(corpo.webhookToken) : null,
    expiresAt: corpo.pix?.expiresAt ? String(corpo.pix.expiresAt) : null,
    feeCents: Number.isFinite(fee) ? Math.round(fee * 100) : null,
  };
}

/* ----------------------------------------------------------------- status */

/** Status do gateway que significam "o dinheiro entrou". */
const PAGO = new Set(["COMPLETED", "PAID", "APPROVED"]);
/** Status finais que nao viram pagamento. */
const MORTO = new Set(["FAILED", "REJECTED", "CANCELED", "EXPIRED", "REFUNDED", "CHARGED_BACK"]);

export type SituacaoPagamento = {
  pago: boolean;
  encerrado: boolean;
  status: string;
  valorCentavos: number | null;
};

/** Le a situacao a partir de um corpo do gateway (resposta de consulta ou aviso). */
export function lerSituacao(corpo: any): SituacaoPagamento {
  const dados = corpo?.data ?? corpo ?? {};
  const status = String(
    dados.transactionStatus ?? dados.status ?? ""
  ).toUpperCase();
  const valor = Number(dados.amount ?? dados.value);
  return {
    pago: PAGO.has(status),
    encerrado: MORTO.has(status),
    status,
    valorCentavos: Number.isFinite(valor) ? Math.round(valor * 100) : null,
  };
}

/**
 * Pergunta ao gateway como esta a cobranca de um pedido.
 *
 * A consulta e por `clientIdentifier` — o codigo do pedido que nos mesmos
 * enviamos —, entao nao dependemos de ter guardado o id deles.
 *
 * Serve de rede: o aviso de pagamento e o caminho normal, mas se ele se
 * perder o comprador ficaria esperando sem ninguem perceber. A documentacao
 * pede para nao chamar a API de volta *por causa do aviso*; consulta pontual,
 * espacada, e outra coisa — e o que evita deixar quem pagou no escuro.
 */
export async function consultarPorPedido(code: string): Promise<SituacaoPagamento | null> {
  const { res, corpo } = await pedirJson(
    `/api/v1/gateway/transactions?clientIdentifier=${encodeURIComponent(code)}`,
    { method: "GET", headers: credenciais() }
  );

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new RaffleError(
      res.status === 429
        ? "O gateway pediu para esperar um pouco antes de consultar de novo."
        : `Nao foi possivel consultar o pagamento (HTTP ${res.status}).`,
      502
    );
  }

  // A resposta pode vir como objeto unico ou dentro de uma lista.
  const t = Array.isArray(corpo) ? corpo[0] : (corpo?.data ?? corpo);
  if (!t) return null;
  return lerSituacao(t);
}
