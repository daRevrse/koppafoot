/**
 * KOPPAFOOT — Vérification du classement des joueurs (lib/classement) et des
 * notes de match (lib/notes). Aucune base, aucun réseau.
 *
 * Usage:
 *   npx tsx scripts/test-classement.ts
 */
import assert from "node:assert/strict";
import { calculerClassements, type MatchAClasser } from "@/lib/classement";
import { notesDuCamp } from "@/lib/notes";
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

function evt(e: Partial<Evenement> & { teamId: string }): Evenement {
  return {
    id: Math.random().toString(36).slice(2),
    type: "goal", period: 0, minute: 0, createdAt: "",
    ...e,
  } as Evenement;
}

function match(m: Partial<MatchAClasser>): MatchAClasser {
  return {
    id: "m1", competitionId: "c1", homeTeamId: "A", awayTeamId: "B", homeTeamName: "PRAISE FC", awayTeamName: "FC LION",
    date: "2026-10-18", time: "16:00", scoreHome: 0, scoreAway: 0, status: "completed",
    homeLineup: [], awayLineup: [], homeOnPitch: [], awayOnPitch: [],
    ...m,
  } as MatchAClasser;
}

const feuille = (...ids: string[]) =>
  ids.map((playerId) => ({ playerId, name: playerId, number: "", role: "starter" as const }));

const evenements = (...events: Evenement[]) =>
  ({ currentPeriod: 4, timerStartAt: null, timerOffset: 0, isTimerRunning: false, events }) as CompMatch["liveState"];

const ligne = (c: ReturnType<typeof calculerClassements>, nom: string) =>
  c.parContribution.find((l) => l.nom === nom);

console.log("Score saisi après le match, un camp sans feuille");

// Le cas G2 du 18 octobre : PRAISE FC 0-4 FC LION. PRAISE FC avait validé sa
// feuille, FC LION non, et l'organisateur a saisi le score et les buteurs le
// lendemain.
const g2 = () => match({
  scoreHome: 0, scoreAway: 4,
  homeLineup: feuille("praise1", "praise2"),
  awayLineup: [],
  liveState: evenements(
    evt({ teamId: "B", playerId: "amegan", playerName: "AMEGAN Kodjo" }),
    evt({ teamId: "B", playerId: "ayite", playerName: "AYITE Komi" }),
    evt({ teamId: "B", playerId: "amegan", playerName: "AMEGAN Kodjo", assistPlayerId: "woayi", assistPlayerName: "WOAYI Sena" }),
    evt({ teamId: "B", playerId: "woayi", playerName: "WOAYI Sena" }),
  ),
  comptesDesLignes: {},
});

cas("le doublé compte deux buts et un match", () => {
  const l = ligne(calculerClassements([g2()]), "AMEGAN Kodjo");
  assert.ok(l, "AMEGAN absent du classement");
  assert.equal(l.buts, 2);
  assert.equal(l.matchs, 1);
});

cas("chaque buteur et passeur nommé y figure", () => {
  const c = calculerClassements([g2()]);
  assert.equal(ligne(c, "AYITE Komi")?.buts, 1);
  assert.equal(ligne(c, "WOAYI Sena")?.buts, 1);
  assert.equal(ligne(c, "WOAYI Sena")?.passes, 1);
  assert.equal(ligne(c, "WOAYI Sena")?.matchs, 1);
});

cas("personne n'est noté sur le camp sans feuille", () => {
  const c = calculerClassements([g2()]);
  assert.deepEqual(ligne(c, "AMEGAN Kodjo")?.notes, [null]);
});

cas("le camp qui a une feuille garde la sienne", () => {
  const c = calculerClassements([g2()]);
  const praise = [...c.parContribution, ...c.parNote];
  // Personne de PRAISE FC n'a contribué : ils ne sont pas aux contributions,
  // mais le match compte bien comme retenu.
  assert.equal(praise.some((l) => l.nom.startsWith("praise")), false);
  assert.equal(c.matchsRetenus, 1);
});

cas("un joueur nommé hors de la feuille de son camp ne compte toujours pas", () => {
  const m = match({
    homeLineup: feuille("p1"),
    awayLineup: feuille("q1"),
    liveState: evenements(evt({ teamId: "B", playerId: "intrus", playerName: "Intrus" })),
    comptesDesLignes: {},
  });
  assert.equal(ligne(calculerClassements([m]), "Intrus"), undefined);
});

