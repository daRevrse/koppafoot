import { adminDb } from "@/lib/firebase-admin";
import { slugify } from "@/lib/competition-format";
import { estPro, jourDeLome } from "@/lib/offre";
import { lireDroits } from "@/lib/offre-server";
import type { ClubDeLEquipe, ClubPublic, FirestoreClub, SectionPublique } from "@/lib/clubs";

// ============================================
// Les clubs, côté serveur : les lire, dire s'ils dorment, les montrer.
//
// `clubs/{id}` est fermé aux navigateurs (firestore.rules) : tout passe par
// les routes /api/clubs (gestion) et /api/public/club (la page). C'est ici
// que se décide l'état ÉVEILLÉ ou EN SOMMEIL, à chaque lecture, d'après le Pro
// du propriétaire : aucun traitement planifié n'a à endormir un club, et un
// Pro qui revient le réveille à la lecture suivante.
// ============================================

export const clubs = () => adminDb.collection("clubs");

export async function lireClub(id: string): Promise<(FirestoreClub & { id: string }) | null> {
  const snap = await clubs().doc(id).get();
  return snap.exists ? { id: snap.id, ...(snap.data() as FirestoreClub) } : null;
}

export async function clubParSlug(slug: string): Promise<(FirestoreClub & { id: string }) | null> {
  const snap = await clubs().where("slug", "==", slug).limit(1).get();
  return snap.empty ? null : { id: snap.docs[0].id, ...(snap.docs[0].data() as FirestoreClub) };
}

/** Le club d'un propriétaire : un seul par compte. */
export async function clubDuProprietaire(uid: string): Promise<(FirestoreClub & { id: string }) | null> {
  const snap = await clubs().where("proprietaire_id", "==", uid).limit(1).get();
  return snap.empty ? null : { id: snap.docs[0].id, ...(snap.docs[0].data() as FirestoreClub) };
}

/** Le club dont l'équipe est une section, éveillé ou non. */
export async function clubDeLEquipeBrut(equipeId: string): Promise<(FirestoreClub & { id: string }) | null> {
  const snap = await clubs().where("equipe_ids", "array-contains", equipeId).limit(1).get();
  return snap.empty ? null : { id: snap.docs[0].id, ...(snap.docs[0].data() as FirestoreClub) };
}

/** Le club vit-il ? Oui tant que son propriétaire a le Pro. */
export async function estEveille(club: Pick<FirestoreClub, "proprietaire_id">): Promise<boolean> {
  return estPro(await lireDroits(club.proprietaire_id), jourDeLome());
}

/** Une adresse libre : « etoile-de-be », sinon « etoile-de-be-2 »… */
export async function slugLibre(nom: string): Promise<string> {
  const base = slugify(nom) || "club";
  for (let n = 1; ; n += 1) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if ((await clubs().where("slug", "==", slug).limit(1).get()).empty) return slug;
  }
}

/** Les sections, lues sur leurs équipes ; une équipe supprimée disparaît. */
export async function sectionsDuClub(club: FirestoreClub): Promise<SectionPublique[]> {
  if (!club.equipe_ids?.length) return [];
  const snaps = await adminDb.getAll(...club.equipe_ids.map((id) => adminDb.collection("teams").doc(id)));
  return snaps.flatMap((s) => {
    if (!s.exists) return [];
    const t = s.data()!;
    return [{
      equipeId: s.id,
      libelle: club.sections?.[s.id] ?? "",
      nom: String(t.name ?? ""),
      logoUrl: (t.logo_url as string | undefined) ?? null,
      couleur: (t.color as string | undefined) ?? null,
      categorie: (t.category as string | undefined) ?? null,
      ville: (t.city as string | undefined) ?? null,
    }];
  });
}

/** La page du club. `enSommeil` : seuls le nom et l'adresse sortent. */
export async function vuePublique(club: FirestoreClub & { id: string }, eveille: boolean): Promise<ClubPublic> {
  const base = {
    id: club.id, slug: club.slug, nom: club.nom, proprietaireId: club.proprietaire_id,
    couleur: club.couleur,
  };
  if (!eveille) {
    return {
      ...base, enSommeil: true, ville: null, description: null, slogan: null,
      logoUrl: null, banniereUrl: null, staff: [], sections: [],
    };
  }
  return {
    ...base,
    enSommeil: false,
    ville: club.ville ?? null,
    description: club.description ?? null,
    slogan: club.slogan ?? null,
    logoUrl: club.logo_url ?? null,
    banniereUrl: club.banniere_url ?? null,
    staff: club.staff ?? [],
    sections: await sectionsDuClub(club),
  };
}

/** Ce que la fiche d'une équipe montre de son club ; rien s'il dort. */
export async function clubDeLEquipe(equipeId: string): Promise<ClubDeLEquipe | null> {
  const club = await clubDeLEquipeBrut(equipeId);
  if (!club || !(await estEveille(club))) return null;
  return {
    nom: club.nom,
    slug: club.slug,
    logoUrl: club.logo_url ?? null,
    couleur: club.couleur,
    libelle: club.sections?.[equipeId] ?? "",
  };
}
