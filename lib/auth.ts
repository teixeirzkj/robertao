import crypto from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "rifa_admin";
const MAX_AGE = 60 * 60 * 12; // 12 horas
const PRODUCAO = process.env.NODE_ENV === "production";

/**
 * Segredo que assina o cookie de sessao.
 *
 * Em producao nao ha valor padrao de proposito: um padrao conhecido deixaria
 * qualquer pessoa forjar um cookie de admin. Sem a variavel, o painel fica
 * inacessivel — que e o modo certo de falhar.
 */
function secret(): string | null {
  const s = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (s) return s;
  return PRODUCAO ? null : "segredo-de-desenvolvimento";
}

export function adminPassword(): string | null {
  const p = process.env.ADMIN_PASSWORD;
  if (p) return p;
  return PRODUCAO ? null : "robertao123";
}

/**
 * Impressao digital da senha atual, embutida no cookie.
 *
 * E o que faz trocar a senha derrubar quem ja estava logado: o cookie antigo
 * carrega a digital da senha velha e para de conferir. Sem isso, uma sessao
 * aberta sobreviveria 12 horas a troca de senha.
 */
function digitalDaSenha(): string {
  const p = adminPassword() ?? "";
  return crypto.createHash("sha256").update(p).digest("base64url").slice(0, 12);
}

function sign(payload: string): string | null {
  const s = secret();
  if (!s) return null;
  return crypto.createHmac("sha256", s).update(payload).digest("base64url");
}

export function createToken(): string | null {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = `admin.${exp}.${digitalDaSenha()}`;
  const mac = sign(payload);
  return mac ? `${payload}.${mac}` : null;
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 4) return false;
  const [role, exp, digital, mac] = parts;
  if (role !== "admin") return false;
  if (digital !== digitalDaSenha()) return false; // senha trocou: sessao morre

  const expected = sign(`${role}.${exp}.${digital}`);
  if (!expected) return false;
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  return Number(exp) > Date.now();
}

/** Comparacao de senha em tempo constante. */
export function checkPassword(input: string): boolean {
  const expected = adminPassword();
  if (!expected) return false; // sem ADMIN_PASSWORD em producao, ninguem entra
  const a = crypto.createHash("sha256").update(input).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function isAuthenticated() {
  const store = await cookies();
  return verifyToken(store.get(ADMIN_COOKIE)?.value);
}

export const cookieOptions = {
  httpOnly: true,
  // "strict" porque nada no site legitimamente chega ao painel vindo de fora;
  // isso fecha a porta para CSRF nas rotas de admin.
  sameSite: "strict" as const,
  secure: PRODUCAO,
  path: "/",
  maxAge: MAX_AGE,
};
