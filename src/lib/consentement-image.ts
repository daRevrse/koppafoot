// ============================================
// Le consentement à l'image : un joueur autorise-t-il KoppaFoot à mettre sa
// photo sur ses affiches et vidéos publiées sur les réseaux sociaux ?
//
// Décidé le 2026-10-19 (voir docs/superpowers/specs/2026-10-19-joueur-de-
// la-semaine-design.md, « Le consentement à l'image ») :
//
//   — LE JOUEUR RÉPOND LUI-MÊME s'il a un compte ; sinon, la personne qui pose
//     sa photo, organisateur ou manager.
//   — SANS RÉPONSE, C'EST NON. On n'utilise jamais une photo sans un oui.
//   — LA RÉPONSE EST ATTACHÉE À LA PHOTO : elle porte l'adresse de la photo
//     pour laquelle elle a été donnée. Une nouvelle photo n'a plus de réponse,
//     ce qui redemande l'accord.
//   — UN MINEUR N'A JAMAIS SA PHOTO, et on ne le lui demande pas. Mineur se lit
//     sur la date de naissance ; une date absente ne dit pas qu'il l'est.
//
// Pur : aucun SDK. Le même objet sur un compte (`consentement_image`), une
// ligne d'effectif et une fiche de club (`photo_consentement`).
// ============================================

export type ReponseConsentement = "oui" | "non";

export interface ConsentementImage {
  reponse: ReponseConsentement;
  /** ISO. */
  le: string;
  /** Le compte qui a répondu : le joueur, ou celui qui a posé sa photo. */
  par: string;
  /** L'adresse de la photo pour laquelle la réponse vaut. */
  photo: string;
}

/**
 * Ce qu'on peut faire de la photo de quelqu'un.
 * `aucun` : pas de photo, pas de réponse, ou une réponse donnée pour une autre photo.
 */
export type EtatConsentement = "oui" | "non" | "aucun" | "mineur";

/** Ce qu'il faut savoir d'une personne pour décider : sa photo, sa réponse, son âge. */
export interface SujetImage {
  photo: string | null;
  /** Tel que la base le range ; lu par `lireConsentement`. */
  consentement: unknown;
  dateNaissance?: string | null;
}

/** La majorité, au Togo comme ailleurs. */
const MAJORITE = 18;

/** Une réponse bien formée, ou null. */
export function lireConsentement(brut: unknown): ConsentementImage | null {
  if (!brut || typeof brut !== "object") return null;
  const c = brut as Record<string, unknown>;
  if (c.reponse !== "oui" && c.reponse !== "non") return null;
  if (typeof c.photo !== "string" || !c.photo) return null;
  return {
    reponse: c.reponse,
    le: typeof c.le === "string" ? c.le : "",
    par: typeof c.par === "string" ? c.par : "",
    photo: c.photo,
  };
}

/** La réponse à ranger, pour cette photo-là. */
export function consentementPour(
  photo: string,
  reponse: ReponseConsentement,
  par: string,
  le: string = new Date().toISOString(),
): ConsentementImage {
  return { reponse, le, par, photo };
}

/** Moins de 18 ans le `jour` dit, d'après une date « AAAA-MM-JJ ». Illisible ou absente : non. */
export function estMineur(dateNaissance: string | null | undefined, jour: string): boolean {
  const n = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateNaissance ?? "");
  const j = /^(\d{4})-(\d{2})-(\d{2})/.exec(jour);
  if (!n || !j) return false;
  const [an, mois, quantieme] = [Number(n[1]), Number(n[2]), Number(n[3])];
  if (mois < 1 || mois > 12 || quantieme < 1 || quantieme > 31) return false;
  const pasEncoreFete = `${j[2]}-${j[3]}` < `${n[2]}-${n[3]}`;
  const age = Number(j[1]) - an - (pasEncoreFete ? 1 : 0);
  return age < MAJORITE;
}

export function etatDuConsentement(s: SujetImage, jour: string): EtatConsentement {
  if (estMineur(s.dateNaissance, jour)) return "mineur";
  if (!s.photo) return "aucun";
  const c = lireConsentement(s.consentement);
  if (!c || c.photo !== s.photo) return "aucun";
  return c.reponse;
}

/** La photo, si et seulement si elle est autorisée ; sinon null, et l'affiche montre l'avatar. */
export function photoAutorisee(s: SujetImage, jour: string): string | null {
  return etatDuConsentement(s, jour) === "oui" ? s.photo : null;
}

/**
 * La réponse à montrer dans le champ photo d'un joueur sans compte : celle
 * donnée pour CETTE photo, ou null (pas encore de réponse pour elle).
 */
export function reponsePourLaPhoto(photo: string | null | undefined, consentement: unknown): ReponseConsentement | null {
  const c = lireConsentement(consentement);
  return photo && c && c.photo === photo ? c.reponse : null;
}

/**
 * Ce qu'il faut ranger sur la ligne ou la fiche à l'enregistrement. La
 * réponse donnée vaut pour la photo finale ; sans réponse, l'ancienne reste si
 * la photo n'a pas changé, et tombe sinon ; sans photo, rien.
 */
export function consentementAEnregistrer({ photo, reponse, ancien, par }: {
  photo: string | null | undefined;
  reponse: ReponseConsentement | null;
  ancien: unknown;
  par: string;
}): ConsentementImage | null {
  if (!photo) return null;
  if (reponse) return consentementPour(photo, reponse, par);
  const c = lireConsentement(ancien);
  return c && c.photo === photo ? c : null;
}

/** Faut-il poser la question au joueur ? Une photo, pas mineur, et pas de réponse pour CETTE photo. */
export function aDemanderAuJoueur(s: SujetImage, jour: string): boolean {
  return etatDuConsentement(s, jour) === "aucun" && !!s.photo;
}
