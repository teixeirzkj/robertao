import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { RaffleError } from "@/lib/raffle";

export function ok<T>(data: T, init?: number) {
  return NextResponse.json(data as object, { status: init ?? 200 });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Converte qualquer erro em resposta JSON, sem vazar detalhes internos. */
export function handleError(err: unknown) {
  if (err instanceof RaffleError) return fail(err.message, err.status);
  const message = err instanceof Error ? err.message : "Erro inesperado.";
  if (/DATABASE_URL/.test(message)) return fail(message, 503);
  console.error("[api]", err);
  return fail("Erro ao processar a solicitacao. Tente novamente.", 500);
}

/** Retorna null quando autorizado, ou a resposta 401 quando nao. */
export async function requireAdmin() {
  if (await isAuthenticated()) return null;
  return fail("Sessao expirada. Faca login novamente.", 401);
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