cas("un csc ne fait pas entrer l'adversaire dans le camp sans feuille", () => {
  // Saisi en console, le csc porte son auteur, un joueur d'en face, et il est
  // rangé dans le camp qui en profite.
  const m = match({
    homeLineup: feuille("p1"),
    liveState: evenements(evt({ teamId: "B", playerId: "p1", playerName: "p1", detail: "csc" })),
    comptesDesLignes: {},
  });
  const c = calculerClassements([m]);
  const p1 = [...c.parContribution, ...c.parNote].find((l) => l.nom === "p1");
  assert.equal(p1, undefined);
});

cas("un carton nomme aussi un joueur présent", () => {
  const m = match({
    liveState: evenements(
      evt({ teamId: "B", playerId: "amegan", playerName: "AMEGAN Kodjo" }),
      evt({ teamId: "B", type: "yellow_card", playerId: "kossi", playerName: "Kossi" }),
    ),
    comptesDesLignes: {},
  });
  // Il n'a pas contribué, il n'est donc pas aux contributions ; mais le match
  // entre dans sa fenêtre. On le voit au match suivant, où il marque.
  const suivant = match({
    id: "m2", date: "2026-10-25",
    liveState: evenements(evt({ teamId: "B", playerId: "kossi", playerName: "Kossi" })),
    comptesDesLignes: {},
  });
  assert.equal(ligne(calculerClassements([m, suivant]), "Kossi")?.matchs, 2);
});

cas("la ligne revendiquée classe le compte, pas le nom", () => {
  const m = match({
    liveState: evenements(evt({ teamId: "B", playerId: "amegan", playerName: "AMEGAN Kodjo" })),
    comptesDesLignes: { amegan: "uidAmegan" },
  });
  const l = ligne(calculerClassements([m]), "AMEGAN Kodjo");
  assert.equal(l?.cle, "uid:uidAmegan");
  assert.equal(l?.uid, "uidAmegan");
});

cas("un dossard que personne n'a nommé reste hors du classement", () => {
  const m = match({
    liveState: evenements(evt({ teamId: "B", playerId: "dos-B-11", playerName: "N°11" })),
    comptesDesLignes: {},
  });
  assert.equal(calculerClassements([m]).parContribution.length, 0);
});

cas("sans effectif fourni, pas de repli (un amical)", () => {
  const m = match({
    competitionId: "friendly",
    liveState: evenements(evt({ teamId: "B", playerId: "amegan", playerName: "AMEGAN Kodjo" })),
  });
  assert.equal(calculerClassements([m]).parContribution.length, 0);
});

console.log("\nLes notes d'un match que le chrono n'a jamais vu");

// Le camp AVEC feuille du même match G2 : saisi le lendemain, il n'a jamais
// été chronométré. La note lui donnait 6,0 à plat, et 4,6 à son gardien pour
// les quatre buts encaissés.
const praise = () => match({
  scoreHome: 0, scoreAway: 4,
  homeLineup: [
    { playerId: "g", name: "gardien", number: "1", role: "starter", position: "goalkeeper" },
    { playerId: "t", name: "titulaire", number: "5", role: "starter" },
  ],
  liveState: evenements(
    ...[1, 2, 3, 4].map(() => evt({ teamId: "B", playerId: "amegan", playerName: "AMEGAN Kodjo" })),
  ),
  comptesDesLignes: {},
});

const chronometre = (m: MatchAClasser): MatchAClasser =>
  ({ ...m, liveState: { ...m.liveState!, timerOffset: 50 * 60_000 } }) as MatchAClasser;

cas("personne n'est noté sur un match jamais chronométré", () => {
  const m = praise();
  const notes = notesDuCamp(m, m.homeLineup, m.liveState!.events, "A");
  assert.equal(notes.get("t")?.note, null);
  assert.equal(notes.get("g")?.note, null);
});

cas("trois matchs saisis après coup ne classent personne à la note", () => {
  const c = calculerClassements([
    praise(), { ...praise(), id: "m2", date: "2026-10-11" }, { ...praise(), id: "m3", date: "2026-10-04" },
  ]);
  assert.equal(c.parNote.length, 0);
});

cas("un match suivi en console garde ses notes", () => {
  const m = chronometre(praise());
  const notes = notesDuCamp(m, m.homeLineup, m.liveState!.events, "A");
  assert.equal(notes.get("t")?.note, 6);
  assert.equal(notes.get("g")?.note, 4.6);
});

cas("un match en cours, chrono lancé, se note déjà", () => {
  const base = praise();
  const m = {
    ...base, status: "live",
    liveState: { ...base.liveState!, isTimerRunning: true, timerStartAt: new Date().toISOString() },
  } as MatchAClasser;
  const notes = notesDuCamp(m, m.homeLineup, m.liveState!.events, "A");
  assert.notEqual(notes.get("t")?.note, null);
});

if (echecs > 0) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log("\nTout passe.");
