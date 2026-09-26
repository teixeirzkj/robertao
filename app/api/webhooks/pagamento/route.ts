import { after } from "next/server";
import { getOrderByPaymentId, verificarPagamento } from "@/lib/raffle";
import { assinaturaValida } from "@/lib/mercadopago";
import { fail, handleError, ok, readJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// O gateway e brasileiro; sair dos EUA evita latencia e bloqueio por regiao.
export const preferredRegion = "gru1";

/**
 * Aviso de pagamento do Mercado Pago.
 *
 *   { type: "payment" | "order", action, data: { id } }
 *   header x-signature: ts=<numero>,v1=<hmac>
 *
 * O aviso traz so um id — de proposito. Conferimos a assinatura e depois
 * perguntamos a situacao para a API: quem diz se foi pago e o gateway,
 * respondendo a nos, nunca o corpo de uma requisicao que chegou de fora.
 *
 * Idempotente: reenviar o mesmo aviso nao sorteia cotas de novo.
 */
export async function POST(req: Request) {
  try {
    const body = await readJson(req);

    const dados = (body.data ?? {}) as Record<string, unknown>;
    const dataId = String(dados.id ?? body.id ?? "").trim();

    // A assinatura vem antes de qualquer ida ao banco: assim a rota nao conta
    // a quem chutar quais pedidos existem.
    if (!assinaturaValida(req, dataId)) return fail("Nao autorizado.", 401);
    if (!dataId) return ok({ ignorado: true, motivo: "aviso sem id" });

    const tipo = String(body.type ?? "").toLowerCase();
    if (tipo && !["payment", "order"].includes(tipo)) {
      return ok({ ignorado: true, motivo: `tipo "${tipo}" nao tratado` });
    }

    const pedido = await getOrderByPaymentId(dataId);
    if (!pedido) return ok({ ignorado: true, motivo: "pedido nao encontrado" });

    // O gateway espera resposta rapida; a confirmacao envolve consulta mais
    // sorteio em transacao, entao respondemos ja e fazemos o trabalho depois.
    after(async () => {
      try {
        await verificarPagamento(pedido.id, { forcar: true });
      } catch (err) {
        // A pagina do pedido consulta sozinha, entao uma falha aqui atrasa a
        // confirmacao em vez de perde-la.
        console.error("[webhook] confirmacao falhou para", pedido.code, err);
      }
    });

    return ok({ recebido: true });
  } catch (err) {
    return handleError(err);
  }
}
