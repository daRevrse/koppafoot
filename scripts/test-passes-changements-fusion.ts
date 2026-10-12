/**
 * KOPPAFOOT — Vérification des calculs purs : passes décisives, règles de
 * changement d'une compétition, correspondances proposées à l'import d'un
 * club. Aucune base, aucun réseau.
 *
 * Usage:
 *   npx tsx scripts/test-passes-changements-fusion.ts
 */
import assert from "node:assert/strict";
import { computePlayerStats, computeAppearances, computeSquadStats, totalStats } from "@/lib/player-stats";
import { DEFAULT_SUBS_MAX, defaultFormat, reentryAllowed, subsMax } from "@/lib/competition-format";
import { lireAmicalAdmin } from "@/lib/amical-admin";
import {
  ImportRefuse, estLigneLibre, lignesActives, planifierImport, proposerImport, recopierLesComptes,
  retirerLeCompte, sansLeLien,
  type JoueurDuClub,
} from "@/lib/fusion-import";
import type { CompMatch, CompPlayer, LinkedCompPlayer } from "@/types";

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

function but(e: Partial<Evenement> & { teamId: string }): Evenement {
  return {
    id: Math.random().toString(36).slice(2),
    type: "goal", period: 1, minute: 10, createdAt: "",
    ...e,
  } as Evenement;
}

function match(m: Partial<CompMatch>): CompMatch {
  return {
    id: "m1", homeTeamId: "A", awayTeamId: "B", homeTeamName: "A", awayTeamName: "B",
    date: "2026-10-01", time: "16:00", scoreHome: 0, scoreAway: 0, status: "completed",
    homeLineup: [], awayLineup: [], homeOnPitch: [], awayOnPitch: [],
    ...m,
  } as CompMatch;
}

const feuille = (...ids: string[]) =>
  ids.map((playerId) => ({ playerId, name: playerId, number: "", role: "starter" as const }));

console.log("Passes décisives");

cas("une passe est comptée au passeur, pas au buteur", () => {
  const m = match({
    homeLineup: feuille("p1", "p2"),
    liveState: { events: [but({ teamId: "A", playerId: "p1", assistPlayerId: "p2" })] } as CompMatch["liveState"],
  });
  assert.equal(computePlayerStats([m], "A", "p2").assists, 1);
  assert.equal(computePlayerStats([m], "A", "p2").goals, 0);
  assert.equal(computePlayerStats([m], "A", "p1").assists, 0);
  assert.equal(computePlayerStats([m], "A", "p1").goals, 1);
});

cas("un but annulé par la VAR emporte sa passe", () => {
  const m = match({
    homeLineup: feuille("p1", "p2"),
    liveState: { events: [but({ teamId: "A", playerId: "p1", assistPlayerId: "p2", varStatus: "cancelled" })] } as CompMatch["liveState"],
  });
  assert.equal(computePlayerStats([m], "A", "p2").assists, 0);
});

cas("un but contre son camp ne donne de passe à personne", () => {
  const m = match({
    homeLineup: feuille("p2"),
    liveState: { events: [but({ teamId: "A", playerId: undefined, detail: "csc", assistPlayerId: "p2" })] } as CompMatch["liveState"],
  });
  assert.equal(computePlayerStats([m], "A", "p2").assists, 0);
});

cas("on ne se fait pas la passe à soi-même", () => {
  const m = match({
    homeLineup: feuille("p1"),
    liveState: { events: [but({ teamId: "A", playerId: "p1", assistPlayerId: "p1" })] } as CompMatch["liveState"],
  });
  const s = computePlayerStats([m], "A", "p1");
  assert.equal(s.goals, 1);
  assert.equal(s.assists, 0);
});

cas("sans feuille, le passeur nommé au résultat prend son match", () => {
  const m = match({
    liveState: { events: [but({ teamId: "A", playerId: "p1", assistPlayerId: "p2" })] } as CompMatch["liveState"],
  });
  const s = computePlayerStats([m], "A", "p2");
  assert.equal(s.matchesPlayed, 1);
  assert.equal(s.assists, 1);
});

cas("le match par match et le total portent les passes", () => {
  const m = match({
    homeLineup: feuille("p1", "p2"),
    liveState: { events: [
      but({ teamId: "A", playerId: "p1", assistPlayerId: "p2" }),
      but({ teamId: "A", playerId: "p1", assistPlayerId: "p2" }),
    ] } as CompMatch["liveState"],
  });
  assert.equal(computeAppearances([m], "A", "p2")[0].assists, 2);
  const s = computePlayerStats([m], "A", "p2");
  assert.equal(totalStats([s, s]).assists, 4);
});

