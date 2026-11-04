/**
 * KOPPAFOOT — Lance toutes les vérifications du site : chaque
 * `scripts/test-*.ts`, l'un après l'autre, et échoue si un seul échoue.
 *
 * Un nouveau `scripts/test-*.ts` est pris tout seul. Ceux qui ont besoin d'une
 * base, d'un réseau ou de secrets ne tournent pas ici (ni en CI) : ils sont
 * listés dans HORS_CI, avec la raison.
 *
 * Usage:
 *   npm test
 *   npm test -- dribbles gardiens     (seulement ceux dont le nom contient l'un des mots)
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HORS_CI = {
  // Appelle les vraies routes avec de vrais jetons Firebase (.env.local).
  "test-registration-flow.ts": "bout en bout, base et réseau réels",
};

const dossier = dirname(fileURLToPath(import.meta.url));
const filtres = process.argv.slice(2);

const fichiers = readdirSync(dossier)
  .filter((f) => /^test-.+\.ts$/.test(f) && !(f in HORS_CI))
  .filter((f) => filtres.length === 0 || filtres.some((mot) => f.includes(mot)))
  .sort();

if (fichiers.length === 0) {
  console.error("Aucun script de test ne correspond.");
  process.exit(1);
}

const tsx = join(dossier, "..", "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
const echecs = [];

for (const f of fichiers) {
  console.log(`\n▶ ${f}`);
  const r = spawnSync(tsx, [join(dossier, f)], { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) echecs.push(f);
}

console.log(`\n${fichiers.length - echecs.length}/${fichiers.length} scripts de test passent.`);
if (echecs.length > 0) {
  console.error(`En échec : ${echecs.join(", ")}`);
  process.exit(1);
}
