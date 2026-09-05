import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import type { FirestoreMatch } from "@/types";
import { estSuperadmin } from "@/lib/admin-api-auth";

/**
 * POST /api/matches/[mid]/couvrir, un scoreur prend un amical en charge.
 * DELETE, il s'en dédit.
 *
 * LE SENS EST INVERSE DE `/api/matches/moderators`. Là, le manager TIRE : il
 * invite un bénévole par email. Ici, le scoreur POUSSE : il se sert dans les
 * amicaux que personne ne couvre. Les deux chemins mènent au même endroit,
 * `moderator_ids`, mais ils n'autorisent pas la même personne, d'où deux
 * routes plutôt qu'un paramètre.
 *
 * Le libre-service se paie d'un garde-fou : SE DEDIRE DOIT ETRE POSSIBLE.
 * Sans le DELETE, un scoreur empêché laisserait le match verrouillé sur son
 * nom, et le créateur n'aurait plus aucun moyen d'en trouver un autre — le
 * libre-service serait devenu pire que rien.
 */

async function verifierJeton(req: NextRequest): Promise<string | null> {
  const entete = req.headers.get("authorization");
  if (!entete?.startsWith("Bearer ")) return null;
  try {
    return (await adminAuth.verifyIdToken(entete.split("Bearer ")[1])).uid;
  } catch {
    return null;
  }
}

/**
 * Est-il sur la feuille de ce match ?
 *
 * ON NE COUVRE PAS UN MATCH QU'ON JOUE. Le manager peut tenir la console de sa
 * propre équipe — c'est le dernier recours, et il l'a toujours pu — mais un
 * joueur qui saisit les buts de la rencontre qu'il dispute n'est pas un
 * scoreur, c'est un juge et partie.
 *
 * Deux sources, parce que la feuille n'existe pas toujours au moment où l'on
 * se propose : la convocation confirmée (`participations`), qui précède le
 * match de plusieurs jours, et la feuille elle-même quand elle est validée.
 */
async function joueCeMatch(mid: string, uid: string, m: FirestoreMatch): Promise<boolean> {
  const surLaFeuille = [...(m.home_lineup ?? []), ...(m.away_lineup ?? [])]
    .some((e) => e.user_id === uid);
  if (surLaFeuille) return true;

  const convocations = await adminDb
    .collection("participations")
    .where("match_id", "==", mid)
    .where("player_id", "==", uid)
    .limit(5)
    .get();
  return convocations.docs.some((d) => d.data().status === "confirmed");
}

async function charger(
  req: NextRequest,
  mid: string,
): Promise<{ error: NextResponse } | { uid: string; match: FirestoreMatch }> {
  const uid = await verifierJeton(req);
  if (!uid) {
    return { error: NextResponse.json({ error: "Non autorisé" }, { status: 401 }) };
  }
  const snap = await adminDb.collection("matches").doc(mid).get();
  if (!snap.exists) {
    return { error: NextResponse.json({ error: "Match introuvable" }, { status: 404 }) };
  }
  return { uid, match: snap.data() as FirestoreMatch };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ mid: string }> },
) {
  const { mid } = await params;
  const charge = await charger(req, mid);
  if ("error" in charge) return charge.error;
  const { uid, match } = charge;

  try {
    const profil = await adminDb.collection("users").doc(uid).get();
    const d = profil.data();
    const estScoreur = profil.exists
      && (d?.is_scorer === true || estSuperadmin(d));
    if (!estScoreur) {
      return NextResponse.json(
        { error: "Il faut être scoreur validé pour couvrir un match." },
        { status: 403 },
      );
    }

    if (match.status === "completed" || match.status === "cancelled") {
      return NextResponse.json(
        { error: "Ce match est terminé, il n'y a plus rien à couvrir." },
        { status: 409 },
      );
    }

    // Premier arrivé. Un match déjà pris ne se reprend pas : celui qui le
    // tient doit d'abord se dédire, sinon deux scoreurs se disputeraient la
    // console pendant la rencontre.
    if ((match.moderator_ids ?? []).length > 0) {
      return NextResponse.json(
        { error: "Ce match a déjà un scoreur." },
        { status: 409 },
      );
    }

    if (await joueCeMatch(mid, uid, match)) {
      return NextResponse.json(
        { error: "Tu figures sur la feuille de ce match : tu ne peux pas le couvrir." },
        { status: 409 },
      );
    }

    await adminDb.collection("matches").doc(mid).update({
      moderator_ids: FieldValue.arrayUnion(uid),
      updated_at: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[matches/couvrir POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ mid: string }> },
) {
  const { mid } = await params;
  const charge = await charger(req, mid);
  if ("error" in charge) return charge.error;
  const { uid, match } = charge;

  try {
    if (!(match.moderator_ids ?? []).includes(uid)) {
      return NextResponse.json({ error: "Tu ne couvres pas ce match." }, { status: 409 });
    }
    // Se dédire pendant la rencontre laisserait le match sans personne au
    // tableau d'affichage, en direct. On rend avant, ou on va au bout.
    if (match.status === "live") {
      return NextResponse.json(
        { error: "Le match est en cours : on ne rend pas la console en plein direct." },
        { status: 409 },
      );
    }
    await adminDb.collection("matches").doc(mid).update({
      moderator_ids: FieldValue.arrayRemove(uid),
      updated_at: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[matches/couvrir DELETE]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
