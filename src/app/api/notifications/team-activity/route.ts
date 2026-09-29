import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { convoquerAEntrainement, notifyTeamActivity, type TeamActivityEvent } from "@/lib/activity-notify-server";

/**
 * POST /api/notifications/team-activity
 *
 * Prévient l'effectif d'une équipe, et ceux qui la suivent, d'un mouvement
 * la concernant : arrivée, départ, inscription en compétition.
 *
 * Body: { teamId, event, playerId?, playerName?, competitionName?, link? }
 *     ou { teamId, event: "training_scheduled", trainingId } : la convocation
 *     à un entraînement, par le manager ou un délégué de l'équipe.
 *
 * Autorisation : le jeton porte l'auteur, jamais le corps de la requête.
 * Selon l'événement, l'auteur doit être le manager de l'équipe ou le joueur
 * concerné, sinon n'importe qui pourrait diffuser « X quitte Y » à tout un
 * effectif. Le nom du joueur est relu depuis son profil pour la même raison.
 *
 * Diffusion best-effort côté appelant : un échec ici ne doit jamais annuler
 * l'adhésion ou le retrait qui vient d'aboutir.
 */

const EVENTS: TeamActivityEvent[] = [
  "member_joined",
  "member_left",
  "competition_entered",
];

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

  const { teamId, event, playerId, competitionName, link, trainingId } =
    (await req.json().catch(() => ({}))) as {
      teamId?: string;
      event?: TeamActivityEvent | "training_scheduled";
      playerId?: string;
      competitionName?: string;
      link?: string;
      trainingId?: string;
    };

  // La convocation à un entraînement : l'entraînement doit être de cette
  // équipe, et l'appelant la diriger (manager ou délégué).
  if (event === "training_scheduled") {
    if (!teamId || !trainingId) {
      return NextResponse.json({ error: "teamId et trainingId requis" }, { status: 400 });
    }
    const [teamSnap, trainingSnap] = await Promise.all([
      adminDb.collection("teams").doc(teamId).get(),
      adminDb.collection("trainings").doc(trainingId).get(),
    ]);
    const team = teamSnap.data();
    const dirige = !!team && (team.manager_id === callerUid || ((team.staff_manager_ids ?? []) as string[]).includes(callerUid));
    if (!dirige || trainingSnap.data()?.team_id !== teamId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    const prevenus = await convoquerAEntrainement(trainingId, callerUid);
    return NextResponse.json({ ok: true, sent: prevenus });
  }

  if (!teamId || !event || !EVENTS.includes(event)) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  if (event !== "competition_entered" && !playerId) {
    return NextResponse.json({ error: "playerId requis" }, { status: 400 });
  }

  const teamSnap = await adminDb.collection("teams").doc(teamId).get();
  if (!teamSnap.exists) {
    return NextResponse.json({ error: "Équipe introuvable" }, { status: 404 });
  }
  const team = teamSnap.data()!;

  const isManager = team.manager_id === callerUid;
  const isSubject = playerId != null && playerId === callerUid;
  // Une inscription en compétition n'est annonçable que par le manager ;
  // une arrivée ou un départ, par le manager ou l'intéressé lui-même.
  const allowed = event === "competition_entered" ? isManager : isManager || isSubject;
  if (!allowed) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Le nom affiché vient du profil, pas du corps de la requête.
  let playerName = "Un joueur";
  if (playerId) {
    const userSnap = await adminDb.collection("users").doc(playerId).get();
    const u = userSnap.data();
    if (u) playerName = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || playerName;
  }

  try {
    const sent = await notifyTeamActivity({
      teamId,
      event,
      actorId: callerUid,
      playerId: playerId ?? null,
      playerName,
      competitionName,
      link,
    });
    return NextResponse.json({ ok: true, sent });
  } catch (err) {
    console.error("[notifications/team-activity]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
