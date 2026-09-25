import { createOrder, getRaffle, toPublicOrder } from "@/lib/raffle";
import { fail, handleError, ok, readJson } from "@/lib/api";
import { limitarOu429 } from "@/lib/rate-limit";
import {
  formatCPF,
  formatPhone,
  isValidCPF,
  isValidEmail,
  isValidPhone,
  normalizePhone,
  onlyDigits,
  parseBirthdate,
} from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Cada pedido reserva cotas por 1 hora; sem teto, um script esgotaria a
  // rifa inteira sem pagar nada.
  const bloqueado = await limitarOu429(req, "pedido", 10, 10 * 60);
  if (bloqueado) return bloqueado;

  try {
    const body = await readJson(req);

    const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
    if (name.length < 5 || !name.includes(" ")) {
      return fail("Informe seu nome completo.");
    }

    // Precisa ser celular: o gateway exige e recusa o numero com o 55 do
    // pais no lugar do DDD.
    const phoneDigits = normalizePhone(String(body.phone ?? ""));
    if (!isValidPhone(phoneDigits)) {
      return fail("Informe um celular valido com DDD, ex.: (74) 99923-8282.");
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

    const raffle = await getRaffle();
    const order = await createOrder({
      name,
      phone: formatPhone(phoneDigits),
      email,
      cpf: formatCPF(cpfDigits),
      birthdate,
      quantity,
    });

    // Devolve so o que a tela usa. O eco do CPF, e-mail e telefone que a
    // pessoa acabou de digitar nao serve para nada e ainda passa por cache,
    // extensao de navegador e ferramenta de rede pelo caminho.
    return ok(toPublicOrder(order, raffle.reservationMinutes), 201);
  } catch (err) {
    return handleError(err);
  }
}
