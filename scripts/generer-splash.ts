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
 * LA LARGEUR D'ABORD, ET C'EST LA REGLE ENTIERE.
 *
 * Le mot-marque va d'un bord à l'autre de l'illustration — il ne lui reste que
 * 5 % de marge de chaque côté. Tout ce qui rogne horizontalement le coupe.
 *
 * La première version couvrait (`fit: cover`), et j'avais calibré ce choix sur
 * l'iPad, plus LARGE que la source. Le cas courant est l'inverse : un iPhone
 * moderne fait du 19,5:9, bien plus HAUT que le 9:16 de la source, et couvrir
 * y rogne les côtés — jusqu'à 147 px de chaque bord sur un iPhone 16 Pro Max.
 * Dix des dix-huit tailles étaient dans ce cas, c'est-à-dire tout l'iPhone
 * depuis le X : le « K » et le « T » sortaient de l'écran.
 *
 * On met donc la largeur à la taille exacte de la cible, toujours, puis on
 * traite la hauteur :
 *
 *   - trop haute (iPad, plus large que la source) : on rogne au centre. Le
 *     mot-marque est à mi-hauteur, il est loin des bords.
 *   - trop courte (iPhone) : on prolonge le motif EN MIROIR. Du vert plat
 *     laisserait deux bandes vides et des ballons coupés net ; le miroir
 *     prolonge les ballons par des ballons, et la couture ne se voit pas.
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

    const image = await composer(largeur, hauteur, meta.width!, meta.height!);
    await sharp(image)
      // Sans transparence dans la source il ne sert jamais — mais si
      // l'illustration en gagne un jour, le JPEG remplirait de noir.
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

/**
 * LE MOT-MARQUE TOUCHE-T-IL UN BORD ?
 *
 * C'est la question que la première version n'a pas posée, et l'écran de
 * démarrage est parti en production avec le « K » et le « T » coupés sur tous
 * les iPhone récents. Un rendu qu'on ne regarde que sur une taille ne prouve
 * rien : il y en a dix-huit.
 *
 * Le mot-marque est le seul blanc de l'illustration, donc l'encadré des pixels
 * clairs le cerne exactement. S'il arrive à moins de cinq pixels d'un bord
 * vertical, c'est qu'il est rogné, et la génération échoue au lieu d'écrire
 * dix-huit fichiers cassés.
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

    // Aucun pixel clair : l'illustration a change et ce controle ne sait plus
    // ce qu'il cherche. On le dit plutot que de rendre un feu vert vide.
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
      `\n! ${sansBlanc} fichier(s) sans pixel clair : le controle du mot-marque ` +
        "suppose qu'il est blanc. A revoir si l'illustration a change.",
    );
  }

  if (fautifs.length > 0) {
    console.error("\nLE MOT-MARQUE EST COUPE :");
    for (const f of fautifs) console.error(`  ${f}`);
    process.exit(1);
  }

  console.log("Mot-marque entier sur toutes les tailles.");
}

/**
 * Une image à la taille exacte de la cible, sans jamais toucher aux côtés.
 */
async function composer(
  largeur: number,
  hauteur: number,
  srcL: number,
  srcH: number,
): Promise<Buffer> {
  // La largeur d'abord : l'échelle est imposée par elle, la hauteur suit.
  const hauteurMise = Math.round(srcH * (largeur / srcL));
  // `.png()` a chaque etape : `toBuffer()` sans format rend des pixels bruts,
  // que sharp ne sait pas relire au tour suivant.
  const mise = await sharp(SOURCE).resize(largeur, hauteurMise).png().toBuffer();

  // Plus haute que la cible : on rogne au centre, le mot-marque est à
  // mi-hauteur et n'en souffre pas.
  if (hauteurMise >= hauteur) {
    return sharp(mise)
      .extract({
        left: 0,
        top: Math.floor((hauteurMise - hauteur) / 2),
        width: largeur,
        height: hauteur,
      })
      .png()
      .toBuffer();
  }

  // Plus courte : on prolonge le motif en miroir, haut et bas.
  const manque = hauteur - hauteurMise;
  const haut = Math.floor(manque / 2);
  const bas = manque - haut;

  // Une bande ne peut pas etre plus haute que l'image dont on la tire. Sur les
  // tailles d'aujourd'hui on demande 9 % d'une image de 2 000 px, donc on n'y
  // touche jamais — mais un appareil encore plus allonge ne doit pas faire
  // echouer la generation : on comble ce qu'on peut, le fond fait le reste, et
  // la console le dit.
  const hHaut = Math.min(haut, hauteurMise);
  const hBas = Math.min(bas, hauteurMise);
  if (hHaut < haut || hBas < bas) {
    console.warn(
      `  ! ${largeur}×${hauteur} : bandes plus hautes que la source, ` +
        "le reste sera du fond uni.",
    );
  }

  // Une bande de hauteur nulle — la cible tombe a un pixel pres sur le format
  // de la source — ferait echouer `extract`. On ne la pose pas.
  const couches: sharp.OverlayOptions[] = [{ input: mise, top: haut, left: 0 }];

  if (hHaut > 0) {
    couches.unshift({
      input: await sharp(mise)
        .extract({ left: 0, top: 0, width: largeur, height: hHaut })
        .flip()
        .png()
        .toBuffer(),
      top: haut - hHaut,
      left: 0,
    });
  }

  if (hBas > 0) {
    couches.push({
      input: await sharp(mise)
        .extract({ left: 0, top: hauteurMise - hBas, width: largeur, height: hBas })
        .flip()
        .png()
        .toBuffer(),
      top: haut + hauteurMise,
      left: 0,
    });
  }

  return sharp({
    create: { width: largeur, height: hauteur, channels: 3, background: SPLASH_FOND },
  })
    .composite(couches)
    .png()
    .toBuffer();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
