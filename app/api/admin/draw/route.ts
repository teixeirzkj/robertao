import { clearGrandPrize, drawGrandPrize, getGrandWinner } from "@/lib/raffle";
import { handleError, ok, readJson, requireAdmin } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    return ok({ winner: await getGrandWinner() });
  } catch (err) {
    return handleError(err);
  }
}

/** Sorteio do premio maximo entre todas as cotas vendidas. */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await readJson(req);
    const winner = await drawGrandPrize(Boolean(body.force));
    return ok({ winner });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    await clearGrandPrize();
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
