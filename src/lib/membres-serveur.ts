import { adminDb } from "@/lib/firebase-admin";

// ============================================
// Le profil d'un autre membre, tel qu'un compte connecté peut le lire.
//
// POURQUOI PAR LE SERVEUR. `users/{uid}` porte, à côté du profil, ce qui
// n'appartient qu'à son titulaire : son e-mail, son numéro, ses jetons de
// notification, ses réglages, un éventuel motif de suspension. La règle
// Firestore laissait tout compte connecté lire le document entier, donc
// moissonner l'e-mail et le numéro de chacun (l'inscription est ouverte à
// tous). Une règle ne sait pas cacher un champ : la lecture est désormais
// réservée au titulaire (firestore.rules), et les profils des autres passent
// par ici, en liste blanche.
//
// LA LISTE BLANCHE est exactement ce que l'application lit sur le profil d'un
// autre (voir toUserProfile, lib/firestore) : identité, rôle, poste, gabarit,
// licence d'arbitre, casquettes, palmarès, état de forme. Un champ qu'on
// ajoute au document n'en sort pas tant qu'on ne l'ajoute pas ici.
//
// Ce qui ne sort jamais : email, phone, auth_providers, fcm_tokens,
// push_prefs, suspension_*, followed_competition_ids, linked_comp_players,
// is_superadmin.
// ============================================

export const CHAMPS_MEMBRE = [
  "first_name", "last_name", "user_type", "evolution_role", "location_city", "bio",
  "profile_picture_url", "cover_photo_url", "company_name", "organizer_name",
  "is_active", "is_organizer", "is_venue_owner", "is_scorer",
  "position", "skill_level", "team_name", "strong_foot", "gender", "height", "weight", "date_of_birth",
  "license_number", "license_level", "experience_years",
  "followers_count", "following_count", "gallery_photos", "trophies", "condition",
  "created_at", "updated_at",
] as const;

/** Un horodatage Firestore devient une date ISO ; le reste passe tel quel. */
function serialiser(v: unknown): unknown {
  if (v && typeof v === "object") {
    const o = v as { toDate?: () => Date };
    if (typeof o.toDate === "function") return o.toDate().toISOString();
    if (Array.isArray(v)) return v.map(serialiser);
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, serialiser(x)]));
  }
  return v;
}

export type ProfilMembre = Record<string, unknown> & { uid: string };

export function vueMembre(uid: string, data: Record<string, unknown>): ProfilMembre {
  const out: ProfilMembre = { uid };
  for (const cle of CHAMPS_MEMBRE) {
    if (data[cle] !== undefined) out[cle] = serialiser(data[cle]);
  }
  return out;
}

/** Les profils demandés, dans l'ordre demandé ; un compte disparu est omis. */
export async function lireMembres(uids: string[]): Promise<ProfilMembre[]> {
  const ids = [...new Set(uids.filter((u) => typeof u === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(u)))];
  if (!ids.length) return [];
  const snaps = await adminDb.getAll(...ids.map((id) => adminDb.collection("users").doc(id)));
  return snaps.flatMap((s) => (s.exists ? [vueMembre(s.id, s.data()!)] : []));
}

export interface FiltresMembres {
  role: "joueur" | "arbitre" | "scoreur";
  ville?: string;
  poste?: string;
  niveau?: string;
  licence?: string;
  texte?: string;
}

/**
 * Les recherches de l'application, rejouées ici à l'identique : joueurs du
 * mercato (rôle activé), arbitres (rôle activé OU ancien `user_type`, voir
 * searchReferees), scoreurs validés. Les index composites sont ceux que les
 * requêtes du navigateur utilisaient déjà.
 */
export async function rechercherMembres(f: FiltresMembres): Promise<ProfilMembre[]> {
  const users = adminDb.collection("users");
  let requetes: FirebaseFirestore.Query[];
  if (f.role === "joueur") {
    let q = users.where("evolution_role", "==", "player").where("is_active", "==", true);
    if (f.ville) q = q.where("location_city", "==", f.ville);
    if (f.poste) q = q.where("position", "==", f.poste);
    if (f.niveau) q = q.where("skill_level", "==", f.niveau);
    requetes = [q];
  } else if (f.role === "arbitre") {
    const filtrer = (q: FirebaseFirestore.Query) => {
      let r = q.where("is_active", "==", true);
      if (f.ville) r = r.where("location_city", "==", f.ville);
      if (f.licence) r = r.where("license_level", "==", f.licence);
      return r;
    };
    requetes = [filtrer(users.where("evolution_role", "==", "referee")), filtrer(users.where("user_type", "==", "referee"))];
  } else {
    requetes = [users.where("is_scorer", "==", true).where("is_active", "==", true)];
  }

  const vus = new Set<string>();
  const out: ProfilMembre[] = [];
  for (const snap of await Promise.all(requetes.map((q) => q.get()))) {
    for (const d of snap.docs) {
      if (vus.has(d.id)) continue;
      vus.add(d.id);
      out.push(vueMembre(d.id, d.data()));
    }
  }
  const texte = f.texte?.trim().toLowerCase();
  return texte
    ? out.filter((m) => `${m.first_name ?? ""} ${m.last_name ?? ""}`.toLowerCase().includes(texte))
    : out;
}
