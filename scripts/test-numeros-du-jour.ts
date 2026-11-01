/**
 * KOPPAFOOT — Vérification des dossards du jour (lib/numeros-du-jour) : le
 * numéro qu'un joueur porte sur la feuille d'un match, changé depuis la
 * console. Aucune base, aucun réseau.
 *
 * Usage:
 *   npx tsx scripts/test-numeros-du-jour.ts
 */
import assert from "node:assert/strict";
import {
  appliquerNumeros, lireNumero, numeroModifiable, numerosDeLaFeuille, numerosEnDouble,
} from "@/lib/numeros-du-jour";
import { idDossard } from "@/lib/dossards";
import { ghostOpponentLineup } from "@/lib/effectif-match";
import type { LineupEntry } from "@/types";

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

console.log("lireNumero");

cas("un nombre de 0 à 99, sans zéro devant ; vide pour aucun numéro", () => {
  assert.equal(lireNumero("7"), "7");
  assert.equal(lireNumero(" 07 "), "7");
  assert.equal(lireNumero("0"), "0");
  assert.equal(lireNumero("99"), "99");
  assert.equal(lireNumero(""), "");
  assert.equal(lireNumero("   "), "");
});

cas("tout le reste est refusé", () => {
  for (const x of ["100", "-1", "7a", "N°9", "1.5", "１"]) assert.equal(lireNumero(x), null, x);
});

console.log("numeroModifiable");

cas("une ligne d'effectif, oui ; un dossard de secours ou un « Joueur 9 », non", () => {
  assert.equal(numeroModifiable("abc123"), true);
  assert.equal(numeroModifiable("u_uid42"), true);
  assert.equal(numeroModifiable("ghost_g1"), true);
  assert.equal(numeroModifiable(idDossard("t1", 9)), false);
  assert.equal(numeroModifiable(ghostOpponentLineup("5v5")[0].playerId), false);
});

const FEUILLE: LineupEntry[] = [
  { playerId: "l1", name: "Koffi", number: "10", role: "starter", position: "forward" },
  { playerId: "l2", name: "Afi", number: "", role: "starter" },
  { playerId: idDossard("t1", 9), name: "N°9", number: "9", role: "substitute" },
];

console.log("numerosDeLaFeuille");

cas("le numéro de chaque ligne, vide compris", () => {
  assert.deepEqual(numerosDeLaFeuille(FEUILLE), { l1: "10", l2: "", [idDossard("t1", 9)]: "9" });
});

console.log("appliquerNumeros");

cas("les numéros changés, le reste de la ligne intact", () => {
  const f = appliquerNumeros(FEUILLE, { l1: "11", l2: "4" })!;
  assert.deepEqual(f.map((e) => e.number), ["11", "4", "9"]);
  assert.deepEqual({ ...f[0], number: "10" }, FEUILLE[0]);
  assert.equal(FEUILLE[0].number, "10");
});

cas("rien ne change : rien à écrire", () => {
  assert.equal(appliquerNumeros(FEUILLE, numerosDeLaFeuille(FEUILLE)), null);
  assert.equal(appliquerNumeros(FEUILLE, {}), null);
  assert.equal(appliquerNumeros(FEUILLE, { inconnu: "3" }), null);
});

cas("un dossard de secours garde son numéro, quoi qu'on lui demande", () => {
  assert.equal(appliquerNumeros(FEUILLE, { [idDossard("t1", 9)]: "12" }), null);
});

cas("on peut retirer un numéro", () => {
  assert.equal(appliquerNumeros(FEUILLE, { l1: "" })![0].number, "");
});

console.log("numerosEnDouble");

cas("les numéros portés deux fois ; un joueur sans numéro n'en est pas un", () => {
  assert.deepEqual([...numerosEnDouble(["7", "9", "7", "", "", "10"])], ["7"]);
  assert.equal(numerosEnDouble(["1", "2", "3"]).size, 0);
});

if (echecs) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log("\nTout est bon.");
