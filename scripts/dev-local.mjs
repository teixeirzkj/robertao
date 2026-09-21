/**
 * `npm run dev:local`
 *
 * Sobe o banco de desenvolvimento e o Next.js juntos, sem precisar de
 * Postgres instalado nem de banco na nuvem.
 *
 * Se você já tiver um DATABASE_URL definido (em .env.local, por exemplo),
 * use `npm run dev` — este script é só o atalho para o banco embutido.
 */
import { spawn } from "node:child_process";
import { startDevDatabase } from "./dev-db.mjs";
import { prepararPastaDeBuild } from "./prepare-next.mjs";

const port = process.env.PORT || "3000";

prepararPastaDeBuild();

const db = await startDevDatabase();

const next = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "dev", "-p", port],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: db.url,
      // O banco embutido serve todas as conexoes na mesma sessao Postgres;
      // uma conexao so mantem as transacoes em fila. Ver lib/db.ts.
      DEV_SINGLE_CONNECTION: "1",
    },
    shell: process.platform === "win32",
  }
);

async function shutdown(code = 0) {
  await db.close().catch(() => {});
  process.exit(code);
}

next.on("exit", (code) => shutdown(code ?? 0));
process.on("SIGINT", () => next.kill("SIGINT"));
process.on("SIGTERM", () => next.kill("SIGTERM"));
