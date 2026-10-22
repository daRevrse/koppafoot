/**
 * KOPPAFOOT — Rendu de contrôle de l'affiche « Joueur de la semaine »
 * (lib/og-joueur-semaine), à regarder : Satori ne se teste pas autrement.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json scripts/rendu-joueur-semaine.tsx <dossier> [donnees.json]
 *
 * Sans fichier de données, des joueurs FICTIFS (le dépôt est public : aucune
 * vraie personne ici). Avec un fichier JSON de la forme de `DonneesAffiche`,
 * dont `photo` et les `logo` peuvent être des chemins de fichiers locaux, il
 * rend en plus ce cas-là (`reel-*.png`).
 *
 * Rend : `complet-*` (trois matchs, deux partenaires), `vide-*` (pas de photo,
 * équipes sans logo, aucun partenaire), `long-*` (noms très longs, six matchs),
 * et `zones-tiktok.png` (le vertical, les zones que TikTok recouvre en rose).
 */
import sharp from "sharp";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { afficheJoueurSemaine, calquesJoueurSemaine, preparerPhoto, type DonneesAffiche } from "@/lib/og-joueur-semaine";

const DIR = process.argv[2];
if (!DIR) {
  console.error("Usage : rendu-joueur-semaine.tsx <dossier> [donnees.json]");
  process.exit(1);
}

/** Un fichier local devient une data URI ; le reste passe tel quel. */
async function image(valeur: string | null): Promise<string | null> {
  if (!valeur || valeur.startsWith("data:") || !existsSync(valeur)) return valeur;
  const png = await sharp(await readFile(valeur)).resize(400, 400, { fit: "inside" }).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

/** Un portrait de synthèse : un dégradé et une silhouette, pour ne montrer personne. */
async function portrait(): Promise<string> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8aa29a"/><stop offset="1" stop-color="#3f4a46"/></linearGradient></defs>
    <rect width="600" height="800" fill="url(#g)"/>
    <circle cx="300" cy="300" r="130" fill="#20262a"/>
    <rect x="120" y="470" width="360" height="400" rx="160" fill="#e25822"/>
  </svg>`;
  return preparerPhoto(await sharp(Buffer.from(svg)).png().toBuffer());
}

const ecussonFictif = async (lettre: string, couleur: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
    <path d="M100 8 L184 40 L172 140 L100 192 L28 140 L16 40 Z" fill="${couleur}" stroke="#111" stroke-width="8"/>
    <text x="100" y="128" font-size="80" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">${lettre}</text>
  </svg>`;
  return `data:image/png;base64,${(await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64")}`;
};

