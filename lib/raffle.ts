import crypto from "crypto";
import type { PoolClient } from "pg";
import { query, transaction } from "@/lib/db";
import { maskName } from "@/lib/utils";
import type {
  Order,
  OrderWithNumbers,
  Prize,
  PrizeWithBuyer,
  PublicOrder,
  PublicRaffle,
  Raffle,
  RaffleStats,
  TicketRange,
  WonPrize,
} from "@/lib/types";

/** Chave do advisory lock que serializa a distribuição de cotas. */
const TICKET_LOCK = 918273645;

export class RaffleError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/* ------------------------------------------------------------------ rifa */

type Row = Record<string, any>;

function mapRaffle(row: Row): Raffle {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    images: Array.isArray(row.images) ? row.images : [],
    priceCents: row.price_cents,
    totalNumbers: row.total_numbers,
    minQuantity: row.min_quantity,
    maxQuantity: row.max_quantity,
    quickPicks: Array.isArray(row.quick_picks) ? row.quick_picks : [],
    drawDate: row.draw_date ?? "",
    status: row.status,
    prizeChance: row.prize_chance,
    reservationMinutes: row.reservation_minutes ?? 60,
    showProgress: row.show_progress ?? true,
    prizeMinRevenueCents: row.prize_min_revenue_cents ?? 0,
    pixKey: row.pix_key ?? "",
    pixName: row.pix_name ?? "",
    infinitepayHandle: row.infinitepay_handle ?? "",
    whatsapp: row.whatsapp ?? "",
    whatsappGroup: row.whatsapp_group ?? "",
    instagram: row.instagram ?? "",
    rules: row.rules ?? "",
    grandPrize: row.grand_prize ?? "",
    winnerNumber: row.winner_number ?? null,
    winnerOrderId: row.winner_order_id ?? null,
    drawnAt: row.drawn_at ? new Date(row.drawn_at).toISOString() : null,
  };
}

export async function getRaffle(): Promise<Raffle> {
  const { rows } = await query("SELECT * FROM raffle WHERE id = 1");
  if (!rows.length) throw new RaffleError("Rifa nao encontrada", 404);
  return mapRaffle(rows[0]);
}

const EDITABLE: Record<string, string> = {
  title: "title",
  subtitle: "subtitle",
  description: "description",
  images: "images",
  priceCents: "price_cents",
  totalNumbers: "total_numbers",
  minQuantity: "min_quantity",
  maxQuantity: "max_quantity",
  quickPicks: "quick_picks",
  drawDate: "draw_date",
  status: "status",
  prizeChance: "prize_chance",
  reservationMinutes: "reservation_minutes",
  showProgress: "show_progress",
  prizeMinRevenueCents: "prize_min_revenue_cents",
  pixKey: "pix_key",
  pixName: "pix_name",
  infinitepayHandle: "infinitepay_handle",
  whatsapp: "whatsapp",
  whatsappGroup: "whatsapp_group",
  instagram: "instagram",
  rules: "rules",
  grandPrize: "grand_prize",
};

const JSON_FIELDS = new Set(["images", "quickPicks"]);

export async function updateRaffle(patch: Record<string, unknown>): Promise<Raffle> {
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1)", [TICKET_LOCK]);

    if (patch.totalNumbers !== undefined) {
      const total = Number(patch.totalNumbers);
      if (!Number.isInteger(total) || total < 10 || total > 1000000) {
        throw new RaffleError("Total de cotas deve ser um inteiro entre 10 e 1.000.000.");
      }
      const { rows } = await client.query<{ max: number | null }>(
        "SELECT MAX(number) AS max FROM tickets"
      );
      const maxSold = rows[0]?.max ?? 0;
      if (maxSold && total < maxSold) {
        throw new RaffleError(
          "Nao da para reduzir para " + total + ": a cota " + maxSold + " ja foi vendida."
        );
      }
      // Cotas premiadas fora do novo intervalo voltam a ficar sem numero.
      await client.query(
        "UPDATE prizes SET number = NULL WHERE number > $1 AND order_id IS NULL",
        [total]
      );
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, column] of Object.entries(EDITABLE)) {
      if (patch[key] === undefined) continue;
      values.push(JSON_FIELDS.has(key) ? JSON.stringify(patch[key]) : patch[key]);
      sets.push(column + " = $" + values.length + (JSON_FIELDS.has(key) ? "::jsonb" : ""));
    }
    if (!sets.length) {
      const { rows } = await client.query("SELECT * FROM raffle WHERE id = 1");
      return mapRaffle(rows[0]);
    }
    sets.push("updated_at = now()");
    const { rows } = await client.query(
      "UPDATE raffle SET " + sets.join(", ") + " WHERE id = 1 RETURNING *",
      values
    );
    return mapRaffle(rows[0]);
  });
}

/* ----------------------------------------------------------- estatisticas */

