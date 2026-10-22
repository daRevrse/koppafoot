/**
 * KOPPAFOOT — Vérification du programme d'une affiche « Journée X » /
 * « Matchs du jour » (lib/programme). Aucune base, aucun réseau.
 *
 * Usage:
 *   npx tsx scripts/test-programme.ts
 */
import assert from "node:assert/strict";
import {
  datesDisponibles, journeesDisponibles, lireChoix, paginer, selectionnerProgramme, titreDuProgramme,
} from "@/lib/programme";
import type { JourDuCalendrier, LigneDuCalendrier } from "@/lib/calendrier-competition";
import type { CompMatch } from "@/types";

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok  ${nom}`);
  } catch (err) {
    echecs += 1;
    console.error(`  KO  ${nom}\n      ${(err as Error).message.split("\n").join("\n      ")}`);
  }
}

function match(id: string, m: Partial<CompMatch> = {}): CompMatch {
  return {
    id, competitionId: "c1", stage: "group", group: "A", round: null, bracketSlot: null,
    homeSource: null, awaySource: null,
    homeTeamId: "H", awayTeamId: "A", homeTeamName: "Domicile", awayTeamName: "Extérieur",
    homeTeamLogo: null, awayTeamLogo: null, bannerUrl: null,
    date: "2026-10-18", time: "16:30", venueName: null, venueCity: null, venueId: null, venueBooking: null,
    status: "scheduled", scoreHome: null, scoreAway: null, penaltyHome: null, penaltyAway: null,
    winnerTeamId: null, journee: null, forfeitByTeamId: null, feedsIntoMatchId: null, feedsIntoSlot: null,
    homeLineup: [], awayLineup: [], homeLineupReady: true, awayLineupReady: true,
    homeOnPitch: [], awayOnPitch: [], liveState: null, createdAt: "", updatedAt: "",
    ...m,
  } as CompMatch;
}

/** Un jour du calendrier de `n` lignes. */
function jour(date: string, n: number): JourDuCalendrier {
  return { date, titre: date, lignes: Array.from({ length: n }, (_, i) => ({ id: `${date}-${i}` }) as LigneDuCalendrier) };
}
const tailles = (pages: JourDuCalendrier[][]) => pages.map((p) => p.map((j) => j.lignes.length));

console.log("lireChoix");

cas("une journée, ou des dates triées sans doublon", () => {
  assert.deepEqual(lireChoix(new URLSearchParams("journee=2")), { journee: 2 });
  assert.deepEqual(lireChoix(new URLSearchParams("dates=2026-11-01,2026-10-25,2026-10-25")), { dates: ["2026-10-25", "2026-11-01"] });
});

cas("une adresse bricolée ne choisit rien", () => {
  for (const q of ["journee=abc", "journee=0", "journee=2.5", "journee=-1", "dates=hier", "dates=2026-13-45",
    "journee=2&dates=2026-10-25", "", "dates=", "journee="]) {
    assert.equal(lireChoix(new URLSearchParams(q)), null, q);
  }
});

cas("quatorze dates au plus", () => {
  const quinze = Array.from({ length: 15 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`).join(",");
  assert.equal(lireChoix(new URLSearchParams(`dates=${quinze}`)), null);
});

console.log("selectionnerProgramme");

const matchs = [
  match("j2-a", { journee: 2, date: "2026-10-18" }),
  match("j2-sans-date", { journee: 2, date: null }),
  match("j1", { journee: 1, date: "2026-10-11" }),
  match("demi", { stage: "knockout", group: null, round: "semi", date: "2026-10-18" }),
  match("gala", { stage: "exhibition", group: null, date: "2026-10-18" }),
  match("annule", { journee: 2, date: "2026-10-25", status: "cancelled" }),
];

cas("une journée : ses seuls matchs de poule, y compris ceux sans date", () => {
  assert.deepEqual(selectionnerProgramme(matchs, { journee: 2 }).map((m) => m.id).sort(), ["annule", "j2-a", "j2-sans-date"]);
});

cas("des dates : tous les matchs de ces dates, phase finale et exhibitions comprises", () => {
  assert.deepEqual(selectionnerProgramme(matchs, { dates: ["2026-10-18"] }).map((m) => m.id).sort(), ["demi", "gala", "j2-a"]);
});

console.log("titreDuProgramme");

cas("JOURNÉE N, MATCHS DU JOUR, AU PROGRAMME", () => {
  assert.equal(titreDuProgramme({ journee: 3 }), "JOURNÉE 3");
  assert.equal(titreDuProgramme({ dates: ["2026-10-25"] }), "MATCHS DU JOUR");
  assert.equal(titreDuProgramme({ dates: ["2026-10-25", "2026-10-26"] }), "AU PROGRAMME");
});

console.log("journeesDisponibles, datesDisponibles");

cas("J1 et J3 sans J2 inventée, dates triées et dédoublonnées, matchs annulés écartés", () => {
  const l = [
    match("a", { journee: 3, date: "2026-11-01" }), match("b", { journee: 1, date: "2026-10-18" }),
    match("c", { journee: 3, date: "2026-10-25" }), match("d", { journee: 3, date: "2026-11-01" }),
    match("e", { journee: 3, date: null }), match("f", { journee: 4, date: "2026-11-08", status: "cancelled" }),
  ];
  assert.deepEqual(journeesDisponibles(l), [
    { journee: 1, dates: ["2026-10-18"] },
    { journee: 3, dates: ["2026-10-25", "2026-11-01"] },
  ]);
  assert.deepEqual(datesDisponibles(l), ["2026-10-18", "2026-10-25", "2026-11-01"]);
});

console.log("paginer");

cas("douze lignes tiennent sur une page", () => {
  assert.deepEqual(tailles(paginer([jour("d1", 12)])), [[12]]);
});

cas("treize lignes d'un même jour : deux pages, le jour répété en tête de la seconde", () => {
  const pages = paginer([jour("d1", 13)]);
  assert.deepEqual(tailles(pages), [[12], [1]]);
  assert.equal(pages[1][0].date, "d1");
});

cas("coupe entre deux jours quand le second tient entier sur une page neuve", () => {
  assert.deepEqual(tailles(paginer([jour("d1", 8), jour("d2", 6)])), [[8], [6]]);
  assert.deepEqual(tailles(paginer([jour("d1", 6), jour("d2", 6)])), [[6, 6]]);
});

cas("un jour trop long pour une page neuve finit la page en cours, dans l'ordre", () => {
  const pages = paginer([jour("d1", 10), jour("d2", 15)]);
  assert.ok(pages.every((p) => p.reduce((s, j) => s + j.lignes.length, 0) <= 12));
  assert.deepEqual(pages.flat().flatMap((j) => j.lignes.map((l) => l.id)), [
    ...jour("d1", 10).lignes, ...jour("d2", 15).lignes,
  ].map((l) => l.id));
});

if (echecs) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log("\nTout est bon.");
