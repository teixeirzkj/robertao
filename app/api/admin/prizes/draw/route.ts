import { drawPrizeNumbers, listPrizes } from "@/lib/raffle";
import { handleError, ok, readJson, requireAdmin } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sorteia os numeros das cotas premiadas. */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await readJson(req);
    await drawPrizeNumbers(Boolean(body.reshuffle));
    return ok({ prizes: await listPrizes() });
  } catch (err) {
    return handleError(err);
  }
}
