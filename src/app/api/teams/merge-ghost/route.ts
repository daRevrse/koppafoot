import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { peutGererEquipeServeur } from "@/lib/team-access-server";
import type { FirestoreGhostPlayer, FirestoreTeam } from "@/types";
import { estSuperadmin } from "@/lib/admin-api-auth";

/**
 * POST { teamId, ghostId, playerId } — fusionner un joueur sans compte avec le
 * compte qu'il vient de créer.
 *
 * POURQUOI CETTE ROUTE. Un club amateur inscrit ses joueurs sans smartphone
 * comme joueurs sans compte : ils figurent sur les feuilles de match et
 * accumulent une carrière sur `teams/{id}/ghost_players`. Le jour où l'un
 * d'eux crée un compte et rejoint l'équipe, il repart de zéro pendant que son
 * double continue d'exister à côté de lui. Deux lignes pour un seul homme,
 * dont une qui porte tout son passé.
 *
 * CE QUE LA FUSION DÉPLACE :
 *   - les compteurs de carrière, additionnés sur le compte ;
 *   - les lignes des feuilles de match déjà jouées, réécrites au vrai nom et
 *     rattachées au compte, pour que l'historique le désigne lui ;
 *   - puis le joueur sans compte disparaît.
 *
 * CÔTÉ SERVEUR PARCE QUE LES ÉCRITURES SORTENT DE CE QUE LE MANAGER POSSÈDE :
 * incrémenter `users/{uid}` ne lui est pas permis par les règles, et ce serait
 * une bien mauvaise idée de le permettre — la seule règle qui l'aurait autorisé
 * est « tout compte connecté peut réécrire les statistiques de n'importe qui ».
 *
 * IRRÉVERSIBLE : ce sont des incréments, et rien ne dira plus tard quelle part
 * d'un compteur venait d'ici.
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

  const { teamId, ghostId, playerId } = (await req.json().catch(() => ({}))) as {
    teamId?: string;
    ghostId?: string;
    playerId?: string;
  };
  if (!teamId || !ghostId || !playerId) {
    return NextResponse.json(
      { error: "teamId, ghostId et playerId requis" },
      { status: 400 },
    );
  }

  const teamSnap = await adminDb.collection("teams").doc(teamId).get();
  if (!teamSnap.exists) {
    return NextResponse.json({ error: "Équipe introuvable" }, { status: 404 });
  }
  const team = teamSnap.data() as FirestoreTeam;

  // Fusionner, c'est écrire dans la carrière de quelqu'un : réservé à ceux qui
  // dirigent l'équipe.
  let autorise = await peutGererEquipeServeur(teamId, callerUid);
  if (!autorise) {
    const caller = await adminDb.collection("users").doc(callerUid).get();
    autorise = caller.exists && estSuperadmin(caller.data());
  }
  if (!autorise) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Une équipe hors plateforme n'a pas de carrière à transmettre : ses joueurs
  // sont anonymes par construction (voir /api/matches/complete).
  if (team.is_ghost) {
    return NextResponse.json(
      { error: "Une équipe hors plateforme ne tient pas de statistiques" },
      { status: 400 },
    );
  }

  // Le compte doit être dans l'effectif : on ne verse pas la carrière d'un
  // joueur du club sur le compte de quelqu'un qui n'y est pas.
  if (!(team.member_ids ?? []).includes(playerId)) {
    return NextResponse.json(
      { error: "Ce compte ne fait pas partie de l'effectif" },
      { status: 400 },
    );
  }

  const ghostRef = adminDb.collection("teams").doc(teamId).collection("ghost_players").doc(ghostId);
  const ghostSnap = await ghostRef.get();
  if (!ghostSnap.exists) {
    return NextResponse.json({ error: "Joueur sans compte introuvable" }, { status: 404 });
  }
  const ghost = ghostSnap.data() as FirestoreGhostPlayer;

  const userRef = adminDb.collection("users").doc(playerId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
  }
  const user = userSnap.data() ?? {};
  const vraiNom = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
    || `${ghost.first_name} ${ghost.last_name}`.trim();

  // Les feuilles de match déjà jouées. On les retrouve par les deux camps,
  // Firestore ne sachant pas chercher à l'intérieur d'un tableau d'objets : on
  // lit les matchs de l'équipe et on filtre en mémoire, ce qui suffit
  // largement pour l'historique d'un club.
  const [surDomicile, surExterieur] = await Promise.all([
    adminDb.collection("matches").where("home_team_id", "==", teamId).get(),
    adminDb.collection("matches").where("away_team_id", "==", teamId).get(),
  ]);

  const batch = adminDb.batch();
  let feuillesReecrites = 0;

  for (const doc of [...surDomicile.docs, ...surExterieur.docs]) {
    const m = doc.data();
    const cote = m.home_team_id === teamId ? "home_ghost_lineup" : "away_ghost_lineup";
    const lignes = Array.isArray(m[cote]) ? (m[cote] as { player_id?: string }[]) : [];
    if (!lignes.some((l) => l.player_id === ghostId)) continue;
    batch.update(doc.ref, {
      [cote]: lignes.map((l) =>
        l.player_id === ghostId ? { ...l, player_id: playerId, name: vraiNom } : l,
      ),
      updated_at: FieldValue.serverTimestamp(),
    });
    feuillesReecrites += 1;
  }

  batch.update(userRef, {
    goals: FieldValue.increment(ghost.goals ?? 0),
    assists: FieldValue.increment(ghost.assists ?? 0),
    matches_played: FieldValue.increment(ghost.matches_played ?? 0),
    updated_at: FieldValue.serverTimestamp(),
  });

  batch.delete(ghostRef);

  await batch.commit();

  return NextResponse.json({
    ok: true,
    nom: vraiNom,
    buts: ghost.goals ?? 0,
    passes: ghost.assists ?? 0,
    matchs: ghost.matches_played ?? 0,
    feuillesReecrites,
  });
}
