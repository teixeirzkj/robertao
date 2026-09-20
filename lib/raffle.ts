import crypto from "crypto";
import { query, transaction } from "@/lib/db";
import type {
  Order,
  OrderWithNumbers,
  Prize,
  PrizeWithBuyer,
  PublicRaffle,
  Raffle,
  RaffleStats,
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
    pixKey: row.pix_key ?? "",
    pixName: row.pix_name ?? "",
    whatsapp: row.whatsapp ?? "",
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
  pixKey: "pix_key",
  pixName: "pix_name",
  whatsapp: "whatsapp",
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

export async function getStats(): Promise<RaffleStats> {
  const [raffle, sold, orders, prizes] = await Promise.all([
    getRaffle(),
    query<{ count: string }>("SELECT COUNT(*)::text AS count FROM tickets"),
    query<Record<string, string>>(
      `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE status = 'pago')::text AS paid,
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
  return {
    sold: soldCount,
    available: Math.max(raffle.totalNumbers - soldCount, 0),
    soldPercent: raffle.totalNumbers ? (soldCount / raffle.totalNumbers) * 100 : 0,
    ordersCount: Number(orders.rows[0].total),
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
    query<Row>("SELECT id, label, value_cents, order_id FROM prizes ORDER BY value_cents DESC, id ASC"),
  ]);
  return {
    ...raffle,
    stats: { sold: stats.sold, available: stats.available, soldPercent: stats.soldPercent },
    prizes: prizes.rows.map((p) => ({
      id: p.id,
      label: p.label,
      valueCents: p.value_cents,
      claimed: Boolean(p.order_id),
    })),
  };
}

/* ------------------------------------------------------ cotas premiadas */

function mapPrize(row: Row): Prize {
  return {
    id: row.id,
    label: row.label,
    valueCents: row.value_cents,
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

export async function createPrize(label: string, valueCents: number): Promise<Prize> {
  if (!label.trim()) throw new RaffleError("Informe o nome do premio.");
  const { rows } = await query(
    "INSERT INTO prizes (label, value_cents) VALUES ($1, $2) RETURNING *",
    [label.trim(), Math.max(0, Math.round(valueCents))]
  );
  return mapPrize(rows[0]);
}

export async function updatePrize(
  id: number,
  patch: { label?: string; valueCents?: number; number?: number | null }
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
      values.push(patch.label.trim());
      sets.push("label = $" + values.length);
    }
    if (patch.valueCents !== undefined) {
      values.push(Math.max(0, Math.round(patch.valueCents)));
      sets.push("value_cents = $" + values.length);
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
 * Sorteia numeros para as cotas premiadas que ainda nao tem numero.
 * `reshuffle` redistribui tambem as que ja tinham numero (menos as conquistadas).
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
 * Cria o pedido e distribui as cotas de forma atomica.
 *
 * As cotas premiadas ficam "mais dificeis" no comeco da rifa: a chance de
 * liberacao parte de `prize_chance`% e sobe ate 100% conforme a rifa enche,
 * entao ninguem leva os premios logo nas primeiras compras.
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
    const sold = Number(soldRes.rows[0].count);
    const available = raffle.totalNumbers - sold;
    if (available <= 0) throw new RaffleError("Todas as cotas ja foram vendidas.", 409);
    if (qty > available) {
      throw new RaffleError("Restam apenas " + available + " cota(s) disponiveis.", 409);
    }

    // Cotas premiadas ainda nao conquistadas.
    const prizePool = await client.query<{ number: number }>(
      `SELECT p.number FROM prizes p
       WHERE p.number IS NOT NULL AND p.order_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM tickets t WHERE t.number = p.number)`
    );
    const prizeNumbers = prizePool.rows.map((r) => r.number);

    // Candidatos comuns suficientes para cobrir o pedido inteiro.
    const plainRes = await client.query<{ n: number }>(
      `SELECT gs AS n FROM generate_series(1, $1) gs
       WHERE NOT EXISTS (SELECT 1 FROM tickets t WHERE t.number = gs)
         AND NOT EXISTS (SELECT 1 FROM prizes p WHERE p.number = gs AND p.order_id IS NULL)
       ORDER BY random() LIMIT $2`,
      [raffle.totalNumbers, qty]
    );
    const plain = plainRes.rows.map((r) => r.n);

    const soldRatio = raffle.totalNumbers ? sold / raffle.totalNumbers : 0;
    const base = Math.min(Math.max(raffle.prizeChance, 0), 100) / 100;
    // Curva de liberacao: comeca em `base`, sobe devagar e chega a 100% quando
    // 75% da rifa foi vendida — assim os premios nao saem logo nas primeiras
    // compras, mas tambem nao ficam todos presos para o ultimo comprador.
    const ramp = Math.pow(Math.min(soldRatio / 0.75, 1), 1.5);
    const release = base + (1 - base) * ramp;

    const chosen: number[] = [];
    const remainingPrizes = [...prizeNumbers];
    let remainingAvailable = available;

    for (let i = 0; i < qty; i++) {
      const naturalChance =
        remainingAvailable > 0 ? remainingPrizes.length / remainingAvailable : 0;
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

    const id = crypto.randomUUID();
    const totalCents = qty * raffle.priceCents;
    let code = orderCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const dup = await client.query("SELECT 1 FROM orders WHERE code = $1", [code]);
      if (!dup.rows.length) break;
      code = orderCode();
    }

    const orderRes = await client.query(
      `INSERT INTO orders (id, code, name, phone, email, cpf, birthdate, quantity, total_cents)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, code, input.name, input.phone, input.email, input.cpf, input.birthdate, qty, totalCents]
    );

    // A PK de `tickets` garante, no banco, que um numero nunca se repete.
    await client.query("INSERT INTO tickets (number, order_id) SELECT unnest($1::int[]), $2", [
      chosen,
      id,
    ]);

    const wonRes = await client.query<Row>(
      `UPDATE prizes SET order_id = $1, claimed_at = now()
       WHERE number = ANY($2::int[]) AND order_id IS NULL
       RETURNING id, label, value_cents, number`,
      [id, chosen]
    );

    return {
      ...mapOrder(orderRes.rows[0]),
      numbers: chosen,
      prizes: wonRes.rows.map((p) => ({
        id: p.id,
        label: p.label,
        valueCents: p.value_cents,
        number: p.number,
      })),
    };
  });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function hydrateOrder(row: Row): Promise<OrderWithNumbers> {
  const [tickets, prizes] = await Promise.all([
    query<{ number: number }>("SELECT number FROM tickets WHERE order_id = $1 ORDER BY number", [
      row.id,
    ]),
    query<Row>(
      "SELECT id, label, value_cents, number FROM prizes WHERE order_id = $1 ORDER BY value_cents DESC",
      [row.id]
    ),
  ]);
  return {
    ...mapOrder(row),
    numbers: tickets.rows.map((t) => t.number),
    prizes: prizes.rows.map((p) => ({
      id: p.id,
      label: p.label,
      valueCents: p.value_cents,
      number: p.number,
    })),
  };
}

