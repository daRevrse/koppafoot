import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { CompPlayer, FirestoreLineupEntry } from "@/types";
import type { Poste } from "@/lib/postes";

/**
 * Training sandbox for the live console.
 *
 * New reporters and moderators need somewhere to make mistakes. This route
 * hands each user their OWN throwaway competition, they are its sole
 * organizer, so every existing Firestore rule already grants them the writes
 * the console performs. No rules change, and no two trainees can collide.
 *
 * The competition is `status: "draft"` and `is_sandbox: true`, so it is
 * filtered out of every public and organizer listing; only /live-ops shows it.
 *
 * POST , create the sandbox, or return the existing one (idempotent).
 * PATCH, reset the match: score, events and timer back to kickoff.
 */

const SANDBOX_NAME = "Match d'entraînement";

const HOME_TEAM = { name: "FC Entraînement", short: "ENT", color: "#10b981" };
const AWAY_TEAM = { name: "AS Démo", short: "DEM", color: "#6366f1" };

/** Le NvN du bac à sable, et donc le nombre de titulaires de chaque feuille. */
const TAILLE_EQUIPE = 11;
/** Quelques remplaçants en plus des titulaires, pour avoir un banc. */
const TAILLE_EFFECTIF = 14;

const FIRST_NAMES = [
  "Kodjo", "Yao", "Koffi", "Amivi", "Sena", "Edem", "Mawuli",
  "Komi", "Afi", "Selom", "Kossi", "Ayaba", "Dela", "Elom",
];
const LAST = ["Adjo", "Mensah", "Agbeko", "Lawson", "Dogbe", "Attiogbe", "Kouassi"];

/**
 * Le poste du joueur de rang `i` dans l'effectif : un gardien, quatre
 * défenseurs, cinq milieux, le reste devant. C'est la seule source du poste —
 * le libellé français de la fiche joueur et le code de la feuille de match en
 * découlent tous les deux, ils ne peuvent donc plus se contredire.
 */
function posteDuRang(i: number): Poste {
  if (i === 0) return "goalkeeper";
  if (i < 5) return "defender";
  if (i < 10) return "midfielder";
  return "forward";
}

const LIBELLE: Record<Poste, string> = {
  goalkeeper: "Gardien",
  defender: "Défenseur",
  midfielder: "Milieu",
  forward: "Attaquant",
};

function buildRoster(seed: number): CompPlayer[] {
  return Array.from({ length: TAILLE_EFFECTIF }, (_, i) => ({
    id: `p${seed}_${i + 1}`,
    name: `${FIRST_NAMES[(i + seed * 3) % FIRST_NAMES.length]} ${LAST[(i + seed) % LAST.length]}`,
    number: String(i + 1),
    position: LIBELLE[posteDuRang(i)],
    user_id: null,
  }));
}

/**
 * LA FEUILLE DE MATCH EST DÉJÀ FAITE, ET DÉJÀ VALIDÉE.
 *
 * Le bac à sable ouvrait sur l'atelier des feuilles : avant de toucher à la
 * console — ce pour quoi on vient — il fallait cocher onze joueurs de chaque
 * côté, puis valider deux fois. C'est un exercice de saisie, pas un
 * entraînement au direct, et il faisait renoncer avant le coup d'envoi.
 *
 * Les deux équipes arrivent donc composées et prêtes, et le premier écran est
 * la barre du coup d'envoi. La console n'a pas bougé : elle n'ouvre l'atelier
 * que s'il reste une feuille à faire, et « Revoir les feuilles » reste là pour
 * qui veut justement s'exercer à les remplir (voir LiveMatchConsole).
 *
 * Le onze est celui du 4-3-3 de lib/terrain : gardien, quatre défenseurs,
 * trois milieux, trois attaquants. Les trois joueurs restants forment le banc,
 * sans quoi il n'y aurait personne à faire entrer.
 */
function feuillePrete(seed: number): FirestoreLineupEntry[] {
  const effectif = buildRoster(seed);
  // Les rangs titulaires : le gardien, les quatre défenseurs, trois des cinq
  // milieux, trois des quatre attaquants. Onze en tout.
  const titulaires = new Set([0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 12]);
  if (titulaires.size !== TAILLE_EQUIPE) {
    throw new Error(`feuillePrete : ${titulaires.size} titulaires, ${TAILLE_EQUIPE} attendus`);
  }
  return effectif.map((j, i) => ({
    player_id: j.id,
    name: j.name,
    number: j.number,
    role: titulaires.has(i) ? "starter" : "substitute",
    user_id: null,
    position: posteDuRang(i),
  }));
}

/** Les champs de feuille d'un match neuf : composé des deux côtés, prêt. */
function feuillesDuBacASable() {
  return {
    home_lineup: feuillePrete(1),
    away_lineup: feuillePrete(2),
    home_lineup_ready: true,
    away_lineup_ready: true,
    // La pelouse se remplit au coup d'envoi, à partir des titulaires : avant,
    // personne n'est encore entré.
    home_on_pitch: [],
    away_on_pitch: [],
  };
}

async function callerUidOf(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
    return decoded.uid;
  } catch {
    return null;
  }
}

/** The caller's existing sandbox, if any. */
async function findSandbox(uid: string) {
  const snap = await adminDb
    .collection("competitions")
    .where("is_sandbox", "==", true)
    .where("created_by", "==", uid)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0];
}

