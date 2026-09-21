import { deletePrize, listPrizes, updatePrize } from "@/lib/raffle";
import { fail, handleError, ok, readJson, requireAdmin } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const id = Number((await params).id);
    if (!Number.isInteger(id)) return fail("Premio invalido.");

    const body = await readJson(req);
    const patch: {
      label?: string;
      valueCents?: number;
      image?: string;
      number?: number | null;
    } = {};
    if (body.label !== undefined) patch.label = String(body.label).slice(0, 200);
    if (body.valueCents !== undefined) patch.valueCents = Number(body.valueCents);
    if (body.image !== undefined) patch.image = String(body.image).slice(0, 2000);
    if (body.number !== undefined) {
      patch.number =
        body.number === null || body.number === "" ? null : Math.round(Number(body.number));
      if (patch.number !== null && !Number.isInteger(patch.number)) {
        return fail("Numero de cota invalido.");
      }
    }

    await updatePrize(id, patch);
    return ok({ prizes: await listPrizes() });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const id = Number((await params).id);
    if (!Number.isInteger(id)) return fail("Premio invalido.");
    await deletePrize(id);
    return ok({ prizes: await listPrizes() });
  } catch (err) {
    return handleError(err);
  }
}
