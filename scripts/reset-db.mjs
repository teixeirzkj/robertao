/**
 * `npm run reset -- --sim`
 *
 * Apaga o banco local de desenvolvimento. As tabelas sao recriadas vazias na
 * proxima vez que o site consultar o banco.
 *
 * So afeta o ambiente local — nao toca no banco de producao.
 */
import fs from "node:fs";
import path from "node:path";
import { resolverDataDir } from "./dev-db.mjs";

const dir = resolverDataDir();
// A pasta antiga dentro do projeto tambem e limpa, se existir.
const antiga = path.join(process.cwd(), ".pgdata");
const alvos = [...new Set([dir, antiga])].filter((d) => fs.existsSync(d));

if (!alvos.length) {
  console.log(`Nada para apagar. O banco local ficaria em:\n  ${dir}`);
  process.exit(0);
}

if (!process.argv.includes("--sim") && !process.argv.includes("-y")) {
  console.log("Isto apaga TODOS os pedidos, cotas e premios do banco local:");
  for (const d of alvos) console.log(`  ${d}`);
  console.log("\nPara confirmar, rode:  npm run reset -- --sim");
  process.exit(1);
}

for (const d of alvos) {
  fs.rmSync(d, { recursive: true, force: true });
  console.log(`apagado: ${d}`);
}
console.log("\nSuba o site (npm run dev:local) e rode `npm run seed`.");
