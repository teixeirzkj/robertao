import { getTicketRange } from "@/lib/raffle";
import { handleError, ok } from "@/lib/api";
import { maskName } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Menor e maior cota ja vendida, com quem ficou com cada uma.
 *
 * O nome sai mascarado (igual ao da cota vencedora): da para a pessoa se
 * reconhecer sem expor o comprador. Telefone, e-mail e CPF nunca saem daqui.
 */
export async function GET() {
  try {
    const range = await getTicketRange();
    return ok({
      count: range.count,
      lowest: range.lowest?.number ?? null,
      lowestName: range.lowest ? maskName(range.lowest.order.name) : null,
      highest: range.highest?.number ?? null,
      highestName: range.highest ? maskName(range.highest.order.name) : null,
    });
  } catch (err) {
    return handleError(err);
  }
}
