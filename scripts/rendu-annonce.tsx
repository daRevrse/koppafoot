/**
 * KOPPAFOOT — Rendu de contrôle de l'annonce d'un match chaud
 * (lib/og-annonce), à regarder : Satori ne se teste pas autrement.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json scripts/rendu-annonce.tsx <dossier>
 *
 * Des équipes FICTIVES (le dépôt est public). Par cas : l'annonce entière
 * (`<cas>.png`), les calques recomposés à leur place (`<cas>-calques.png`,
 * doit être identique), les zones que TikTok recouvre en rose
 * (`<cas>-zones.png`), et quatre instants de la vidéo côte à côte
 * (`<cas>-etapes.png`, un calque à moins de moitié d'opacité n'y est pas).
 */
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { afficheAnnonce, calquesAnnonce } from "@/lib/og-annonce";
import type { FlyerMatch } from "@/lib/og-flyer";
import { etatCalqueAnnonce } from "@/lib/video-annonce";

const DIR = process.argv[2];
if (!DIR) {
  console.error("Usage : rendu-annonce.tsx <dossier>");
  process.exit(1);
}

const png = async (svg: string) => `data:image/png;base64,${(await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64")}`;
const ecusson = (lettre: string, couleur: string) => png(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
  <path d="M200 16 L368 80 L344 280 L200 384 L56 280 L32 80 Z" fill="${couleur}" stroke="#fff" stroke-width="12"/>
  <text x="200" y="256" font-size="160" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">${lettre}</text>
</svg>`);
const logoCompetition = () => png(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">
  <rect width="400" height="200" rx="30" fill="#f59e0b"/>
  <text x="200" y="125" font-size="72" font-family="Arial" font-weight="bold" fill="#111" text-anchor="middle">COUPE X</text>
</svg>`);

async function rendre(nom: string, m: FlyerMatch) {
  const entiere = await afficheAnnonce(m);
  await writeFile(`${DIR}/${nom}.png`, entiere);

  const calques = await calquesAnnonce(m);
  const tampon = (c: (typeof calques)[number]) => Buffer.from(c.png.split(",")[1], "base64");
  const recompose = await sharp({ create: { width: 1080, height: 1920, channels: 4, background: "#ffffff" } })
    .composite(calques.map((c) => ({ input: tampon(c), left: c.left, top: c.top })))
    .png().toBuffer();
  await writeFile(`${DIR}/${nom}-calques.png`, recompose);

  const zones = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
    <rect width="1080" height="150" fill="#ff2d55" fill-opacity="0.35"/>
    <rect y="1480" width="1080" height="440" fill="#ff2d55" fill-opacity="0.35"/>
  </svg>`;
  await sharp(entiere).composite([{ input: Buffer.from(zones) }]).png().toFile(`${DIR}/${nom}-zones.png`);

  // Quatre instants, réduits au quart, côte à côte.
  const instants = [0.7, 1.6, 2.4, 8];
  const images = await Promise.all(instants.map(async (t) => {
    const morceaux = [];
    for (const c of calques) {
      const e = etatCalqueAnnonce(c, t, 1080);
      if (e.opacite < 0.5) continue;
      const left = Math.round(c.left + e.dx);
      const top = Math.round(c.top + e.dy);
      // sharp refuse un calque qui dépasse : on le rogne à l'image.
      const x0 = Math.max(0, left), y0 = Math.max(0, top);
      const x1 = Math.min(1080, left + c.w), y1 = Math.min(1920, top + c.h);
      if (x1 <= x0 || y1 <= y0) continue;
      const input = await sharp(tampon(c)).extract({ left: x0 - left, top: y0 - top, width: x1 - x0, height: y1 - y0 }).png().toBuffer();
      morceaux.push({ input, left: x0, top: y0 });
    }
    const image = await sharp({ create: { width: 1080, height: 1920, channels: 4, background: "#ffffff" } }).composite(morceaux).png().toBuffer();
    return sharp(image).resize(270, 480).png().toBuffer();
  }));
  await sharp({ create: { width: 270 * 4 + 30, height: 480, channels: 4, background: "#ffffff" } })
    .composite(images.map((input, i) => ({ input, left: i * 280, top: 0 })))
    .png().toFile(`${DIR}/${nom}-etapes.png`);
  console.log("écrit", nom, `(${calques.length} calques)`);
}

async function main() {
  const base: FlyerMatch = {
    titre: "MATCHDAY", surtitre: "Groupe A · Journée 2", amical: false, logoCompetition: await logoCompetition(),
    home: { nom: "Lions FC", logo: await ecusson("L", "#d4a017") },
    away: { nom: "AS Bè", logo: await ecusson("B", "#1d6fb8") },
    date: "2026-11-08", time: "16:30", lieu: "Stade de Bè, Lomé",
  };
  await rendre("complet", base);
  await rendre("sans-logos-noms-longs", {
    ...base, logoCompetition: null, surtitre: "Le championnat inter-quartiers de la grande ville · Groupe B · Journée 4",
    home: { nom: "Association Sportive des Jeunes de Bè-Kpota", logo: null },
    away: { nom: "Union Sportive de Tokoin-Hôpital", logo: null },
    lieu: "Terrain municipal du quartier administratif, Lomé",
  });
  await rendre("finale-sans-heure", { ...base, titre: "LA FINALE", surtitre: "", time: "", lieu: "" });
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
