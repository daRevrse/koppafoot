/**
 * KOPPAFOOT — les icônes et l'écran de lancement de l'application mobile.
 *
 *   npx tsx scripts/generer-icones-mobile.ts
 *
 * La même source que les icônes du site (scripts/generer-icones.ts) :
 * `branding/koppafoot logo.png`, l'épingle blanche sur le vert de la marque.
 * Un téléphone qui a le site en raccourci et l'application installée montre
 * ainsi deux fois la même icône, et non deux marques voisines.
 *
 * Ce qu'il écrit, dans mobile/assets :
 *   icon.png                       1024², l'icône iOS et la référence d'Expo (sans alpha : iOS le refuse)
 *   android-icon-foreground.png    1024², l'épingle seule, transparente, pour l'icône adaptative
 *   android-icon-monochrome.png    la même, pour les icônes à thème d'Android 13+
 *   splash-icon.png                la même, au centre de l'écran de lancement
 *   favicon.png                    48², pour la version web d'Expo
 *
 * L'ÉPINGLE TIENT DANS LES 58 % CENTRAUX. L'icône adaptative d'Android est
 * recadrée par le lanceur (cercle, goutte, carré arrondi) : seul le disque
 * central de 66 % est garanti visible. Et l'écran de lancement d'Android 12+
 * n'affiche qu'une icône centrée, rognée au même disque — une image plein
 * écran y est impossible, d'où ce même fichier pour les deux.
 *
 * À relancer à chaque changement de logo, puis à committer : les fichiers
 * produits sont versionnés, le build ne les fabrique pas. Le fond des icônes
 * adaptatives et de l'écran de lancement est SPLASH_FOND, déclaré dans
 * mobile/app.json.
 */
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import { SPLASH_FOND } from "../src/config/ios-launch";

const SRC = path.join(process.cwd(), "branding", "koppafoot logo.png");
const DEST = path.join(process.cwd(), "mobile", "assets");

const COTE = 1024;
const HAUTEUR_EPINGLE = Math.round(COTE * 0.58);

/**
 * L'épingle, détourée : chaque pixel devient blanc, d'autant plus opaque
 * qu'il est clair. Le fond vert disparaît, le halo reste en transparence —
 * posée sur le même vert, l'épingle retrouve l'aspect de l'affiche.
 */
async function epingle(): Promise<Buffer> {
  const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    const alpha = Math.max(0, Math.min(1, (lum - 45) / (230 - 45)));
    rgba[j] = rgba[j + 1] = rgba[j + 2] = 255;
    rgba[j + 3] = Math.round(alpha * 255);
  }
  const detouree = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
  const rognee = await sharp(detouree).trim({ threshold: 8 }).toBuffer();
  const reduite = await sharp(rognee).resize({ height: HAUTEUR_EPINGLE }).toBuffer();
  return sharp({ create: { width: COTE, height: COTE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: reduite, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Source introuvable : ${SRC}`);
    process.exit(1);
  }
  const ecrire = async (nom: string, contenu: Buffer) => {
    fs.writeFileSync(path.join(DEST, nom), contenu);
    const m = await sharp(contenu).metadata();
    console.log(`${nom.padEnd(30)} ${m.width}x${m.height} alpha=${m.hasAlpha} ${Math.round(contenu.length / 1024)} Ko`);
  };

  const icone = await sharp(SRC).resize(COTE, COTE, { fit: "cover" }).removeAlpha().png({ compressionLevel: 9 }).toBuffer();
  await ecrire("icon.png", icone);

  const seule = await epingle();
  await ecrire("android-icon-foreground.png", seule);
  await ecrire("android-icon-monochrome.png", seule);
  await ecrire("splash-icon.png", seule);

  await ecrire("favicon.png", await sharp(SRC).resize(48, 48, { fit: "cover" }).png({ compressionLevel: 9 }).toBuffer());

  // Le fond de l'icône adaptative est une couleur unie (app.json) : l'image
  // de fond du modèle Expo n'a plus d'usage.
  const fondModele = path.join(DEST, "android-icon-background.png");
  if (fs.existsSync(fondModele)) fs.unlinkSync(fondModele);

  console.log(`Fond à déclarer dans mobile/app.json : ${SPLASH_FOND}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
