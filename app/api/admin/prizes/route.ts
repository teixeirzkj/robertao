import { createPrize, listPrizes } from "@/lib/raffle";
import { handleError, ok, readJson, requireAdmin } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    return ok({ prizes: await listPrizes() });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await readJson(req);
    await createPrize(String(body.label ?? ""), Number(body.valueCents ?? 0));
    return ok({ prizes: await listPrizes() }, 201);
  } catch (err) {
    return handleError(err);
  }
}