/** Cotas presas em pedidos pendentes dentro da janela de reserva. */
const RESERVED_SQL = `
  SELECT COALESCE(SUM(quantity), 0)::text AS reserved FROM orders
  WHERE status = 'pendente'
    AND created_at > now() - ($1::int * interval '1 minute')`;

export async function getStats(): Promise<RaffleStats> {
  const raffle = await getRaffle();
  const [sold, reserved, orders, prizes] = await Promise.all([
    query<{ count: string }>("SELECT COUNT(*)::text AS count FROM tickets"),
    query<{ reserved: string }>(RESERVED_SQL, [raffle.reservationMinutes]),
    query<Record<string, string>>(
      `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE status = 'pago')::text AS paid,
              COUNT(*) FILTER (WHERE status = 'pendente')::text AS pending,
              COALESCE(SUM(total_cents) FILTER (WHERE status <> 'cancelado'), 0)::text AS revenue,
              COALESCE(SUM(total_cents) FILTER (WHERE status = 'pago'), 0)::text AS paid_revenue
       FROM orders`
    ),
    query<Record<string, string>>(
      `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE order_id IS NOT NULL)::text AS claimed
       FROM prizes`
    ),
  ]);

  const soldCount = Number(sold.rows[0].count);
  const reservedCount = Number(reserved.rows[0].reserved);
  return {
    sold: soldCount,
    reserved: reservedCount,
    available: Math.max(raffle.totalNumbers - soldCount - reservedCount, 0),
    soldPercent: raffle.totalNumbers ? (soldCount / raffle.totalNumbers) * 100 : 0,
    ordersCount: Number(orders.rows[0].total),
    pendingCount: Number(orders.rows[0].pending),
    paidCount: Number(orders.rows[0].paid),
    revenueCents: Number(orders.rows[0].revenue),
    paidRevenueCents: Number(orders.rows[0].paid_revenue),
    prizesTotal: Number(prizes.rows[0].total),
    prizesClaimed: Number(prizes.rows[0].claimed),
  };
}

export async function getPublicRaffle(): Promise<PublicRaffle> {
  const [raffle, stats, prizes] = await Promise.all([
    getRaffle(),
    getStats(),
    query<Row>(
      `SELECT p.id, p.label, p.value_cents, p.image, p.number, p.order_id, o.name AS buyer_name
       FROM prizes p LEFT JOIN orders o ON o.id = p.order_id
       ORDER BY p.value_cents DESC, p.id ASC`
    ),
  ]);
  return {
    ...raffle,
    // Nao expomos a quantidade de cotas disponiveis no site.
    stats: { sold: stats.sold, soldPercent: stats.soldPercent },
    prizes: prizes.rows.map((p) => ({
      id: p.id,
      label: p.label,
      valueCents: p.value_cents,
      image: p.image ?? "",
      number: p.number ?? null,
      claimed: Boolean(p.order_id),
      winner: p.buyer_name ? maskName(p.buyer_name) : null,
    })),
  };
}

/* ------------------------------------------------------ cotas premiadas */

function mapPrize(row: Row): Prize {
  return {
    id: row.id,
    label: row.label,
    valueCents: row.value_cents,
    image: row.image ?? "",
    number: row.number ?? null,
    orderId: row.order_id ?? null,
    claimedAt: row.claimed_at ? new Date(row.claimed_at).toISOString() : null,
  };
}

export async function listPrizes(): Promise<PrizeWithBuyer[]> {
  const { rows } = await query<Row>(
    `SELECT p.*, o.name AS buyer_name, o.phone AS buyer_phone, o.code AS order_code
     FROM prizes p LEFT JOIN orders o ON o.id = p.order_id
     ORDER BY p.value_cents DESC, p.id ASC`
  );
  return rows.map((row) => ({
    ...mapPrize(row),
    buyerName: row.buyer_name ?? null,
    buyerPhone: row.buyer_phone ?? null,
    orderCode: row.order_code ?? null,
  }));
}

export async function createPrize(
  label: string,
  valueCents: number,
  image = ""
): Promise<Prize> {
  if (!label.trim()) throw new RaffleError("Informe o nome do premio.");
  const { rows } = await query(
    "INSERT INTO prizes (label, value_cents, image) VALUES ($1, $2, $3) RETURNING *",
    [label.trim(), Math.max(0, Math.round(valueCents)), image.trim()]
  );
  return mapPrize(rows[0]);
}

