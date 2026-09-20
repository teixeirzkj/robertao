import crypto from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "rifa_admin";
const MAX_AGE = 60 * 60 * 12; // 12 horas

function secret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "robertao-rifas-dev-secret"
  );
}

export function adminPassword() {
  return process.env.ADMIN_PASSWORD || "robertao123";
}

function sign(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createToken() {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = `admin.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [role, exp, mac] = parts;
  if (role !== "admin") return false;
  const expected = sign(`${role}.${exp}`);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  return Number(exp) > Date.now();
}

/** Comparação de senha em tempo constante. */
export function checkPassword(input: string) {
  const expected = adminPassword();
  const a = Buffer.from(crypto.createHash("sha256").update(input).digest());
  const b = Buffer.from(crypto.createHash("sha256").update(expected).digest());
  return crypto.timingSafeEqual(a, b);
}

export async function isAuthenticated() {
  const store = await cookies();
  return verifyToken(store.get(ADMIN_COOKIE)?.value);
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE,
};