cas("à buts égaux, l'effectif se range par passes", () => {
  const m = match({
    homeLineup: feuille("p1", "p2", "p3"),
    liveState: { events: [but({ teamId: "A", playerId: "p1", assistPlayerId: "p3" })] } as CompMatch["liveState"],
  });
  const effectif: CompPlayer[] = [
    { id: "p2", name: "Abalo", number: "2" },
    { id: "p3", name: "Zinsou", number: "3" },
    { id: "p1", name: "Koffi", number: "9" },
  ];
  assert.deepEqual(computeSquadStats([m], "A", effectif).map((l) => l.player.id), ["p1", "p3", "p2"]);
});

console.log("\nChangements d'une compétition");

const formatDeBase = defaultFormat("league");

cas("sans réglage : cinq changements, sortie définitive", () => {
  assert.equal(subsMax(formatDeBase), DEFAULT_SUBS_MAX);
  assert.equal(reentryAllowed(formatDeBase), false);
});

cas("changements illimités : plus de plafond, et un sorti peut revenir", () => {
  const f = { ...formatDeBase, unlimited_subs: true };
  assert.equal(subsMax(f), null);
  assert.equal(reentryAllowed(f), true);
});

cas("une case décochée vaut comme une case absente", () => {
  const f = { ...formatDeBase, unlimited_subs: false };
  assert.equal(subsMax(f), DEFAULT_SUBS_MAX);
  assert.equal(reentryAllowed(f), false);
});

console.log("\nAmical créé par l'administration");

const amical = {
  homeTeamId: "clubA", awayTeamId: "clubB", awayName: "",
  date: "2026-11-01", time: "16:00", venueName: "Stade de Bè", venueCity: "Lomé", format: "7v7",
};
const erreurDe = (corps: unknown) => {
  const r = lireAmicalAdmin(corps, "2026-10-12");
  return "erreur" in r ? r.erreur : null;
};

cas("un amical entre deux clubs de la plateforme est accepté", () => {
  const r = lireAmicalAdmin(amical, "2026-10-12");
  assert.ok("valeur" in r);
  assert.deepEqual(r.valeur, amical);
});

cas("le jour même passe, la veille non", () => {
  assert.equal(erreurDe({ ...amical, date: "2026-10-12" }), null);
  assert.match(erreurDe({ ...amical, date: "2026-10-11" }) ?? "", /passée/);
});

cas("un club ne joue pas contre lui-même", () => {
  assert.match(erreurDe({ ...amical, awayTeamId: "clubA" }) ?? "", /lui-même/);
});

cas("hors plateforme, il faut le nom de l'adversaire", () => {
  assert.match(erreurDe({ ...amical, awayTeamId: "", awayName: "  " }) ?? "", /adversaire/i);
  const r = lireAmicalAdmin({ ...amical, awayTeamId: "", awayName: " FC Kodjoviakopé " }, "2026-10-12");
  assert.ok("valeur" in r);
  assert.equal(r.valeur.awayName, "FC Kodjoviakopé");
  assert.equal(r.valeur.awayTeamId, "");
});

cas("une date ou une heure qui n'existe pas est refusée", () => {
  assert.notEqual(erreurDe({ ...amical, date: "2026-02-31" }), null);
  assert.notEqual(erreurDe({ ...amical, time: "25:00" }), null);
  assert.notEqual(erreurDe({ ...amical, time: "" }), null);
});

cas("le format est un NvN proposé, 11v11 par défaut", () => {
  assert.notEqual(erreurDe({ ...amical, format: "3v3" }), null);
  assert.notEqual(erreurDe({ ...amical, format: "7v5" }), null);
  const r = lireAmicalAdmin({ ...amical, format: undefined }, "2026-10-12");
  assert.ok("valeur" in r);
  assert.equal(r.valeur.format, "11v11");
});

cas("un identifiant douteux ne passe pas", () => {
  assert.notEqual(erreurDe({ ...amical, homeTeamId: "a/b" }), null);
  assert.notEqual(erreurDe({ ...amical, homeTeamId: "" }), null);
});

console.log("\nFusion à l'import d'un club");

const koffi: JoueurDuClub = { genre: "compte", id: "uidKoffi", nom: "Koffi Mensah", numero: "9" };
const abalo: JoueurDuClub = { genre: "sans_compte", id: "gAbalo", nom: "Abalo Kossi", numero: "4" };
const yao: JoueurDuClub = { genre: "compte", id: "uidYao", nom: "Yao Agbeko", numero: "7" };
const saisie = (id: string, name: string, number = ""): CompPlayer => ({ id, name, number });
const aucune = new Set<string>();

