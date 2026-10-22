import { accorder, lireGenre, type Genre } from "@/lib/genre";
import { nomDuPoste, normaliserPoste } from "@/lib/postes";
import { ROLE_LABELS, type UserRole } from "@/types";

// La fiche d'un joueur (app/(app)/profile/[uid] du site), lue de la route
// publique /api/public/profile/[uid] : la seule porte vers un compte quand on
// n'en est pas le titulaire — `users` est fermé, il porte l'email et le
// téléphone. La route ne renvoie qu'une liste blanche de champs.

export interface EquipeDuJoueur {
  id: string;
  nom: string;
  ville: string | null;
  logo: string | null;
  victoires: number;
  nuls: number;
  defaites: number;
  joues: number;
  /** Ce joueur dirige-t-il cette équipe ? */
  dirige: boolean;
}

export type FicheJoueur =
  | {
    genre: "fiche";
    uid: string;
    nom: string;
    photo: string | null;
    couverture: string | null;
    bio: string | null;
    ville: string | null;
    /** « Joueur », « Joueuse », « Manager », « Arbitre », « Membre ». */
    role: string;
    poste: string | null;
    numero: string | null;
    pied: string | null;
    niveau: string | null;
    taille: number | null;
    poids: number | null;
    age: number | null;
    abonnes: number;
    matchs: number;
    buts: number;
    passes: number;
    galerie: string[];
    equipes: EquipeDuJoueur[];
    genreDuJoueur: Genre | null;
  }
  /** Un compte sans fiche publique (aUnProfilPublic) : son nom et sa photo, rien d'autre. */
  | { genre: "sans-fiche"; uid: string; nom: string; photo: string | null };

// Les mots de la carte de bilan du site (BilanDuProfil).
const PIED: Record<string, string> = { left: "Pied gauche", right: "Pied droit", both: "Deux pieds" };
const NIVEAU: Record<string, string> = { beginner: "Débutant", amateur: "Amateur", intermediate: "Intermédiaire", advanced: "Confirmé" };

/** L'âge le jour `maintenant`, d'une date « AAAA-MM-JJ » ; null sans date lisible. */
export function ageLe(dateDeNaissance: string | null | undefined, maintenant: Date): number | null {
  if (!dateDeNaissance) return null;
  const naissance = new Date(`${dateDeNaissance.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(naissance.getTime())) return null;
  let age = maintenant.getFullYear() - naissance.getFullYear();
  const mois = maintenant.getMonth() - naissance.getMonth();
  if (mois < 0 || (mois === 0 && maintenant.getDate() < naissance.getDate())) age--;
  return age;
}

const texte = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const nombre = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const lien = (v: unknown): string | null => (typeof v === "string" && v.startsWith("http") ? v : null);
const nomComplet = (p: Record<string, unknown>) => [texte(p.first_name), texte(p.last_name)].filter(Boolean).join(" ");

/** La réponse de la route, en fiche ; `null` quand elle ne dit rien. */
export function ficheDepuisLaRoute(uid: string, data: unknown, maintenant: Date = new Date()): FicheJoueur | null {
  const d = (data ?? {}) as { profile?: Record<string, unknown> | null; teams?: unknown; sansProfilPublic?: Record<string, unknown> };
  if (d.sansProfilPublic) {
    return { genre: "sans-fiche", uid, nom: nomComplet(d.sansProfilPublic), photo: lien(d.sansProfilPublic.profile_picture_url) };
  }
  const p = d.profile;
  if (!p) return null;

  const genreDuJoueur = lireGenre(p.gender);
  const typeDeCompte = (texte(p.evolution_role) ?? texte(p.user_type) ?? "user") as UserRole;
  const roleBrut = ROLE_LABELS[typeDeCompte] ?? ROLE_LABELS.user;
  const role = typeDeCompte === "player" ? accorder(genreDuJoueur, "Joueur", "Joueuse") : roleBrut;
  const poste = normaliserPoste(texte(p.position));
  const numero = p.jersey_number == null || p.jersey_number === "" ? null : String(p.jersey_number);

  const equipes = (Array.isArray(d.teams) ? d.teams : []).map((t: Record<string, unknown>) => ({
    id: String(t.id ?? ""),
    nom: texte(t.name) ?? "",
    ville: texte(t.city),
    logo: lien(t.logoUrl),
    victoires: nombre(t.wins) ?? 0,
    nuls: nombre(t.draws) ?? 0,
    defaites: nombre(t.losses) ?? 0,
    joues: nombre(t.matchesPlayed) ?? 0,
    dirige: t.isManager === true,
  })).filter((e) => e.id);

  return {
    genre: "fiche",
    uid,
    nom: nomComplet(p),
    photo: lien(p.profile_picture_url),
    couverture: lien(p.cover_photo_url),
    bio: texte(p.bio),
    ville: texte(p.location_city),
    role,
    poste: poste ? nomDuPoste(poste, "fr", genreDuJoueur) : null,
    numero,
    pied: PIED[texte(p.strong_foot) ?? ""] ?? null,
    niveau: NIVEAU[texte(p.skill_level) ?? ""] ?? null,
    taille: nombre(p.height),
    poids: nombre(p.weight),
    age: ageLe(texte(p.date_of_birth), maintenant),
    abonnes: nombre(p.followers_count) ?? 0,
    matchs: nombre(p.matches_played) ?? 0,
    buts: nombre(p.goals) ?? 0,
    passes: nombre(p.assists) ?? 0,
    galerie: (Array.isArray(p.gallery_urls) ? p.gallery_urls : []).map(lien).filter((u): u is string => !!u),
    equipes,
    genreDuJoueur,
  };
}
