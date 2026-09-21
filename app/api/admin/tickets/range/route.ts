import { getTicketRange } from "@/lib/raffle";
import { handleError, ok, requireAdmin } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Maior e menor cota vendida em um período.
 * /api/admin/tickets/range?from=2026-09-20T00:00&to=2026-09-21T18:00
 */
export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const range = await getTicketRange(
      searchParams.get("from") || undefined,
      searchParams.get("to") || undefined
    );
    return ok(range);
  } catch (err) {
    return handleError(err);
  }
}