cas("une ligne saisie à la main est libre, une ligne importée ou rattachée ne l'est pas", () => {
  assert.equal(estLigneLibre(saisie("x1", "Koffi")), true);
  assert.equal(estLigneLibre({ ...saisie("x1", "Koffi"), user_id: "u" }), false);
  assert.equal(estLigneLibre({ ...saisie("x1", "Koffi"), club_ghost_id: "g" }), false);
  assert.equal(estLigneLibre(saisie("u_uidKoffi", "Koffi")), false);
  assert.equal(estLigneLibre(saisie("ghost_gAbalo", "Abalo")), false);
});

cas("le nom rapproche malgré les accents, la casse et l'ordre", () => {
  const p = proposerImport([saisie("x1", "MENSAH  koffi"), saisie("x2", "Kossi Abalô")], [koffi, abalo], aucune);
  assert.deepEqual(p.propositions.map((x) => [x.cle, x.etat, x.suggestion]), [
    ["compte:uidKoffi", "nouveau", "x1"],
    ["sans_compte:gAbalo", "nouveau", "x2"],
  ]);
  assert.deepEqual(p.libres.map((l) => l.id), ["x1", "x2"]);
});

cas("à défaut du nom entier, le dossard et un nom commun suffisent", () => {
  const p = proposerImport([saisie("x1", "Koffi", "9"), saisie("x2", "Koffi", "5")], [koffi], aucune);
  assert.equal(p.propositions[0].suggestion, "x1");
});

cas("un prénom seul, sans dossard qui concorde, ne propose rien", () => {
  const p = proposerImport([saisie("x1", "Koffi", "5")], [koffi], aucune);
  assert.equal(p.propositions[0].suggestion, null);
});

cas("une ligne libre n'est proposée qu'à un seul joueur", () => {
  const homonyme: JoueurDuClub = { ...koffi, id: "uidAutre" };
  const p = proposerImport([saisie("x1", "Koffi Mensah")], [koffi, homonyme], aucune);
  assert.deepEqual(p.propositions.map((x) => x.suggestion), ["x1", null]);
});

cas("un joueur déjà dans l'effectif n'est pas reproposé", () => {
  const effectif = [{ ...saisie("u_uidKoffi", "Koffi Mensah"), user_id: "uidKoffi" }, saisie("ghost_gAbalo", "Abalo Kossi")];
  const p = proposerImport(effectif, [koffi, abalo], aucune);
  assert.equal(p.propositions.length, 0);
  assert.equal(p.aJour, 2);
});

cas("un doublon déjà créé se propose à la fusion, si la ligne importée est vide", () => {
  const effectif = [saisie("x1", "Koffi Mensah", "9"), { ...saisie("u_uidKoffi", "Koffi Mensah"), user_id: "uidKoffi" }];
  const vide = proposerImport(effectif, [koffi], aucune);
  assert.deepEqual(vide.propositions.map((x) => [x.etat, x.suggestion]), [["doublon", "x1"]]);
  const active = proposerImport(effectif, [koffi], new Set(["u_uidKoffi"]));
  assert.equal(active.propositions.length, 0);
  assert.equal(active.aJour, 1);
});

cas("sans correspondance, l'import ajoute tout le club comme avant", () => {
  const plan = planifierImport([saisie("x1", "Koffi Mensah")], [koffi, abalo], {}, aucune);
  assert.deepEqual(plan.effectif.map((l) => l.id), ["x1", "u_uidKoffi", "ghost_gAbalo"]);
  assert.deepEqual(plan.liens, [{ uid: "uidKoffi", ligne: "u_uidKoffi", nom: "Koffi Mensah" }]);
  assert.equal(plan.ajoutes, 2);
  assert.equal(plan.fusionnes, 0);
});

cas("une correspondance confirmée garde la ligne, donc ses stats, et lui donne le compte", () => {
  const effectif = [{ ...saisie("x1", "K. Mensah"), photo_url: "https://exemple/photo.webp" }];
  const plan = planifierImport(effectif, [koffi, yao], { "compte:uidKoffi": "x1", "compte:uidYao": null }, aucune);
  assert.deepEqual(plan.effectif.map((l) => l.id), ["x1", "u_uidYao"]);
  const ligne = plan.effectif[0];
  assert.equal(ligne.user_id, "uidKoffi");
  assert.equal(ligne.name, "K. Mensah");
  assert.equal(ligne.number, "9");
  assert.equal("photo_url" in ligne, false);
  assert.deepEqual(plan.photosRetirees, ["https://exemple/photo.webp"]);
  assert.deepEqual(plan.comptesParLigne, { x1: "uidKoffi" });
  assert.deepEqual(plan.liens.map((l) => [l.uid, l.ligne]), [["uidKoffi", "x1"], ["uidYao", "u_uidYao"]]);
  assert.equal(plan.fusionnes, 1);
  assert.equal(plan.ajoutes, 1);
});

