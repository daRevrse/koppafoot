/**
 * KOPPAFOOT — Rendu de contrôle de l'affiche des meilleurs buteurs
 * (lib/og-buteurs), à regarder : Satori ne se teste pas autrement.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json scripts/rendu-buteurs.tsx <dossier>
 *
 * Des joueurs et des équipes FICTIFS (le dépôt est public). Un PNG par cas :
 * dix buteurs avec écussons, trois seulement, des noms très longs, avec
 * partenaires et logo de compétition, sans rien.
 */
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { afficheDesButeurs, type DonneesButeurs, type LigneDeLAffiche } from "@/lib/og-buteurs";

const DIR = process.argv[2];
if (!DIR) {
  console.error("Usage : rendu-buteurs.tsx <dossier>");
  process.exit(1);
}

const png = async (svg: string) => `data:image/png;base64,${(await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64")}`;

const ecusson = (lettre: string, couleur: string) => png(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <path d="M100 8 L184 40 L172 140 L100 192 L28 140 L16 40 Z" fill="${couleur}" stroke="#fff" stroke-width="6"/>
  <text x="100" y="128" font-size="80" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">${lettre}</text>
</svg>`);

const logoPartenaire = (texte: string, couleur: string) => png(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200">
  <rect x="0" y="30" width="140" height="140" rx="20" fill="${couleur}"/>
  <text x="70" y="128" font-size="80" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">${texte[0]}</text>
  <text x="165" y="132" font-size="78" font-family="Arial" font-weight="bold" fill="#111">${texte}</text>
</svg>`);

const logoCompetition = () => png(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">
  <rect width="400" height="200" rx="30" fill="#f59e0b"/>
  <text x="200" y="125" font-size="72" font-family="Arial" font-weight="bold" fill="#111" text-anchor="middle">COUPE X</text>
</svg>`);

const EQUIPES = ["Lions FC", "AS Bè", "FC Agoè", "Étoile FC", "US Tokoin", "JS Adidogomé", "Union Bè", "Racing Hédzranawoé"];
const JOUEURS = [
  "Koffi Mensah", "Yawo Tepe", "Sena Kpodar", "Kafui Adjovi", "Elikem Dogbe",
  "Mawuli Ahiable", "Dela Gbadoe", "Selom Akakpo", "Komla Ayivi", "Edem Lawson",
];

async function main() {
  const couleurs = ["#d4a017", "#1d6fb8", "#b91c1c", "#7c3aed", "#0f766e", "#c2410c", "#334155", "#15803d"];
  const ecussons = await Promise.all(EQUIPES.map((e, i) => ecusson(e[0], couleurs[i])));
  const buts = [6, 5, 5, 4, 3, 3, 3, 2, 2, 2];
  const rangs = [1, 2, 2, 4, 5, 5, 5, 8, 8, 8];
  const dix: LigneDeLAffiche[] = JOUEURS.map((nom, i) => ({
    rang: rangs[i], nom, equipe: EQUIPES[i % EQUIPES.length], ecusson: ecussons[i % EQUIPES.length], buts: buts[i],
  }));

  const rendre = async (nom: string, d: DonneesButeurs) => {
    const r = await afficheDesButeurs(d);
    await writeFile(`${DIR}/${nom}.png`, Buffer.from(await r.arrayBuffer()));
    console.log("rendu", nom);
  };

  const base: DonneesButeurs = { surtitre: "COUPE X · APRÈS LA JOURNÉE 2", logoCompetition: null, lignes: dix, partenaires: [] };
  await rendre("dix", base);
  await rendre("trois", { ...base, lignes: dix.slice(0, 3).map((l, i) => ({ ...l, rang: i + 1, buts: 3 - i })) });
  await rendre("un", { ...base, surtitre: "COUPE X · APRÈS LA JOURNÉE 1", lignes: [{ ...dix[0], buts: 1 }] });
  await rendre("noms-longs", {
    ...base,
    lignes: dix.map((l, i) => (i % 2 ? l : {
      ...l,
      nom: "Kossivi Mawuena Agbodjan-Kpodzro",
      equipe: "Association Sportive des Jeunes Footballeurs de Hédzranawoé",
      ecusson: null,
    })),
  });
  await rendre("avec-partenaires", {
    ...base,
    surtitre: "À CE JOUR",
    logoCompetition: await logoCompetition(),
    partenaires: [
      { annonceur: "Brasserie X", logo: await logoPartenaire("Brasserie", "#b91c1c") },
      { annonceur: "Télécom Y", logo: await logoPartenaire("Télécom", "#1d4ed8") },
    ],
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
