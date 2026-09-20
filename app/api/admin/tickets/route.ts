import { lookupTicket } from "@/lib/raffle";
import { fail, handleError, ok, requireAdmin } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Busca de cota: /api/admin/tickets?number=1234 */
export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const raw = new URL(req.url).searchParams.get("number");
    const number = Number(String(raw ?? "").replace(/\D+/g, ""));
    if (!raw || !Number.isFinite(number)) return fail("Informe o numero da cota.");
    return ok(await lookupTicket(number));
  } catch (err) {
    return handleError(err);
  }
}
