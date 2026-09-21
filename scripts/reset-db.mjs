/**
 * `npm run reset`
 *
 * Apaga o banco local de desenvolvimento (.pgdata/). As tabelas são recriadas
 * vazias na próxima vez que o site consultar o banco.
 *
 * Só afeta o ambiente local — não toca no banco de producao.
 */
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(process.cwd(), ".pgdata");

if (!fs.existsSync(dir)) {
  console.log("Nada para apagar: .pgdata/ nao existe.");
  process.exit(0);
}

if (!process.argv.includes("--sim") && !process.argv.includes("-y")) {
  console.log("Isto apaga TODOS os pedidos, cotas e premios do banco local.");
  console.log("Para confirmar, rode:  npm run reset -- --sim");
  process.exit(1);
}

fs.rmSync(dir, { recursive: true, force: true });
console.log("Banco local apagado. Suba o site (npm run dev:local) e rode `npm run seed`.");