export async function updatePrize(
  id: number,
  patch: { label?: string; valueCents?: number; image?: string; number?: number | null }
): Promise<Prize> {
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1)", [TICKET_LOCK]);
    const current = await client.query("SELECT * FROM prizes WHERE id = $1", [id]);
    if (!current.rows.length) throw new RaffleError("Premio nao encontrado", 404);
    if (current.rows[0].order_id && patch.number !== undefined) {
      throw new RaffleError("Esta cota premiada ja foi conquistada e nao pode mudar de numero.");
    }

    if (patch.number !== undefined && patch.number !== null) {
      const raffle = await client.query("SELECT total_numbers FROM raffle WHERE id = 1");
      const total = raffle.rows[0].total_numbers;
      if (patch.number < 1 || patch.number > total) {
        throw new RaffleError("A cota deve estar entre 1 e " + total + ".");
      }
      const taken = await client.query("SELECT 1 FROM tickets WHERE number = $1", [patch.number]);
      if (taken.rows.length) throw new RaffleError("Essa cota ja foi vendida.");
      const dup = await client.query("SELECT 1 FROM prizes WHERE number = $1 AND id <> $2", [
        patch.number,
        id,
      ]);
      if (dup.rows.length) throw new RaffleError("Essa cota ja esta reservada para outro premio.");
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    if (patch.label !== undefined) {
      if (!patch.label.trim()) throw new RaffleError("Informe o nome do premio.");
      values.push(patch.label.trim());
      sets.push("label = $" + values.length);
    }
    if (patch.valueCents !== undefined) {
      values.push(Math.max(0, Math.round(patch.valueCents)));
      sets.push("value_cents = $" + values.length);
    }
    if (patch.image !== undefined) {
      values.push(patch.image.trim());
      sets.push("image = $" + values.length);
    }
    if (patch.number !== undefined) {
      values.push(patch.number);
      sets.push("number = $" + values.length);
    }
    if (!sets.length) return mapPrize(current.rows[0]);
    values.push(id);
    const { rows } = await client.query(
      "UPDATE prizes SET " + sets.join(", ") + " WHERE id = $" + values.length + " RETURNING *",
      values
    );
    return mapPrize(rows[0]);
  });
}

export async function deletePrize(id: number) {
  const { rowCount } = await query("DELETE FROM prizes WHERE id = $1 AND order_id IS NULL", [id]);
  if (!rowCount) {
    throw new RaffleError("Premio nao encontrado ou ja conquistado por um participante.");
  }
}

/**
 * Sorteia números para as cotas premiadas que ainda não têm número.
 * `reshuffle` redistribui também as que já tinham número (menos as conquistadas).
 */
export async function drawPrizeNumbers(reshuffle = false): Promise<Prize[]> {
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1)", [TICKET_LOCK]);
    const raffle = await client.query("SELECT total_numbers FROM raffle WHERE id = 1");
    const total: number = raffle.rows[0].total_numbers;

    if (reshuffle) {
      await client.query("UPDATE prizes SET number = NULL WHERE order_id IS NULL");
    }

    const pending = await client.query<{ id: number }>(
      "SELECT id FROM prizes WHERE number IS NULL ORDER BY value_cents DESC, id ASC"
    );

    if (pending.rows.length) {
      const free = await client.query<{ n: number }>(
        `SELECT gs AS n FROM generate_series(1, $1) gs
         WHERE NOT EXISTS (SELECT 1 FROM tickets t WHERE t.number = gs)
           AND NOT EXISTS (SELECT 1 FROM prizes p WHERE p.number = gs)
         ORDER BY random() LIMIT $2`,
        [total, pending.rows.length]
      );
      if (free.rows.length < pending.rows.length) {
        throw new RaffleError("Nao ha cotas disponiveis suficientes para sortear todos os premios.");
      }
      for (let i = 0; i < pending.rows.length; i++) {
        await client.query("UPDATE prizes SET number = $1 WHERE id = $2", [
          free.rows[i].n,
          pending.rows[i].id,
        ]);
      }
    }

    const all = await client.query("SELECT * FROM prizes ORDER BY value_cents DESC, id ASC");
    return all.rows.map(mapPrize);
  });
}

/* --------------------------------------------------------------- pedidos */

function mapOrder(row: Row): Order {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    phone: row.phone,
    email: row.email,
    cpf: row.cpf,
    birthdate: row.birthdate,
    quantity: row.quantity,
    totalCents: row.total_cents,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : null,
    paymentId: row.payment_id ?? null,
    pixCode: row.pix_code ?? null,
    paymentToken: row.payment_token ?? null,
    pixExpiresAt: row.pix_expires_at ? new Date(row.pix_expires_at).toISOString() : null,
    paymentCheckedAt: row.payment_checked_at
      ? new Date(row.payment_checked_at).toISOString()
      : null,
  };
}

function orderCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return "RB" + out;
}

export interface BuyerInput {
  name: string;
  phone: string;
  email: string;
  cpf: string;
  birthdate: string;
  quantity: number;
}

/**
 * Cria o pedido **sem** distribuir cotas: o pedido nasce pendente e apenas
 * reserva a quantidade. Os números só são sorteados quando o pagamento é
 * confirmado (ver `confirmPayment`).
 */