cas("un joueur sans compte confirmé marque la ligne, sans la doubler à la prochaine synchro", () => {
  const plan = planifierImport([saisie("x2", "Abalo")], [abalo], { "sans_compte:gAbalo": "x2" }, aucune);
  assert.deepEqual(plan.effectif, [{ id: "x2", name: "Abalo", number: "4", club_ghost_id: "gAbalo" }]);
  assert.deepEqual(plan.liens, []);
  const encore = planifierImport(plan.effectif, [abalo], {}, aucune);
  assert.deepEqual(encore.effectif.map((l) => l.id), ["x2"]);
  assert.equal(encore.ajoutes, 0);
});

cas("fusionner un doublon retire la ligne importée vide et déplace le lien", () => {
  const effectif = [saisie("x1", "Koffi Mensah"), { ...saisie("u_uidKoffi", "Koffi Mensah"), user_id: "uidKoffi" }];
  const plan = planifierImport(effectif, [koffi], { "compte:uidKoffi": "x1" }, aucune);
  assert.deepEqual(plan.effectif.map((l) => [l.id, l.user_id]), [["x1", "uidKoffi"]]);
  assert.deepEqual(plan.liensRetires, [{ uid: "uidKoffi", ligne: "u_uidKoffi" }]);
  assert.deepEqual(plan.liens.map((l) => l.ligne), ["x1"]);
});

cas("on ne fusionne pas deux lignes qui ont chacune leur histoire", () => {
  const effectif = [saisie("x1", "Koffi Mensah"), { ...saisie("u_uidKoffi", "Koffi Mensah"), user_id: "uidKoffi" }];
  assert.throws(
    () => planifierImport(effectif, [koffi], { "compte:uidKoffi": "x1" }, new Set(["u_uidKoffi"])),
    ImportRefuse,
  );
});

cas("une ligne ne se donne ni deux fois, ni quand elle n'est pas libre, ni quand elle n'existe pas", () => {
  const effectif = [saisie("x1", "Koffi Mensah"), { ...saisie("x3", "Yao"), user_id: "uidAilleurs" }];
  assert.throws(() => planifierImport(effectif, [koffi, yao], { "compte:uidKoffi": "x1", "compte:uidYao": "x1" }, aucune), ImportRefuse);
  assert.throws(() => planifierImport(effectif, [yao], { "compte:uidYao": "x3" }, aucune), ImportRefuse);
  assert.throws(() => planifierImport(effectif, [yao], { "compte:uidYao": "inconnue" }, aucune), ImportRefuse);
});

cas("les lignes actives se lisent sur les feuilles, les événements et l'homme du match", () => {
  const actives = lignesActives([{
    home_lineup: [{ player_id: "a", name: "", number: "", role: "starter" }],
    away_on_pitch: ["b"],
    mvp_player_id: "c",
    live_state: { events: [{ player_id: "d", assist_player_id: "e", out_player_id: "f", victim_player_id: "g" }] },
  }]);
  assert.deepEqual([...actives].sort(), ["a", "b", "c", "d", "e", "f", "g"]);
});

cas("le compte se recopie sur les feuilles passées, sans écraser ce qui y est", () => {
  const patch = recopierLesComptes({
    home_lineup: [
      { player_id: "x1", name: "K", number: "9", role: "starter" },
      { player_id: "x9", name: "Z", number: "2", role: "starter", user_id: "dejaLa" },
    ],
    away_lineup: [{ player_id: "autre", name: "A", number: "1", role: "starter" }],
    mvp_player_id: "x1",
  }, { x1: "uidKoffi", x9: "uidNouveau" });
  assert.deepEqual(patch, {
    home_lineup: [
      { player_id: "x1", name: "K", number: "9", role: "starter", user_id: "uidKoffi" },
      { player_id: "x9", name: "Z", number: "2", role: "starter", user_id: "dejaLa" },
    ],
    mvp_user_id: "uidKoffi",
  });
  assert.equal(recopierLesComptes({ home_lineup: [{ player_id: "autre", name: "A", number: "1", role: "starter" }] }, { x1: "u" }), null);
});

console.log("\nRattacher à nouveau une ligne déliée");

const deliee = (): CompPlayer[] => [{ ...saisie("u_uidKoffi", "Koffi Mensah", "9"), user_id: null }];

