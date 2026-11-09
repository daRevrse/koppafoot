/**
 * KOPPAFOOT — Rendu de contrôle de l'annonce d'un match chaud
 * (lib/og-annonce), à regarder : Satori ne se teste pas autrement.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json scripts/rendu-annonce.tsx <dossier> [--images]
 *
 * Des équipes FICTIVES (le dépôt est public). Par cas : l'annonce entière
 * (`<cas>.png`), les calques de l'affiche recomposés à leur place
 * (`<cas>-calques.png`, doit être identique), les zones que TikTok recouvre
 * en rose (`<cas>-zones.png`, sur l'affiche et sur l'accroche), et six
 * instants de la vidéo côte à côte (`<cas>-etapes.png`), de l'accroche à
 * l'affiche finie.
 *
 * `--images` écrit en plus chaque image de la vidéo du premier cas dans
 * `<dossier>/images/`, à monter pour la voir bouger :
 *   ffmpeg -framerate 30 -i <dossier>/images/%04d.png -pix_fmt yuv420p <dossier>/annonce.mp4
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { afficheAnnonce, calquesAnnonce } from "@/lib/og-annonce";
import type { FlyerMatch } from "@/lib/og-flyer";
import type { CalqueVideo } from "@/lib/og-joueur-semaine";
import { CLES_ACCROCHE, DUREE_ANNONCE, etatCalqueAnnonce } from "@/lib/video-annonce";
import { FPS } from "@/lib/video-joueur-semaine";

const DIR = process.argv[2];
if (!DIR) {
  console.error("Usage : rendu-annonce.tsx <dossier>");
  process.exit(1);
}

const IMAGES = process.argv.includes("--images");

const tampon = (c: CalqueVideo) => Buffer.from(c.png.split(",")[1], "base64");

/**
 * Une image de la vidéo à l'instant `t`, comme le navigateur la dessine
 * (lib/video-joueur-semaine-client) : place, opacité et échelle de chaque
 * calque. L'annonce n'use ni du zoom ni du dévoilement.
 */
async function imageA(calques: CalqueVideo[], t: number): Promise<Buffer> {
  const morceaux = [];
  for (const c of calques) {
    const e = etatCalqueAnnonce(c, t, 1080);
    if (e.opacite <= 0.01) continue;
    const k = e.echelle ?? 1;
    const w = Math.max(1, Math.round(c.w * k));
    const h = Math.max(1, Math.round(c.h * k));
    const left = Math.round(c.left + e.dx + (c.w - w) / 2);
    const top = Math.round(c.top + e.dy + (c.h - h) / 2);
    // sharp refuse un calque qui dépasse : on le rogne à l'image.
    const x0 = Math.max(0, left), y0 = Math.max(0, top);
    const x1 = Math.min(1080, left + w), y1 = Math.min(1920, top + h);
    if (x1 <= x0 || y1 <= y0) continue;
    let img = sharp(tampon(c));
    if (k !== 1) img = sharp(await img.resize(w, h, { fit: "fill" }).png().toBuffer());
    let input = await img.extract({ left: x0 - left, top: y0 - top, width: x1 - x0, height: y1 - y0 }).png().toBuffer();
    if (e.opacite < 1) {
      const voile = await sharp({ create: { width: x1 - x0, height: y1 - y0, channels: 4, background: { r: 0, g: 0, b: 0, alpha: e.opacite } } }).png().toBuffer();
      input = await sharp(input).composite([{ input: voile, blend: "dest-in" }]).png().toBuffer();
    }
    morceaux.push({ input, left: x0, top: y0 });
  }
  return sharp({ create: { width: 1080, height: 1920, channels: 4, background: "#ffffff" } }).composite(morceaux).png().toBuffer();
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
  // L'affiche entière ne porte pas l'accroche : seuls ses calques la recomposent.
  const recompose = await sharp({ create: { width: 1080, height: 1920, channels: 4, background: "#ffffff" } })
    .composite(calques.filter((c) => !(CLES_ACCROCHE as readonly string[]).includes(c.cle)).map((c) => ({ input: tampon(c), left: c.left, top: c.top })))
    .png().toBuffer();
  await writeFile(`${DIR}/${nom}-calques.png`, recompose);

  const zones = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
    <rect width="1080" height="150" fill="#ff2d55" fill-opacity="0.35"/>
    <rect y="1480" width="1080" height="440" fill="#ff2d55" fill-opacity="0.35"/>
  </svg>`;
  const reduit = (image: Buffer) => sharp(image).composite([{ input: Buffer.from(zones) }]).png().toBuffer().then((b) => sharp(b).resize(540, 960).png().toBuffer());
  await sharp({ create: { width: 540 * 2 + 20, height: 960, channels: 4, background: "#ffffff" } })
    .composite([
      { input: await reduit(await imageA(calques, 1.4)), left: 0, top: 0 },
      { input: await reduit(entiere), left: 560, top: 0 },
    ])
    .png().toFile(`${DIR}/${nom}-zones.png`);

  // Six instants, réduits au quart, côte à côte : l'accroche, puis l'affiche.
  const instants = [0, 0.6, 1.4, 2.9, 4.4, DUREE_ANNONCE];
  const images = await Promise.all(instants.map(async (t) => sharp(await imageA(calques, t)).resize(270, 480).png().toBuffer()));
  await sharp({ create: { width: 280 * instants.length - 10, height: 480, channels: 4, background: "#ffffff" } })
    .composite(images.map((input, i) => ({ input, left: i * 280, top: 0 })))
    .png().toFile(`${DIR}/${nom}-etapes.png`);
  console.log("écrit", nom, `(${calques.length} calques)`);

  if (IMAGES && nom === "complet") {
    await mkdir(`${DIR}/images`, { recursive: true });
    const total = FPS * DUREE_ANNONCE;
    for (let n = 0; n < total; n++) {
      await writeFile(`${DIR}/images/${String(n).padStart(4, "0")}.png`, await imageA(calques, n / FPS));
    }
    console.log("écrit", `${total} images dans images/`);
  }
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
