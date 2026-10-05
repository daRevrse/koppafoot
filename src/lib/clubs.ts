// ============================================
// Le statut club : plusieurs équipes réunies sous un même club.
//
// UNE COUCHE AU-DESSUS DES ÉQUIPES, RIEN DE PLUS. Une équipe reste une équipe,
// gratuite, avec sa fiche, son effectif, ses matchs et ses stats. Le club les
// réunit : une identité (nom, écusson, couleurs), une page publique, un
// encadrement commun, et des sections (« Seniors », « U17 », « Féminines »).
// Aucune donnée d'équipe ni de joueur ne vit dans le club : il ne fait que
// les désigner.
//
// RÉSERVÉ À KOPPAFOOT PRO, ET TANT QU'IL DURE. Le club vit du Pro de son
// propriétaire. Quand celui-ci s'arrête, le club se met EN SOMMEIL : sa page
// ne s'affiche plus, ses sections redeviennent des équipes autonomes à
// l'affichage, mais rien n'est effacé. Le Pro qui revient le réveille tel
// quel. Aucun match ni aucune compétition ne dépend du club.
//
// L'ACCORD DE CHAQUE MANAGER. Le propriétaire rattache ses propres équipes
// d'un geste ; celle d'un autre manager reçoit une invitation, qu'il accepte
// ou refuse. Un manager peut sortir son équipe du club à tout moment.
//
// PAS D'ALLURE OFFICIELLE. « Club » dit une structure sur KoppaFoot, jamais
// une affiliation à une fédération : aucune mention « officiel » ni
// « affilié » ne s'affiche.
//
// Module pur : aucun SDK. Le serveur (lib/clubs-serveur, les routes) et le
// navigateur (la page du club, sa gestion) le partagent.
// ============================================

/** Un club tient une structure de quartier, pas une ligue. */
export const MAX_SECTIONS = 12;
export const MAX_STAFF = 12;

/** Des libellés qu'on propose ; n'importe quel autre se tape. */
export const SECTIONS_SUGGEREES = ["Seniors", "Réserve", "U19", "U17", "U15", "U13", "Féminines", "Vétérans"];

/** Une personne de l'encadrement du club : son nom et ce qu'elle y fait. */
export interface MembreDuClub {
  nom: string;
  titre: string;
}

/** Une invitation envoyée au manager d'une équipe qui n'est pas au propriétaire. */
export interface InvitationDeClub {
  libelle: string;
  /** Le manager invité, pour retrouver ses invitations sans lire chaque équipe. */
  manager_id: string;
  le: string;
}

/** Le club, tel que Firestore le range (`clubs/{id}`). Écrit par le serveur seulement. */
export interface FirestoreClub {
  nom: string;
  /** L'adresse de la page, fixée à la création : un lien partagé ne casse pas. */
  slug: string;
  ville: string | null;
  description: string | null;
  slogan: string | null;
  logo_url: string | null;
  banniere_url: string | null;
  couleur: string;
  /** Le compte dont le Pro fait vivre le club. */
  proprietaire_id: string;
  staff: MembreDuClub[];
  /** Les équipes rattachées, dans l'ordre de la page. */
  equipe_ids: string[];
  /** Le libellé de chaque section : `{ [equipeId]: "U17" }`. */
  sections: Record<string, string>;
  /** Les invitations en attente : `{ [equipeId]: … }`. */
  invitations: Record<string, InvitationDeClub>;
  /** Les managers invités, pour qu'une requête retrouve leurs invitations. */
  invite_manager_ids: string[];
  created_at: unknown;
  updated_at: unknown;
}

/** Une section, telle que la page du club la montre. */
export interface SectionPublique {
  equipeId: string;
  libelle: string;
  nom: string;
  logoUrl: string | null;
  couleur: string | null;
  categorie: string | null;
  ville: string | null;
}

/** La page d'un club. En sommeil, rien d'autre que le nom et l'état. */
export interface ClubPublic {
  id: string;
  slug: string;
  nom: string;
  enSommeil: boolean;
  proprietaireId: string;
  ville: string | null;
  description: string | null;
  slogan: string | null;
  logoUrl: string | null;
  banniereUrl: string | null;
  couleur: string;
  staff: MembreDuClub[];
  sections: SectionPublique[];
}

/** Ce qu'une fiche d'équipe montre de son club. */
export interface ClubDeLEquipe {
  nom: string;
  slug: string;
  logoUrl: string | null;
  couleur: string;
  libelle: string;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
export const COULEUR_PAR_DEFAUT = "#059669";

/** Une couleur « #rrggbb », sinon celle par défaut. */
export function couleurValide(x: unknown): string {
  return typeof x === "string" && HEX.test(x) ? x.toLowerCase() : COULEUR_PAR_DEFAUT;
}

/** Un libellé de section : 1 à 30 caractères. */
export function libelleValide(x: unknown): string | null {
  const s = typeof x === "string" ? x.trim().slice(0, 30) : "";
  return s || null;
}

/** L'encadrement, nettoyé : des noms et des titres courts, douze au plus. */
export function staffValide(x: unknown): MembreDuClub[] {
  if (!Array.isArray(x)) return [];
  return x.flatMap((m) => {
    const o = (m ?? {}) as Record<string, unknown>;
    const nom = typeof o.nom === "string" ? o.nom.trim().slice(0, 60) : "";
    const titre = typeof o.titre === "string" ? o.titre.trim().slice(0, 40) : "";
    return nom ? [{ nom, titre }] : [];
  }).slice(0, MAX_STAFF);
}

/**
 * L'identifiant d'une équipe à partir de ce que le propriétaire a collé : son
 * adresse (« …/teams/abc123 ») ou l'identifiant seul.
 */
export function equipeDepuisSaisie(saisie: unknown): string | null {
  const brut = typeof saisie === "string" ? saisie.trim() : "";
  if (!brut) return null;
  const id = brut.includes("/teams/") ? brut.split("/teams/")[1].split(/[/?#]/)[0] : brut;
  return /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : null;
}
