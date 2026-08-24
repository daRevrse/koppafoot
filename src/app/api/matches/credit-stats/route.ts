import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { peutGererEquipeServeur } from "@/lib/team-access-server";
import type { FirestoreMatch, FirestoreParticipation } from "@/types";

/**
 * POST { matchId } — attribuer les statistiques d'un amical joué contre une
 * équipe hors plateforme.
 *
 * QUAND CETTE ROUTE SERT, et quand elle ne sert pas. Un amical fantôme couvert
 * EN DIRECT crédite ses joueurs tout seul à la fin du match : les buts y ont
 * été saisis minute par minute, à chaud, par quelqu'un qui regardait — voir
 * /api/matches/complete. Il ne reste ici que les matchs joués sans console
 * live, dont la feuille a été remplie après coup.
 *
 * Ceux-là n'ont qu'un seul manager et personne en face pour contresigner. Les
 * créditer d'office reviendrait à laisser n'importe qui s'inventer une saison
 * en créant des adversaires imaginaires. La décision revient donc à celui qui
 * a vu le match : le manager de l'équipe, ou un délégué de son staff. La trace
 * de qui a crédité reste sur le document, et le match garde son statut « non
 * vérifié ». On n'efface pas la différence entre un match contresigné et un
 * match sur parole, on l'assume.
 *
 * L'ADVERSAIRE FANTÔME NE REÇOIT RIEN, jamais, ni ici ni ailleurs : il est
 * l'adversaire du jeu vidéo, seule notre équipe tient une carrière.
 *
 * IRRÉVERSIBLE PAR CONSTRUCTION : ce sont des incréments, et rien ne permet
 * de savoir plus tard quelle part d'un compteur venait d'ici. D'où le
 * verrou — `stats_credited_at` — vérifié DANS une transaction : deux clics
 * simultanés, ou un renvoi de requête, doubleraient sinon une carrière.
 */

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let callerUid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
    callerUid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }

  const { matchId } = (await req.json().catch(() => ({}))) as { matchId?: string };
  if (!matchId) {
    return NextResponse.json({ error: "matchId requis" }, { status: 400 });
  }

  const matchRef = adminDb.collection("matches").doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) {
    return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  }
  const match = matchSnap.data() as FirestoreMatch;

  if (match.status !== "completed") {
    return NextResponse.json({ error: "Le match n'est pas terminé" }, { status: 409 });
  }
  // Un match entre deux comptes crédite déjà à la fin de la rencontre. Passer
  // par ici doublerait ses compteurs.
  if (match.away_manager_id) {
    return NextResponse.json(
      { error: "Ce match a déjà crédité ses joueurs" },
      { status: 409 },
    );
  }

  // `is_home` dit si le CRÉATEUR joue à domicile : c'est la seule façon de
  // savoir laquelle des deux équipes est la vraie. La supposer à domicile
  // aurait crédité l'effectif fantôme d'un déplacement.
  const realTeamId = match.is_home ? match.home_team_id : match.away_team_id;

  let autorise =
    match.manager_id === callerUid ||
    (await peutGererEquipeServeur(realTeamId, callerUid));
  if (!autorise) {
    const caller = await adminDb.collection("users").doc(callerUid).get();
    autorise = caller.exists && caller.data()?.user_type === "superadmin";
  }
  if (!autorise) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  // La feuille de match fait foi, pas la timeline : /api/matches/complete a
  // déjà recopié les buts du direct sur chaque ligne, et le manager a pu la
  // corriger depuis. Créditer autre chose que ce qu'il a sous les yeux au
  // moment de cliquer serait incompréhensible.
  const partsSnap = await adminDb
    .collection("participations")
    .where("match_id", "==", matchId)
    .get();

  const lignes = partsSnap.docs
    .map((d) => ({ ref: d.ref, data: d.data() as FirestoreParticipation }))
    .filter(
      (l) =>
        l.data.status === "confirmed" &&
        !!l.data.player_id &&
        // Seuls les joueurs de la vraie équipe : une ligne d'un autre club sur
        // ce match serait une anomalie, on ne la crédite pas « au cas où ».
        l.data.team_id === realTeamId,
    );

  try {
    await adminDb.runTransaction(async (tx) => {
      const frais = await tx.get(matchRef);
      const dejaFait = (frais.data() as FirestoreMatch | undefined)?.stats_credited_at;
      if (dejaFait) throw new Error("DEJA_CREDITE");

      for (const ligne of lignes) {
        tx.update(adminDb.collection("users").doc(ligne.data.player_id), {
          matches_played: FieldValue.increment(1),
          goals: FieldValue.increment(ligne.data.goals || 0),
          assists: FieldValue.increment(ligne.data.assists || 0),
          last_match_id: matchId,
          updated_at: FieldValue.serverTimestamp(),
        });
      }

      tx.update(matchRef, {
        stats_credited_at: FieldValue.serverTimestamp(),
        stats_credited_by: callerUid,
        updated_at: FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "DEJA_CREDITE") {
      return NextResponse.json(
        { error: "Statistiques déjà attribuées" },
        { status: 409 },
      );
    }
    console.error("credit-stats a échoué :", err);
    return NextResponse.json({ error: "L'attribution a échoué" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, joueurs: lignes.length });
}
