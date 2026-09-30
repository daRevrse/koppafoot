// ============================================
// Les tutoriels PDF, servis par le site.
//
// Ils vivent dans docs/tutoriel-*/ — là où leurs outils les fabriquent et où
// le dépôt les versionne. Le centre de tutoriels (/aide/tutoriels) les propose
// en téléchargement, et le site ne sert que ce qui est dans public/.
//
// On les COPIE à chaque `dev` et à chaque `build`, plutôt que de les
// recopier dans le dépôt : une seconde copie versionnée finirait par
// diverger de la première (un tutoriel régénéré, l'autre oublié), et
// doublerait vingt-cinq mégaoctets de binaires dans chaque clone.
// public/tutoriels est donc ignoré par git.
//
// docs/tutoriel-joueur/Tutoriel-joueur-KoppaFoot.pdf → public/tutoriels/joueur.pdf
// ============================================

import fs from "node:fs";
import path from "node:path";

const racine = path.resolve(import.meta.dirname, "..");
const docs = path.join(racine, "docs");
const cible = path.join(racine, "public", "tutoriels");

fs.mkdirSync(cible, { recursive: true });

let copies = 0;
for (const dossier of fs.readdirSync(docs)) {
  const m = /^tutoriel-(.+)$/.exec(dossier);
  if (!m) continue;
  const slug = m[1];
  const source = path.join(docs, dossier, `Tutoriel-${slug}-KoppaFoot.pdf`);
  if (!fs.existsSync(source)) continue;
  const destination = path.join(cible, `${slug}.pdf`);
  // Rien à faire si la copie est déjà à jour : `dev` se relance souvent.
  const avant = fs.existsSync(destination) ? fs.statSync(destination) : null;
  const apres = fs.statSync(source);
  if (avant && avant.size === apres.size && avant.mtimeMs >= apres.mtimeMs) continue;
  fs.copyFileSync(source, destination);
  copies += 1;
}

if (copies > 0) console.log(`tutoriels : ${copies} PDF copié${copies > 1 ? "s" : ""} dans public/tutoriels`);
