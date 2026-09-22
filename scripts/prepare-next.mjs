/**
 * Começa o Next com a pasta `.next` limpa quando o projeto está em uma pasta
 * sincronizada na nuvem (OneDrive/Dropbox/Google Drive).
 *
 * Nesses casos, um build antigo ou interrompido faz o Next quebrar com
 * "EINVAL: invalid argument, readlink ...", tanto no `dev` quanto no `build`.
 * Descartar o build anterior resolve — e é sempre seguro, porque `.next` é
 * conteúdo gerado.
 *
 * Fora de pastas sincronizadas (Vercel, por exemplo) não faz nada, para não
 * jogar fora o cache de build.
 *
 * Obs.: não fixe a pasta com `attrib +P` — o atributo "pinned" faz o
 * `next build` falhar exatamente com o mesmo EINVAL.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PASTAS_NA_NUVEM = /OneDrive|Dropbox|Google Drive|iCloud/i;

export function prepararPastaDeBuild({ silencioso = false } = {}) {
  const cwd = process.cwd();
  if (!PASTAS_NA_NUVEM.test(cwd)) return false;

  const nextPath = path.join(cwd, ".next");
  if (!fs.existsSync(nextPath)) return false;

  try {
    fs.rmSync(nextPath, { recursive: true, force: true });
    if (!silencioso) {
      console.log("[next] .next anterior descartado (evita o EINVAL/readlink em pasta sincronizada)");
    }
    return true;
  } catch (err) {
    if (!silencioso) {
      console.warn(
        `[next] nao consegui limpar .next (${err.code}). Se o Next quebrar com EINVAL, apague .next manualmente.`
      );
    }
    return false;
  }
}

// Permite rodar sozinho: `node scripts/prepare-next.mjs`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  prepararPastaDeBuild();
}
