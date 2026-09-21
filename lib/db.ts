import { Pool, type PoolClient } from "pg";

/**
 * Conexão única com o Postgres (Neon, Vercel Postgres, Supabase, Railway...).
 * Em serverless cada instância mantém um pool pequeno; use sempre a URL
 * "pooled" do provedor quando existir.
 */

declare global {
  // eslint-disable-next-line no-var
  var __rifaPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __rifaSchemaReady: Promise<void> | undefined;
}

function connectionString() {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_POSTGRES_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL não configurada. Crie um Postgres (Neon/Vercel/Supabase) e defina a variável de ambiente."
    );
  }
  return url;
}

export function getPool(): Pool {
  if (!global.__rifaPool) {
    const url = connectionString();
    global.__rifaPool = new Pool({
      connectionString: url,
      /**
       * O banco embutido de desenvolvimento (`npm run dev:local`) roda o
       * Postgres em modo single-user: todas as conexoes caem na MESMA sessao,
       * onde `pg_advisory_xact_lock` nao isola nada e dois BEGIN/COMMIT
       * simultaneos se intercalam. Com uma conexao so, as transacoes ficam em
       * fila e o comportamento bate com o de um Postgres de verdade.
       * Em producao cada conexao e uma sessao propria, entao usamos o pool.
       */
      max: process.env.DEV_SINGLE_CONNECTION === "1" ? 1 : 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 15_000,
      ssl: /localhost|127\.0\.0\.1/.test(url)
        ? undefined
        : { rejectUnauthorized: false },
    });
  }
  return global.__rifaPool;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS raffle (
  id               INTEGER PRIMARY KEY DEFAULT 1,
  title            TEXT NOT NULL DEFAULT 'Rifa Robertão',
  subtitle         TEXT NOT NULL DEFAULT 'Concorra a um prêmio incrível',
  description      TEXT NOT NULL DEFAULT '',
  images           JSONB NOT NULL DEFAULT '[]'::jsonb,
  price_cents      INTEGER NOT NULL DEFAULT 500,
  total_numbers    INTEGER NOT NULL DEFAULT 1000,
  min_quantity     INTEGER NOT NULL DEFAULT 1,
  max_quantity     INTEGER NOT NULL DEFAULT 1000,
  quick_picks      JSONB NOT NULL DEFAULT '[5,10,25,50,100,250]'::jsonb,
  draw_date        TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'ativa',
  prize_chance     INTEGER NOT NULL DEFAULT 12,
  pix_key          TEXT NOT NULL DEFAULT '',
  pix_name         TEXT NOT NULL DEFAULT '',
  whatsapp         TEXT NOT NULL DEFAULT '',
  instagram        TEXT NOT NULL DEFAULT '',
  rules            TEXT NOT NULL DEFAULT '',
  grand_prize      TEXT NOT NULL DEFAULT '',
  winner_number    INTEGER,
  winner_order_id  TEXT,
  drawn_at         TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT raffle_singleton CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS orders (
  id           TEXT PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  phone        TEXT NOT NULL,
  email        TEXT NOT NULL,
  cpf          TEXT NOT NULL,
  birthdate    TEXT NOT NULL,
  quantity     INTEGER NOT NULL,
  total_cents  INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pendente',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS orders_cpf_idx ON orders (cpf);
CREATE INDEX IF NOT EXISTS orders_phone_idx ON orders (phone);
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC);

CREATE TABLE IF NOT EXISTS tickets (
  number     INTEGER PRIMARY KEY,
  order_id   TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tickets_order_idx ON tickets (order_id);

CREATE TABLE IF NOT EXISTS prizes (
  id          SERIAL PRIMARY KEY,
  label       TEXT NOT NULL,
  value_cents INTEGER NOT NULL DEFAULT 0,
  number      INTEGER UNIQUE,
  order_id    TEXT REFERENCES orders(id) ON DELETE SET NULL,
  claimed_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prizes_number_idx ON prizes (number);

INSERT INTO raffle (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Colunas acrescentadas depois da primeira versao (idempotente).
ALTER TABLE prizes ADD COLUMN IF NOT EXISTS image TEXT NOT NULL DEFAULT '';
ALTER TABLE raffle ADD COLUMN IF NOT EXISTS reservation_minutes INTEGER NOT NULL DEFAULT 60;

-- Consultas de maior/menor cota por periodo.
CREATE INDEX IF NOT EXISTS tickets_created_idx ON tickets (created_at);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status, created_at DESC);
`;

export async function ensureSchema() {
  if (!global.__rifaSchemaReady) {
    global.__rifaSchemaReady = (async () => {
      const pool = getPool();
      await pool.query(SCHEMA);
    })().catch((err) => {
      global.__rifaSchemaReady = undefined;
      throw err;
    });
  }
  return global.__rifaSchemaReady;
}

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
) {
  await ensureSchema();
  return getPool().query<T>(text, params);
}

/** Executa um bloco dentro de uma transação, com rollback automático em erro. */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
