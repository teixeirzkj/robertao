import { getOrder, getRaffle, salvarCobranca } from "@/lib/raffle";
import { criarCobrancaPix } from "@/lib/syncpay";
import { fail, handleError, ok } from "@/lib/api";
import { limitarOu429 } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A SyncPay e brasileira; sair dos EUA evita latencia e bloqueio por regiao.
export const preferredRegion = "gru1";

type Ctx = { params: Promise<{ code: string }> };

/**
 * QR Code do copia-e-cola, gerado aqui no servidor.
 *
 * Nivel de correcao "M": o codigo Pix e longo, e um nivel maior de redundancia
 * engordaria a imagem a ponto de ficar dificil de ler na camera do celular.
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
    // Sem QR o comprador ainda paga pelo copia-e-cola; nao vale derrubar a rota.
    console.error("[pagamento] falha ao gerar o QR:", err);
    return null;
  }
}

/** URL publica do site, a partir do pedido (funciona na Vercel e local). */
function baseUrl(req: Request) {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Devolve o codigo Pix do pedido, criando a cobranca na SyncPay se ainda nao
 * existir.
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

    if (order.pixCode) {
      return ok({ pixCode: order.pixCode, qr: await gerarQr(order.pixCode) });
    }

    const raffle = await getRaffle();
    const { pixCode, identifier } = await criarCobrancaPix({
      order,
      baseUrl: baseUrl(req),
      descricao: `${order.quantity} cota(s) — ${raffle.title}`,
    });
    await salvarCobranca(order.id, identifier, pixCode);

    return ok({ pixCode, qr: await gerarQr(pixCode) });
  } catch (err) {
    return handleError(err);
  }
}
