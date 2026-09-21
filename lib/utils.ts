import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatNumber(value: number) {
  return value.toLocaleString("pt-BR");
}

/** Formata a cota com zeros à esquerda conforme o total da rifa (ex.: 42 -> "00042"). */
export function padTicket(n: number, total: number) {
  const width = Math.max(String(Math.max(total, 1) - 1).length, 2);
  return String(n).padStart(width, "0");
}

/**
 * Nome para exibicao publica: primeiro nome inteiro e o resto abreviado.
 * "Ana Paula Ribeiro" -> "Ana P**** R****"
 */
export function maskName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  return [
    parts[0],
    ...parts.slice(1).map((p) => (p.length > 2 ? p[0] + "*".repeat(Math.min(p.length - 1, 4)) : p)),
  ].join(" ");
}

export function onlyDigits(value: string) {
  return value.replace(/\D+/g, "");
}

export function formatCPF(value: string) {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

export function formatPhone(value: string) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

export function isValidCPF(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let check = ((sum * 10) % 11) % 10;
  if (check !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  check = ((sum * 10) % 11) % 10;
  return check === Number(cpf[10]);
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/** Aceita dd/mm/aaaa ou aaaa-mm-dd e devolve ISO (aaaa-mm-dd) ou null. */
export function parseBirthdate(value: string): string | null {
  const v = value.trim();
  let y: number, m: number, d: number;
  const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (br) [d, m, y] = [Number(br[1]), Number(br[2]), Number(br[3])];
  else if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  )
    return null;
  const age = (Date.now() - date.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (age < 18 || age > 120) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function formatDateBR(value: string | null) {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
}

export function formatDateTimeBR(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
