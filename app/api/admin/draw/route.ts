import { clearGrandPrize, getGrandWinner, setWinnerTicket } from "@/lib/raffle";
import { fail, handleError, ok, readJson, requireAdmin } from "@/lib/api";

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

/**
 * Registra a cota vencedora do premio principal.
 * O sorteio e feito pela Loteria Federal; aqui o admin informa o numero.
 */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await readJson(req);
    const number = Math.round(Number(String(body.number ?? "").replace(/\D+/g, "")));
    if (!Number.isFinite(number) || number < 1) {
      return fail("Informe o numero da cota sorteada.");
    }
    const winner = await setWinnerTicket(number, Boolean(body.force));
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
