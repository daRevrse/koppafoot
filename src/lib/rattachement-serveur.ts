import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { messageLimite } from "@/lib/offre";
import { limiteDeCreation } from "@/lib/offre-server";
import { lireCategorie } from "@/lib/genre";
import {
  effectifDepuisCompetition, equipeDepuisCompetition, gereLEquipe,
  type Rattachement, type ResumeReprise,
} from "@/lib/rattachement-equipe";
import type { CompPlayer } from "@/types";

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

/** Une équipe de compétition déjà liée à une équipe : on n'en crée pas une seconde. */
export class DejaLiee extends Error {}

/** Le rattachement posé : l'équipe du manager, et ce que la création a repris. */
export interface RattachementFait {
  equipeId: string;
  /** `null` quand l'équipe était déjà au manager : rien n'a été créé. */
  repris: ResumeReprise | null;
}

/**
 * Pose le lien `claimed_by_team_id`, en créant d'abord l'équipe s'il le faut.
 * Rend l'équipe du manager, ou `null` sans rattachement.
 *
 * CRÉER, C'EST UNE TRANSACTION : l'équipe, les fiches de ses joueurs sans
 * compte (lib/rattachement-equipe, `effectifDepuisCompetition`) et l'effectif
 * de compétition qui les désigne s'écrivent ensemble ou pas du tout.
 * L'effectif est un seul tableau : relu dans la transaction, il ne perd pas
 * une ligne que l'organisateur ajouterait au même moment. Et une équipe déjà
 * liée lève `DejaLiee` : deux clics ne font pas deux équipes.
 */
export async function appliquerRattachement(
  uid: string,
  cid: string,
  compTeamId: string,
  r: Rattachement,
): Promise<RattachementFait | null> {
  if (r.type === "aucun") return null;
  const compRef = adminDb.collection("competitions").doc(cid);
  const equipeRef = compRef.collection("comp_teams").doc(compTeamId);

  if (r.type === "existante") {
    await equipeRef.update({ claimed_by_team_id: r.equipeId, updated_at: FieldValue.serverTimestamp() });
    return { equipeId: r.equipeId, repris: null };
  }

  const nouvelle = adminDb.collection("teams").doc();
  const fiches = nouvelle.collection("ghost_players");
  return adminDb.runTransaction(async (tx) => {
    const [compSnap, equipeSnap] = await Promise.all([tx.get(compRef), tx.get(equipeRef)]);
    if (!equipeSnap.exists) throw new Error("TEAM_NOT_FOUND");
    const c = compSnap.data() ?? {};
    const e = equipeSnap.data() ?? {};
    if (e.claimed_by_team_id) throw new DejaLiee("Cette équipe est déjà liée à une de tes équipes.");

    const repris = effectifDepuisCompetition((e.players ?? []) as CompPlayer[], () => fiches.doc().id);
    // Les dates d'une fiche sont des chaînes ISO, comme celles qu'écrit le
    // formulaire (lib/firestore, `createGhostPlayer`).
    const maintenant = new Date().toISOString();

    tx.set(nouvelle, {
      ...equipeDepuisCompetition(
        { nom: String(e.name ?? ""), logo: (e.logo_url as string | null) ?? null, ville: (c.venue_city as string | null) ?? null, categorie: c.category },
        uid,
      ),
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });
    for (const { id, ...fiche } of repris.fiches) {
      tx.set(fiches.doc(id), { ...fiche, created_at: maintenant, updated_at: maintenant });
    }
    tx.update(equipeRef, {
      ...(repris.fiches.length > 0 ? { players: repris.effectif } : {}),
      claimed_by_team_id: nouvelle.id,
      updated_at: FieldValue.serverTimestamp(),
    });

    return {
      equipeId: nouvelle.id,
      repris: { fiches: repris.fiches.length, comptes: repris.comptes, categorie: lireCategorie(c.category) },
    };
  });
}
