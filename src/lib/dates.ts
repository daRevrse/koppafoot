// ============================================
// Firestore date normalisation, shared, pure, SDK-agnostic (no web SDK and
// no admin SDK import) so client mappers, server mappers and the auth
// context can all use it.
//
// Firestore hands back a Timestamp object for anything written with
// serverTimestamp(), even where the TypeScript type says `string`. Passing
// that object to `new Date(...)` yields Invalid Date, so every read path has
// to go through here.
// ============================================

import type { Langue } from "@/i18n/config";

export type FirestoreDate =
  | string
  | { seconds?: number; toDate?: () => Date }
  | null
  | undefined;

/** Convert a Firestore date (string or Timestamp, web or admin) to an ISO string. */
export function formatDate(date: FirestoreDate): string {
  if (!date) return new Date().toISOString();
  if (typeof date === "string") return date;
  // Handle Firestore serverTimestamp placeholder (no toDate or seconds on first snapshot)
  if (!date.seconds && !date.toDate) return new Date().toISOString();
  if (typeof date.toDate === "function") return date.toDate().toISOString();
  if (date.seconds) return new Date(date.seconds * 1000).toISOString();
  return new Date().toISOString();
}

// ---- Le jour, tel qu'on l'ecrit a quelqu'un ---------------------------------
//
// CES TROIS FONCTIONS VIVAIENT DANS LE DIRECT, et elles y vivaient DEUX fois
// — une copie dans `DirectHome`, une autre dans `DirectHomeV2`, plus une
// troisieme variante dans `WorldMatchList`. Une quatrieme copie etait sur le
// point de naitre avec la liste des matchs d'une equipe, qui affichait jusque
// la sa date brute : « 2026-09-05 », c'est-a-dire ce que la base stocke et non
// ce qu'on dit a quelqu'un.
//
// Elles atterrissent ici parce que ce module ne depend d'aucun SDK et se lit
// donc du serveur comme du navigateur, ce qui est exactement la contrainte
// qui avait fait naitre les copies.

/** Une date au format que la base stocke : « 2026-09-05 ». */
export function cleDuJour(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** La meme cle, decalee de `delta` jours. */
export function decalerDeJours(cle: string, delta: number): string {
  const d = new Date(`${cle}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return cleDuJour(d);
}

/**
 * « Aujourd'hui », « Demain », « Hier », sinon « sam. 23 août » (« Sat 23 Aug »).
 *
 * LES TROIS PREMIERS VALENT MIEUX QU'UNE DATE, et c'est tout l'interet : on
 * ne compte pas les jours pour savoir si un match est demain. Au-dela, le jour
 * de la semaine porte plus que l'annee — personne ne consulte le calendrier
 * d'un club de quartier a douze mois.
 */
/**
 * Aujourd'hui, demain ou hier : les jours que `libelleDuJour` écrit en toutes
 * lettres. L'anglais en a besoin pour bâtir sa phrase — « no matches today »
 * mais « no matches ON Sat 23 Aug » —, et pour ne pas mettre de minuscule à
 * un nom de jour.
 */
export function estJourProche(cle: string): boolean {
  const aujourdhui = cleDuJour(new Date());
  return cle === aujourdhui || cle === decalerDeJours(aujourdhui, 1) || cle === decalerDeJours(aujourdhui, -1);
}

const JOURS_PROCHES: Record<Langue, [string, string, string]> = {
  fr: ["Aujourd'hui", "Demain", "Hier"],
  en: ["Today", "Tomorrow", "Yesterday"],
};

export function libelleDuJour(cle: string, langue: Langue = "fr"): string {
  const aujourdhui = cleDuJour(new Date());
  const [ajd, demain, hier] = JOURS_PROCHES[langue];
  if (cle === aujourdhui) return ajd;
  if (cle === decalerDeJours(aujourdhui, 1)) return demain;
  if (cle === decalerDeJours(aujourdhui, -1)) return hier;
  const d = new Date(`${cle}T00:00:00`);
  return Number.isNaN(d.getTime()) ? cle : dateAvecJour(d, langue);
}

// ---- Une date avec son jour de la semaine, écrite à la main -----------------
//
// `toLocaleDateString` NE DONNE PAS LA MÊME CHOSE PARTOUT. En anglais
// britannique, le Node du serveur écrit « Sat 3 Oct » et Chrome « Sat, 3 Oct »
// — et au format long avec l'année, c'est l'inverse qui porte la virgule. Chacun suit
// sa version des données Unicode, Safari et Firefox la leur. Une page rendue
// par le serveur puis reprise par le navigateur voyait donc son texte changer
// sous elle, et React jetait tout l'arbre pour le reconstruire.
//
// Le français, lui, ne varie pas ; mais une seule écriture pour les deux
// langues vaut mieux que deux régimes. Les noms suivent ceux d'Unicode, pour
// que rien ne change à l'œil : « sam. 3 oct. », « Sat 3 Oct ».

const JOURS: Record<Langue, { court: string[]; long: string[] }> = {
  fr: {
    court: ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."],
    long: ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"],
  },
  en: {
    court: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    long: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  },
};

const MOIS: Record<Langue, { court: string[]; long: string[] }> = {
  fr: {
    court: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."],
    long: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
  },
  en: {
    court: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"],
    long: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  },
};

/** « sam. 3 oct. », « Sat 3 Oct ». Heure locale, comme `getDate`. */
export function dateAvecJour(d: Date, langue: Langue = "fr"): string {
  return `${JOURS[langue].court[d.getDay()]} ${d.getDate()} ${MOIS[langue].court[d.getMonth()]}`;
}

/** « samedi 3 octobre 2026 », « Saturday 3 October 2026 » ; l'année sur demande. */
export function dateAvecJourLong(d: Date, langue: Langue = "fr", { annee = false }: { annee?: boolean } = {}): string {
  const base = `${JOURS[langue].long[d.getDay()]} ${d.getDate()} ${MOIS[langue].long[d.getMonth()]}`;
  return annee ? `${base} ${d.getFullYear()}` : base;
}
