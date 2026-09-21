/**
 * Banco Postgres local para desenvolvimento.
 *
 * Sobe um Postgres embutido (PGlite) falando o protocolo real do Postgres em
 * 127.0.0.1:54321, com os dados gravados em `.pgdata/` — ou seja, o que voce
 * cadastrar continua ali depois de fechar o servidor.
 *
 * So e usado em desenvolvimento. Em producao, defina DATABASE_URL apontando
 * para o Postgres de verdade (Vercel/Neon/Supabase).
 */
import net from "node:net";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { fromNodeSocket } from "pg-gateway/node";

export const DEV_DB_PORT = 54321;
export const DEV_DB_URL = `postgres://postgres@127.0.0.1:${DEV_DB_PORT}/postgres`;

export async function startDevDatabase({ dataDir = ".pgdata", quiet = false } = {}) {
  const db = new PGlite(path.resolve(process.cwd(), dataDir));
  await db.waitReady;

  const server = net.createServer(async (socket) => {
    try {
      await fromNodeSocket(socket, {
        serverVersion: "16.3",
        auth: { method: "trust" },
        async onStartup() {
          await db.waitReady;
        },
        async onMessage(data, { isAuthenticated }) {
          if (!isAuthenticated) return;
          return await db.execProtocolRaw(data);
        },
      });
    } catch (err) {
      console.error("[db] conexao falhou:", err.message);
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(DEV_DB_PORT, "127.0.0.1", resolve);
  });

  if (!quiet) console.log(`[db] Postgres local em ${DEV_DB_URL} (dados em ${dataDir}/)`);

  return {
    url: DEV_DB_URL,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await db.close();
    },
  };
}

// Permite rodar sozinho: `node scripts/dev-db.mjs`
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  await startDevDatabase();
}
