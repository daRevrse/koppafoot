/**
 * Les affiches des rôles pour l'onglet Évolution de l'appli : celles du site
 * (public/branding/role_<nom>.png, 1024 × 1024), recadrées au centre en
 * portrait 3:4 et compressées, dans mobile/assets/roles/<nom>.jpg.
 *
 *   node scripts/generer-affiches-roles-mobile.mjs
 *
 * 150 000 octets au plus chacune : l'appli les embarque. La qualité descend
 * de 72 jusqu'à 60, pas plus bas, tant qu'une image dépasse.
 */
import sharp from "sharp";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SORTIE = path.join(RACINE, "mobile", "assets", "roles");
const PLAFOND = 150_000;

fs.mkdirSync(SORTIE, { recursive: true });

for (const nom of ["joueur", "manager", "arbitre"]) {
  const source = path.join(RACINE, "public", "branding", `role_${nom}.png`);
  const { width, height } = await sharp(source).metadata();
  // Le portrait 3:4 le plus grand qui tienne dans l'image, au centre.
  const h = height;
  const l = Math.round((h * 3) / 4);
  const recadrage = { left: Math.round((width - l) / 2), top: 0, width: l, height: h };
  let qualite = 72;
  let donnees;
  for (;;) {
    donnees = await sharp(source)
      .extract(recadrage)
      .resize(720, 960)
      .jpeg({ quality: qualite, mozjpeg: true })
      .toBuffer();
    if (donnees.length <= PLAFOND || qualite <= 60) break;
    qualite -= 2;
  }
  fs.writeFileSync(path.join(SORTIE, `${nom}.jpg`), donnees);
  console.log(`${nom}.jpg : ${donnees.length} octets (qualité ${qualite})${donnees.length > PLAFOND ? " — AU-DESSUS DU PLAFOND" : ""}`);
}
