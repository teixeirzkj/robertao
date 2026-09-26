import { getOrder, getRaffle, limparCobranca, salvarCobranca } from "@/lib/raffle";
import { criarCobrancaPix } from "@/lib/mercadopago";
import { fail, handleError, ok } from "@/lib/api";
import { limitarOu429 } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// O gateway e brasileiro; sair dos EUA evita latencia e bloqueio por regiao.
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

/**
 * QR Code do copia-e-cola, desenhado aqui no servidor.
 *
 * O gateway devolve uma URL de imagem, mas a propria documentacao dele manda
 * renderizar a partir do codigo — assim o QR nao depende de uma imagem
 * hospedada por terceiro, que pode sair do ar no meio da compra.
 *
 * Nivel de correcao "M": o codigo Pix e longo, e mais redundancia engordaria
 * a imagem a ponto de dificultar a leitura pela camera do celular.
 */
async function gerarQr(pixCode: string): Promise<string | null> {
  try {
    const { toDataURL } = await import("qrcode");
    return await toDataURL(pixCode, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
      color: { dark: "#141c24", light: "#ffffff" },
    });
  } catch (err) {
    // Sem QR o comprador ainda paga pelo copia-e-cola.
    console.error("[pagamento] falha ao gerar o QR:", err);
    return null;
  }
}

/** O codigo Pix vencido nao adianta mostrar: melhor gerar outro. */
function vencido(expiresAt: string | null) {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  return Number.isFinite(t) && t <= Date.now();
}

/**
 * Devolve o codigo Pix do pedido, criando a cobranca se ainda nao existir.
 *
 * Reaproveita a cobranca ja criada: recarregar a pagina nao pode gerar um Pix
 * novo a cada vez, senao o comprador acaba com varios codigos e paga o errado.
 */
export async function POST(req: Request, { params }: Ctx) {
  const bloqueado = await limitarOu429(req, "pagamento", 20, 10 * 60);
  if (bloqueado) return bloqueado;

  try {
    const { code } = await params;
    const order = await getOrder(code.trim());
    if (!order) return fail("Pedido nao encontrado.", 404);
    if (order.status === "pago") return fail("Este pedido ja foi pago.", 409);
    if (order.status === "cancelado") return fail("Este pedido foi cancelado.", 409);

    if (order.pixCode && !vencido(order.pixExpiresAt)) {
      return ok({ pixCode: order.pixCode, qr: await gerarQr(order.pixCode) });
    }
    if (order.pixCode) await limparCobranca(order.id);

    const raffle = await getRaffle();
    // A URL do aviso e configurada no painel do gateway, nao por cobranca.
    const cobranca = await criarCobrancaPix({
      order,
      descricao: `${order.quantity} cota(s) — ${raffle.title}`,
    });

    await salvarCobranca(order.id, {
      paymentId: cobranca.orderId,
      pixCode: cobranca.pixCode,
      token: null,
      expiresAt: cobranca.expiresAt,
    });

    return ok({ pixCode: cobranca.pixCode, qr: await gerarQr(cobranca.pixCode) });
  } catch (err) {
    return handleError(err);
  }
}
