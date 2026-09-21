/**
 * `npm run dev:local`
 *
 * Sobe o banco de desenvolvimento e o Next.js juntos, sem precisar de
 * Postgres instalado nem de banco na nuvem.
 *
 * Se você já tiver um DATABASE_URL definido (em .env.local, por exemplo),
 * use `npm run dev` — este script é só o atalho para o banco embutido.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { startDevDatabase } from "./dev-db.mjs";

const port = process.env.PORT || "3000";
const PASTAS_NA_NUVEM = /OneDrive|Dropbox|Google Drive|iCloud/i;

/**
 * Prepara a pasta `.next` para conviver com o OneDrive.
 *
 * Em pastas sincronizadas, o cliente de nuvem pode transformar arquivos do
 * build em placeholders (reparse points). O Node então falha com
 * "EINVAL: invalid argument, readlink" e o `next dev` morre no meio.
 *
 * Duas medidas resolvem:
 *  1. começar com `.next` limpo (build antigo/parcial é o gatilho mais comum);
 *  2. fixar a pasta com `attrib +P -U`, o "sempre manter neste dispositivo"
 *     do OneDrive, para os arquivos novos não serem desidratados.
 *
 * Só toca em conteúdo de build, que é sempre regerável.
 */
function prepararPastaDeBuild() {
  const cwd = process.cwd();
  if (!PASTAS_NA_NUVEM.test(cwd)) return;

  const nextPath = path.join(cwd, ".next");
  try {
    fs.rmSync(nextPath, { recursive: true, force: true });
  } catch (err) {
    console.warn(`[next] nao consegui limpar .next (${err.code}); seguindo.`);
  }

  fs.mkdirSync(nextPath, { recursive: true });

  if (process.platform === "win32") {
    // +P mantem os arquivos sempre locais; -U desmarca "somente na nuvem".
    const r = spawnSync("attrib.exe", ["+P", "-U", nextPath, "/s", "/d"], {
      stdio: "ignore",
    });
    if (r.status === 0) {
      console.log("[next] .next limpo e fixado como local (fora do sync do OneDrive)");
      return;
    }
  }
  console.log("[next] .next limpo para evitar o erro EINVAL/readlink do OneDrive");
}

prepararPastaDeBuild();

const db = await startDevDatabase();

const next = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "dev", "-p", port],
  {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: db.url },
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
