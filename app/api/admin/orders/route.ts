import { listOrders } from "@/lib/raffle";
import { handleError, ok, requireAdmin } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const result = await listOrders({
      search: searchParams.get("search") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      limit: Number(searchParams.get("limit") ?? 30),
      offset: Number(searchParams.get("offset") ?? 0),
    });
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
