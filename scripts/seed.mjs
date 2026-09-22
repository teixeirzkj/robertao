/**
 * `npm run seed`
 *
 * Configura a rifa e as cotas premiadas, e (opcionalmente) cria compras de
 * exemplo. Usa a própria API do site, então o servidor precisa estar rodando.
 *
 * Variáveis: BASE_URL (padrão http://localhost:3000), ADMIN_PASSWORD,
 * e SEED_ORDERS=0 para não criar compras de exemplo.
 */
const BASE = process.env.BASE_URL || "http://localhost:3000";
const SENHA = process.env.ADMIN_PASSWORD || "robertao123";
const CRIAR_PEDIDOS = process.env.SEED_ORDERS !== "0";

let cookie = "";

async function api(path, init = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(init.headers || {}),
    },
  });
  for (const c of res.headers.getSetCookie?.() ?? []) cookie = c.split(";")[0];
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${JSON.stringify(body)}`);
  return body;
}

const brl = (cents) => "R$ " + (cents / 100).toFixed(2).replace(".", ",");

console.log(`Populando ${BASE} ...`);

await api("/api/admin/session", { method: "POST", body: JSON.stringify({ password: SENHA }) });
console.log("  login ok");

/* ----------------------------------------------------------------- a rifa */

const TOTAL_COTAS = 80000;
const VALOR_COTA = 8; // centavos (R$ 0,08)

await api("/api/admin/raffle", {
  method: "PATCH",
  body: JSON.stringify({
    title: "R$ 2.000 no Pix",
    subtitle: "Prêmio principal de R$ 2.000 no Pix + 10 títulos premiados de R$ 100",
    description:
      "O ganhador leva R$ 2.000 no Pix, na conta, no dia do sorteio.\n\n" +
      "São 80.000 cotas de R$ 0,08 cada. Além do prêmio principal, 10 cotas " +
      "valem R$ 100 no Pix e são pagas na hora em que aparecem para o comprador.\n\n" +
      "Quanto mais cotas você garantir, maiores as chances.",
    rules:
      "1. O sorteio do prêmio principal é feito pela Loteria Federal, após a rifa atingir 100% das cotas vendidas.\n" +
      "2. Cada cota dá direito a um número único, sorteado pelo sistema após a confirmação do pagamento.\n" +
      "3. As 10 cotas premiadas de R$ 100 são reveladas assim que o pagamento é confirmado.\n" +
      "4. A cota vencedora e o ganhador são publicados no site logo após o sorteio.\n" +
      "5. O ganhador será contatado pelo telefone cadastrado em até 48 horas.\n" +
      "6. É necessário ter 18 anos ou mais para participar.",
    images: ["/placeholders/pix-2000.svg"],
    priceCents: VALOR_COTA,
    totalNumbers: TOTAL_COTAS,
    minQuantity: 1,
    maxQuantity: 5000,
    quickPicks: [50, 100, 200, 400, 500, 1000],
    drawDate: "20/12/2026 às 20h",
    status: "ativa",
    prizeChance: 12,
    reservationMinutes: 60,
    showProgress: true,
    // Cotas premiadas so comecam a sair depois de R$ 200 arrecadados.
    prizeMinRevenueCents: 20000,
    // O pagamento e todo pelo checkout da InfinitePay; nao ha Pix manual.
    pixKey: "",
    pixName: "",
    whatsapp: "5574999238282",
    whatsappGroup: "https://chat.whatsapp.com/Hrjk03WhV358ANrNCkqh8o",
    infinitepayHandle: "riquelme-pereira-wkg",
    instagram: "@robertaorifas",
    grandPrize: "R$ 2.000 no Pix",
  }),
});
console.log(
  `  rifa: R$ 2.000 · ${TOTAL_COTAS} cotas de ${brl(VALOR_COTA)} = ${brl(TOTAL_COTAS * VALOR_COTA)}`
);

/* -------------------------------------------------------- cotas premiadas */

const atuais = await api("/api/admin/prizes");
for (const prize of atuais.prizes) {
  if (prize.orderId) {
    console.log(`  mantido (já conquistado): ${prize.label}`);
    continue;
  }
  await api(`/api/admin/prizes/${prize.id}`, { method: "DELETE" });
}

const QTD_PREMIOS = 10;
for (let i = 1; i <= QTD_PREMIOS; i++) {
  await api("/api/admin/prizes", {
    method: "POST",
    body: JSON.stringify({
      label: `R$ 100 no Pix — prêmio ${i}`,
      valueCents: 10000,
      image: "/premios/cota-premiada.png",
    }),
  });
}

const sorteadas = await api("/api/admin/prizes/draw", {
  method: "POST",
  body: JSON.stringify({ reshuffle: false }),
});
const numeros = sorteadas.prizes.filter((p) => !p.orderId).map((p) => p.number);
console.log(`  ${QTD_PREMIOS} cotas premiadas de R$ 100 · cotas: ${numeros.join(", ")}`);

/* ------------------------------------------------------ compras de exemplo */

if (CRIAR_PEDIDOS) {
  // CPFs com dígito verificador válido, só para o exemplo.
  const compradores = [
    ["Ana Paula Ribeiro", "(11) 98877-6655", "ana.ribeiro@exemplo.com", "529.982.247-25", "14/05/1991", 4000, true],
    ["Carlos Eduardo Mendes", "(21) 99123-4455", "carlos.mendes@exemplo.com", "168.995.350-09", "02/11/1985", 2500, true],
    ["Juliana Alves Costa", "(31) 98456-7788", "juliana.costa@exemplo.com", "398.261.600-08", "23/07/1994", 5000, true],
    ["Marcos Vinícius Pereira", "(41) 99988-1122", "marcos.pereira@exemplo.com", "746.897.910-31", "09/02/1988", 800, false],
    ["Fernanda Lima Souza", "(51) 98321-9900", "fernanda.souza@exemplo.com", "062.418.940-64", "30/09/1996", 300, false],
  ];

  for (const [name, phone, email, cpf, birthdate, quantity, pagar] of compradores) {
    const existe = await api(`/api/admin/orders?search=${encodeURIComponent(email)}`);
    if (existe.total > 0) {
      console.log(`  ${name}: já cadastrado, pulando`);
      continue;
    }

    const pedido = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify({ name, phone, email, cpf, birthdate, quantity }),
    });

    if (!pagar) {
      console.log(`  ${name}: ${quantity} cotas (${pedido.code}) — aguardando pagamento`);
      continue;
    }

    // Confirma o pagamento: é aqui que as cotas são sorteadas.
    const pago = await api(`/api/admin/orders/${pedido.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "pago" }),
    });
    const premiadas = pago.order.prizes.length
      ? ` — ${pago.order.prizes.length} premiada(s)!`
      : "";
    console.log(
      `  ${name}: ${quantity} cotas (${pedido.code}) pago, ${pago.order.numbers.length} sorteadas${premiadas}`
    );
  }
}

const final = await api("/api/admin/raffle");
const s = final.stats;
console.log(
  `\nPronto. ${s.sold} de ${final.raffle.totalNumbers} cotas vendidas (${s.soldPercent.toFixed(1)}%), ` +
    `${s.reserved} reservadas, ${s.prizesClaimed}/${s.prizesTotal} premiadas conquistadas.`
);
console.log(`\nSite:   ${BASE}`);
console.log(`Painel: ${BASE}/admin   (senha: ${SENHA})`);