/** Un logo fictif : rond (carré) ou en longueur, sur fond transparent, comme ceux qu'on reçoit. */
const logoFictif = async (texte: string, fond: string, forme: "carre" | "long") => {
  const svg = forme === "carre"
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
        <circle cx="200" cy="200" r="190" fill="${fond}"/>
        <text x="200" y="235" font-size="120" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">${texte}</text>
      </svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="240">
        <rect x="0" y="40" width="160" height="160" rx="24" fill="${fond}"/>
        <text x="80" y="150" font-size="90" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">${texte[0]}</text>
        <text x="190" y="155" font-size="104" font-family="Arial" font-weight="bold" fill="#111">${texte}</text>
      </svg>`;
  return `data:image/png;base64,${(await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64")}`;
};

async function rendre(nom: string, d: DonneesAffiche) {
  for (const format of ["publication", "vertical"] as const) {
    const png = await afficheJoueurSemaine(d, format);
    await writeFile(`${DIR}/${nom}-${format}.png`, png);
    console.log("écrit", `${DIR}/${nom}-${format}.png`);
    if (nom === "complet" && format === "vertical") {
      // Les calques de la vidéo : chacun à sa place, recadré.
      const calques = await calquesJoueurSemaine(d);
      console.log(`calques : ${calques.map((c) => `${c.cle} ${c.w}×${c.h}@${c.left},${c.top}`).join(" | ")}`);
      const reconstitue = await sharp({ create: { width: 1080, height: 1920, channels: 4, background: "#ffffff" } })
        .composite(calques.map((c) => ({ input: Buffer.from(c.png.split(",")[1], "base64"), left: c.left, top: c.top })))
        .png().toBuffer();
      await writeFile(`${DIR}/calques-reconstitues.png`, reconstitue);
      console.log("écrit", `${DIR}/calques-reconstitues.png`);
      const zones = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
        <rect width="1080" height="150" fill="#ff2d55" fill-opacity="0.35"/>
        <rect y="1480" width="1080" height="440" fill="#ff2d55" fill-opacity="0.35"/>
      </svg>`;
      await sharp(png).composite([{ input: Buffer.from(zones) }]).png().toFile(`${DIR}/zones-tiktok.png`);
      console.log("écrit", `${DIR}/zones-tiktok.png`);
    }
  }
}

async function main() {
  const lions = await ecussonFictif("L", "#d4a017");
  const be = await ecussonFictif("B", "#1f6fb2");

  await rendre("complet", {
    nom: "KODJO MENSAH",
    numeroSemaine: 42,
    photo: await portrait(),
    lignes: [
      { jour: "MER. 14 OCT.", competition: "TOURNOI DES QUARTIERS", equipe: "AS BÈ", ecusson: be, affiche: "AS BÈ 1–1 FC AGOÈ", detail: "1 PASSE" },
      { jour: "VEN. 16 OCT.", competition: "MATCH AMICAL", equipe: "AS BÈ", ecusson: be, affiche: "AS BÈ 2–0 JS ADIDOGOMÉ", detail: "" },
      { jour: "DIM. 18 OCT.", competition: "COUPE D'EXEMPLE", equipe: "LIONS FC", ecusson: lions, affiche: "LIONS FC 4–0 ÉTOILE FC", detail: "2 BUTS" },
    ],
    ecussons: [{ equipe: "LIONS FC", logo: lions }, { equipe: "AS BÈ", logo: be }],
    partenaires: [
      { annonceur: "Marque A", image: await logoFictif("MA", "#c0392b", "carre") },
      { annonceur: "Marque B", image: await logoFictif("MARQUEB", "#2c3e50", "long") },
    ],
  });

  await rendre("vide", {
    nom: "AFI",
    numeroSemaine: 1,
    photo: null,
    lignes: [{ jour: "SAM. 3 JANV.", competition: "MATCH AMICAL", equipe: "ÉQUIPE SANS LOGO", ecusson: null, affiche: "ÉQUIPE SANS LOGO 1–0 AUTRE", detail: "1 BUT" }],
    ecussons: [{ equipe: "ÉQUIPE SANS LOGO", logo: null }],
    partenaires: [],
  });

  const longue = "ASSOCIATION SPORTIVE DES JEUNES DE BÈ-KPOTA";
  await rendre("long", {
    nom: "KOMLAN AYAWOVI DZIFA AKAKPO-AGBODJAN",
    numeroSemaine: 53,
    photo: await portrait(),
    lignes: [1, 2, 3, 4, 5, 6].map((i) => ({
      jour: `JEU. ${i} JANV.`, competition: "LE CHAMPIONNAT INTER-QUARTIERS DE LA GRANDE VILLE",
      equipe: longue, ecusson: null, affiche: `${longue} 3–2 UNION SPORTIVE DE TOKOIN`, detail: "1 BUT · 2 PASSES",
    })),
    ecussons: ["A", "B", "C", "D", "E"].map((l) => ({ equipe: `${l} FC`, logo: null })),
    partenaires: [
      { annonceur: "Marque A", image: await logoFictif("MARQUEA", "#c0392b", "long") },
      { annonceur: "Marque B", image: await logoFictif("MB", "#2c3e50", "carre") },
    ],
  });

  const fichier = process.argv[3];
  if (fichier) {
    const brut = JSON.parse(await readFile(fichier, "utf8")) as DonneesAffiche;
    await rendre("reel", {
      ...brut,
      photo: brut.photo && existsSync(brut.photo) ? await preparerPhoto(await readFile(brut.photo)) : brut.photo,
      lignes: await Promise.all(brut.lignes.map(async (l) => ({ ...l, ecusson: await image(l.ecusson) }))),
      ecussons: await Promise.all(brut.ecussons.map(async (e) => ({ ...e, logo: await image(e.logo) }))),
      // Comme sur le serveur : un logo introuvable retire le partenaire du pied.
      partenaires: (await Promise.all(brut.partenaires.map(async (p) => ({ ...p, image: await image(p.image) }))))
        .filter((p): p is { annonceur: string; image: string } => p.image !== null),
    });
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
