/**
 * KOPPAFOOT — Vérification des dribbles saisis dans la console : réussi ou
 * raté, qui peut les saisir, où va le ballon, les compteurs du match et le
 * poids dans la note. Aucune base, aucun réseau. Des joueurs fictifs.
 *
 * Usage:
 *   npx tsx scripts/test-dribbles.ts
 */
import assert from "node:assert/strict";
import { balleApres, dribblePossible } from "@/lib/etat-du-jeu";
import { EMOJI_EVENEMENT, LIBELLE_EVENEMENT, LIBELLES_EVENEMENT, estMineur, estStatistique, type TypeEvenement } from "@/lib/evenements";
import { notesDuCamp } from "@/lib/notes";
import { POSSESSION_VIDE } from "@/lib/possession";
import { lignesStats, type FaitCompte } from "@/lib/stats-match";
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

console.log("Qui peut dribbler");

cas("l'équipe qui a le ballon, oui ; celle qui ne l'a pas, non", () => {
  assert.equal(dribblePossible("home", "home"), true);
  assert.equal(dribblePossible("away", "home"), false);
});

cas("personne n'a le ballon : tout le monde peut dribbler", () => {
  assert.equal(dribblePossible("home", null), true);
  assert.equal(dribblePossible("away", null), true);
});

console.log("\nOù va le ballon");

cas("un dribble réussi le garde à l'équipe du dribbleur", () => {
  assert.equal(balleApres("dribble", "home"), "home");
  assert.equal(balleApres("dribble", "away"), "away");
});

cas("un dribble raté le donne à l'adversaire", () => {
  assert.equal(balleApres("dribble_failed", "home"), "away");
  assert.equal(balleApres("dribble_failed", "away"), "home");
});

console.log("\nCe que les deux événements sont");

cas("ni notifiés ni racontés dans le fil : des compteurs", () => {
  for (const t of ["dribble", "dribble_failed"] as const) {
    assert.ok(estMineur(t), `${t} devrait être mineur`);
    assert.ok(estStatistique(t), `${t} devrait être comptable`);
  }
});

cas("leurs libellés en français et en anglais, et leurs emojis", () => {
  assert.equal(LIBELLE_EVENEMENT.dribble, "Dribble réussi");
  assert.equal(LIBELLE_EVENEMENT.dribble_failed, "Dribble raté");
  assert.equal(LIBELLES_EVENEMENT.en.dribble, "Successful dribble");
  assert.equal(LIBELLES_EVENEMENT.en.dribble_failed, "Failed dribble");
  assert.ok(EMOJI_EVENEMENT.dribble && EMOJI_EVENEMENT.dribble_failed);
});

console.log("\nLes compteurs du match");

const faits: FaitCompte[] = [
  { type: "dribble", teamId: "A" },
  { type: "dribble", teamId: "A" },
  { type: "dribble", teamId: "A" },
  { type: "dribble_failed", teamId: "A" },
  { type: "ball_lost", teamId: "A" },
  { type: "dribble_failed", teamId: "B" },
];
const lignes = lignesStats(faits, "A", "B", { home: 0, away: 0 }, POSSESSION_VIDE, false, 0, 0);
const ligne = (cle: string) => {
  const l = lignes.find((x) => x.cle === cle);
  return l && { label: l.label, home: l.home, away: l.away };
};

cas("« Dribbles » compte les tentés, « Dribbles réussis » ceux qui passent", () => {
  assert.deepEqual(ligne("dribbles"), { label: "Dribbles", home: 4, away: 1 });
  assert.deepEqual(ligne("dribbles_reussis"), { label: "Dribbles réussis", home: 3, away: 0 });
});

cas("un dribble raté est aussi un ballon perdu", () => {
  assert.deepEqual(ligne("pertes"), { label: "Ballons perdus", home: 2, away: 1 });
});

cas("les dribbles suivent les ballons perdus", () => {
  const i = lignes.findIndex((l) => l.cle === "pertes");
  assert.equal(lignes[i + 1]?.cle, "dribbles");
  assert.equal(lignes[i + 2]?.cle, "dribbles_reussis");
});

cas("rien de saisi, aucune ligne de dribble", () => {
  const vides = lignesStats([], "A", "B", { home: 0, away: 0 }, POSSESSION_VIDE, false, 0, 0);
  assert.ok(!vides.some((l) => l.cle === "dribbles" || l.cle === "dribbles_reussis"));
});

console.log("\nLe poids dans la note");

cas("+0,1 par dribble réussi, −0,1 par dribble raté, comme un ballon perdu", () => {
  const lineup = [
    { playerId: "ailier", name: "Ailier fictif", number: "7", role: "starter" as const },
    { playerId: "milieu", name: "Milieu fictif", number: "8", role: "starter" as const },
  ];
  const events = [
    ...Array.from({ length: 5 }, () => evt({ type: "dribble", teamId: "A", playerId: "ailier" })),
    evt({ type: "dribble_failed", teamId: "A", playerId: "ailier" }),
    ...Array.from({ length: 4 }, () => evt({ type: "dribble_failed", teamId: "A", playerId: "milieu" })),
  ];
  const match = {
    id: "m1", homeTeamId: "A", awayTeamId: "B", homeTeamName: "LES PALMIERS FC", awayTeamName: "AS LAGUNE",
    date: "2026-11-01", time: "16:00", scoreHome: 0, scoreAway: 0, status: "completed",
    homeLineup: lineup, awayLineup: [], homeOnPitch: [], awayOnPitch: [],
    liveState: { currentPeriod: 4, timerStartAt: null, timerOffset: 90 * 60_000, isTimerRunning: false, events },
  } as unknown as CompMatch;
  const notes = notesDuCamp(match, lineup, events, "A", 90);
  // 6,0 de base : cinq réussis (+0,5) et un raté (−0,1).
  assert.equal(notes.get("ailier")?.note, 6.4);
  assert.equal(notes.get("ailier")?.faits, 6);
  assert.equal(notes.get("milieu")?.note, 5.6);
});

if (echecs > 0) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log("\nTout est bon.");
