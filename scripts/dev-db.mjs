/**
 * Banco Postgres local para desenvolvimento.
 *
 * Sobe um Postgres embutido (PGlite) falando o protocolo real do Postgres em
 * 127.0.0.1:54321, com os dados gravados em disco — ou seja, o que voce
 * cadastrar continua ali depois de fechar o servidor.
 *
 * So e usado em desenvolvimento. Em producao, defina DATABASE_URL apontando
 * para o Postgres de verdade (Vercel/Neon/Supabase).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { fromNodeSocket } from "pg-gateway/node";

export const DEV_DB_PORT = 54321;
export const DEV_DB_URL = `postgres://postgres@127.0.0.1:${DEV_DB_PORT}/postgres`;

const PASTAS_NA_NUVEM = /OneDrive|Dropbox|Google Drive|iCloud/i;

/**
 * Onde guardar os dados do Postgres.
 *
 * Dentro do projeto seria mais pratico, mas em pastas sincronizadas o cliente
 * de nuvem mexe nos arquivos enquanto o Postgres os usa e **corrompe o banco**
 * ("PGlite failed to initialize properly", sem recuperacao). Nesses casos os
 * dados vao para o temp do sistema, em um caminho fixo derivado do projeto —
 * continuam persistindo entre execucoes, mas fora do alcance do sync.
 *
 * DEV_DB_DIR sobrescreve a escolha.
 */
export function resolverDataDir() {
  if (process.env.DEV_DB_DIR) return path.resolve(process.env.DEV_DB_DIR);

  const cwd = process.cwd();
  if (!PASTAS_NA_NUVEM.test(cwd)) return path.join(cwd, ".pgdata");

  const hash = crypto.createHash("sha1").update(cwd).digest("hex").slice(0, 10);
  return path.join(os.tmpdir(), `rifa-pgdata-${hash}`);
}

/**
 * Quando o servidor e encerrado a forca (kill, queda), sobra um
 * `postmaster.pid` e o Postgres se recusa a subir. Aqui nunca ha um segundo
 * servidor usando esses dados — a porta 54321 ja teria falhado antes —,
 * entao o lock e sempre orfao.
 */
function limparLockOrfao(dir) {
  const pid = path.join(dir, "postmaster.pid");
  if (!fs.existsSync(pid)) return false;
  try {
    fs.rmSync(pid);
    return true;
  } catch {
    return false;
  }
}

export async function startDevDatabase({ dataDir, quiet = false } = {}) {
  const dir = dataDir ? path.resolve(process.cwd(), dataDir) : resolverDataDir();

  if (limparLockOrfao(dir) && !quiet) {
    console.log("[db] lock orfao de uma execucao anterior removido");
  }

  let db;
  try {
    db = new PGlite(dir);
    await db.waitReady;
  } catch (err) {
    // Banco danificado: avisa com clareza em vez de despejar o stack do wasm.
    console.error(
      `\n[db] nao foi possivel abrir o banco local em ${dir}\n` +
        `     (${err.message})\n\n` +
        "     Os dados provavelmente foram corrompidos por um encerramento abrupto.\n" +
        "     Para comecar de novo:  npm run reset -- --sim   e depois  npm run seed\n"
    );
    throw new Error("banco de desenvolvimento inacessivel");
  }

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

  if (!quiet) console.log(`[db] Postgres local em ${DEV_DB_URL}\n[db] dados em ${dir}`);

  return {
    url: DEV_DB_URL,
    dataDir: dir,
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
