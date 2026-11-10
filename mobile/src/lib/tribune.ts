import { isVenueOwner } from "@/lib/hats";
import type { Post, PostType, UserProfile } from "@/types";

// La Tribune de l'application : le fil du site (/feed), ses mots et ses
// règles. Ici ce qui ne touche ni l'écran ni la base.

/** Les publications épinglées en tête ; les autres gardent l'ordre de la requête, la plus récente d'abord. */
export function trierLeFil(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => Number(b.pinned) - Number(a.pinned));
}

/**
 * Le « j'aime » posé d'avance : le cœur se remplit sans attendre la base. Si
 * l'écriture échoue, le même appel avec `aimait` inversé le défait.
 */
export function apresJaime(posts: Post[], postId: string, uid: string, aimait: boolean): Post[] {
  return posts.map((p) =>
    p.id === postId
      ? { ...p, isLiked: !aimait, likes: aimait ? p.likes.filter((u) => u !== uid) : [...p.likes.filter((u) => u !== uid), uid] }
      : p,
  );
}

export interface Signature {
  authorName: string;
  authorRole: string;
  authorAvatar: string;
}

/**
 * Ce qu'une publication porte de son auteur (PostCard du site). L'étiquette
 * dit le RÔLE, ce qu'on est sur le terrain : organiser ou gérer un terrain
 * sont des casquettes, elles ne prennent pas sa place. Le nom se construit
 * champ par champ : un profil incomplet a un nom de famille vide.
 */
export function signature(profil: UserProfile): Signature {
  const initiale = profil.lastName?.charAt(0);
  const authorName = isVenueOwner(profil) && profil.companyName
    ? profil.companyName
    : [profil.firstName, initiale ? `${initiale}.` : null].filter(Boolean).join(" ");
  const authorRole =
    profil.evolutionRole === "manager" ? "Manager"
      : profil.evolutionRole === "referee" ? "Arbitre"
        : profil.gender === "female" ? "Joueuse" : "Joueur";
  return { authorName, authorRole, authorAvatar: profil.profilePictureUrl || "" };
}

/** « Il y a 3min », comme le site (timeAgo de PostCard). Rien pour une date illisible. */
export function ilYA(iso: string, maintenant: Date): string {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return "";
  const minutes = Math.floor((maintenant.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes}min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `Il y a ${heures}h`;
  const jours = Math.floor(heures / 24);
  if (jours === 1) return "Hier";
  if (jours < 7) return `Il y a ${jours}j`;
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

const ROLES = ["Joueur", "Joueuse", "Manager", "Arbitre"];

/**
 * Le rôle à peindre en pastille, ou `null`. Les publications d'avant portent
 * parfois « Partenaire » ou « Organisateur » : ce sont des casquettes, pas des
 * rôles, et on ne les repeint pas.
 */
export function roleAffiche(role: string): string | null {
  return ROLES.includes(role) ? role : null;
}

const TYPES: Record<PostType, string | null> = {
  text: null,
  match_result: "Résultat",
  team_announcement: "Recrutement",
  highlight: "Performance",
  competition_announcement: "Compétition",
};

export const etiquetteDuType = (type: PostType): string | null => TYPES[type] ?? null;

// Les couleurs d'avatar du site (AVATAR_COLORS de PostCard), dans le même
// ordre : un auteur sans photo garde la même pastille des deux côtés.
const COULEURS_D_AVATAR = ["#3b82f6", "#10b981", "#a855f7", "#f59e0b", "#f97316", "#ec4899"];

export function couleurDAvatar(nom: string): string {
  let hash = 0;
  for (let i = 0; i < nom.length; i++) hash = nom.charCodeAt(i) + ((hash << 5) - hash);
  return COULEURS_D_AVATAR[Math.abs(hash) % COULEURS_D_AVATAR.length];
}

/** Sans photo : les initiales rangées dans la publication, sinon les deux premières lettres du nom. */
export function initialesDAuteur(post: Pick<Post, "authorAvatar" | "authorName">): string {
  if (post.authorAvatar && !post.authorAvatar.startsWith("http")) return post.authorAvatar;
  return post.authorName.slice(0, 2).toUpperCase();
}

/** L'adresse d'une publication, celle du site : ce qu'on partage, ce qu'une notification porte. */
export const lienDeLaPublication = (id: string) => `/feed?post=${encodeURIComponent(id)}`;

/** La publication qu'un lien vise (/feed?post=<id>&commentaires=1), et s'il faut ouvrir ses commentaires. */
export function publicationVisee(lien: string): { post: string | null; commentaires: boolean } {
  const requete = lien.split("#")[0].split("?")[1] ?? "";
  const params = new Map(requete.split("&").filter(Boolean).map((p) => {
    const [cle, valeur = ""] = p.split("=");
    try {
      return [cle, decodeURIComponent(valeur)] as const;
    } catch {
      return [cle, ""] as const;
    }
  }));
  const post = params.get("post") || null;
  return { post, commentaires: post !== null && params.get("commentaires") === "1" };
}

const PHOTO_MAX = 5 * 1024 * 1024;

/** Pourquoi cette photo ne part pas, ou `null` : les limites du site et de la règle Storage. */
export function photoRefusee(photo: { mimeType?: string | null; fileSize?: number | null }): string | null {
  if (photo.mimeType && !photo.mimeType.startsWith("image/")) return "Seules les images sont acceptées.";
  if (photo.fileSize && photo.fileSize > PHOTO_MAX) return "Image trop lourde (5 Mo au plus).";
  return null;
}
