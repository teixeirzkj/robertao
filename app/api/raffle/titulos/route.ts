import { getTicketRange } from "@/lib/raffle";
import { handleError, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Menor e maior cota ja vendida — versao publica, sem dado de comprador.
 */
export async function GET() {
  try {
    const range = await getTicketRange();
    return ok({
      count: range.count,
      lowest: range.lowest?.number ?? null,
      highest: range.highest?.number ?? null,
    });
  } catch (err) {
    return handleError(err);
  }
}
