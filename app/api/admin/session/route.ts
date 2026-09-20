import { NextResponse } from "next/server";
import { ADMIN_COOKIE, checkPassword, cookieOptions, createToken } from "@/lib/auth";
import { fail, readJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bloqueio simples por IP contra tentativa de forca bruta. */
const attempts = new Map<string, { count: number; until: number }>();

function clientKey(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

export async function POST(req: Request) {
  const key = clientKey(req);
  const entry = attempts.get(key);
  if (entry && entry.until > Date.now() && entry.count >= 6) {
    return fail("Muitas tentativas. Aguarde alguns minutos.", 429);
  }

  const body = await readJson(req);
  const password = String(body.password ?? "");

  if (!password || !checkPassword(password)) {
    const next = entry && entry.until > Date.now() ? entry.count + 1 : 1;
    attempts.set(key, { count: next, until: Date.now() + 5 * 60_000 });
    return fail("Senha incorreta.", 401);
  }

  attempts.delete(key);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, createToken(), cookieOptions);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return res;
}
