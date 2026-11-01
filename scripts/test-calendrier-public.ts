/**
 * KOPPAFOOT — Vérification de l'ordre du calendrier public d'une compétition
 * (lib/calendrier-public) : aujourd'hui et la suite d'abord, les jours passés
 * ensuite, le plus récent en tête. Aucune base, aucun réseau. Des matchs fictifs.
 *
 * Usage:
 *   npx tsx scripts/test-calendrier-public.ts
 */
import assert from "node:assert/strict";
import { calendrierParPriorite, type JourDuCalendrierPublic } from "@/lib/calendrier-public";
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

const match = (id: string, p: Partial<CompMatch> = {}): CompMatch =>
  ({ id, date: "2026-11-01", time: "14:00", status: "scheduled", group: null, round: null, stage: null, ...p } as CompMatch);

/** Les jours, réduits à ce qu'on lit : la date et les matchs dans l'ordre. */
const lire = (jours: JourDuCalendrierPublic[]) => jours.map((j) => [j.date, j.matchs.map((m) => m.id)]);

const AUJOURDHUI = "2026-11-01";

console.log("calendrierParPriorite");

cas("aujourd'hui et la suite d'abord, les jours passés ensuite, le plus récent en tête", () => {
  const { aVenir, joues } = calendrierParPriorite([
    match("j1-a", { date: "2026-10-18", time: "14:00", status: "completed" }),
    match("j1-b", { date: "2026-10-18", time: "16:00", status: "completed" }),
    match("j2-a", { date: "2026-10-25", time: "16:00", status: "completed" }),
    match("j2-b", { date: "2026-10-25", time: "14:00", status: "completed" }),
    match("auj-16h", { date: AUJOURDHUI, time: "16:00" }),
    match("auj-14h", { date: AUJOURDHUI, time: "14:00", status: "completed" }),
    match("j4", { date: "2026-11-08", time: "14:00" }),
    match("sans-date", { date: null, time: null }),
  ], AUJOURDHUI);
  assert.deepEqual(lire(aVenir), [
    [AUJOURDHUI, ["auj-14h", "auj-16h"]],
    ["2026-11-08", ["j4"]],
    [null, ["sans-date"]],
  ]);
  assert.deepEqual(lire(joues), [
    ["2026-10-25", ["j2-b", "j2-a"]],
    ["2026-10-18", ["j1-a", "j1-b"]],
  ]);
});

cas("un match en direct daté de la veille reste devant", () => {
  const { aVenir, joues } = calendrierParPriorite([
    match("hier-fini", { date: "2026-10-31", time: "18:00", status: "completed" }),
    match("hier-en-direct", { date: "2026-10-31", time: "23:30", status: "live" }),
    match("avant-hier", { date: "2026-10-30", status: "completed" }),
    match("demain", { date: "2026-11-02" }),
  ], AUJOURDHUI);
  assert.deepEqual(lire(aVenir), [
    ["2026-10-31", ["hier-fini", "hier-en-direct"]],
    ["2026-11-02", ["demain"]],
  ]);
  assert.deepEqual(lire(joues), [["2026-10-30", ["avant-hier"]]]);
});

cas("une compétition terminée n'a que des matchs joués", () => {
  const { aVenir, joues } = calendrierParPriorite([
    match("finale", { date: "2026-08-29", status: "completed" }),
    match("demi", { date: "2026-08-25", status: "completed" }),
  ], AUJOURDHUI);
  assert.deepEqual(aVenir, []);
  assert.deepEqual(lire(joues), [["2026-08-29", ["finale"]], ["2026-08-25", ["demi"]]]);
});

cas("une compétition qui n'a pas commencé n'a que des matchs à venir", () => {
  const { aVenir, joues } = calendrierParPriorite([
    match("b", { date: "2026-11-15" }),
    match("a", { date: "2026-11-08" }),
  ], AUJOURDHUI);
  assert.deepEqual(lire(aVenir), [["2026-11-08", ["a"]], ["2026-11-15", ["b"]]]);
  assert.deepEqual(joues, []);
});

cas("dans un jour, l'ordre des heures, les matchs sans heure à la fin", () => {
  const { aVenir } = calendrierParPriorite([
    match("sans-heure", { time: null }),
    match("16h", { time: "16:00" }),
    match("9h", { time: "09:00" }),
  ], AUJOURDHUI);
  assert.deepEqual(lire(aVenir), [[AUJOURDHUI, ["9h", "16h", "sans-heure"]]]);
});

cas("aucun match : rien", () => {
  assert.deepEqual(calendrierParPriorite([], AUJOURDHUI), { aVenir: [], joues: [] });
});

cas("l'entrée n'est pas modifiée", () => {
  const entree = [match("b", { time: "16:00" }), match("a", { time: "09:00" })];
  calendrierParPriorite(entree, AUJOURDHUI);
  assert.deepEqual(entree.map((m) => m.id), ["b", "a"]);
});

if (echecs) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log("\nTout est bon.");