async function firstMatchId(cid: string): Promise<string | null> {
  const snap = await adminDb
    .collection("competitions").doc(cid)
    .collection("comp_matches")
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}

export async function POST(req: NextRequest) {
  try {
    const uid = await callerUidOf(req);
    if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const existing = await findSandbox(uid);
    if (existing) {
      const mid = await firstMatchId(existing.id);
      if (mid) {
        // UN BAC À SABLE D'AVANT PORTE ENCORE DES FEUILLES VIDES. Il est créé
        // une fois et resservi ensuite : sans ce rattrapage, ceux qui se sont
        // déjà entraînés garderaient l'atelier obligatoire pour toujours. On
        // ne touche qu'à un match qui n'a pas commencé, et qu'à des feuilles
        // que personne n'a faites — celle d'un stagiaire au travail est la
        // sienne.
        const ref = existing.ref.collection("comp_matches").doc(mid);
        const snap = await ref.get();
        const d = snap.data() ?? {};
        const vierge =
          d.status === "scheduled" &&
          !d.home_lineup_ready &&
          !d.away_lineup_ready &&
          !(d.home_lineup ?? []).length &&
          !(d.away_lineup ?? []).length;
        if (vierge) {
          await ref.update({ ...feuillesDuBacASable(), updated_at: FieldValue.serverTimestamp() });
        }
        return NextResponse.json({ ok: true, cid: existing.id, mid, created: false });
      }
      // Sandbox exists but its match is gone, fall through and rebuild it.
      await existing.ref.delete();
    }

    const compRef = adminDb.collection("competitions").doc();
    // Slug stays unique and unguessable, sandboxes never surface publicly,
    // but they share the slug namespace with real competitions.
    await compRef.set({
      name: SANDBOX_NAME,
      slug: `entrainement-${compRef.id.slice(0, 8).toLowerCase()}`,
      description: "Bac à sable : entraîne-toi à la console live, rien n'est publié.",
      logo_url: null,
      banner_url: null,
      organizer_ids: [uid],
      moderator_ids: [],
      created_by: uid,
      status: "draft",
      competition_type: "cup",
      is_sandbox: true,
      format: {
        group_count: 0,
        teams_per_group: 0,
        qualifiers_per_group: 0,
        has_third_place: false,
        double_round: false,
        knockout_teams: 2,
        points: { win: 3, draw: 1, loss: 0 },
        team_size: TAILLE_EQUIPE,
        half_duration: 45,
      },
      start_date: null,
      end_date: null,
      venue_city: null,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    const teamsCol = compRef.collection("comp_teams");
    const homeRef = teamsCol.doc();
    const awayRef = teamsCol.doc();
    const teamDoc = (t: typeof HOME_TEAM, players: CompPlayer[]) => ({
      name: t.name,
      short_name: t.short,
      logo_url: null,
      color: t.color,
      group: null,
      players,
      claimed_by_manager_id: null,
      claimed_by_team_id: null,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    const matchRef = compRef.collection("comp_matches").doc();

    const batch = adminDb.batch();
    batch.set(homeRef, teamDoc(HOME_TEAM, buildRoster(1)));
    batch.set(awayRef, teamDoc(AWAY_TEAM, buildRoster(2)));
    batch.set(matchRef, {
      competition_id: compRef.id,
      stage: "knockout",
      group: null,
      round: "final",
      bracket_slot: 0,
      home_team_id: homeRef.id,
      away_team_id: awayRef.id,
      home_team_name: HOME_TEAM.name,
      away_team_name: AWAY_TEAM.name,
      home_team_logo: null,
      away_team_logo: null,
      date: null,
      time: null,
      venue_name: "Terrain d'entraînement",
      venue_city: null,
      status: "scheduled",
      score_home: null,
      score_away: null,
      penalty_home: null,
      penalty_away: null,
      winner_team_id: null,
      feeds_into_match_id: null,
      feeds_into_slot: null,
      live_state: null,
      ...feuillesDuBacASable(),
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return NextResponse.json({ ok: true, cid: compRef.id, mid: matchRef.id, created: true });
  } catch (err) {
    console.error("[live-training POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const uid = await callerUidOf(req);
    if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const sandbox = await findSandbox(uid);
    if (!sandbox) {
      return NextResponse.json({ error: "Aucun match d'entraînement" }, { status: 404 });
    }
    const mid = await firstMatchId(sandbox.id);
    if (!mid) return NextResponse.json({ error: "Match introuvable" }, { status: 404 });

    // Back to kickoff: score, events and timer cleared. LES FEUILLES, ELLES,
    // SONT REPOSÉES PLUTÔT QU'EFFACÉES : la remise à zéro les vidait, et le
    // deuxième passage au bac à sable retombait sur l'atelier que le premier
    // venait d'éviter.
    await sandbox.ref.collection("comp_matches").doc(mid).update({
      status: "scheduled",
      score_home: null,
      score_away: null,
      penalty_home: null,
      penalty_away: null,
      winner_team_id: null,
      live_state: null,
      ...feuillesDuBacASable(),
      updated_at: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, cid: sandbox.id, mid });
  } catch (err) {
    console.error("[live-training PATCH]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
