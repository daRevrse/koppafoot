/**
 * KOPPAFOOT — les écrans de démarrage iOS, produits depuis une seule image.
 *
 *   npx tsx scripts/generer-splash.ts
 *
 * POURQUOI UN SCRIPT PLUTÔT QU'UN EXPORT À LA MAIN. Il y a dix-huit fichiers,
 * un par couple (appareil, densité), et chacun doit faire EXACTEMENT la taille
 * que sa balise annonce — iOS ignore l'image au moindre écart et ouvre sur un
 * écran blanc. Dix-huit recadrages faits à la main, c'est dix-huit occasions
 * de se tromper d'un pixel, et aucune trace de la façon dont on les a
 * obtenus. Ici, la liste des appareils est la même que celle du `<head>` (voir
 * config/ios-launch), et refaire la série après un changement d'illustration
 * tient en une commande.
 *
 * LE RECADRAGE. La source est au format d'un téléphone (9:16) ; les iPad sont
 * en 3:4, beaucoup plus larges. On couvre plutôt qu'on ne contient : contenir
 * laisserait deux bandes de vert plat au-dessus et en dessous du motif, avec
 * une couture visible là où il s'arrête. Couvrir rogne le haut et le bas — des
 * ballons — et garde le mot-marque, qui est au centre.
 */
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import { IOS_LAUNCH_DEVICES, SPLASH_FOND } from "../src/config/ios-launch";

const SOURCE = path.resolve(__dirname, "..", "public", "branding", "koppafoot.png");
const DESTINATION = path.resolve(__dirname, "..", "public", "splash");

/**
 * 82 : au-dessus, les fichiers doublent de poids pour un aplat de vert et un
 * mot en blanc, où le JPEG ne perd rien de visible. Ces images se téléchargent
 * au premier lancement, sur des connexions qui ne sont pas toutes rapides.
 */
const QUALITE = 82;

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Source introuvable : ${SOURCE}`);
    process.exit(1);
  }

  const meta = await sharp(SOURCE).metadata();
  console.log(`Source : ${meta.width}×${meta.height}\n`);

  fs.mkdirSync(DESTINATION, { recursive: true });

  // Les tailles voulues, dédoublonnées : deux appareils peuvent tomber sur la
  // même (un 414×896@2 et un autre modèle de même diagonale), et produire le
  // fichier deux fois ne ferait que le réécrire.
  const tailles = new Map<string, [number, number]>();
  for (const [w, h, dpr] of IOS_LAUNCH_DEVICES) {
    tailles.set(`${w * dpr}x${h * dpr}`, [w * dpr, h * dpr]);
  }

  // Ce qui existait avant et que la nouvelle liste ne produit plus : un
  // fichier orphelin ne gêne personne, mais il laisse croire qu'un appareil
  // est couvert alors que plus aucune balise ne le réclame.
  const avant = new Set(
    fs.existsSync(DESTINATION)
      ? fs.readdirSync(DESTINATION).filter((f) => f.endsWith(".jpg"))
      : [],
  );

  let total = 0;
  for (const [nom, [largeur, hauteur]] of [...tailles].sort()) {
    const fichier = `splash-${nom}.jpg`;
    const sortie = path.join(DESTINATION, fichier);

    await sharp(SOURCE)
      .resize(largeur, hauteur, {
        fit: "cover",
        position: "centre",
        // Sans transparence dans la source, il ne sert jamais — mais si
        // l'illustration en gagne un jour, le JPEG remplirait de noir.
        background: SPLASH_FOND,
      })
      .flatten({ background: SPLASH_FOND })
      .jpeg({ quality: QUALITE, mozjpeg: true })
      .toFile(sortie);

    const poids = fs.statSync(sortie).size;
    total += poids;
    avant.delete(fichier);
    console.log(`  ${fichier.padEnd(26)} ${String(Math.round(poids / 1024)).padStart(4)} ko`);
  }

  console.log(`\n${tailles.size} fichiers, ${Math.round(total / 1024)} ko au total.`);

  await verifierLeMotMarque();

  if (avant.size > 0) {
    console.log(`\nOrphelins (plus aucune balise ne les demande) : ${[...avant].join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * LE MOT-MARQUE TOUCHE-T-IL UN BORD ?
 *
 * C'est la question que la première série n'a pas posée, et l'écran de
 * démarrage est parti en production avec le « K » et le « T » coupés sur tous
 * les iPhone récents : la source est au format d'un téléphone (9:16), un
 * iPhone moderne fait du 19,5:9, et `cover` y rogne les CÔTÉS. J'avais regardé
 * deux rendus — l'iPad et le plus petit téléphone — c'est-à-dire les deux qui
 * allaient bien. Un rendu qu'on regarde sur une taille ne prouve rien : il y
 * en a dix-huit.
 *
 * Le mot-marque est le seul blanc de l'illustration, donc l'encadré des pixels
 * clairs le cerne exactement. S'il arrive à moins de cinq pixels d'un bord
 * vertical, la génération ÉCHOUE au lieu d'écrire dix-huit fichiers cassés.
 *
 * LA MARGE À TENIR DANS L'ILLUSTRATION, si quelqu'un la refait : 9,1 % de
 * chaque côté et 12,5 % en haut et en bas. Ce sont les deux appareils
 * extrêmes de la table — le 1206×2622, le plus étroit, ne montre que 81,8 %
 * de la largeur ; l'iPad 1536×2048, le plus large, que 75 % de la hauteur.
 */
async function verifierLeMotMarque() {
  const MARGE_MINIMALE = 5;
  const fautifs: string[] = [];
  let sansBlanc = 0;

  for (const fichier of fs.readdirSync(DESTINATION).filter((f) => f.endsWith(".jpg")).sort()) {
    const { data, info } = await sharp(path.join(DESTINATION, fichier))
      .raw()
      .toBuffer({ resolveWithObject: true });

    let gauche = info.width;
    let droite = -1;
    // Une ligne sur deux : le mot fait des centaines de pixels de haut, il ne
    // peut pas passer entre les mailles, et c'est deux fois moins à lire.
    for (let y = 0; y < info.height; y += 2) {
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * info.channels;
        if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) {
          if (x < gauche) gauche = x;
          if (x > droite) droite = x;
        }
      }
    }

    // Aucun pixel clair : l'illustration a changé et ce contrôle ne sait plus
    // ce qu'il cherche. On le dit plutôt que de rendre un feu vert vide.
    if (droite < 0) {
      sansBlanc += 1;
      continue;
    }

    if (gauche < MARGE_MINIMALE || info.width - 1 - droite < MARGE_MINIMALE) {
      fautifs.push(`${fichier} (marges ${gauche} / ${info.width - 1 - droite} px)`);
    }
  }

  if (sansBlanc > 0) {
    console.warn(
      `\n! ${sansBlanc} fichier(s) sans pixel clair : le contrôle du mot-marque ` +
        "suppose qu'il est blanc. À revoir si l'illustration a changé.",
    );
  }

  if (fautifs.length > 0) {
    console.error("\nLE MOT-MARQUE EST COUPÉ :");
    for (const f of fautifs) console.error(`  ${f}`);
    process.exit(1);
  }

  console.log("Mot-marque entier sur toutes les tailles.");
}