export async function getOrder(idOrCode: string): Promise<OrderWithNumbers | null> {
  const { rows } = await query<Row>("SELECT * FROM orders WHERE id = $1 OR code = $2 LIMIT 1", [
    isUuid(idOrCode) ? idOrCode : "00000000-0000-0000-0000-000000000000",
    idOrCode.toUpperCase(),
  ]);
  if (!rows.length) return null;
  return hydrateOrder(rows[0]);
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

export async function setOrderStatus(id: string, status: string): Promise<Order> {
  if (!["pendente", "pago", "cancelado"].includes(status)) {
    throw new RaffleError("Status invalido.");
  }
  const { rows } = await query<Row>(
    `UPDATE orders SET status = $1, paid_at = CASE WHEN $1 = 'pago' THEN now() ELSE NULL END
     WHERE id = $2 RETURNING *`,
    [status, id]
  );
  if (!rows.length) throw new RaffleError("Pedido nao encontrado", 404);
  return mapOrder(rows[0]);
}

/** Exclui o pedido e devolve as cotas (e premios) para a rifa. */
export async function releaseOrder(id: string) {
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1)", [TICKET_LOCK]);
    const found = await client.query("SELECT 1 FROM orders WHERE id = $1", [id]);
    if (!found.rows.length) throw new RaffleError("Pedido nao encontrado", 404);
    await client.query("UPDATE prizes SET order_id = NULL, claimed_at = NULL WHERE order_id = $1", [
      id,
    ]);
    await client.query("UPDATE raffle SET winner_number = NULL, winner_order_id = NULL, drawn_at = NULL WHERE winner_order_id = $1", [id]);
    await client.query("DELETE FROM tickets WHERE order_id = $1", [id]);
    await client.query("DELETE FROM orders WHERE id = $1", [id]);
  });
}

/* ------------------------------------------------------- consulta de cota */

export interface TicketLookup {
  number: number;
  status: "vendida" | "disponivel";
  prize: { id: number; label: string; valueCents: number; claimed: boolean } | null;
  order: Order | null;
}

export async function lookupTicket(number: number): Promise<TicketLookup> {
  const raffle = await getRaffle();
  if (!Number.isInteger(number) || number < 1 || number > raffle.totalNumbers) {
    throw new RaffleError("Informe uma cota entre 1 e " + raffle.totalNumbers + ".");
  }
  const [ticket, prize] = await Promise.all([
    query<Row>("SELECT o.* FROM tickets t JOIN orders o ON o.id = t.order_id WHERE t.number = $1", [
      number,
    ]),
    query<Row>("SELECT id, label, value_cents, order_id FROM prizes WHERE number = $1", [number]),
  ]);
  return {
    number,
    status: ticket.rows.length ? "vendida" : "disponivel",
    prize: prize.rows.length
      ? {
          id: prize.rows[0].id,
          label: prize.rows[0].label,
          valueCents: prize.rows[0].value_cents,
          claimed: Boolean(prize.rows[0].order_id),
        }
      : null,
    order: ticket.rows.length ? mapOrder(ticket.rows[0]) : null,
  };
}

/** Consulta publica: todos os pedidos de um CPF ou telefone. */
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

export async function drawGrandPrize(force = false): Promise<GrandDraw> {
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1)", [TICKET_LOCK]);
    const raffleRes = await client.query("SELECT * FROM raffle WHERE id = 1");
    if (raffleRes.rows[0].winner_number && !force) {
      throw new RaffleError("O sorteio final ja foi realizado. Use 'refazer' para sortear de novo.");
    }
    const pick = await client.query<{ number: number; order_id: string }>(
      `SELECT t.number, t.order_id FROM tickets t
       JOIN orders o ON o.id = t.order_id
       WHERE o.status <> 'cancelado'
       ORDER BY random() LIMIT 1`
    );
    if (!pick.rows.length) throw new RaffleError("Nenhuma cota vendida para sortear.");

    await client.query(
      `UPDATE raffle SET winner_number = $1, winner_order_id = $2, drawn_at = now(), status = 'encerrada'
       WHERE id = 1`,
      [pick.rows[0].number, pick.rows[0].order_id]
    );
    const order = await client.query("SELECT * FROM orders WHERE id = $1", [pick.rows[0].order_id]);
    return { number: pick.rows[0].number, order: mapOrder(order.rows[0]) };
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