cas("une ligne importée puis déliée se propose à son joueur, sans être présélectionnée d'office", () => {
  const p = proposerImport(deliee(), [koffi], aucune);
  assert.deepEqual(p.propositions.map((x) => [x.cle, x.etat, x.suggestion]), [
    ["compte:uidKoffi", "delie", "u_uidKoffi"],
  ]);
  assert.equal(p.aJour, 0);
  assert.deepEqual(p.libres, []);
});

cas("confirmée, elle retrouve son compte, son lien et ses feuilles, sans ligne de plus", () => {
  const plan = planifierImport(deliee(), [koffi], { "compte:uidKoffi": "u_uidKoffi" }, new Set(["u_uidKoffi"]));
  assert.deepEqual(plan.effectif.map((l) => [l.id, l.user_id]), [["u_uidKoffi", "uidKoffi"]]);
  assert.deepEqual(plan.liens, [{ uid: "uidKoffi", ligne: "u_uidKoffi", nom: "Koffi Mensah" }]);
  assert.deepEqual(plan.comptesParLigne, { u_uidKoffi: "uidKoffi" });
  assert.deepEqual([plan.rattaches, plan.fusionnes, plan.ajoutes], [1, 0, 0]);
});

cas("laissée telle quelle, elle reste déliée", () => {
  const plan = planifierImport(deliee(), [koffi], { "compte:uidKoffi": null }, aucune);
  assert.deepEqual(plan.effectif, deliee());
  assert.deepEqual(plan.liens, []);
  assert.equal(plan.rattaches, 0);
});

cas("la ligne déliée d'un joueur ne se donne pas à un autre", () => {
  assert.throws(() => planifierImport(deliee(), [koffi, yao], { "compte:uidYao": "u_uidKoffi" }, aucune), ImportRefuse);
});

console.log("\nDélier une ligne");

const lien = (competition_id: string, team_id: string, player_id: string): LinkedCompPlayer => ({
  competition_id, competition_name: "", competition_slug: "", team_id, team_name: "", player_id, player_name: "",
});

cas("le lien retiré est celui de cette ligne, dans cette équipe, et lui seul", () => {
  const liens = [lien("c1", "t1", "x1"), lien("c1", "t2", "x1"), lien("c2", "t1", "x1"), lien("c1", "t1", "x2")];
  assert.deepEqual(
    sansLeLien(liens, { cid: "c1", teamId: "t1", playerId: "x1" }),
    [liens[1], liens[2], liens[3]],
  );
  assert.deepEqual(sansLeLien([], { cid: "c1", teamId: "t1", playerId: "x1" }), []);
});

cas("le compte quitte les feuilles de sa ligne, pas celles des autres", () => {
  const patch = retirerLeCompte({
    home_lineup: [
      { player_id: "x1", name: "K", number: "9", role: "starter", user_id: "uidKoffi" },
      { player_id: "x9", name: "Z", number: "2", role: "starter", user_id: "uidAutre" },
    ],
    away_lineup: [{ player_id: "autre", name: "A", number: "1", role: "starter", user_id: "uidKoffi" }],
    mvp_player_id: "x1",
    mvp_user_id: "uidKoffi",
  }, "x1", "uidKoffi");
  assert.deepEqual(patch, {
    home_lineup: [
      { player_id: "x1", name: "K", number: "9", role: "starter", user_id: null },
      { player_id: "x9", name: "Z", number: "2", role: "starter", user_id: "uidAutre" },
    ],
    mvp_user_id: null,
  });
});

cas("une ligne qui porte un autre compte sur la feuille n'est pas touchée", () => {
  const match = {
    home_lineup: [{ player_id: "x1", name: "K", number: "9", role: "starter" as const, user_id: "uidAncien" }],
    mvp_player_id: "x1",
    mvp_user_id: "uidAncien",
  };
  assert.equal(retirerLeCompte(match, "x1", "uidKoffi"), null);
});

cas("délier défait exactement ce que le rattachement avait recopié", () => {
  const avant = {
    home_lineup: [{ player_id: "x1", name: "K", number: "9", role: "starter" as const }],
    mvp_player_id: "x1",
  };
  const pose = recopierLesComptes(avant, { x1: "uidKoffi" });
  assert.ok(pose);
  const retire = retirerLeCompte({ ...avant, ...pose }, "x1", "uidKoffi");
  assert.deepEqual(retire, {
    home_lineup: [{ player_id: "x1", name: "K", number: "9", role: "starter", user_id: null }],
    mvp_user_id: null,
  });
});

if (echecs > 0) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log("\nTout passe.");
