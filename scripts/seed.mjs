/**
 * `npm run seed`
 *
 * Preenche o banco com uma rifa de exemplo, cotas premiadas e algumas compras,
 * para você navegar pelo site e pelo painel com conteúdo real.
 *
 * Usa a própria API do site, então o servidor precisa estar rodando.
 * Variáveis opcionais: BASE_URL (padrão http://localhost:3000) e ADMIN_PASSWORD.
 */
const BASE = process.env.BASE_URL || "http://localhost:3000";
const SENHA = process.env.ADMIN_PASSWORD || "robertao123";

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

console.log(`Populando ${BASE} ...`);

await api("/api/admin/session", { method: "POST", body: JSON.stringify({ password: SENHA }) });
console.log("  login ok");

await api("/api/admin/raffle", {
  method: "PATCH",
  body: JSON.stringify({
    title: "Honda Africa Twin CRF 1100L 0km",
    subtitle: "A big trail dos seus sonhos, zero quilômetro e emplacada.",
    description:
      "Honda Africa Twin CRF 1100L 2026, 0km, na cor prata.\n\n" +
      "Documentação e emplacamento por nossa conta. Entrega em qualquer capital do Brasil " +
      "ou retirada na loja, como o ganhador preferir.\n\n" +
      "O ganhador pode optar por receber o valor equivalente em dinheiro via Pix.",
    rules:
      "1. O sorteio será realizado pela Loteria Federal na data informada.\n" +
      "2. Cada cota dá direito a um número único, gerado automaticamente pelo sistema.\n" +
      "3. As cotas premiadas são reveladas na hora da compra.\n" +
      "4. O ganhador será contatado pelo telefone cadastrado em até 48 horas.\n" +
      "5. É necessário ter 18 anos ou mais para participar.",
    images: ["/placeholders/africa-twin.svg"],
    priceCents: 500,
    totalNumbers: 2000,
    minQuantity: 1,
    maxQuantity: 500,
    quickPicks: [5, 10, 25, 50, 100, 250],
    drawDate: "20/12/2026 às 20h",
    status: "ativa",
    prizeChance: 12,
    pixKey: "rifas@robertao.com.br",
    pixName: "Roberto Alves da Silva",
    whatsapp: "5511999990000",
    instagram: "@robertaorifas",
    grandPrize: "Honda Africa Twin CRF 1100L 0km",
  }),
});
console.log("  rifa configurada");

const premios = [
  ["Pix de R$ 1.000", 100000],
  ["Pix de R$ 500", 50000],
  ["Pix de R$ 300", 30000],
  ["Smart TV 50 polegadas", 220000],
  ["iPhone 15", 450000],
  ["Capacete + kit de viagem", 180000],
];

const atuais = await api("/api/admin/prizes");
if (atuais.prizes.length === 0) {
  for (const [label, valueCents] of premios) {
    await api("/api/admin/prizes", { method: "POST", body: JSON.stringify({ label, valueCents }) });
  }
  console.log(`  ${premios.length} cotas premiadas cadastradas`);
}

const sorteadas = await api("/api/admin/prizes/draw", {
  method: "POST",
  body: JSON.stringify({ reshuffle: false }),
});
console.log(`  números secretos sorteados: ${sorteadas.prizes.map((p) => p.number).join(", ")}`);

// CPFs válidos (dígitos verificadores corretos) só para o exemplo.
const compradores = [
  ["Ana Paula Ribeiro", "(11) 98877-6655", "ana.ribeiro@exemplo.com", "529.982.247-25", "14/05/1991", 50],
  ["Carlos Eduardo Mendes", "(21) 99123-4455", "carlos.mendes@exemplo.com", "168.995.350-09", "02/11/1985", 25],
  ["Juliana Alves Costa", "(31) 98456-7788", "juliana.costa@exemplo.com", "398.261.600-08", "23/07/1994", 100],
  ["Marcos Vinícius Pereira", "(41) 99988-1122", "marcos.pereira@exemplo.com", "746.897.910-31", "09/02/1988", 10],
  ["Fernanda Lima Souza", "(51) 98321-9900", "fernanda.souza@exemplo.com", "062.418.940-64", "30/09/1996", 75],
];

for (const [name, phone, email, cpf, birthdate, quantity] of compradores) {
  // Evita duplicar compras se o seed rodar mais de uma vez.
  const existe = await api(`/api/admin/orders?search=${encodeURIComponent(email)}`);
  if (existe.total > 0) {
    console.log(`  ${name}: já cadastrado, pulando`);
    continue;
  }
  const pedido = await api("/api/orders", {
    method: "POST",
    body: JSON.stringify({ name, phone, email, cpf, birthdate, quantity }),
  });
  const premiadas = pedido.prizes.length ? ` — ${pedido.prizes.length} premiada(s)!` : "";
  console.log(`  ${name}: ${quantity} cotas (${pedido.code})${premiadas}`);
}

const final = await api("/api/admin/raffle");
console.log(
  `\nPronto. ${final.stats.sold} de ${final.raffle.totalNumbers} cotas vendidas ` +
    `(${final.stats.soldPercent.toFixed(1)}%), ${final.stats.prizesClaimed}/${final.stats.prizesTotal} premiadas conquistadas.`
);
console.log(`\nSite:   ${BASE}`);
console.log(`Painel: ${BASE}/admin   (senha: ${SENHA})`);
