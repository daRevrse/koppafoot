/**
 * KOPPAFOOT — Préparer l'image de fond du panneau de connexion.
 *
 * La source, `branding/login side.png`, est un COLLAGE CARRÉ de quatre photos
 * (2000×2000, 5 Mo). Le panneau de connexion, lui, est une colonne verticale
 * qui occupe toute la hauteur de l'écran : en `object-cover`, un carré y est
 * recadré sur sa bande centrale, c'est-à-dire précisément sur la couture entre
 * les quatre vignettes. On voit alors quatre bouts de photo et une croix au
 * milieu.
 *
 * On découpe donc UNE COLONNE du collage — la gauche, un but au premier plan
 * et un match sur un terrain de terre —, ce qui donne une image 1000×2000
 * naturellement portrait, dans le bon sens pour ce panneau.
 *
 * Et on l'allège : 5 Mo de PNG sur une page de connexion, c'est la page
 * entière plusieurs fois. Un JPEG de 1000px de large suffit largement pour un
 * fond passé sous un voile sombre.
 *
 * Usage :
 *   npx tsx scripts/preparer-image-login.ts
 *
 * Pour prendre l'autre colonne (le but au crépuscule et le ballon), passer
 * COLONNE à "droite".
 */
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(process.cwd(), "branding", "login side.png");
const DEST = path.join(process.cwd(), "public", "branding", "login_side.jpg");

/** Quelle moitié du collage on garde. */
const COLONNE: "gauche" | "droite" = "gauche";

async function main() {
  const { width = 0, height = 0 } = await sharp(SRC).metadata();
  const moitie = Math.floor(width / 2);

  await sharp(SRC)
    .extract({
      left: COLONNE === "gauche" ? 0 : moitie,
      top: 0,
      width: moitie,
      height,
    })
    // Le panneau fait au plus ~45% d'un écran large : 1000px de large couvre
    // largement, y compris sur un écran à forte densité.
    .resize(1000, 2000, { fit: "cover" })
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(DEST);

  const m = await sharp(DEST).metadata();
  const avant = (fs.statSync(SRC).size / 1048576).toFixed(1);
  const apres = (fs.statSync(DEST).size / 1024).toFixed(0);
  console.log(`  ${path.relative(process.cwd(), DEST)}  ${m.width}x${m.height}  ${apres} Ko  (source ${avant} Mo)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