export async function createOrder(input: BuyerInput): Promise<OrderWithNumbers> {
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1)", [TICKET_LOCK]);

    const raffleRes = await client.query("SELECT * FROM raffle WHERE id = 1");
    const raffle = mapRaffle(raffleRes.rows[0]);
    if (raffle.status !== "ativa") {
      throw new RaffleError("Esta rifa nao esta aceitando compras no momento.", 409);
    }

    const qty = Math.floor(input.quantity);
    if (!Number.isFinite(qty) || qty < raffle.minQuantity) {
      throw new RaffleError("A quantidade minima e de " + raffle.minQuantity + " cota(s).");
    }
    if (qty > raffle.maxQuantity) {
      throw new RaffleError("A quantidade maxima por compra e de " + raffle.maxQuantity + " cotas.");
    }

    const soldRes = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM tickets"
    );
    const reservedRes = await client.query<{ reserved: string }>(RESERVED_SQL, [
      raffle.reservationMinutes,
    ]);
    const sold = Number(soldRes.rows[0].count);
    const reserved = Number(reservedRes.rows[0].reserved);
    const available = raffle.totalNumbers - sold - reserved;

    if (available <= 0) throw new RaffleError("Todas as cotas ja foram reservadas.", 409);
    if (qty > available) {
      throw new RaffleError("Restam apenas " + available + " cota(s) disponiveis.", 409);
    }

    const id = crypto.randomUUID();
    const totalCents = qty * raffle.priceCents;
    let code = orderCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const dup = await client.query("SELECT 1 FROM orders WHERE code = $1", [code]);
      if (!dup.rows.length) break;
      code = orderCode();
    }

    const orderRes = await client.query(
      `INSERT INTO orders (id, code, name, phone, email, cpf, birthdate, quantity, total_cents, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pendente') RETURNING *`,
      [id, code, input.name, input.phone, input.email, input.cpf, input.birthdate, qty, totalCents]
    );

    return { ...mapOrder(orderRes.rows[0]), numbers: [], prizes: [] };
  });
}

/**
 * Sorteia `qty` cotas livres, segurando as premiadas no começo da rifa.
 *
 * A chance de liberação parte de `prize_chance`% e sobe até 100% quando 75%
 * da rifa foi vendida — assim os prêmios não saem nas primeiras compras, mas
 * também não ficam presos para o último comprador.
 */
async function drawNumbers(
  client: PoolClient,
  raffle: Raffle,
  qty: number,
  sold: number
): Promise<number[]> {
  const prizePool = await client.query<{ number: number }>(
    `SELECT p.number FROM prizes p
     WHERE p.number IS NOT NULL AND p.order_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM tickets t WHERE t.number = p.number)`
  );
  const prizeNumbers = prizePool.rows.map((r) => r.number);

  const plainRes = await client.query<{ n: number }>(
    `SELECT gs AS n FROM generate_series(1, $1) gs
     WHERE NOT EXISTS (SELECT 1 FROM tickets t WHERE t.number = gs)
       AND NOT EXISTS (SELECT 1 FROM prizes p WHERE p.number = gs AND p.order_id IS NULL)
     ORDER BY random() LIMIT $2`,
    [raffle.totalNumbers, qty]
  );
  const plain = plainRes.rows.map((r) => r.n);

  const available = raffle.totalNumbers - sold;
  const soldRatio = raffle.totalNumbers ? sold / raffle.totalNumbers : 0;
  const base = Math.min(Math.max(raffle.prizeChance, 0), 100) / 100;
  const ramp = Math.pow(Math.min(soldRatio / 0.75, 1), 1.5);

  // Antes do piso de arrecadacao nenhuma cota premiada sai: a rifa nao pode
  // pagar os premios com o que ainda nao entrou. `sold` ja inclui estas cotas,
  // entao o piso vale a partir do que a rifa tem em caixa agora.
  const arrecadado = sold * raffle.priceCents;
  const seguraPremios = raffle.prizeMinRevenueCents > 0 && arrecadado < raffle.prizeMinRevenueCents;
  const release = seguraPremios ? 0 : base + (1 - base) * ramp;

  const chosen: number[] = [];
  const remainingPrizes = [...prizeNumbers];
  let remainingAvailable = available;

  for (let i = 0; i < qty; i++) {
    const naturalChance = remainingAvailable > 0 ? remainingPrizes.length / remainingAvailable : 0;
    const drawsPrize =
      remainingPrizes.length > 0 &&
      (plain.length === 0 || (Math.random() < naturalChance && Math.random() < release));

    if (drawsPrize) {
      chosen.push(remainingPrizes.splice(crypto.randomInt(remainingPrizes.length), 1)[0]);
    } else if (plain.length) {
      chosen.push(plain.pop()!);
    } else if (remainingPrizes.length) {
      chosen.push(remainingPrizes.splice(crypto.randomInt(remainingPrizes.length), 1)[0]);
    } else {
      throw new RaffleError("Nao ha cotas suficientes disponiveis.", 409);
    }
    remainingAvailable--;
  }

  chosen.sort((a, b) => a - b);
  return chosen;
}

/**
 * Confirma o pagamento e **só então** sorteia e grava as cotas do pedido.
 *
 * É idempotente: chamar de novo em um pedido já pago devolve as mesmas cotas,
 * sem sortear nada novo — importante para o aviso do gateway.
 */
