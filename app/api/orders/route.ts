import { createOrder } from "@/lib/raffle";
import { fail, handleError, ok, readJson } from "@/lib/api";
import {
  formatCPF,
  formatPhone,
  isValidCPF,
  isValidEmail,
  onlyDigits,
  parseBirthdate,
} from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await readJson(req);

    const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
    if (name.length < 5 || !name.includes(" ")) {
      return fail("Informe seu nome completo.");
    }

    const phoneDigits = onlyDigits(String(body.phone ?? ""));
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      return fail("Informe um telefone valido com DDD.");
    }

    const email = String(body.email ?? "").trim().toLowerCase();
    if (!isValidEmail(email)) return fail("Informe um e-mail valido.");

    const cpfDigits = onlyDigits(String(body.cpf ?? ""));
    if (!isValidCPF(cpfDigits)) return fail("CPF invalido.");

    const birthdate = parseBirthdate(String(body.birthdate ?? ""));
    if (!birthdate) return fail("Data de nascimento invalida (e necessario ter 18 anos ou mais).");

    const quantity = Number(body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      return fail("Quantidade de cotas invalida.");
    }

    const order = await createOrder({
      name,
      phone: formatPhone(phoneDigits),
      email,
      cpf: formatCPF(cpfDigits),
      birthdate,
      quantity,
    });

    return ok(order, 201);
  } catch (err) {
    return handleError(err);
  }
}
