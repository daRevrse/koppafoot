import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { sendPushToUser } from "@/lib/fcm-server";
import { categorieDuType } from "@/lib/push-categories";
import { LIBELLE_CONDITION, lireCondition, type ConditionJoueur } from "@/lib/etat-de-forme";

/**
 * POST /api/joueurs/condition, prévient ceux qui composent qu'un joueur a
 * changé de condition.
 *
 * Le joueur écrit sa condition lui-même, sur son document (les règles le lui
 * permettent, voir firestore.rules). Mais une blessure déclarée que personne
 * ne lit ne sert à rien : le manager l'apprendrait en ouvrant l'effectif, ou
 * le samedi matin. Cette route le lui dit au moment où ça arrive.
 *
 * QUI EST PRÉVENU : le manager de chaque équipe dont le joueur est membre, et
 * le staff qui a ses droits (`staff_manager_ids`). PAS l'effectif, PAS les
 * abonnés : une blessure est l'affaire de ceux qui composent, pas une
 * nouvelle à diffuser.
 *
 * CE QUI EST DIT vient du DOCUMENT, jamais du corps de la requête : sans
 * quoi n'importe qui annoncerait n'importe quoi au nom de n'importe qui. Le
 * mot libre du joueur n'est pas recopié dans la notification — il reste sur
 * sa fiche, où le manager le lit.
 *
 * Best-effort côté appelant : la condition est déjà enregistrée quand on
 * arrive ici, un échec ne la défait pas.
 */

export const dynamic = "force-dynamic";

/**
 * Au-delà, la déclaration n'est plus fraîche : on ne l'annonce plus.
 * L'appel suit l'écriture de quelques secondes ; un rejeu tardif du même
 * appel ne doit pas réveiller un manager pour une nouvelle vieille d'hier.
 */
const FRAICHEUR_MS = 10 * 60_000;

function dateCourte(jour: string): string {
  try {
    return new Date(`${jour}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  } catch {
    return jour;
  }
}

function message(nom: string, c: ConditionJoueur): string {
  if (c.statut === "apte") return `${nom} est de nouveau apte.`;
  const statut = `${nom} : ${LIBELLE_CONDITION[c.statut].toLowerCase()}`;
  // Pas de point final après la date : « 8 oct. » porte déjà le sien.
  return c.retourPrevu ? `${statut}, retour prévu le ${dateCourte(c.retourPrevu)}` : `${statut}.`;
}

export async function POST(req: NextRequest) {
  const entete = req.headers.get("authorization");
  if (!entete?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(entete.split("Bearer ")[1])).uid;
  } catch {
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }

  try {
    const profil = (await adminDb.collection("users").doc(uid).get()).data();
    const condition = lireCondition(profil?.condition);
    if (!profil || !condition) return NextResponse.json({ ok: true, prevenus: 0 });

    const declaree = Date.parse(condition.declareeLe);
    if (!Number.isFinite(declaree) || Date.now() - declaree > FRAICHEUR_MS) {
      return NextResponse.json({ ok: true, prevenus: 0 });
    }

    const nom = `${profil.first_name ?? ""} ${profil.last_name ?? ""}`.trim() || "Un joueur";
    const equipes = await adminDb.collection("teams").where("member_ids", "array-contains", uid).get();

    // Un destinataire par équipe au plus, et une seule fois s'il dirige
    // plusieurs équipes du joueur : le lien mène alors à la première.
    const destinataires = new Map<string, string>();
    for (const d of equipes.docs) {
      const t = d.data();
      if (t.is_ghost === true) continue;
      for (const id of [t.manager_id, ...((t.staff_manager_ids ?? []) as string[])]) {
        if (typeof id === "string" && id && id !== uid && !destinataires.has(id)) {
          destinataires.set(id, `/teams/${d.id}`);
        }
      }
    }
    if (destinataires.size === 0) return NextResponse.json({ ok: true, prevenus: 0 });

    const titre = condition.statut === "apte" ? "Retour dans l'effectif" : "État de forme";
    const corps = message(nom, condition);

    const batch = adminDb.batch();
    for (const [userId, link] of destinataires) {
      batch.set(adminDb.collection("notifications").doc(), {
        user_id: userId,
        type: "team_activity",
        title: titre,
        body: corps,
        link,
        read: false,
        created_at: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();

    await Promise.allSettled(
      [...destinataires].map(([userId, link]) =>
        sendPushToUser(userId, { title: titre, body: corps, link, category: categorieDuType("team_activity") }),
      ),
    );

    return NextResponse.json({ ok: true, prevenus: destinataires.size });
  } catch (err) {
    console.error("POST /api/joueurs/condition failed:", err);
    return NextResponse.json({ error: "Notification impossible" }, { status: 500 });
  }
}
