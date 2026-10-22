/**
 * KOPPAFOOT — Rendu de contrôle de l'affiche du programme, « Journée X » /
 * « Matchs du jour » (lib/og-programme), à regarder : Satori ne se teste pas
 * autrement.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json scripts/rendu-programme.tsx <dossier>
 *
 * Des équipes FICTIVES (le dépôt est public). Un PNG par cas : de 1 à 13
 * matchs, plusieurs dates, noms très longs, places de phase finale à
 * déterminer, date à fixer, tirs au but, forfait, match en cours, avec et sans
 * partenaires, avec et sans logo de compétition.
 */
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { afficheDuProgramme, type DonneesProgramme } from "@/lib/og-programme";
import { paginer } from "@/lib/programme";
import type { JourDuCalendrier, LigneDuCalendrier } from "@/lib/calendrier-competition";

const DIR = process.argv[2];
if (!DIR) {
  console.error("Usage : rendu-programme.tsx <dossier>");
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

const EQUIPES = [
  "Lions FC", "AS Bè", "FC Agoè", "Étoile FC", "US Tokoin", "JS Adidogomé", "Union Bè", "Racing Hédzranawoé",
  "Dynamo Kégué", "AC Nyékonakpoè", "Olympic Baguida", "FC Avédji", "Sporting Akodésséwa", "Réal Bè-Kpota",
];

async function main() {
  const couleurs = ["#d4a017", "#1d6fb8", "#b91c1c", "#7c3aed", "#0f766e", "#c2410c"];
  const logos = await Promise.all(couleurs.map((c, i) => ecusson(EQUIPES[i][0], c)));
  const logoDe = (i: number) => logos[i % EQUIPES.length] ?? null;

  let n = 0;
  const ligne = (i: number, l: Partial<LigneDuCalendrier> = {}): LigneDuCalendrier => {
    const a = i % EQUIPES.length, b = (i + 7) % EQUIPES.length;
    return {
      id: `l${n++}`, heure: `${String(14 + (i % 6)).padStart(2, "0")}:00`, phase: i % 2 ? "Poule B · Journée 2" : "Poule A · Journée 2",
      domicile: { nom: EQUIPES[a], enAttente: false, logo: logoDe(a), buteurs: [] },
      exterieur: { nom: EQUIPES[b], enAttente: false, logo: logoDe(b), buteurs: [] },
      etat: "a_venir", score: null, tab: null, forfait: null, sansFeuille: false, lieu: null,
      ...l,
    };
  };
  const joue = (i: number, s: [number, number], l: Partial<LigneDuCalendrier> = {}) => ligne(i, { etat: "joue", score: s, ...l });
  const jour = (date: string | null, titre: string, lignes: LigneDuCalendrier[]): JourDuCalendrier => ({ date, titre, lignes });

  const base = { titre: "MATCHS DU JOUR", surtitre: "SAMEDI 17 OCTOBRE 2026", logoCompetition: null, page: null, partenaires: [] };
  const rendre = async (nom: string, d: DonneesProgramme) => {
    const r = await afficheDuProgramme(d);
    await writeFile(`${DIR}/${nom}.png`, Buffer.from(await r.arrayBuffer()));
    console.log("écrit", `${DIR}/${nom}.png`);
  };

  const unJour = (k: number, debut = 0) => [jour("2026-10-17", "Samedi 17 octobre", Array.from({ length: k }, (_, i) =>
    i < k / 2 ? joue(debut + i, [i % 3, (i + 1) % 2]) : ligne(debut + i)))];

  await rendre("1-match", { ...base, jours: unJour(1) });
  await rendre("2-matchs", { ...base, jours: unJour(2) });
  await rendre("3-matchs", { ...base, jours: unJour(3) });
  await rendre("4-matchs", { ...base, jours: unJour(4) });
  await rendre("6-matchs-3-dates", {
    ...base, titre: "JOURNÉE 2", surtitre: "TOURNOI DES QUARTIERS · PHASE DE POULES",
    jours: [
      jour("2026-10-18", "Dimanche 18 octobre", [joue(0, [2, 1]), joue(1, [0, 0])]),
      jour("2026-10-25", "Dimanche 25 octobre", [ligne(2), ligne(3)]),
      jour("2026-11-01", "Dimanche 1er novembre", [ligne(4), ligne(5)]),
    ],
  });
  await rendre("12-matchs", { ...base, jours: unJour(12) });
  const treize = paginer(unJour(13));
  for (const [i, p] of treize.entries()) {
    await rendre(`13-matchs-page-${i + 1}`, { ...base, jours: p, page: { n: i + 1, total: treize.length } });
  }
  const long = "Association Sportive des Jeunes de Bè-Kpota";
  await rendre("noms-longs", {
    ...base, jours: [jour("2026-10-17", "Samedi 17 octobre", Array.from({ length: 6 }, (_, i) => ligne(i, {
      domicile: { nom: long, enAttente: false, logo: null, buteurs: [] },
      exterieur: { nom: "Union Sportive de Tokoin-Hôpital", enAttente: false, logo: null, buteurs: [] },
    })))],
  });
  await rendre("noms-longs-duel", {
    ...base, jours: [jour("2026-10-17", "Samedi 17 octobre", [ligne(0, {
      domicile: { nom: long, enAttente: false, logo: null, buteurs: [] },
    })])],
  });
  const attente = { nom: "1er poule B", enAttente: true, logo: null, buteurs: [] };
  await rendre("tableau-a-determiner", {
    ...base, jours: [jour("2026-10-24", "Samedi 24 octobre", [
      ligne(0, { phase: "Quart de finale", domicile: attente }),
      ligne(1, { phase: "Quart de finale", exterieur: { ...attente, nom: "2e meilleur 3e" } }),
      ligne(2, { phase: "Quart de finale" }), ligne(3, { phase: "Petite finale", domicile: attente, exterieur: attente }),
    ])],
  });
  await rendre("date-a-fixer", {
    ...base, titre: "JOURNÉE 3", surtitre: "PHASE DE POULES",
    jours: [jour("2026-11-08", "Dimanche 8 novembre", [ligne(0), ligne(1), ligne(2)]), jour(null, "Date à fixer", [ligne(3, { heure: null }), ligne(4, { heure: null })])],
  });
  await rendre("tab-forfait-en-cours", {
    ...base, jours: [jour("2026-10-17", "Samedi 17 octobre", [
      joue(0, [1, 1], { phase: "Demi-finale", tab: [4, 3] }), joue(1, [3, 0], { forfait: "exterieur" }),
      ligne(2, { etat: "en_cours", score: [2, 1] }), ligne(3), ligne(4, { heure: null }),
    ])],
  });
  const partenaires = [
    { annonceur: "Togotrans", logo: await logoPartenaire("TOGOTRANS", "#ea580c") },
    { annonceur: "Pharmacie", logo: await logoPartenaire("PHARMA", "#1d4ed8") },
  ];
  await rendre("avec-partenaires", { ...base, partenaires, jours: unJour(12) });
  await rendre("avec-partenaires-duel", { ...base, partenaires, logoCompetition: await logoCompetition(), jours: unJour(3) });
  await rendre("sans-logo-competition", { ...base, surtitre: "COUPE X · SAMEDI 17 OCTOBRE", jours: unJour(5) });
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