export async function confirmPayment(idOrCode: string): Promise<OrderWithNumbers> {
  const result = await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1)", [TICKET_LOCK]);

    const found = await client.query<Row>(
      "SELECT * FROM orders WHERE id = $1 OR code = $2 LIMIT 1",
      [isUuid(idOrCode) ? idOrCode : NIL_UUID, idOrCode.toUpperCase()]
    );
    if (!found.rows.length) throw new RaffleError("Pedido nao encontrado", 404);
    const order = found.rows[0];

    const existing = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM tickets WHERE order_id = $1",
      [order.id]
    );

    // Já tem cotas: apenas garante o status pago e devolve o que existe.
    if (Number(existing.rows[0].count) > 0) {
      if (order.status !== "pago") {
        await client.query(
          "UPDATE orders SET status = 'pago', paid_at = COALESCE(paid_at, now()) WHERE id = $1",
          [order.id]
        );
      }
      return order.id as string;
    }

    if (order.status === "cancelado") {
      throw new RaffleError("Este pedido foi cancelado e nao pode ser confirmado.", 409);
    }

    const raffleRes = await client.query("SELECT * FROM raffle WHERE id = 1");
    const raffle = mapRaffle(raffleRes.rows[0]);

    const soldRes = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM tickets"
    );
    const sold = Number(soldRes.rows[0].count);
    if (raffle.totalNumbers - sold < order.quantity) {
      throw new RaffleError(
        "Restam apenas " +
          Math.max(raffle.totalNumbers - sold, 0) +
          " cota(s) livres — nao da para liberar as " +
          order.quantity +
          " deste pedido.",
        409
      );
    }

    const chosen = await drawNumbers(client, raffle, order.quantity, sold);

    // A PK de `tickets` garante, no banco, que um numero nunca se repete.
    await client.query("INSERT INTO tickets (number, order_id) SELECT unnest($1::int[]), $2", [
      chosen,
      order.id,
    ]);
    await client.query(
      `UPDATE prizes SET order_id = $1, claimed_at = now()
       WHERE number = ANY($2::int[]) AND order_id IS NULL`,
      [order.id, chosen]
    );
    await client.query(
      "UPDATE orders SET status = 'pago', paid_at = COALESCE(paid_at, now()) WHERE id = $1",
      [order.id]
    );

    return order.id as string;
  });

  const order = await getOrder(result);
  if (!order) throw new RaffleError("Pedido nao encontrado", 404);
  return order;
}

/** Devolve as cotas e os prêmios do pedido para a rifa. */
async function releaseTickets(client: PoolClient, orderId: string) {
  await client.query("UPDATE prizes SET order_id = NULL, claimed_at = NULL WHERE order_id = $1", [
    orderId,
  ]);
  await client.query(
    "UPDATE raffle SET winner_number = NULL, winner_order_id = NULL, drawn_at = NULL WHERE winner_order_id = $1",
    [orderId]
  );
  await client.query("DELETE FROM tickets WHERE order_id = $1", [orderId]);
}

export async function setOrderStatus(
  idOrCode: string,
  status: string
): Promise<OrderWithNumbers> {
  if (!["pendente", "pago", "cancelado"].includes(status)) {
    throw new RaffleError("Status invalido.");
  }
  if (status === "pago") return confirmPayment(idOrCode);

  // Aceita o codigo do pedido tambem, como o confirmPayment ja fazia.
  const alvo = await getOrder(idOrCode);
  if (!alvo) throw new RaffleError("Pedido nao encontrado", 404);
  const id = alvo.id;

  await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1)", [TICKET_LOCK]);
    const found = await client.query("SELECT id FROM orders WHERE id = $1", [id]);
    if (!found.rows.length) throw new RaffleError("Pedido nao encontrado", 404);
    // Voltar para pendente ou cancelar libera as cotas ja distribuidas.
    await releaseTickets(client, id);
    await client.query("UPDATE orders SET status = $1, paid_at = NULL WHERE id = $2", [status, id]);
  });

  const order = await getOrder(id);
  if (!order) throw new RaffleError("Pedido nao encontrado", 404);
  return order;
}

/** Exclui o pedido e devolve as cotas (e prêmios) para a rifa. */
export async function releaseOrder(id: string) {
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1)", [TICKET_LOCK]);
    const found = await client.query("SELECT 1 FROM orders WHERE id = $1", [id]);
    if (!found.rows.length) throw new RaffleError("Pedido nao encontrado", 404);
    await releaseTickets(client, id);
    await client.query("DELETE FROM orders WHERE id = $1", [id]);
  });
}

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function hydrateOrder(row: Row): Promise<OrderWithNumbers> {
  const [tickets, prizes] = await Promise.all([
    query<{ number: number }>("SELECT number FROM tickets WHERE order_id = $1 ORDER BY number", [
      row.id,
    ]),
    query<Row>(
      "SELECT id, label, value_cents, image, number FROM prizes WHERE order_id = $1 ORDER BY value_cents DESC",
      [row.id]
    ),
  ]);
  return {
    ...mapOrder(row),
    numbers: tickets.rows.map((t) => t.number),
    prizes: prizes.rows.map(mapWonPrize),
  };
}

