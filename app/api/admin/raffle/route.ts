import { getRaffle, getStats, updateRaffle } from "@/lib/raffle";
import { fail, handleError, ok, readJson, requireAdmin } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const [raffle, stats] = await Promise.all([getRaffle(), getStats()]);
    return ok({ raffle, stats });
  } catch (err) {
    return handleError(err);
  }
}

const TEXT_FIELDS = [
  "title",
  "subtitle",
  "description",
  "drawDate",
  "pixKey",
  "pixName",
  "whatsapp",
  "instagram",
  "rules",
  "grandPrize",
] as const;

const INT_FIELDS = [
  "priceCents",
  "totalNumbers",
  "minQuantity",
  "maxQuantity",
  "prizeChance",
  "reservationMinutes",
] as const;

export async function PATCH(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await readJson(req);
    const patch: Record<string, unknown> = {};

    for (const field of TEXT_FIELDS) {
      if (body[field] !== undefined) patch[field] = String(body[field]).slice(0, 8000);
    }

    for (const field of INT_FIELDS) {
      if (body[field] === undefined) continue;
      const value = Number(body[field]);
      if (!Number.isFinite(value)) return fail("Valor invalido em " + field + ".");
      patch[field] = Math.round(value);
    }

    if (patch.priceCents !== undefined && (patch.priceCents as number) < 1) {
      return fail("O valor da cota precisa ser maior que zero.");
    }
    if (patch.prizeChance !== undefined) {
      patch.prizeChance = Math.min(Math.max(patch.prizeChance as number, 0), 100);
    }
    if (patch.reservationMinutes !== undefined) {
      patch.reservationMinutes = Math.min(Math.max(patch.reservationMinutes as number, 5), 10080);
    }
    if (patch.minQuantity !== undefined && (patch.minQuantity as number) < 1) {
      patch.minQuantity = 1;
    }
    if (
      patch.maxQuantity !== undefined &&
      patch.minQuantity !== undefined &&
      (patch.maxQuantity as number) < (patch.minQuantity as number)
    ) {
      return fail("A quantidade maxima nao pode ser menor que a minima.");
    }

    if (body.status !== undefined) {
      const status = String(body.status);
      if (!["ativa", "pausada", "encerrada"].includes(status)) return fail("Status invalido.");
      patch.status = status;
    }

    if (body.images !== undefined) {
      if (!Array.isArray(body.images)) return fail("Imagens invalidas.");
      patch.images = body.images
        .map((img) => String(img).trim())
        .filter(Boolean)
        .slice(0, 10);
    }

    if (body.quickPicks !== undefined) {
      if (!Array.isArray(body.quickPicks)) return fail("Atalhos de quantidade invalidos.");
      patch.quickPicks = Array.from(
        new Set(
          body.quickPicks
            .map((n) => Math.round(Number(n)))
            .filter((n) => Number.isFinite(n) && n > 0)
        )
      )
        .sort((a, b) => a - b)
        .slice(0, 8);
    }

    const raffle = await updateRaffle(patch);
    return ok({ raffle });
  } catch (err) {
    return handleError(err);
  }
}
