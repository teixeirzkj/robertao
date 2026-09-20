import { getPublicRaffle } from "@/lib/raffle";
import { handleError, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(await getPublicRaffle());
  } catch (err) {
    return handleError(err);
  }
}