function mapWonPrize(p: Row): WonPrize {
  return {
    id: p.id,
    label: p.label,
    valueCents: p.value_cents,
    image: p.image ?? "",
    number: p.number,
  };
}

export async function getOrder(idOrCode: string): Promise<OrderWithNumbers | null> {
  const { rows } = await query<Row>("SELECT * FROM orders WHERE id = $1 OR code = $2 LIMIT 1", [
    isUuid(idOrCode) ? idOrCode : NIL_UUID,
    idOrCode.toUpperCase(),
  ]);
  if (!rows.length) return null;
  return hydrateOrder(rows[0]);
}

/** Versão do pedido exibida ao comprador, sem CPF nem e-mail. */
/**
 * Versao do pedido que pode sair do servidor.
 *
 * CPF, telefone, e-mail e data de nascimento ficam de fora: a tela do
 * comprador nunca precisou deles, e quem chega ao pedido pode ser so alguem
 * com o codigo em maos (print no WhatsApp) ou tentando CPFs na consulta
 * publica. Quem precisa desses dados e o painel, que exige sessao.
 */
export function toPublicOrder(order: OrderWithNumbers, reservationMinutes: number): PublicOrder {
  return {
    code: order.code,
    name: order.name,
    quantity: order.quantity,
    totalCents: order.totalCents,
    status: order.status,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    numbers: order.numbers,
    prizes: order.prizes,
    expiresAt:
      order.status === "pendente"
        ? new Date(
            new Date(order.createdAt).getTime() + reservationMinutes * 60_000
          ).toISOString()
        : null,
    // So faz sentido mostrar o Pix enquanto ha o que pagar.
    pixCode: order.status === "pendente" ? order.pixCode : null,
  };
}

export async function getPublicOrder(code: string): Promise<PublicOrder | null> {
  const order = await getOrder(code);
  if (!order) return null;
  const raffle = await getRaffle();
  return toPublicOrder(order, raffle.reservationMinutes);
}

/** Consulta publica por CPF ou telefone, ja sem os dados pessoais. */
export async function findPublicOrdersByDocument(value: string): Promise<PublicOrder[]> {
  const [orders, raffle] = await Promise.all([findOrdersByDocument(value), getRaffle()]);
  return orders.map((o) => toPublicOrder(o, raffle.reservationMinutes));
}

