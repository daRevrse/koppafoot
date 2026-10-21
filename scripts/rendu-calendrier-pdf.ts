/**
 * KOPPAFOOT — Le PDF du calendrier sur une compétition fictive, pour le
 * regarder (lib/pdf-calendrier). Aucune base, aucun réseau.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json scripts/rendu-calendrier-pdf.ts <dossier>
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { calendrierDeCompetition } from "@/lib/calendrier-competition";
import { pdfCalendrier } from "@/lib/pdf-calendrier";
import type { CompMatch, LineupEntry } from "@/types";

type Evt = NonNullable<CompMatch["liveState"]>["events"][number];

const dossier = process.argv[2];
if (!dossier) {
  console.error("Usage : npx tsx --tsconfig tsconfig.json scripts/rendu-calendrier-pdf.ts <dossier>");
  process.exit(1);
}

const EQUIPES: Record<string, string[]> = {
  A: ["AS Bè", "FC Lion", "Étoile Filante de Lomé", "Gbossimé United"],
  B: ["Team Coopération", "Team Nations Unies", "Avenir de Kodjoviakopé", "Racing Club Adidogomé"],
  C: ["Dynamic Togolais", "Espoir Tokoin", "Olympique Agoè-Nyivé Football Club", "Ifodjè FC"],
};
const PRENOMS = ["Kossi", "Mawuli", "Edem", "Sena", "Komi", "Yao", "Afi", "Kodjo", "Elom", "Dodzi", "Selom", "Koffi"];
const feuille = [{ playerId: "p", name: "Joueur", number: "1", role: "starter" }] as LineupEntry[];

let n = 0;
const but = (teamId: string, minute: number, nom?: string, extra: Partial<Evt> = {}): Evt =>
  ({ id: `e${n++}`, type: "goal", minute, teamId, playerId: `j${n}`, playerName: nom ?? PRENOMS[n % PRENOMS.length], ...extra }) as Evt;

function match(id: string, m: Partial<CompMatch> & { events?: Evt[] }): CompMatch {
  const { events, ...reste } = m;
  return {
    id, competitionId: "c", stage: "group", group: "A", round: null, bracketSlot: null, homeSource: null, awaySource: null,
    homeTeamId: "h", awayTeamId: "a", homeTeamName: "", awayTeamName: "", homeTeamLogo: null, awayTeamLogo: null, bannerUrl: null,
    date: null, time: null, venueName: null, venueCity: null, venueId: null, venueBooking: null,
    status: "scheduled", scoreHome: null, scoreAway: null, penaltyHome: null, penaltyAway: null, winnerTeamId: null,
    forfeitByTeamId: null, feedsIntoMatchId: null, feedsIntoSlot: null,
    homeLineup: feuille, awayLineup: feuille, homeLineupReady: true, awayLineupReady: true, homeOnPitch: [], awayOnPitch: [],
    liveState: events ? ({ events } as unknown as CompMatch["liveState"]) : null, createdAt: "", updatedAt: "",
    ...reste,
  } as CompMatch;
}

const matchs: CompMatch[] = [];
const jours = ["2026-10-15", "2026-10-16", "2026-10-17"];
const heures = ["14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];
let k = 0;
for (const [g, eqs] of Object.entries(EQUIPES)) {
  for (let i = 0; i < eqs.length; i++) {
    for (let j = i + 1; j < eqs.length; j++) {
      const date = jours[k % 2];
      const time = heures[(k * 5) % heures.length];
      const id = `g${g}${i}${j}`;
      const h = (k * 7) % 4;
      const a = (k * 5) % 3;
      const events = [
        ...Array.from({ length: h }, (_, x) => but("h", 8 + x * 17, x === 1 && k % 3 === 0 ? PRENOMS[(k + 1) % 12] : undefined)),
        ...Array.from({ length: a }, (_, x) => but("a", 21 + x * 13)),
      ];
      matchs.push(match(id, {
        group: g, homeTeamId: `${g}${i}`, awayTeamId: `${g}${j}`, homeTeamName: eqs[i], awayTeamName: eqs[j],
        date, time, venueName: "UL - Terrain 1", venueCity: "Lomé",
        status: "completed", scoreHome: h, scoreAway: a,
        events: events.map((e) => ({ ...e, teamId: e.teamId === "h" ? `${g}${i}` : `${g}${j}` })),
        // Un match sur cinq rattrapé après coup, sans feuille.
        homeLineup: k % 5 === 2 ? [] : feuille,
      }));
      k++;
    }
  }
}
// Un buteur au dossard, des tirs au but, un forfait, un csc, un but sans minute.
matchs.push(match("dossard", {
  group: "B", homeTeamId: "B0", awayTeamId: "B3", homeTeamName: "Team Coopération", awayTeamName: "Racing Club Adidogomé",
  date: "2026-10-16", time: "20:00", status: "completed", scoreHome: 2, scoreAway: 1,
  events: [but("B0", 12, "N°7", { playerId: "dos-B0-7" }), but("B0", 40, "Kossi", { detail: "csc" } as Partial<Evt>), but("B3", 0, "Yao")],
}));
// Une large victoire : six buteurs, la liste passe à la ligne.
matchs.push(match("large", {
  group: "A", homeTeamId: "A2", awayTeamId: "A3", homeTeamName: "Étoile Filante de Lomé", awayTeamName: "Gbossimé United",
  date: "2026-10-16", time: "20:00", status: "completed", scoreHome: 7, scoreAway: 2,
  events: [but("A2", 3, "Kossi Amegan"), but("A2", 11, "Mawuli Ayité"), but("A2", 19, "Edem Woayi"), but("A2", 27, "Sena Kpodar"),
    but("A2", 38, "Komi Agbeko"), but("A2", 44, "Yao Tchalla"), but("A2", 58, "Kossi Amegan"), but("A3", 33, "Afi Dzidzo"), but("A3", 61, "Elom Akakpo")],
}));
matchs.push(match("forfait", {
  group: "C", homeTeamId: "C0", awayTeamId: "C3", homeTeamName: "Dynamic Togolais", awayTeamName: "Ifodjè FC",
  date: "2026-10-17", time: "09:00", status: "completed", scoreHome: 3, scoreAway: 0, forfeitByTeamId: "C3",
}));
// La phase finale : un quart joué aux tirs au but, des demies à venir.
matchs.push(match("q1", {
  stage: "knockout", group: null, round: "quarter", bracketSlot: 1, homeTeamId: "A0", awayTeamId: "B1",
  homeTeamName: "AS Bè", awayTeamName: "Team Nations Unies", date: "2026-10-17", time: "15:00",
  status: "completed", scoreHome: 1, scoreAway: 1, penaltyHome: 4, penaltyAway: 3,
  events: [but("A0", 22, "Edem"), but("B1", 49, "Sena")],
}));
matchs.push(match("q2", {
  stage: "knockout", group: null, round: "quarter", bracketSlot: 2, homeTeamId: "B0", awayTeamId: "C1",
  homeTeamName: "Team Coopération", awayTeamName: "Espoir Tokoin", date: "2026-10-17", time: "16:30",
  status: "live", scoreHome: 1, scoreAway: 0, events: [but("B0", 31, "Kodjo")],
}));
matchs.push(match("d1", {
  stage: "knockout", group: null, round: "semi", bracketSlot: 1, homeTeamId: "A0", awayTeamId: null,
  homeTeamName: "AS Bè", awayTeamName: "", awaySource: { kind: "group_rank", group: "C", rank: 1 },
  date: "2026-10-18", time: "15:00", venueName: "Stade Agoè-Nyivé", venueCity: "Lomé",
}));
matchs.push(match("d2", {
  stage: "knockout", group: null, round: "semi", bracketSlot: 2, homeTeamId: null, awayTeamId: null,
  homeTeamName: "", awayTeamName: "", homeSource: { kind: "best_rank", rank: 2, index: 1 },
  date: "2026-10-18", time: "16:30", venueName: "Stade Agoè-Nyivé", venueCity: "Lomé",
}));
matchs.push(match("f", {
  stage: "knockout", group: null, round: "final", homeTeamId: null, awayTeamId: null, homeTeamName: "", awayTeamName: "",
}));
matchs.push(match("annule", { status: "cancelled", homeTeamName: "X", awayTeamName: "Y", homeTeamId: "x", awayTeamId: "y", date: "2026-10-16" }));

async function main() {
  const cal = calendrierDeCompetition(matchs, 25);
  const pdf = await pdfCalendrier(
    { nom: "Tournoi des Quartiers 2026", slug: "tournoi-des-quartiers-2026", logo: null,
      debut: "2026-10-15", fin: "2026-10-18", ville: "Lomé", organisateur: "Association Sportive des Quartiers" },
    cal,
    "mercredi 21 octobre 2026",
  );
  await mkdir(dossier, { recursive: true });
  const fichier = join(dossier, "calendrier.pdf");
  await writeFile(fichier, pdf);
  console.log(`${fichier} : ${cal.joues} joués, ${cal.aVenir} à venir, ${cal.sansFeuille} sans feuille, ${pdf.length} octets`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
