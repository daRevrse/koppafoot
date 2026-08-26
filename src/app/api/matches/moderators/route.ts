import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { peutGererEquipeServeur } from "@/lib/team-access-server";
import type { FirestoreMatch } from "@/types";

/**
 * Les modérateurs d'UN match — ceux qui tiendront sa console live.
 *
 * POURQUOI CETTE ROUTE EXISTE. La modération ne vivait que sur
 * `competitions.moderator_ids`, donc à l'échelle d'une compétition entière.
 * Un amical n'appartient à aucune compétition : son manager était le seul
 * compte au monde capable de le couvrir, et il ne pouvait déléguer à personne.
 * Un match programmé était donc, en pratique, un match que personne d'autre ne
 * pouvait suivre en direct.
 *
 * L'INVITATION SE FAIT PAR EMAIL, comme côté compétition : on ne demande pas à
 * un manager de retrouver l'identifiant Firebase de son bénévole. L'email est
 * résolu ici, côté serveur, parce que `getUserByEmail` appartient au SDK admin
 * et qu'un annuaire des comptes n'a rien à faire dans le navigateur.
 *
 * CE QUE LE MODÉRATEUR PEUT FAIRE une fois ajouté est borné par les règles
 * Firestore (voir `champsDeLaConsole`) : couvrir le direct et clore le match.
 * Ni la date, ni l'adversaire, ni la liste des modérateurs elle-même.
 */

/** Le match, plus l'autorisation d'y toucher — ou la réponse d'erreur à rendre. */
async function autoriser(
  req: NextRequest,
  matchId: string,
): Promise<
  | { error: NextResponse }
  | { callerUid: string; match: FirestoreMatch }
> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "Non autorisé" }, { status: 401 }) };
  }

  let callerUid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
    callerUid = decoded.uid;
  } catch {
    return { error: NextResponse.json({ error: "Token invalide" }, { status: 401 }) };
  }

  const snap = await adminDb.collection("matches").doc(matchId).get();
  if (!snap.exists) {
    return { error: NextResponse.json({ error: "Match introuvable" }, { status: 404 }) };
  }
  const match = snap.data() as FirestoreMatch;

  // Qui distribue la couverture d'un match : ses managers, et le staff délégué
  // de l'une des deux équipes — les mêmes que ceux qui peuvent le terminer
  // (voir /api/matches/complete). Un modérateur, lui, n'en ajoute pas d'autres.
  let autorise =
    match.manager_id === callerUid ||
    (!!match.away_manager_id && match.away_manager_id === callerUid) ||
    (await peutGererEquipeServeur(match.home_team_id, callerUid)) ||
    (await peutGererEquipeServeur(match.away_team_id, callerUid));

  if (!autorise) {
    const caller = await adminDb.collection("users").doc(callerUid).get();
    autorise = caller.exists && caller.data()?.user_type === "superadmin";
  }
  if (!autorise) {
    return { error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
  }

  return { callerUid, match };
}

export async function POST(req: NextRequest) {
  try {
    const { matchId, email } = (await req.json().catch(() => ({}))) as {
      matchId?: string;
      email?: string;
    };
    if (!matchId || !email) {
      return NextResponse.json({ error: "matchId et email requis" }, { status: 400 });
    }

    const auth = await autoriser(req, matchId);
    if ("error" in auth) return auth.error;
    const { match } = auth;

    // Un match déjà terminé n'a plus de direct à couvrir.
    if (match.status === "completed" || match.status === "cancelled") {
      return NextResponse.json(
        { error: "Ce match est terminé, il n'y a plus de direct à couvrir" },
        { status: 409 },
      );
    }

    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(email.trim());
    } catch {
      return NextResponse.json(
        { error: `Aucun compte KoppaFoot pour « ${email.trim()} »` },
        { status: 404 },
      );
    }
    const uid = userRecord.uid;

    // Il faut un profil Firestore : la console affiche un nom, pas un uid.
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: "Ce compte n'a pas encore de profil KoppaFoot" },
        { status: 404 },
      );
    }
    const userData = userDoc.data();

    // Un manager du match peut déjà tout faire : l'ajouter n'ouvrirait rien et
    // laisserait croire qu'on lui a donné quelque chose.
    if (match.manager_id === uid || match.away_manager_id === uid) {
      return NextResponse.json(
        { error: "Cette personne dirige déjà ce match" },
        { status: 400 },
      );
    }
    if ((match.moderator_ids ?? []).includes(uid)) {
      return NextResponse.json({ error: "Déjà sur ce match" }, { status: 400 });
    }

    await adminDb.collection("matches").doc(matchId).update({
      moderator_ids: FieldValue.arrayUnion(uid),
      updated_at: FieldValue.serverTimestamp(),
    });

    const affiche = `${match.home_team_name} vs ${match.away_team_name}`;
    // Au mieux : sa perte ne doit pas faire échouer l'ajout, qui a abouti.
    try {
      await adminDb.collection("notifications").add({
        user_id: uid,
        type: "admin_message",
        title: "Tu couvres un match",
        body: `${affiche}, le ${match.date} à ${match.time}. La console live t'attend.`,
        link: "/live-ops",
        read: false,
        created_at: FieldValue.serverTimestamp(),
      });
    } catch (notifErr) {
      console.error("Notification modérateur de match:", notifErr);
    }

    return NextResponse.json({
      uid,
      firstName: userData?.first_name ?? "",
      lastName: userData?.last_name ?? "",
      email: userData?.email ?? userRecord.email ?? email,
    });
  } catch (err) {
    console.error("Ajout modérateur de match:", err);
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { matchId, uid } = (await req.json().catch(() => ({}))) as {
      matchId?: string;
      uid?: string;
    };
    if (!matchId || !uid) {
      return NextResponse.json({ error: "matchId et uid requis" }, { status: 400 });
    }

    const auth = await autoriser(req, matchId);
    if ("error" in auth) return auth.error;

    await adminDb.collection("matches").doc(matchId).update({
      moderator_ids: FieldValue.arrayRemove(uid),
      updated_at: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Retrait modérateur de match:", err);
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
