/**
 * `npm run db:check`
 *
 * Testa uma connection string de Postgres antes de você colocá-la na Vercel.
 * Diz se conecta, qual é o servidor e se as tabelas da rifa já existem.
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." npm run db:check
 *   npm run db:check -- "postgresql://..."
 *
 * A URL não é gravada em lugar nenhum.
 */
import pg from "pg";

const url = process.argv[2] || process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!url) {
  console.error(
    "\nInforme a connection string:\n" +
      '  npm run db:check -- "postgresql://usuario:senha@host:6543/postgres"\n'
  );
  process.exit(1);
}

/* ------------------------------------------------- conferências de formato */

if (!/^postgres(ql)?:\/\//i.test(url)) {
  const esquema = url.split("://")[0];
  console.error(
    `\n[x] Essa URL começa com "${esquema}://" e não é uma connection string de Postgres.\n` +
      "    O site usa o driver `pg`, que precisa do formato postgresql://\n" +
      "    (a URL do Prisma Accelerate, prisma+postgres://, não serve).\n"
  );
  process.exit(1);
}

if (/\[YOUR-PASSWORD\]|\[SUA-SENHA\]|SUA-SENHA/i.test(url)) {
  console.error(
    "\n[x] A URL ainda está com o marcador de senha.\n" +
      "    Troque [YOUR-PASSWORD] pela senha real do banco.\n"
  );
  process.exit(1);
}

let alvo;
try {
  alvo = new URL(url);
} catch {
  console.error("\n[x] URL inválida — confira se copiou inteira.\n");
  process.exit(1);
}

console.log(`\nhost   : ${alvo.hostname}`);
console.log(`porta  : ${alvo.port || "5432"}`);
console.log(`banco  : ${alvo.pathname.replace("/", "") || "(padrão)"}`);

const ehSupabase = /supabase/i.test(alvo.hostname);
const ehPooler = /pooler/i.test(alvo.hostname) || alvo.port === "6543";
if (ehSupabase && !ehPooler) {
  console.log(
    "\n[!] Parece a conexão direta do Supabase. Em serverless (Vercel), prefira a\n" +
      "    Transaction pooler (porta 6543) — a direta estoura o limite de conexões."
  );
}

/* ----------------------------------------------------------- conexão real */

const pool = new pg.Pool({
  connectionString: url,
  max: 1,
  connectionTimeoutMillis: 15_000,
  ssl: /localhost|127\.0\.0\.1/.test(alvo.hostname) ? undefined : { rejectUnauthorized: false },
});

try {
  const { rows } = await pool.query("SELECT version(), current_database() AS db");
  console.log(`\n[ok] conectou em ${rows[0].db}`);
  console.log(`     ${rows[0].version.split(",")[0]}`);

  const tabelas = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name IN ('raffle','orders','tickets','prizes')
     ORDER BY table_name`
  );
  const nomes = tabelas.rows.map((r) => r.table_name);

  if (nomes.length === 4) {
    const cotas = await pool.query("SELECT COUNT(*)::text AS c FROM tickets");
    const pedidos = await pool.query("SELECT COUNT(*)::text AS c FROM orders");
    console.log(
      `\n[ok] tabelas da rifa já existem — ${pedidos.rows[0].c} pedido(s), ${cotas.rows[0].c} cota(s)`
    );
  } else if (nomes.length === 0) {
    console.log("\n[ok] banco vazio — as tabelas são criadas sozinhas no primeiro acesso ao site");
  } else {
    console.log(`\n[!] tabelas parciais (${nomes.join(", ")}) — o site completa no próximo acesso`);
  }

  // O advisory lock e o que garante cota unica; confirma que o servidor aceita.
  await pool.query("BEGIN");
  await pool.query("SELECT pg_advisory_xact_lock($1)", [918273645]);
  await pool.query("COMMIT");
  console.log("[ok] advisory lock funciona (é ele que impede cota repetida)");

  console.log("\nPode usar essa URL como DATABASE_URL na Vercel.\n");
} catch (err) {
  console.error(`\n[x] não conectou: ${err.message}`);
  if (/password authentication failed/i.test(err.message)) {
    console.error(
      "    Senha errada. No Supabase: Settings -> Database -> Reset database password.\n" +
        "    Se a senha tiver caracteres especiais (@ : / ?), eles precisam ser\n" +
        "    codificados na URL — @ vira %40, por exemplo."
    );
  } else if (/ENOTFOUND|EAI_AGAIN/i.test(err.message)) {
    console.error("    Host não encontrado — confira se copiou a URL inteira.");
  } else if (/timeout|ETIMEDOUT/i.test(err.message)) {
    console.error("    Tempo esgotado — confira a porta (6543 para a pooler do Supabase).");
  }
  console.error("");
  process.exitCode = 1;
} finally {
  await pool.end().catch(() => {});
}
