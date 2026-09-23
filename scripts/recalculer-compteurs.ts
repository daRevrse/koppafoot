/**
 * KOPPAFOOT — Remettre les compteurs d'accord avec les matchs.
 *
 * CE QU'ILS ONT DE FAUX. `teams.{matches_played,wins,draws,losses}` et
 * `users.{matches_played,goals,assists}` s'incrémentent au coup de sifflet
 * final et ne redescendent jamais : supprimer un match terminé laissait sa
 * victoire au palmarès, corriger un score après clôture ne rejouait rien, et
 * le rollup a longtemps tourné dans le navigateur sans garde — un double-clic
 * comptait deux fois. Constaté en production : un club à 3 matchs joués et
 * 1 victoire pour UN seul match terminé, et un nul.
 *
 * CE QUE FAIT CE SCRIPT. Il recalcule tout depuis la seule source qui ne ment
 * pas — les matchs TERMINÉS de la collection `matches` — et réécrit les
 * compteurs.
 *
 * SON PÉRIMÈTRE S'ARRÊTE AUX AMICAUX, et c'est la règle du produit : les
 * compteurs du document `users` appartiennent aux amicaux, les compétitions se
 * calculent à la lecture (voir lib/bilan-public). Compter ici les
 * `comp_matches` ferait compter double.
 *
 * LE BILAN D'UN CLUB, LUI, NE SE LIT PLUS NULLE PART EN PUBLIC : la route
 * /api/public/team/[id] le recalcule (voir lib/bilan-club). On répare quand
 * même `teams`, que l'espace d'administration et le mercato lisent encore.
 *
 * Usage :
 *   npx tsx scripts/recalculer-compteurs.ts          → simulation
 *   npx tsx scripts/recalculer-compteurs.ts --apply  → écrit
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore(app);

const APPLIQUER = process.argv.includes("--apply");

interface BilanEquipe { joues: number; gagnes: number; nuls: number; perdus: number }
interface BilanJoueur { joues: number; buts: number; passes: number }

async function main() {
  const matchs = await db.collection("matches").get();

  const equipes = new Map<string, BilanEquipe>();
  const joueurs = new Map<string, BilanJoueur>();
  const pourEquipe = (id: string) => {
    if (!equipes.has(id)) equipes.set(id, { joues: 0, gagnes: 0, nuls: 0, perdus: 0 });
    return equipes.get(id)!;
  };
  const pourJoueur = (id: string) => {
    if (!joueurs.has(id)) joueurs.set(id, { joues: 0, buts: 0, passes: 0 });
    return joueurs.get(id)!;
  };

  let termines = 0;
  for (const m of matchs.docs) {
    const d = m.data();
    // SEUL UN MATCH TERMINÉ COMPTE. Un match à venir, en cours, reporté ou
    // annulé n'a pas de résultat, et son 0-0 est un zéro d'attente.
    if (d.status !== "completed") continue;
    const sh = d.score_home, sa = d.score_away;
    if (typeof sh !== "number" || typeof sa !== "number") continue;
    termines += 1;

    // L'équipe hors plateforme ne cumule rien : c'est l'adversaire du jeu
    // vidéo, pas un club qui tient un palmarès. Même règle que
    // /api/matches/complete.
    const idFantome = !d.away_manager_id
      ? (d.is_home ? d.away_team_id : d.home_team_id)
      : null;

    for (const [cleId, pour, contre] of [
      ["home_team_id", sh, sa],
      ["away_team_id", sa, sh],
    ] as const) {
      const id = d[cleId];
      if (!id || id === idFantome) continue;
      const b = pourEquipe(id);
      b.joues += 1;
      if (pour > contre) b.gagnes += 1;
      else if (pour === contre) b.nuls += 1;
      else b.perdus += 1;
    }

    // Les joueurs : ceux que la FEUILLE nomme, et eux seuls. Une participation
    // confirmée dit qu'on vient, pas qu'on a joué.
    for (const cle of ["home_lineup", "away_lineup"] as const) {
      for (const e of (d[cle] ?? []) as { user_id?: string | null }[]) {
        if (!e?.user_id) continue;
        pourJoueur(e.user_id).joues += 1;
      }
    }
    // Les buts, depuis les événements du direct.
    for (const e of (d.live_state?.events ?? []) as { type?: string; player_id?: string | null }[]) {
      if (e?.type === "goal" && e.player_id) pourJoueur(e.player_id).buts += 1;
    }
  }

  console.log(`${matchs.size} amical/amicaux lus, ${termines} terminé(s) retenu(s).\n`);

  // ---- Les équipes ---------------------------------------------------------
  const teams = await db.collection("teams").get();
  let batch = db.batch();
  let ops = 0;
  let equipesCorrigees = 0;

  for (const t of teams.docs) {
    const d = t.data();
    const a = equipes.get(t.id) ?? { joues: 0, gagnes: 0, nuls: 0, perdus: 0 };
    const avant = {
      joues: d.matches_played ?? 0, gagnes: d.wins ?? 0,
      nuls: d.draws ?? 0, perdus: d.losses ?? 0,
    };
    if (
      avant.joues === a.joues && avant.gagnes === a.gagnes
      && avant.nuls === a.nuls && avant.perdus === a.perdus
    ) continue;

    equipesCorrigees += 1;
    console.log(
      `  ${d.name}` +
      `\n      avant : ${avant.joues} joués, ${avant.gagnes}V ${avant.nuls}N ${avant.perdus}D` +
      `\n      après : ${a.joues} joués, ${a.gagnes}V ${a.nuls}N ${a.perdus}D`,
    );
    if (!APPLIQUER) continue;
    batch.update(t.ref, {
      matches_played: a.joues, wins: a.gagnes, draws: a.nuls, losses: a.perdus,
    });
    if ((ops += 1) >= 400) { await batch.commit(); batch = db.batch(); ops = 0; }
  }

  // ---- Les comptes ---------------------------------------------------------
  const users = await db.collection("users").get();
  let comptesCorriges = 0;

  for (const u of users.docs) {
    const d = u.data();
    const a = joueurs.get(u.id) ?? { joues: 0, buts: 0, passes: 0 };
    const avant = {
      joues: d.matches_played ?? 0, buts: d.goals ?? 0, passes: d.assists ?? 0,
    };
    // LES PASSES NE SE RECALCULENT PAS : la console live n'enregistre pas
    // encore de passe décisive (voir lib/player-stats), donc rien ne permet de
    // les reconstituer. On garde ce qui est écrit plutôt que de le mettre à
    // zéro sur une absence de preuve.
    if (avant.joues === a.joues && avant.buts === a.buts) continue;

    comptesCorriges += 1;
    console.log(
      `  ${d.first_name ?? ""} ${d.last_name ?? ""}`.trimEnd() +
      `\n      avant : ${avant.joues} match(s), ${avant.buts} but(s)` +
      `\n      après : ${a.joues} match(s), ${a.buts} but(s)`,
    );
    if (!APPLIQUER) continue;
    batch.update(u.ref, { matches_played: a.joues, goals: a.buts });
    if ((ops += 1) >= 400) { await batch.commit(); batch = db.batch(); ops = 0; }
  }

  if (APPLIQUER && ops > 0) await batch.commit();

  console.log(
    `\n${equipesCorrigees} équipe(s) et ${comptesCorriges} compte(s) ` +
    (APPLIQUER ? "corrigé(s)." : "seraient corrigé(s). Relancer avec --apply pour écrire."),
  );
  process.exit(0);
}

main().catch((e) => { console.error("ERR", e); process.exit(1); });
