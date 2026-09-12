import { NextRequest, NextResponse } from "next/server";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { campDuCompte, refValidation, validationInitiale } from "@/lib/validation-server";
import type { FirestoreMatch, FirestoreMatchValidation, StatutValidation } from "@/types";

/**
 * POST — ce qu'un camp dit d'un match terminé.
 *
 *  - { matchId, action: "retour", validation: "validated" | "contested",
 *      commentaire?, noteArbitre? }
 *  - { matchId, action: "contestation", eventId, motif }
 *
 * CES DEUX GESTES S'ÉCRIVAIENT DEPUIS LE NAVIGATEUR, sur le document du match
 * — public. Le commentaire d'un manager, la note qu'il donne à l'arbitre, le
 * motif d'une contestation : tout se lisait sans compte. Ils s'écrivent
 * désormais ici, dans `match_validations/{matchId}`, que les règles ferment
 * au public et à toute écriture depuis un navigateur.
 *
 * LE SERVEUR TRANCHE, et c'est l'autre moitié du correctif. Le navigateur
 * calculait lui-même le statut commun et l'écrivait : un manager pouvait se
 * déclarer « validé » d'une ligne de console. Ici on sait de quel camp parle
 * l'appelant, on range son retour à ce camp, et on calcule le statut.
 *
 * UN RETOUR PAR CAMP, pas par compte : un délégué du staff valide pour son
 * équipe, comme son manager. Rangés par uid, les retours ne comptaient pour
 * la validation commune que s'ils venaient des deux comptes créateurs.
 */

/** Assez pour un motif, pas assez pour y coller un roman. */
const LONGUEUR_MAX = 1000;

async function identifier(req: NextRequest): Promise<string | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  try {
    return (await adminAuth.verifyIdToken(header.split("Bearer ")[1])).uid;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const uid = await identifier(req);
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    matchId?: string;
    action?: string;
    validation?: string;
    commentaire?: unknown;
    noteArbitre?: unknown;
    eventId?: string;
    motif?: unknown;
  };
  const { matchId, action } = body;
  if (!matchId || (action !== "retour" && action !== "contestation")) {
    return NextResponse.json({ error: "matchId et action requis" }, { status: 400 });
  }

  const matchSnap = await adminDb.collection("matches").doc(matchId).get();
  if (!matchSnap.exists) return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  const m = matchSnap.data() as FirestoreMatch;

  if (m.status !== "completed") {
    return NextResponse.json({ error: "Le match n'est pas terminé" }, { status: 409 });
  }
  // Face à une équipe hors plateforme, personne ne contresigne : le match reste
  // « non vérifié », et c'est l'attribution des statistiques qui fait foi.
  if (!m.away_manager_id) {
    return NextResponse.json({ error: "Personne en face pour valider ce match" }, { status: 409 });
  }
  // Un score renseigné après coup se tranche par la contresignature de
  // l'adversaire (voir /api/matches/record), pas par ce retour : les deux
  // écrivaient le même statut, et le premier arrivé bloquait l'autre.
  if (m.recorded_at) {
    return NextResponse.json(
      { error: "Ce score se confirme depuis la liste des matchs" },
      { status: 409 },
    );
  }

  const camp = await campDuCompte(m, uid);
  if (!camp) {
    return NextResponse.json({ error: "Tu ne gères aucune des deux équipes" }, { status: 403 });
  }

  const ref = refValidation(matchId);
  const texte = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, LONGUEUR_MAX) : "");

  if (action === "retour") {
    const validation = body.validation;
    if (validation !== "validated" && validation !== "contested") {
      return NextResponse.json({ error: "Validation invalide" }, { status: 400 });
    }
    const commentaire = texte(body.commentaire);
    if (validation === "contested" && !commentaire) {
      return NextResponse.json({ error: "Explique ta contestation" }, { status: 400 });
    }
    const note = typeof body.noteArbitre === "number"
      && Number.isInteger(body.noteArbitre)
      && body.noteArbitre >= 1 && body.noteArbitre <= 5
      ? body.noteArbitre
      : null;

    const status = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const v = snap.exists
        ? (snap.data() as FirestoreMatchValidation)
        : validationInitiale(matchId, m, "pending", null);

      const entree = {
        validation,
        by: uid,
        at: new Date().toISOString(),
        ...(commentaire ? { comments: commentaire } : {}),
        ...(note ? { referee_rating: note } : {}),
      };
      const feedback = { ...(v.feedback ?? {}), [camp]: entree };

      // Une contestation l'emporte, et reste : un camp qui valide après coup
      // ne l'efface pas. La validation commune demande les deux camps.
      let suivant: StatutValidation = v.status ?? "pending";
      if (validation === "contested") suivant = "contested";
      else if (
        suivant !== "contested"
        && feedback.home?.validation === "validated"
        && feedback.away?.validation === "validated"
      ) {
        suivant = "validated";
      }
      const tranche = suivant === "validated" || suivant === "contested";

      if (snap.exists) {
        // `update` sur le chemin du camp REMPLACE son retour en entier. Une
        // fusion l'aurait complété, et l'ancien commentaire d'une
        // contestation serait resté sous une validation qui n'en a pas.
        tx.update(ref, {
          [`feedback.${camp}`]: entree,
          status: suivant,
          // Tranché : plus rien à valider tacitement.
          ...(tranche ? { auto_validate_at: FieldValue.delete() } : {}),
          updated_at: FieldValue.serverTimestamp(),
        });
      } else {
        // Un match terminé avant que la validation ne quitte son document
        // n'a pas encore le sien : on le crée.
        tx.set(ref, { ...v, feedback, status: suivant });
      }
      return suivant;
    });

    return NextResponse.json({ ok: true, status });
  }

  // action === "contestation"
  const eventId = body.eventId;
  const motif = texte(body.motif);
  if (!eventId || !motif) {
    return NextResponse.json({ error: "Événement et motif requis" }, { status: 400 });
  }
  if (!(m.live_state?.events ?? []).some((e) => e.id === eventId)) {
    return NextResponse.json({ error: "Événement introuvable" }, { status: 404 });
  }

  try {
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const v = snap.exists
        ? (snap.data() as FirestoreMatchValidation)
        : validationInitiale(matchId, m, "pending", null);
      // Un match validé par les deux camps est clos : on n'y revient plus
      // événement par événement.
      if (v.status === "validated") throw new Error("VALIDE");
      if (v.contested_events?.[eventId]) throw new Error("DEJA");

      const contestation = { by: uid, side: camp, reason: motif, at: new Date().toISOString() };
      if (snap.exists) {
        // Un `FieldPath` et non « contested_events.<id> » : un point dans
        // l'identifiant d'un événement ouvrirait un niveau de plus.
        tx.update(
          ref,
          new FieldPath("contested_events", eventId), contestation,
          "updated_at", FieldValue.serverTimestamp(),
        );
      } else {
        tx.set(ref, { ...v, contested_events: { [eventId]: contestation } });
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === "VALIDE") {
      return NextResponse.json({ error: "Le match est déjà validé" }, { status: 409 });
    }
    if (err instanceof Error && err.message === "DEJA") {
      return NextResponse.json({ error: "Cet événement est déjà contesté" }, { status: 409 });
    }
    console.error("Contestation d'un événement :", err);
    return NextResponse.json({ error: "La contestation a échoué" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
