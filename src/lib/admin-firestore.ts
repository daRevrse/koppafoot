// ============================================
// KOPPAFOOT Admin, lectures Firestore depuis le navigateur (superadmin).
//
// CE FICHIER PORTAIT SES PROPRES COPIES DES CONVERTISSEURS DU PRODUIT, restées
// en arrière : un compte sans rôle Évolution ni casquettes, une équipe sans
// logo ni drapeau fantôme, une date de création qui n'était pas une chaîne.
// L'écran des comptes annonçait « 14 comptes, dont 14 sans aucun espace », la
// fenêtre des casquettes proposait de promouvoir administrateur un
// administrateur, et la fiche d'une équipe plantait à l'ouverture.
//
// On lit désormais avec les convertisseurs du produit (lib/profil,
// lib/competition-mappers) : ce que l'administration voit d'un compte est ce
// que le compte est. Ce qui se compte ou se croise — tableau de bord, équipes,
// matchs, fiche d'un compte — passe par les routes serveur (lib/admin-serveur).
// ============================================

import {
  collection, query, orderBy, limit as firestoreLimit, getDocs, updateDoc, doc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { firestoreToProfile } from "@/lib/profil";
import { toCompetition } from "@/lib/competition-mappers";
import { horairesLus } from "@/lib/terrains";
import type {
  UserProfile, FirestoreUser, Venue, FirestoreVenue, Competition, FirestoreCompetition,
} from "@/types";

export async function getAllUsers(max = 1000): Promise<UserProfile[]> {
  const q = query(collection(db, "users"), orderBy("created_at", "desc"), firestoreLimit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => firestoreToProfile(d.id, d.data() as FirestoreUser));
}

/** Toutes les compétitions, validées ou non, la plus récente d'abord. */
export async function getAllCompetitions(max = 500): Promise<Competition[]> {
  const q = query(collection(db, "competitions"), firestoreLimit(max));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => toCompetition(d.id, d.data() as FirestoreCompetition))
    // Les bacs à sable de la console live appartiennent à leur créateur et ne
    // sont le travail de personne : ils n'ont rien à faire dans une liste
    // qu'on valide.
    .filter((c) => !c.isSandbox)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

/**
 * Ouvrir ou fermer la porte du public.
 *
 * Ne touche à rien d'autre : l'organisateur garde sa compétition, ses équipes
 * et son calendrier. Seul ce qui est montré au public change.
 */
export async function setCompetitionValidated(cid: string, validated: boolean): Promise<void> {
  await updateDoc(doc(db, "competitions", cid), {
    is_validated: validated,
    updated_at: serverTimestamp(),
  });
}

function toVenue(id: string, d: FirestoreVenue): Venue {
  return {
    id, name: d.name, address: d.address, city: d.city, ownerId: d.owner_id,
    fieldType: d.field_type, fieldSurface: d.field_surface, fieldSize: d.field_size,
    rating: d.rating ?? 0, reviewCount: d.review_count ?? 0,
    pricePerHour: d.price_per_hour ?? 0, amenities: d.amenities ?? [],
    available: d.available ?? true, photoUrl: d.photo_url ?? null,
    galleryUrls: d.gallery_urls ?? [],
    openingHours: horairesLus(d.opening_hours),
    createdAt: d.created_at, updatedAt: d.updated_at,
  };
}

export async function getAllVenues(max = 500): Promise<Venue[]> {
  const q = query(collection(db, "venues"), orderBy("created_at", "desc"), firestoreLimit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toVenue(d.id, d.data() as FirestoreVenue));
}

/** Suspendre ou réactiver un compte. La suspension n'accorde rien et ne retire que l'accès. */
export async function toggleUserActive(uid: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    is_active: active,
    updated_at: serverTimestamp(),
  });
}

// ============================================
// Qui modère quelque chose.
//
// La modération ne se lit pas sur le compte : elle vit dans
// `competitions.moderator_ids`. Une requête par ligne du tableau des
// utilisateurs, c'est cinq cents lectures pour une colonne ; une seule
// traversée des compétitions suffit à répondre pour tout le monde.
//
// Les brouillons sont inclus, contrairement à listPublicCompetitions : un
// modérateur nommé sur une compétition pas encore publiée a bel et bien accès
// à la console.
// ============================================

export async function getModeratorIds(): Promise<Set<string>> {
  const snap = await getDocs(collection(db, "competitions"));
  const ids = new Set<string>();
  for (const d of snap.docs) {
    for (const uid of (d.data().moderator_ids as string[] | undefined) ?? []) {
      if (uid) ids.add(uid);
    }
  }
  return ids;
}
