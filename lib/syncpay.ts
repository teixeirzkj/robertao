import { RaffleError } from "@/lib/raffle";
import type { Order } from "@/lib/types";
import { isValidPhone, normalizePhone, onlyDigits } from "@/lib/utils";
import { webhookToken } from "@/lib/auth";

/**
 * Cobranca Pix pela SyncPay.
 *
 *   POST /api/partner/v1/auth-token   { client_id, client_secret } -> access_token (1h)
 *   POST /api/partner/v1/cash-in      { amount, client, webhook_url } -> { pix_code, identifier }
 *   GET  /api/partner/v1/transaction/{identifier} -> { data: { status, amount } }
 *
 * Diferente de um checkout hospedado, a SyncPay devolve o codigo Pix e quem
 * mostra para o comprador somos nos. O pagamento nunca e dado como confirmado
 * pelo que chega no webhook: a confirmacao vem sempre de uma consulta nossa a
 * SyncPay (ver `consultarTransacao`).
 *
 * Docs: https://syncpay.apidog.io/
 */
const HOST = process.env.SYNCPAY_HOST || "https://api.syncpayments.com.br";
const TIMEOUT_MS = 20_000;

/** Status da SyncPay que significa "o dinheiro entrou". */
const PAGO = "completed";

export function syncpayConfigurada() {
  return Boolean(process.env.SYNCPAY_CLIENT_ID && process.env.SYNCPAY_CLIENT_SECRET);
}

/* ------------------------------------------------------------------ token */

/**
 * O token vale 1 hora. Guardamos em memoria da instancia e renovamos um
 * minuto antes de vencer, para uma cobranca nunca sair com token expirado.
 */
type TokenCache = { valor: string; expiraEm: number };
declare global {
  // eslint-disable-next-line no-var
  var __syncpayToken: TokenCache | undefined;
}

async function pedirJson(url: string, init: RequestInit): Promise<{ res: Response; corpo: any }> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new RaffleError("Nao conseguimos falar com a SyncPay. Tente de novo em instantes.", 502);
  }
  const texto = await res.text();
  let corpo: any = null;
  try {
    corpo = JSON.parse(texto);
  } catch {
    /* resposta nao-JSON; `corpo` fica null e quem chamou decide */
  }
  if (!res.ok) console.error("[syncpay]", init.method, url, res.status, texto.slice(0, 400));
  return { res, corpo };
}

