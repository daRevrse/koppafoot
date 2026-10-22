import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { messageLimite } from "@/lib/offre";
import { limiteDeCreation } from "@/lib/offre-server";
import { equipeDepuisCompetition, gereLEquipe, type Rattachement } from "@/lib/rattachement-equipe";

// ============================================
// Server-only. Rattacher une équipe de compétition aux équipes de son
// manager : la lier à une des siennes, ou la créer dans les siennes (voir
// lib/rattachement-equipe pour le pourquoi).
//
// EN DEUX TEMPS : `verifierRattachement` d'abord, AVANT que l'invitation ne
// soit acceptée — une équipe introuvable, celle d'un autre, ou une offre
// gratuite déjà pleine laissent l'invitation en attente, rien n'est à moitié
// fait ; `appliquerRattachement` ensuite.
// ============================================

export interface RefusDeRattachement {
  status: number;
  error: string;
}

/** Ce qui empêche ce rattachement, ou `null`. */
export async function verifierRattachement(uid: string, r: Rattachement): Promise<RefusDeRattachement | null> {
  if (r.type === "existante") {
    const snap = await adminDb.collection("teams").doc(r.equipeId).get();
    if (!snap.exists) return { status: 404, error: "Cette équipe n'existe plus." };
    if (!gereLEquipe(snap.data() ?? {}, uid)) return { status: 403, error: "Ce n'est pas une de tes équipes." };
  }
  if (r.type === "nouvelle") {
    // L'offre gratuite plafonne les équipes qu'on gère (lib/offre), comme POST /api/teams.
    const limite = await limiteDeCreation(uid, "equipes");
    if (limite) return { status: 403, error: `${messageLimite(limite.cle, limite.max)} Lie plutôt l'équipe à une des tiennes.` };
  }
  return null;
}

/**
 * Pose le lien `claimed_by_team_id`, en créant d'abord l'équipe s'il le faut,
 * en une écriture. Rend l'identifiant de l'équipe du manager, ou `null` sans
 * rattachement.
 */
export async function appliquerRattachement(
  uid: string,
  cid: string,
  compTeamId: string,
  r: Rattachement,
): Promise<string | null> {
  if (r.type === "aucun") return null;
  const compRef = adminDb.collection("competitions").doc(cid);
  const equipeRef = compRef.collection("comp_teams").doc(compTeamId);

  if (r.type === "existante") {
    await equipeRef.update({ claimed_by_team_id: r.equipeId, updated_at: FieldValue.serverTimestamp() });
    return r.equipeId;
  }

  const [compSnap, equipeSnap] = await Promise.all([compRef.get(), equipeRef.get()]);
  const c = compSnap.data() ?? {};
  const e = equipeSnap.data() ?? {};
  const nouvelle = adminDb.collection("teams").doc();
  const lot = adminDb.batch();
  lot.set(nouvelle, {
    ...equipeDepuisCompetition(
      { nom: String(e.name ?? ""), logo: (e.logo_url as string | null) ?? null, ville: (c.venue_city as string | null) ?? null, categorie: c.category },
      uid,
    ),
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  });
  lot.update(equipeRef, { claimed_by_team_id: nouvelle.id, updated_at: FieldValue.serverTimestamp() });
  await lot.commit();
  return nouvelle.id;
}
