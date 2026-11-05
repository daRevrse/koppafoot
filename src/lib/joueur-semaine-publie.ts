// ============================================
// Le joueur de la semaine, une fois publié : ce que le public en voit.
//
// JUSQU'ICI, L'ÉLECTION NE LAISSAIT AUCUNE TRACE. La page admin classait la
// semaine et fabriquait l'affiche, à télécharger pour les réseaux ; rien
// n'était enregistré, et l'application ne savait pas qui avait été élu.
// « Publier dans l'appli » range maintenant l'élection dans
// `joueurs_semaine/{lundi}`, avec ses deux affiches figées dans Storage :
// l'affiche que le public partage est celle que l'administration a validée,
// pas un nouveau calcul qui aurait bougé avec une feuille corrigée depuis.
//
// DEUX ENDROITS LA MONTRENT (décidé le 2026-11-04 par le propriétaire) :
//   - la première diapositive de l'affiche du Direct, du jour de la
//     publication jusqu'au dimanche de cette semaine-là ;
//   - l'historique des élus, en tête de la page Top performances.
//
// ILS MONTRENT LE JOUEUR, PAS L'AFFICHE (2026-11-05) : sa photo, son équipe,
// ce qu'il a fait dans la semaine, match par match. L'affiche est faite pour
// être partagée ; elle ne sort qu'avec « Partager ».
//
// La collection n'est lue et écrite que par le serveur (SDK admin) : aucune
// règle Firestore ne l'ouvre aux navigateurs.
//
// Pur : aucun SDK.
// ============================================

import { semaineDu } from "@/lib/joueur-semaine";

export const COLLECTION_JOUEURS_SEMAINE = "joueurs_semaine";

export type FormatAffichePubliee = "publication" | "vertical";

export interface EquipeDuJoueurElu {
  nom: string;
  logo: string | null;
}

/** Un match de sa semaine, comme une ligne de l'affiche le raconte. */
export interface MatchDuJoueurElu {
  /** « DIM. 1 NOV. » */
  jour: string;
  /** Son équipe d'abord : « AVENIR D'ADAKPAMÉ 3–1 OLYMPIQUE DE TOKOIN ». */
  affiche: string;
  buts: number;
  passes: number;
  /** Homme de ce match. */
  homme: boolean;
}

/** Un joueur élu, tel que le public le voit. */
export interface JoueurDeLaSemaine {
  /** Le lundi de la semaine élue, « AAAA-MM-JJ » : l'identifiant du document. */
  lundi: string;
  dimanche: string;
  /** Le numéro de semaine ISO, celui de l'affiche. */
  numero: number;
  /** Le nom affiché, choisi par l'administration (souvent en capitales). */
  nom: string;
  /** Le compte, quand il en a un : sa fiche, le bouton « Suivre ». */
  uid: string | null;
  /** Ses équipes de la semaine, la plus récente d'abord. */
  equipes: EquipeDuJoueurElu[];
  matchs: number;
  buts: number;
  passes: number;
  /** La moyenne de ses notes de la semaine ; null s'il n'en a aucune. */
  note: number | null;
  /** Combien de fois homme du match dans la semaine. */
  hommeDuMatch: number;
  /** Ses matchs de la semaine, du plus ancien au plus récent. Vide pour une élection d'avant ce champ. */
  lignes: MatchDuJoueurElu[];
  /**
   * Sa photo : celle de son profil pour un compte (relue à chaque lecture,
   * voir lib/joueur-semaine-publie-serveur), celle que l'affiche a eu le droit
   * de montrer pour un joueur sans compte. Null : ses initiales.
   */
  photo: string | null;
  /** Le jour (Lomé) de la publication : la diapositive du Direct en dépend. */
  publieLe: string;
  /** Change à chaque publication : l'adresse des affiches en dépend, pour le cache. */
  version: string;
}

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const texte = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null;
const entier = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;

/**
 * Un document `joueurs_semaine/{lundi}` relu, ou null s'il est illisible :
 * une élection à moitié écrite ne s'affiche pas plutôt que de s'afficher
 * fausse.
 */
export function lireJoueurDeLaSemaine(id: string, d: Record<string, unknown> | undefined): JoueurDeLaSemaine | null {
  if (!d || !JOUR.test(id)) return null;
  const nom = texte(d.nom, 80);
  const publieLe = texte(d.publie_le_jour, 10);
  const version = texte(d.version, 64);
  if (!nom || !publieLe || !JOUR.test(publieLe) || !version) return null;
  const semaine = semaineDu(id);
  const equipes = Array.isArray(d.equipes)
    ? (d.equipes as unknown[]).flatMap((e) => {
        const x = (e ?? {}) as Record<string, unknown>;
        const n = texte(x.nom, 120);
        return n ? [{ nom: n, logo: texte(x.logo, 2000) }] : [];
      })
    : [];
  const lignes = Array.isArray(d.lignes)
    ? (d.lignes as unknown[]).flatMap((l) => {
        const x = (l ?? {}) as Record<string, unknown>;
        const jour = texte(x.jour, 40);
        const affiche = texte(x.affiche, 200);
        return jour && affiche
          ? [{ jour, affiche, buts: entier(x.buts), passes: entier(x.passes), homme: x.homme === true }]
          : [];
      })
    : [];
  const note = typeof d.note === "number" && Number.isFinite(d.note) ? d.note : null;
  return {
    lundi: id,
    dimanche: semaine.dimanche,
    numero: semaine.numero,
    nom,
    uid: texte(d.uid, 128),
    equipes,
    matchs: entier(d.matchs),
    buts: entier(d.buts),
    passes: entier(d.passes),
    note,
    hommeDuMatch: entier(d.homme_du_match),
    lignes,
    photo: texte(d.photo, 2000),
    publieLe,
    version,
  };
}