export async function listOrders(opts: {
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ orders: OrderWithNumbers[]; total: number }> {
  const where: string[] = [];
  const values: unknown[] = [];
  const search = opts.search?.trim();

  if (search) {
    const digits = search.replace(/\D+/g, "");
    values.push("%" + search.toLowerCase() + "%");
    const like = "$" + values.length;
    let numberClause = "";
    // So trata como numero de cota se couber em um integer do Postgres —
    // um CPF ou telefone digitado inteiro estoura o tipo.
    if (/^\d+$/.test(search) && Number(search) <= 2147483647) {
      values.push(Number(search));
      numberClause =
        " OR EXISTS (SELECT 1 FROM tickets t WHERE t.order_id = o.id AND t.number = $" +
        values.length +
        ")";
    }
    let digitsClause = "";
    if (digits.length >= 3) {
      values.push("%" + digits + "%");
      const d = "$" + values.length;
      digitsClause =
        " OR regexp_replace(o.cpf, '\\D', '', 'g') LIKE " +
        d +
        " OR regexp_replace(o.phone, '\\D', '', 'g') LIKE " +
        d;
    }
    where.push(
      "(LOWER(o.name) LIKE " +
        like +
        " OR LOWER(o.email) LIKE " +
        like +
        " OR LOWER(o.code) LIKE " +
        like +
        digitsClause +
        numberClause +
        ")"
    );
  }

  if (opts.status && opts.status !== "todos") {
    values.push(opts.status);
    where.push("o.status = $" + values.length);
  }

  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
  const countRes = await query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM orders o " + whereSql,
    values
  );

  const limit = Math.min(opts.limit ?? 30, 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  values.push(limit, offset);
  const { rows } = await query<Row>(
    "SELECT o.* FROM orders o " +
      whereSql +
      " ORDER BY o.created_at DESC LIMIT $" +
      (values.length - 1) +
      " OFFSET $" +
      values.length,
    values
  );

  const orders = await Promise.all(rows.map(hydrateOrder));
  return { orders, total: Number(countRes.rows[0].count) };
}

/* ------------------------------------------------------- consulta de cota */

export interface TicketLookup {
  number: number;
  status: "vendida" | "disponivel";
  prize: { id: number; label: string; valueCents: number; image: string; claimed: boolean } | null;
  order: Order | null;
  soldAt: string | null;
}

export async function lookupTicket(number: number): Promise<TicketLookup> {
  const raffle = await getRaffle();
  if (!Number.isInteger(number) || number < 1 || number > raffle.totalNumbers) {
    throw new RaffleError("Informe uma cota entre 1 e " + raffle.totalNumbers + ".");
  }
  const [ticket, prize] = await Promise.all([
    query<Row>(
      `SELECT o.*, t.created_at AS sold_at FROM tickets t
       JOIN orders o ON o.id = t.order_id WHERE t.number = $1`,
      [number]
    ),
    query<Row>("SELECT id, label, value_cents, image, order_id FROM prizes WHERE number = $1", [
      number,
    ]),
  ]);
  return {
    number,
    status: ticket.rows.length ? "vendida" : "disponivel",
    prize: prize.rows.length
      ? {
          id: prize.rows[0].id,
          label: prize.rows[0].label,
          valueCents: prize.rows[0].value_cents,
          image: prize.rows[0].image ?? "",
          claimed: Boolean(prize.rows[0].order_id),
        }
      : null,
    order: ticket.rows.length ? mapOrder(ticket.rows[0]) : null,
    soldAt: ticket.rows.length ? new Date(ticket.rows[0].sold_at).toISOString() : null,
  };
}

/**
 * Maior e menor cota vendida em um período — ex.: "a maior cota até
 * 20/12 às 18h". Datas ausentes significam "sem limite".
 */
export async function getTicketRange(from?: string, to?: string): Promise<TicketRange> {
  const raffle = await getRaffle();
  const fromIso = from ? new Date(from) : null;
  const toIso = to ? new Date(to) : null;
  if (fromIso && Number.isNaN(fromIso.getTime())) throw new RaffleError("Data inicial invalida.");
  if (toIso && Number.isNaN(toIso.getTime())) throw new RaffleError("Data final invalida.");
  if (fromIso && toIso && fromIso > toIso) {
    throw new RaffleError("A data inicial precisa ser anterior a data final.");
  }

  const params = [fromIso, toIso];
  const windowSql = `
    FROM tickets t JOIN orders o ON o.id = t.order_id
    WHERE o.status <> 'cancelado'
      AND ($1::timestamptz IS NULL OR t.created_at >= $1::timestamptz)
      AND ($2::timestamptz IS NULL OR t.created_at <= $2::timestamptz)`;

  const agg = await query<Row>(
    `SELECT MIN(t.number) AS lowest, MAX(t.number) AS highest,
            COUNT(*)::text AS count, COUNT(DISTINCT o.id)::text AS orders
     ${windowSql}`,
    params
  );

  const count = Number(agg.rows[0].count);
  if (!count) {
    return {
      from: fromIso ? fromIso.toISOString() : null,
      to: toIso ? toIso.toISOString() : null,
      count: 0,
      ordersCount: 0,
      revenueCents: 0,
      lowest: null,
      highest: null,
    };
  }

  const edge = async (number: number) => {
    const { rows } = await query<Row>(
      `SELECT o.*, t.created_at AS sold_at FROM tickets t
       JOIN orders o ON o.id = t.order_id WHERE t.number = $1`,
      [number]
    );
    if (!rows.length) return null;
    return {
      number,
      soldAt: new Date(rows[0].sold_at).toISOString(),
      order: mapOrder(rows[0]),
    };
  };

  const [lowest, highest] = await Promise.all([
    edge(agg.rows[0].lowest),
    edge(agg.rows[0].highest),
  ]);

  return {
    from: fromIso ? fromIso.toISOString() : null,
    to: toIso ? toIso.toISOString() : null,
    count,
    ordersCount: Number(agg.rows[0].orders),
    revenueCents: count * raffle.priceCents,
    lowest,
    highest,
  };
}

/** Consulta pública: todos os pedidos de um CPF ou telefone. */
export async function findOrdersByDocument(value: string): Promise<OrderWithNumbers[]> {
  const digits = value.replace(/\D+/g, "");
  if (digits.length < 10) throw new RaffleError("Informe o CPF completo ou o telefone com DDD.");
  const { rows } = await query<Row>(
    `SELECT * FROM orders
     WHERE regexp_replace(cpf, '\\D', '', 'g') = $1
        OR regexp_replace(phone, '\\D', '', 'g') = $1
     ORDER BY created_at DESC LIMIT 50`,
    [digits]
  );
  return Promise.all(rows.map(hydrateOrder));
}

/* ---------------------------------------------------------- sorteio final */

export interface GrandDraw {
  number: number;
  order: Order;
}

/**
 * Registra a cota vencedora do prêmio principal.
 *
 * O sorteio é feito fora do sistema (Loteria Federal); aqui o admin apenas
 * informa o número sorteado e a rifa passa a mostrar o titular daquela cota
 * como ganhador.
 */
export async function setWinnerTicket(number: number, force = false): Promise<GrandDraw> {
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1)", [TICKET_LOCK]);

    const raffleRes = await client.query("SELECT * FROM raffle WHERE id = 1");
    const total: number = raffleRes.rows[0].total_numbers;

    if (!Number.isInteger(number) || number < 1 || number > total) {
      throw new RaffleError("Informe uma cota entre 1 e " + total + ".");
    }
    if (raffleRes.rows[0].winner_number && !force) {
      throw new RaffleError(
        "Ja existe uma cota vencedora registrada. Confirme a troca para substituir."
      );
    }

    const found = await client.query<Row>(
      `SELECT o.* FROM tickets t JOIN orders o ON o.id = t.order_id WHERE t.number = $1`,
      [number]
    );
    if (!found.rows.length) {
      throw new RaffleError(
        "A cota " + number + " nao foi vendida — nao ha titular para essa cota.",
        404
      );
    }
    if (found.rows[0].status === "cancelado") {
      throw new RaffleError("A cota " + number + " pertence a um pedido cancelado.", 409);
    }

    await client.query(
      `UPDATE raffle SET winner_number = $1, winner_order_id = $2, drawn_at = now(), status = 'encerrada'
       WHERE id = 1`,
      [number, found.rows[0].id]
    );

    return { number, order: mapOrder(found.rows[0]) };
  });
}