async function obterToken(): Promise<string> {
  const agora = Date.now();
  if (global.__syncpayToken && global.__syncpayToken.expiraEm > agora) {
    return global.__syncpayToken.valor;
  }

  const client_id = process.env.SYNCPAY_CLIENT_ID;
  const client_secret = process.env.SYNCPAY_CLIENT_SECRET;
  if (!client_id || !client_secret) {
    throw new RaffleError(
      "O pagamento ainda nao foi configurado. Fale com a organizacao da rifa.",
      503
    );
  }

  const { res, corpo } = await pedirJson(`${HOST}/api/partner/v1/auth-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id, client_secret }),
  });

  const token = corpo?.access_token ?? corpo?.data?.access_token;
  if (!res.ok || !token) {
    throw new RaffleError(
      res.status === 401
        ? "As credenciais da SyncPay foram recusadas. Confira SYNCPAY_CLIENT_ID e SYNCPAY_CLIENT_SECRET."
        : "A SyncPay nao devolveu o token de acesso.",
      502
    );
  }

  // `expires_in` vem em segundos; renovamos 60s antes para nao usar na virada.
  const duracao = Number(corpo.expires_in ?? 3600);
  const validade = Number.isFinite(duracao) && duracao > 120 ? duracao : 3600;
  global.__syncpayToken = { valor: token, expiraEm: agora + (validade - 60) * 1000 };
  return token;
}

/* -------------------------------------------------------------- cobranca */

export type CobrancaPix = { pixCode: string; identifier: string };

export async function criarCobrancaPix({
  order,
  baseUrl,
  descricao,
}: {
  order: Order;
  baseUrl: string;
  descricao: string;
}): Promise<CobrancaPix> {
  if (!isValidPhone(order.phone)) {
    throw new RaffleError(
      `O telefone do pedido (${order.phone}) nao e um celular valido e a SyncPay o exige. ` +
        "Refaca o pedido com um celular com DDD.",
      400
    );
  }

  const webhookUrl = new URL("/api/webhooks/pagamento", baseUrl);
  // O codigo do pedido viaja junto com o token para que o webhook consiga
  // conferir a assinatura antes de tocar no banco: assim ninguem descobre
  // quais codigos existem batendo na rota. O token e um HMAC do codigo, nunca
  // o segredo global — a URL fica gravada na SyncPay e em log de acesso.
  const t = webhookToken(order.code);
  if (t) {
    webhookUrl.searchParams.set("c", order.code);
    webhookUrl.searchParams.set("t", t);
  }

  const token = await obterToken();
  const { res, corpo } = await pedirJson(`${HOST}/api/partner/v1/cash-in`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      // A SyncPay trabalha em reais, nao em centavos.
      amount: Number((order.totalCents / 100).toFixed(2)),
      description: descricao.slice(0, 120),
      webhook_url: webhookUrl.toString(),
      client: {
        name: order.name,
        cpf: onlyDigits(order.cpf),
        email: order.email,
        phone: normalizePhone(order.phone),
      },
    }),
  });

  if (!res.ok) throw new RaffleError(explicarRecusa(res.status, corpo), res.status < 500 ? 400 : 502);

  const pixCode = corpo?.pix_code ?? corpo?.data?.pix_code;
  const identifier = corpo?.identifier ?? corpo?.data?.identifier;
  if (!pixCode || !identifier) {
    console.error("[syncpay] cash-in sem pix_code/identifier:", JSON.stringify(corpo).slice(0, 400));
    throw new RaffleError("A SyncPay respondeu sem o codigo Pix.", 502);
  }
  return { pixCode, identifier };
}

/** Traduz a recusa da SyncPay em algo que de para agir. */
function explicarRecusa(status: number, corpo: any): string {
  const porCampo: string[] = [];
  const erros = corpo?.errors;
  if (erros && typeof erros === "object") {
    for (const [campo, valor] of Object.entries(erros as Record<string, unknown>)) {
      const lista = Array.isArray(valor) ? valor : [valor];
      for (const v of lista) porCampo.push(`${campo}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
    }
  }
  const detalhe = [corpo?.message, ...porCampo].filter(Boolean).join(" — ");
  if (detalhe) return `A SyncPay recusou a cobranca: ${detalhe}`;
  return `A SyncPay recusou a cobranca (HTTP ${status}).`;
}

/* -------------------------------------------------------------- consulta */

export type SituacaoPagamento = {
  pago: boolean;
  status: string;
  /** Valor em centavos, para conferir com o total do pedido. */
  valorCentavos: number | null;
};

/**
 * Pergunta a SyncPay como esta a transacao.
 *
 * E esta resposta — nunca o corpo do webhook — que libera as cotas. A SyncPay
 * nao documenta o formato nem a assinatura do webhook, entao tratamos a
 * chamada dele apenas como um aviso de "olhe de novo"; quem confirma o
 * pagamento e a propria SyncPay, respondendo a uma pergunta nossa.
 */
export async function consultarTransacao(identifier: string): Promise<SituacaoPagamento> {
  const token = await obterToken();
  const { res, corpo } = await pedirJson(
    `${HOST}/api/partner/v1/transaction/${encodeURIComponent(identifier)}`,
    { method: "GET", headers: { Accept: "application/json", Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    throw new RaffleError(
      res.status === 404
        ? "Cobranca nao encontrada na SyncPay."
        : `Nao foi possivel consultar o pagamento (HTTP ${res.status}).`,
      res.status === 404 ? 404 : 502
    );
  }

  const dados = corpo?.data ?? corpo ?? {};
  const status = String(dados.status ?? "").toLowerCase();
  const valor = Number(dados.amount);
  return {
    pago: status === PAGO,
    status,
    valorCentavos: Number.isFinite(valor) ? Math.round(valor * 100) : null,
  };
}