/**
 * Le dernier jour où la diapositive se montre : le dimanche de la semaine
 * de sa publication. Publiée un lundi, elle tient sept jours ; un jeudi,
 * quatre. La semaine suivante, le Direct revient à ses seuls matchs, et le
 * joueur reste dans l'historique.
 */
export function finDeLaDiapositive(j: Pick<JoueurDeLaSemaine, "publieLe">): string {
  return semaineDu(j.publieLe).dimanche;
}

/**
 * Le joueur que la diapositive du Direct montre `jour`, ou null : le plus
 * récent des élus (par semaine élue), tant que sa semaine de publication
 * n'est pas finie.
 */
export function joueurDuDirect(elus: JoueurDeLaSemaine[], jour: string): JoueurDeLaSemaine | null {
  const dernier = [...elus].sort((a, b) => b.lundi.localeCompare(a.lundi))[0];
  if (!dernier) return null;
  return dernier.publieLe <= jour && jour <= finDeLaDiapositive(dernier) ? dernier : null;
}

/** « 2 buts · 1 passe », « 1 but », ou « 3 matchs » quand il n'a ni marqué ni fait marquer. */
export function resumeDuJoueur(j: Pick<JoueurDeLaSemaine, "buts" | "passes" | "matchs">, langue: "fr" | "en" = "fr"): string {
  const mot = (n: number, fr: [string, string], en: [string, string]) =>
    `${n} ${(langue === "fr" ? fr : en)[n > 1 ? 1 : 0]}`;
  const parts: string[] = [];
  if (j.buts > 0) parts.push(mot(j.buts, ["but", "buts"], ["goal", "goals"]));
  if (j.passes > 0) parts.push(mot(j.passes, ["passe", "passes"], ["assist", "assists"]));
  if (parts.length === 0 && j.matchs > 0) parts.push(mot(j.matchs, ["match", "matchs"], ["match", "matches"]));
  return parts.join(" · ");
}

/** L'ancre de l'élu dans l'historique : c'est là que mène le lien partagé. */
export function ancreDuJoueur(lundi: string): string {
  return `joueur-semaine-${lundi}`;
}

/** Le chemin partagé : la page Top performances, ouverte sur l'élu. */
export function cheminDuJoueur(lundi: string): string {
  return `/top-players#${ancreDuJoueur(lundi)}`;
}

/**
 * L'adresse d'une affiche publiée, servie par le site lui-même (et non par
 * Storage, qui refuse les lectures `fetch` d'une autre origine sans réglage
 * CORS du bucket). La version casse le cache à chaque republication.
 */
export function adresseDeLAffiche(
  j: Pick<JoueurDeLaSemaine, "lundi" | "version">,
  format: FormatAffichePubliee,
): string {
  const p = new URLSearchParams({ format, v: j.version });
  return `/api/joueur-semaine/${j.lundi}/affiche?${p}`;
}

/** « 9,2 », ou « 9.2 » en anglais. */
export function noteEnTexte(note: number, langue: "fr" | "en" = "fr"): string {
  return note.toLocaleString(langue === "fr" ? "fr-FR" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Les capitales de l'affiche, adoucies pour une phrase : « EKOUÉ BAWA » → « Ekoué Bawa ». */
export function nomEnPhrase(nom: string): string {
  if (nom !== nom.toUpperCase()) return nom;
  return nom.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toUpperCase());
}

/** Le texte du partage, avant le lien. */
export function texteDuPartage(j: Pick<JoueurDeLaSemaine, "nom" | "numero">, langue: "fr" | "en" = "fr"): string {
  const nom = nomEnPhrase(j.nom);
  return langue === "fr"
    ? `${nom}, joueur de la semaine ${j.numero} sur KoppaFoot ⚽`
    : `${nom}, KoppaFoot player of week ${j.numero} ⚽`;
}

const MOIS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MOIS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** « 26 oct. – 1 nov. », « 2–8 nov. » ; en anglais, « Oct 26 – Nov 1 ». */
export function periodeDeLaSemaine(j: Pick<JoueurDeLaSemaine, "lundi" | "dimanche">, langue: "fr" | "en" = "fr"): string {
  const [, m1, j1] = j.lundi.split("-").map(Number);
  const [, m2, j2] = j.dimanche.split("-").map(Number);
  if (langue === "en") {
    return m1 === m2 ? `${MOIS_EN[m1 - 1]} ${j1}–${j2}` : `${MOIS_EN[m1 - 1]} ${j1} – ${MOIS_EN[m2 - 1]} ${j2}`;
  }
  return m1 === m2 ? `${j1}–${j2} ${MOIS_FR[m2 - 1]}` : `${j1} ${MOIS_FR[m1 - 1]} – ${j2} ${MOIS_FR[m2 - 1]}`;
}
