/**
 * KOPPAFOOT — Vérification des calculs purs des pertes et gains de balle :
 * l'action proposée selon la possession, le ballon après la saisie, les
 * compteurs et le poids dans la note. Aucune base, aucun réseau.
 *
 * Usage:
 *   npx tsx scripts/test-pertes-de-balle.ts
 */
import assert from "node:assert/strict";
import { actionDeBallon, balleApres } from "@/lib/etat-du-jeu";
import { LIBELLE_EVENEMENT, estMineur, estStatistique, type TypeEvenement } from "@/lib/evenements";
import { notesDuCamp } from "@/lib/notes";
import { POSSESSION_VIDE } from "@/lib/possession";
import { aDesStats, lignesStats, type FaitCompte } from "@/lib/stats-match";
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

type Evenement = NonNullable<CompMatch["liveState"]>["events"][number];

function evt(e: Partial<Evenement> & { type: TypeEvenement; teamId: string }): Evenement {
  return {
    id: Math.random().toString(36).slice(2),
    period: 1, minute: 10, createdAt: "",
    ...e,
  } as Evenement;
}

console.log("L'action proposée selon la possession");

cas("l'équipe qui a le ballon peut le perdre", () => {
  assert.equal(actionDeBallon("home", "home"), "ball_lost");
});

cas("l'équipe qui ne l'a pas peut le gagner", () => {
  assert.equal(actionDeBallon("home", "away"), "ball_won");
});

cas("personne n'a le ballon : tout le monde peut le gagner", () => {
  assert.equal(actionDeBallon("away", null), "ball_won");
});

console.log("\nLe ballon après la saisie");

cas("une perte donne le ballon à l'adversaire", () => {
  assert.equal(balleApres("ball_lost", "home"), "away");
});

cas("un gain le donne à l'équipe du joueur", () => {
  assert.equal(balleApres("ball_won", "home"), "home");
});

cas("prendre les gants ne dit rien du ballon", () => {
  assert.equal(balleApres("gants", "home"), null);
});

console.log("\nCe que les trois nouveaux événements sont");

cas("ni notifiés ni racontés", () => {
  for (const t of ["ball_won", "ball_lost", "gants"] as const) {
    assert.ok(estMineur(t), `${t} devrait être mineur`);
    assert.ok(estStatistique(t), `${t} devrait être comptable`);
  }
});

cas("leurs libellés en français", () => {
  assert.equal(LIBELLE_EVENEMENT.ball_won, "Gain de balle");
  assert.equal(LIBELLE_EVENEMENT.ball_lost, "Perte de balle");
});

console.log("\nLes compteurs du match");

const faitsDeBallon: FaitCompte[] = [
  { type: "ball_won", teamId: "A" },
  { type: "ball_won", teamId: "A" },
  { type: "ball_lost", teamId: "B" },
];
const possessionAvecPasses = { ...POSSESSION_VIDE, homePasses: 12 };

cas("deux lignes, juste après les passes", () => {
  const lignes = lignesStats(faitsDeBallon, "A", "B", { home: 0, away: 0 }, possessionAvecPasses, false, 0, 0);
  const recup = lignes.find((l) => l.cle === "recuperations");
  const pertes = lignes.find((l) => l.cle === "pertes");
  assert.deepEqual(
    recup && { label: recup.label, home: recup.home, away: recup.away },
    { label: "Ballons récupérés", home: 2, away: 0 },
  );
  assert.deepEqual(
    pertes && { label: pertes.label, home: pertes.home, away: pertes.away },
    { label: "Ballons perdus", home: 0, away: 1 },
  );
  const iPasses = lignes.findIndex((l) => l.cle === "passes");
  assert.ok(iPasses >= 0, "la ligne des passes manque");
  assert.equal(lignes.findIndex((l) => l.cle === "recuperations"), iPasses + 1);
});

cas("rien de saisi, aucune ligne", () => {
  const lignes = lignesStats([], "A", "B", { home: 0, away: 0 }, possessionAvecPasses, false, 0, 0);
  assert.ok(!lignes.some((l) => l.cle === "recuperations" || l.cle === "pertes"));
});

cas("une prise de gants seule ne fait pas un onglet Stats", () => {
  assert.equal(aDesStats([{ type: "gants", teamId: "A" }], null, false), false);
});

console.log("\nLe poids dans la note");

cas("6 gains et 3 pertes : 6,6 ; 10 pertes sans rien gagner : 5,0", () => {
  const lineup = [
    { playerId: "milieu", name: "Milieu fictif", number: "6", role: "starter" as const },
    { playerId: "dribbleur", name: "Dribbleur fictif", number: "11", role: "starter" as const },
  ];
  const events = [
    ...Array.from({ length: 6 }, () => evt({ type: "ball_won", teamId: "A", playerId: "milieu" })),
    ...Array.from({ length: 3 }, () => evt({ type: "ball_lost", teamId: "A", playerId: "milieu" })),
    ...Array.from({ length: 10 }, () => evt({ type: "ball_lost", teamId: "A", playerId: "dribbleur" })),
  ];
  const match = {
    id: "m1", homeTeamId: "A", awayTeamId: "B", homeTeamName: "LES PALMIERS FC", awayTeamName: "AS LAGUNE",
    date: "2026-10-23", time: "16:00", scoreHome: 0, scoreAway: 0, status: "completed",
    homeLineup: lineup, awayLineup: [], homeOnPitch: [], awayOnPitch: [],
    liveState: { currentPeriod: 4, timerStartAt: null, timerOffset: 90 * 60_000, isTimerRunning: false, events },
  } as unknown as CompMatch;
  const notes = notesDuCamp(match, lineup, events, "A", 90);
  assert.equal(notes.get("milieu")?.note, 6.6);
  assert.equal(notes.get("milieu")?.faits, 9);
  assert.equal(notes.get("dribbleur")?.note, 5);
});

if (echecs > 0) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log("\nTout est bon.");
