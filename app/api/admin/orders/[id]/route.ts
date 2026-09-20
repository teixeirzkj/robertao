import { releaseOrder, setOrderStatus } from "@/lib/raffle";
import { handleError, ok, readJson, requireAdmin } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { id } = await params;
    const body = await readJson(req);
    const order = await setOrderStatus(id, String(body.status ?? ""));
    return ok({ order });
  } catch (err) {
    return handleError(err);
  }
}

/** Exclui o pedido e devolve as cotas para a rifa. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { id } = await params;
    await releaseOrder(id);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
