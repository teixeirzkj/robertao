import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminPassword, checkPassword, cookieOptions, createToken } from "@/lib/auth";
import { fail, readJson } from "@/lib/api";
import { limitarOu429 } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // O painel tem uma senha so: sem teto de tentativas, forca bruta e questao
  // de tempo. O contador fica no banco porque em serverless cada tentativa
  // pode cair em uma instancia diferente.
  const bloqueado = await limitarOu429(req, "login", 8, 15 * 60);
  if (bloqueado) return bloqueado;

  if (!adminPassword()) {
    return fail("ADMIN_PASSWORD nao configurada no servidor. O painel esta fechado.", 503);
  }

  const body = await readJson(req);
  const password = String(body.password ?? "");
  if (!password || !checkPassword(password)) return fail("Senha incorreta.", 401);

  const token = createToken();
  if (!token) {
    return fail("ADMIN_SESSION_SECRET nao configurada no servidor.", 503);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, cookieOptions);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return res;
}