export async function clearGrandPrize() {
  await query(
    "UPDATE raffle SET winner_number = NULL, winner_order_id = NULL, drawn_at = NULL WHERE id = 1"
  );
}

export async function getGrandWinner(): Promise<GrandDraw | null> {
  const raffle = await getRaffle();
  if (!raffle.winnerNumber || !raffle.winnerOrderId) return null;
  const { rows } = await query<Row>("SELECT * FROM orders WHERE id = $1", [raffle.winnerOrderId]);
  if (!rows.length) return null;
  return { number: raffle.winnerNumber, order: mapOrder(rows[0]) };
}

/* ------------------------------------------------------- pagamento (Pix) */

/** Guarda no pedido a cobranca Pix criada no gateway. */
export async function salvarCobranca(
  orderId: string,
  dados: { paymentId: string; pixCode: string; token: string | null; expiresAt: string | null }
) {
  await query(
    `UPDATE orders
        SET payment_id = $1, pix_code = $2, payment_token = $3,
            pix_expires_at = $4, payment_checked_at = NULL
      WHERE id = $5`,
    [dados.paymentId, dados.pixCode, dados.token, dados.expiresAt, orderId]
  );
}

/** Descarta a cobranca para que uma nova seja gerada. */
export async function limparCobranca(orderId: string) {
  await query(
    `UPDATE orders
        SET payment_id = NULL, pix_code = NULL, payment_token = NULL, pix_expires_at = NULL
      WHERE id = $1`,
    [orderId]
  );
}

/** Acha o pedido pelo id da transacao no gateway. */
export async function getOrderByPaymentId(paymentId: string): Promise<OrderWithNumbers | null> {
  const { rows } = await query<Row>("SELECT * FROM orders WHERE payment_id = $1 LIMIT 1", [
    paymentId,
  ]);
  if (!rows.length) return null;
  return hydrateOrder(rows[0]);
}

/**
 * Confirma o pagamento a partir do aviso do gateway.
 *
 * Na SigiloPay o webhook e a confirmacao — a documentacao deles pede
 * explicitamente para nao chamar de volta para conferir o evento. Entao quem
 * sustenta a seguranca aqui e o token: cada cobranca nasce com o seu, e o
 * aviso so vale se trouxer exatamente aquele. Um aviso forjado precisaria do
 * token daquele pedido, que so existe entre nos e o gateway.
 *
 * O valor tambem e conferido contra o total: pagar menos nao libera cota.
 *
 * Idempotente: reenviar o mesmo aviso nao sorteia cotas de novo, porque
 * `confirmPayment` ja trata pedido pago.
 */
export async function confirmarPagamentoPorAviso({
  code,
  token,
  valorCentavos,
}: {
  code: string;
  token: string;
  valorCentavos: number | null;
}): Promise<{ ok: boolean; motivo?: string; order?: OrderWithNumbers }> {
  const order = await getOrder(code);
  if (!order) return { ok: false, motivo: "pedido nao encontrado" };

  const esperado = order.paymentToken ?? process.env.SIGILOPAY_WEBHOOK_TOKEN ?? "";
  if (!esperado) return { ok: false, motivo: "pedido sem token de validacao" };

  const a = Buffer.from(token);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, motivo: "token invalido" };
  }

  if (order.status === "pago") return { ok: true, order };
  if (order.status === "cancelado") return { ok: false, motivo: "pedido cancelado" };

  if (valorCentavos !== null && valorCentavos < order.totalCents) {
    console.error("[pagamento] valor abaixo do pedido", order.code, valorCentavos, order.totalCents);
    return { ok: false, motivo: "valor menor que o total do pedido" };
  }

  return { ok: true, order: await confirmPayment(order.id) };
}
