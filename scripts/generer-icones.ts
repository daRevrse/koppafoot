/**
 * KOPPAFOOT — Fabriquer toutes les icônes depuis l'affiche de marque.
 *
 * Une seule source, `branding/koppafoot logo.png`, et tous les formats que le
 * navigateur et le système d'exploitation réclament en sortent. Les icônes
 * étaient posées à la main jusqu'ici, ce qui explique qu'elles aient divergé :
 * un changement de logo en oubliait toujours une.
 *
 * Ce qu'il écrit :
 *   src/app/favicon.ico                        l'onglet du navigateur
 *   src/app/icon.png                           la convention de fichier Next
 *   src/app/apple-icon.png                     l'écran d'accueil iOS
 *   public/icons/icon-{192,512}.png            le manifeste PWA
 *   public/icons/icon-{192,512}-maskable.png   la variante recadrable Android
 *   public/icons/apple-touch-icon.png
 *
 * Usage :
 *   npx tsx scripts/generer-icones.ts
 *
 * À relancer à chaque changement de logo, puis à committer : les fichiers
 * produits sont versionnés, le build ne les fabrique pas.
 */
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(process.cwd(), "branding", "koppafoot logo.png");

/**
 * La couleur unie des bords de l'affiche.
 *
 * C'est `SPLASH_FOND` (voir config/ios-launch), écrit ici en composantes
 * parce que sharp veut trois nombres. Le remplissage de la variante maskable
 * se confond avec les bords de l'image qu'il entoure.
 */
const FOND = { r: 13, g: 41, b: 27 };

const carre = (taille: number) =>
  sharp(SRC).resize(taille, taille, { fit: "cover" }).png({ compressionLevel: 9 });

/**
 * La variante maskable : le dessin rentre dans les 80% centraux, le reste est
 * rempli de la couleur des bords. Un lanceur Android recadre en cercle et
 * couperait sinon le haut du ballon et le pied de la hampe.
 */
async function maskable(taille: number) {
  const dedans = Math.round(taille * 0.8);
  const marge = Math.round((taille - dedans) / 2);
  const coeur = await sharp(SRC).resize(dedans, dedans, { fit: "cover" }).toBuffer();
  return sharp({
    create: { width: taille, height: taille, channels: 3, background: FOND },
  })
    .composite([{ input: coeur, top: marge, left: marge }])
    .png({ compressionLevel: 9 });
}

/** Un .ico qui embarque des PNG (supporté partout depuis Vista). */
async function ico(tailles: number[]): Promise<Buffer> {
  // `.ensureAlpha()` : le décodeur ICO de Next refuse un PNG sans canal alpha
  // (« The PNG is not in RGBA format! ») et fait échouer le build entier ;
  // l'affiche, elle, est en RGB pur. Il ne sert qu'ici — les PNG servis tels
  // quels restent plus légers sans.
  const images = await Promise.all(
    tailles.map((t) => carre(t).ensureAlpha().png({ compressionLevel: 9 }).toBuffer()),
  );

  const entete = Buffer.alloc(6);
  entete.writeUInt16LE(0, 0); // réservé
  entete.writeUInt16LE(1, 2); // type 1 = icône
  entete.writeUInt16LE(tailles.length, 4);

  let offset = 6 + 16 * tailles.length;
  const entrees = tailles.map((t, i) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(t >= 256 ? 0 : t, 0); // largeur (0 = 256)
    e.writeUInt8(t >= 256 ? 0 : t, 1); // hauteur
    e.writeUInt8(0, 2); // palette
    e.writeUInt8(0, 3); // réservé
    e.writeUInt16LE(1, 4); // plans
    e.writeUInt16LE(32, 6); // bits par pixel
    e.writeUInt32LE(images[i].length, 8);
    e.writeUInt32LE(offset, 12);
    offset += images[i].length;
    return e;
  });

  return Buffer.concat([entete, ...entrees, ...images]);
}

async function main() {
  const cibles: [string, () => ReturnType<typeof carre> | Promise<ReturnType<typeof carre>>][] = [
    ["src/app/icon.png", () => carre(512)],
    ["src/app/apple-icon.png", () => carre(180)],
    ["public/icons/icon-192.png", () => carre(192)],
    ["public/icons/icon-512.png", () => carre(512)],
    ["public/icons/apple-touch-icon.png", () => carre(180)],
    ["public/icons/icon-192-maskable.png", () => maskable(192)],
    ["public/icons/icon-512-maskable.png", () => maskable(512)],
  ];

  for (const [rel, faire] of cibles) {
    const dest = path.join(process.cwd(), rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    await (await faire()).toFile(dest);
    const m = await sharp(dest).metadata();
    console.log(`  ${rel}  ${m.width}x${m.height}  ${fs.statSync(dest).size} o`);
  }

  const buf = await ico([16, 32, 48]);
  fs.writeFileSync(path.join(process.cwd(), "src/app/favicon.ico"), buf);
  console.log(`  src/app/favicon.ico  16/32/48  ${buf.length} o`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
