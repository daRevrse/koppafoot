// ============================================
// La mesure d'audience, la partie pure.
//
// Combien de visites ont reçu les pages d'une compétition et chaque fiche de
// match, combien de personnes suivaient un direct à chaque minute. Voir
// docs/superpowers/specs/2026-10-16-mesure-audience-design.md.
//
// UN DOCUMENT PAR APPAREIL, PAR JOUR ET PAR PAGE CIBLE :
// `audience/{cible}/sessions/{jour}_{appareil}`. Chaque appareil n'écrit que
// le sien, aucun compteur partagé ne sature. L'identifiant d'appareil change
// chaque jour : rien ne relie deux journées, ni une visite à un compte.
//
// Aucun SDK ici : le navigateur (lib/audience-client), le serveur
// (lib/audience-serveur) et la suite de tests partagée s'en servent.
// ============================================

import { jourDeLome } from "@/lib/jour";

/** D'où vient une visite : l'appli, un QR code, un lien partagé depuis KoppaFoot, ou autre. */
export type Via = "app" | "qr" | "partage" | "autre";
export const VIAS: readonly Via[] = ["app", "qr", "partage", "autre"] as const;

/** Les minutes de direct qu'une session retient, au plus : un match prolongé tient en 150. */
export const MINUTES_MAX = 300;

/** Un spectateur compte « maintenant » si son dernier signe de vie date de moins que ça. */
export const FENETRE_MAINTENANT_MS = 2 * 60_000;

/** Combien de jours on garde le détail par appareil avant de le résumer (lot 4). */
export const RETENTION_JOURS = 30;

/**
 * Le premier jour de collecte. Avant lui il n'y a rien, et un écran doit le
 * dire : un chiffre faible la première semaine n'est pas un tournoi sans public.
 */
export const DEBUT_MESURE = "20261017";

/** « 17 octobre 2026 », pour dire depuis quand on mesure. */
export function jourLisible(jour: string): string {
  const d = new Date(Date.UTC(Number(jour.slice(0, 4)), Number(jour.slice(4, 6)) - 1, Number(jour.slice(6, 8))));
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * Un nombre à la française, une décimale au plus : « 62,3 », « 1 284 ». Les
 * espaces insécables deviennent des espaces simples : le rapport PDF n'a pas
 * leur glyphe dans la police Outfit.
 */
export function nombreFr(x: number): string {
  return x.toLocaleString("fr-FR", { maximumFractionDigits: 1 }).replace(/[  ]/g, " ");
}

/** « 16:42 », l'heure de Lomé d'une minute du mur. */
export function heureDeMinute(minute: number): string {
  return new Date(minute * 60_000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

// ---- Les cibles -----------------------------------------------------------------

export const cibleCompetition = (cid: string): string => `comp-${cid}`;
export const cibleMatch = (mid: string): string => `match-${mid}`;

/** Ce que désigne une cible, ou `null` si elle n'a pas la forme attendue. */
export function lireCible(cible: string): { genre: "competition" | "match"; id: string } | null {
  const m = /^(comp|match)-([A-Za-z0-9]{1,40})$/.exec(cible);
  if (!m) return null;
  return { genre: m[1] === "comp" ? "competition" : "match", id: m[2] };
}

// ---- Le temps -------------------------------------------------------------------

/** Le jour en `AAAAMMJJ`, à l'heure de Lomé comme le reste du produit (voir lib/jour). */
export const jourAudience = (date: Date = new Date()): string => jourDeLome(date).replace(/-/g, "");

/** La minute du mur : minutes depuis l'époque Unix. */
export const minuteDe = (ms: number): number => Math.floor(ms / 60_000);

/** Le jour `AAAAMMJJ` qui précède `jour` de `n` jours. */
export function jourMoins(jour: string, n: number): string {
  const d = new Date(Date.UTC(Number(jour.slice(0, 4)), Number(jour.slice(4, 6)) - 1, Number(jour.slice(6, 8))));
  d.setUTCDate(d.getUTCDate() - n);
  return jourAudience(d);
}

// ---- L'appareil du jour ---------------------------------------------------------

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const RE_APPAREIL = /^[a-z0-9]{16}$/;

export function nouvelAppareil(alea: () => number = Math.random): string {
  let s = "";
  for (let i = 0; i < 16; i++) s += ALPHABET[Math.floor(alea() * ALPHABET.length)];
  return s;
}

/** Ce que le navigateur garde dans son stockage local (`koppafoot:audience`). */
export interface AppareilStocke {
  jour: string;
  appareil: string;
  /** Les cibles dont la session du jour existe déjà : on l'incrémente au lieu de la créer. */
  cibles: string[];
}

/**
 * L'appareil de ce jour : celui du stockage s'il date d'aujourd'hui, un neuf
 * sinon. Un identifiant d'hier ne sert jamais une seconde journée.
 */
export function appareilDuJour(
  stocke: unknown,
  jour: string,
  nouveau: () => string = nouvelAppareil,
): AppareilStocke {
  const s = stocke as Partial<AppareilStocke> | null;
  if (s && s.jour === jour && typeof s.appareil === "string" && RE_APPAREIL.test(s.appareil)) {
    return {
      jour,
      appareil: s.appareil,
      cibles: Array.isArray(s.cibles) ? s.cibles.filter((c): c is string => typeof c === "string").slice(-200) : [],
    };
  }
  return { jour, appareil: nouveau(), cibles: [] };
}

export const idSession = (jour: string, appareil: string): string => `${jour}_${appareil}`;

/**
 * Un lien vers une page mesurée, marqué de sa provenance : le bouton de
 * partage, le QR code, l'appli. C'est ce que `lireVia` relit à l'arrivée.
 */
export function avecVia(url: string, via: Exclude<Via, "autre">): string {
  return `${url}${url.includes("?") ? "&" : "?"}via=${via}`;
}

/** Le `?via=` que posent nos propres liens ; tout le reste est « autre ». */
export function lireVia(param: string | null | undefined): Via {
  return VIAS.includes(param as Via) ? (param as Via) : "autre";
}

// ---- La lecture -----------------------------------------------------------------

/** Une session telle que le serveur la lit (lib/audience-serveur). */
export interface SessionLue {
  jour: string;
  vues: number;
  minutes: number[];
  via: Via;
  connecte: boolean;
  /** Le dernier signe de vie, en millisecondes. */
  derniereMs: number | null;
  /** La compétition d'un match de compétition, `null` pour un amical ou une page de compétition. */
  cid: string | null;
}

/** Une session écrite par un navigateur, relue sans lui faire confiance. */
export function lireSession(brut: Record<string, unknown>): SessionLue | null {
  const jour = typeof brut.jour === "string" && /^[0-9]{8}$/.test(brut.jour) ? brut.jour : null;
  if (!jour) return null;
  const minutes = Array.isArray(brut.minutes)
    ? brut.minutes.filter((m): m is number => Number.isInteger(m)).slice(0, MINUTES_MAX)
    : [];
  const derniere = brut.derniere as { toMillis?: () => number } | null | undefined;
  return {
    jour,
    vues: Number.isInteger(brut.vues) && (brut.vues as number) > 0 ? (brut.vues as number) : 1,
    minutes,
    via: lireVia(typeof brut.via === "string" ? brut.via : null),
    connecte: brut.connecte === true,
    derniereMs: typeof derniere?.toMillis === "function" ? derniere.toMillis() : null,
    cid: typeof brut.cid === "string" && brut.cid ? brut.cid : null,
  };
}

export interface JourDeVisites {
  jour: string;
  visites: number;
  vues: number;
}

/** Visites et vues jour par jour, dans l'ordre. */
export function visitesParJour(sessions: SessionLue[]): JourDeVisites[] {
  const parJour = new Map<string, JourDeVisites>();
  for (const s of sessions) {
    const j = parJour.get(s.jour) ?? { jour: s.jour, visites: 0, vues: 0 };
    j.visites += 1;
    j.vues += s.vues;
    parJour.set(s.jour, j);
  }
  return [...parJour.values()].sort((a, b) => a.jour.localeCompare(b.jour));
}

export interface PointDeCourbe {
  /** Minute du mur, voir `minuteDe`. */
  minute: number;
  /** Appareils dont la page était visible pendant cette minute. */
  spectateurs: number;
}

/**
 * La courbe d'un direct, minute par minute. Une minute sans personne au
 * milieu du match y figure à zéro : un trou dans la courbe dit quelque chose.
 */
export function courbe(sessions: SessionLue[]): PointDeCourbe[] {
  const parMinute = new Map<number, number>();
  for (const s of sessions) {
    for (const m of new Set(s.minutes)) parMinute.set(m, (parMinute.get(m) ?? 0) + 1);
  }
  if (parMinute.size === 0) return [];
  const minutes = [...parMinute.keys()];
  const debut = Math.min(...minutes);
  const fin = Math.max(...minutes);
  const points: PointDeCourbe[] = [];
  for (let m = debut; m <= fin; m++) points.push({ minute: m, spectateurs: parMinute.get(m) ?? 0 });
  return points;
}

/** Le pic de spectateurs simultanés, et sa première minute. */
export function pic(points: PointDeCourbe[]): PointDeCourbe | null {
  let meilleur: PointDeCourbe | null = null;
  for (const p of points) if (p.spectateurs > 0 && (!meilleur || p.spectateurs > meilleur.spectateurs)) meilleur = p;
  return meilleur;
}

/** Le temps moyen passé sur un direct, en minutes, parmi ceux qui l'ont suivi. */
export function tempsMoyen(sessions: SessionLue[]): number {
  const suivis = sessions.map((s) => new Set(s.minutes).size).filter((n) => n > 0);
  if (suivis.length === 0) return 0;
  return Math.round((suivis.reduce((a, b) => a + b, 0) / suivis.length) * 10) / 10;
}

/**
 * Les spectateurs du moment : ceux dont la dernière minute de direct est
 * récente. La minute et non le dernier signe de vie : rouvrir la fiche d'un
 * match fini fait un signe de vie, pas un spectateur.
 */
export function spectateursMaintenant(sessions: SessionLue[], maintenantMs: number = Date.now()): number {
  const seuil = minuteDe(maintenantMs - FENETRE_MAINTENANT_MS);
  return sessions.filter((s) => s.minutes.length > 0 && Math.max(...s.minutes) >= seuil).length;
}

export interface ResumeAudience {
  visites: number;
  vues: number;
  parJour: JourDeVisites[];
  provenance: Record<Via, number>;
  /** Visites faites avec un compte connecté. */
  connectees: number;
  courbe: PointDeCourbe[];
  pic: PointDeCourbe | null;
  tempsMoyenMin: number;
}

/** Tout ce qu'un écran ou un rapport montre d'une cible, à partir de ses sessions. */
export function resumer(sessions: SessionLue[]): ResumeAudience {
  const provenance = Object.fromEntries(VIAS.map((v) => [v, 0])) as Record<Via, number>;
  for (const s of sessions) provenance[s.via] += 1;
  const points = courbe(sessions);
  return {
    visites: sessions.length,
    vues: sessions.reduce((a, s) => a + s.vues, 0),
    parJour: visitesParJour(sessions),
    provenance,
    connectees: sessions.filter((s) => s.connecte).length,
    courbe: points,
    pic: pic(points),
    tempsMoyenMin: tempsMoyen(sessions),
  };
}

/** Le premier jour d'une période d'affichage, `null` pour « depuis le début ». */
export type Periode = "7j" | "30j" | "tout";
export function lirePeriode(brut: string | null | undefined): Periode {
  return brut === "7j" || brut === "tout" ? brut : "30j";
}
export function debutDePeriode(periode: Periode, aujourdhui: string = jourAudience()): string | null {
  if (periode === "tout") return null;
  return jourMoins(aujourdhui, periode === "7j" ? 6 : 29);
}

// ---- Ce que lisent les écrans et le rapport ---------------------------------------
//
// Calculé par lib/audience-serveur, une fois pour l'administration, la page
// des organisateurs et le PDF.

export interface MatchAudience {
  cible: string;
  mid: string;
  cid: string | null;
  /** « FC Alpha – Beta Club ». */
  affiche: string;
  date: string | null;
  heure: string | null;
  statut: string;
  visites: number;
  pic: PointDeCourbe | null;
  tempsMoyenMin: number;
  /** Spectateurs du moment, quand le match est en cours ; 0 sinon. */
  maintenant: number;
}

export interface JourDeCompetition {
  jour: string;
  /** Visites des pages de la compétition. */
  pages: number;
  /** Visites des fiches de ses matchs. */
  matchs: number;
}

export interface AudienceDeCompetition {
  cid: string;
  nom: string;
  slug: string;
  logo: string | null;
  organisateur: string | null;
  periode: Periode;
  /** Le premier jour compté : le début de la période, ou celui de la mesure s'il est plus récent. */
  depuis: string;
  parJour: JourDeCompetition[];
  provenance: Record<Via, number>;
  matchs: MatchAudience[];
  totaux: {
    visitesPages: number;
    visitesMatchs: number;
    /** Le plus haut pic de spectateurs simultanés, et le match où il a eu lieu. */
    pic: (PointDeCourbe & { mid: string; affiche: string }) | null;
    tempsMoyenMin: number;
    /** Part des visites venues de l'appli, de 0 à 1. */
    partAppli: number;
    /** Part des visites faites avec un compte connecté, de 0 à 1. */
    partConnectee: number;
    abonnes: number;
    maintenant: number;
  };
}

export interface ButSurLaCourbe {
  /** Minute du mur où le but a été saisi. */
  minute: number;
  /** « 67' Kossi ». */
  libelle: string;
  cote: "home" | "away";
}

export interface AudienceDeMatch {
  cible: string;
  mid: string;
  cid: string | null;
  affiche: string;
  date: string | null;
  heure: string | null;
  statut: string;
  competition: { nom: string; slug: string } | null;
  resume: ResumeAudience;
  maintenant: number;
  buts: ButSurLaCourbe[];
}

export interface DirectAudience {
  total: number;
  matchs: { cible: string; mid: string; cid: string | null; affiche: string; spectateurs: number }[];
}

export interface PanoramaAudience {
  periode: Periode;
  depuis: string;
  visitesCompetitions: number;
  visitesMatchs: number;
  provenance: Record<Via, number>;
  competitions: { cid: string; nom: string; visites: number; visitesMatchs: number; pic: number }[];
  matchs: MatchAudience[];
  direct: DirectAudience;
}

/** Le premier jour compté d'une période : jamais avant le début de la mesure. */
export function depuisDePeriode(periode: Periode, aujourdhui: string = jourAudience()): string {
  const debut = debutDePeriode(periode, aujourdhui);
  return !debut || debut < DEBUT_MESURE ? DEBUT_MESURE : debut;
}

// ---- Le résumé quotidien (lot 4) ---------------------------------------------------
//
// Le détail par appareil se garde RETENTION_JOURS jours. Chaque nuit, la tâche
// planifiée recopie dans `audience/{cible}` ce qu'il faut pour toujours : les
// visites jour par jour, et la courbe d'un match. Puis elle efface les
// sessions trop vieilles. Les lectures combinent les deux : les sessions pour
// les jours récents, le résumé pour les autres.

export interface JourStocke {
  visites: number;
  vues: number;
  connectees: number;
  via: Record<Via, number>;
}

/** Ce que porte `audience/{cible}`, écrit par le serveur seul. */
export interface ResumeStocke {
  par_jour?: Record<string, JourStocke>;
  /** Minute du mur → spectateurs, pour un match. */
  courbe?: Record<string, number> | null;
  temps_moyen?: number | null;
  /** Abonnés d'une compétition, photographiés chaque nuit. */
  abonnes?: Record<string, number>;
}

/**
 * Le résumé à écrire, à partir des sessions encore là et du résumé déjà
 * stocké. Les jours terminés seulement : aujourd'hui n'est pas fini. Un jour
 * déjà résumé et dont les sessions sont encore là est recalculé, ce qui rend la
 * tâche rejouable sans compter deux fois.
 */
export function resumeAStocker(
  sessions: SessionLue[],
  existant: ResumeStocke | null,
  aujourdhui: string,
): Pick<ResumeStocke, "par_jour" | "courbe" | "temps_moyen"> {
  const parJour: Record<string, JourStocke> = { ...(existant?.par_jour ?? {}) };
  const recalcules = new Set<string>();
  for (const s of sessions) {
    if (s.jour >= aujourdhui) continue;
    if (!recalcules.has(s.jour)) {
      recalcules.add(s.jour);
      parJour[s.jour] = { visites: 0, vues: 0, connectees: 0, via: Object.fromEntries(VIAS.map((v) => [v, 0])) as Record<Via, number> };
    }
    const j = parJour[s.jour];
    j.visites += 1;
    j.vues += s.vues;
    if (s.connecte) j.connectees += 1;
    j.via[s.via] += 1;
  }
  // La courbe d'un match se joue sur une soirée : tant qu'il reste des minutes
  // en sessions, elles font foi ; une fois purgées, la courbe stockée reste.
  const points = courbe(sessions);
  const courbeStockee = points.length > 0
    ? Object.fromEntries(points.map((p) => [String(p.minute), p.spectateurs]))
    : existant?.courbe ?? null;
  return {
    par_jour: parJour,
    courbe: courbeStockee,
    temps_moyen: points.length > 0 ? tempsMoyen(sessions) : existant?.temps_moyen ?? null,
  };
}

/**
 * Ce que montre un écran : les sessions pour les jours encore détaillés, le
 * résumé pour les jours plus anciens (à partir de `depuis`). Les deux ne se
 * recouvrent jamais : un jour qui a encore ses sessions ne se lit pas dans le
 * résumé.
 */
export function avecLeResume(
  sessions: SessionLue[],
  stocke: ResumeStocke | null,
  depuis: string,
): ResumeAudience {
  const r = resumer(sessions);
  if (!stocke) return r;
  const joursDetailles = new Set(sessions.map((s) => s.jour));
  const anciens = Object.entries(stocke.par_jour ?? {})
    .filter(([jour]) => jour >= depuis && !joursDetailles.has(jour));
  const parJour = [...r.parJour];
  const provenance = { ...r.provenance };
  let visites = r.visites;
  let vues = r.vues;
  let connectees = r.connectees;
  for (const [jour, j] of anciens) {
    parJour.push({ jour, visites: j.visites, vues: j.vues });
    visites += j.visites;
    vues += j.vues;
    connectees += j.connectees;
    for (const v of VIAS) provenance[v] += j.via?.[v] ?? 0;
  }
  parJour.sort((a, b) => a.jour.localeCompare(b.jour));

  let points = r.courbe;
  let moyen = r.tempsMoyenMin;
  if (points.length === 0 && stocke.courbe) {
    points = Object.entries(stocke.courbe)
      .map(([m, n]) => ({ minute: Number(m), spectateurs: n }))
      .filter((p) => Number.isInteger(p.minute))
      .sort((a, b) => a.minute - b.minute);
    moyen = stocke.temps_moyen ?? 0;
  }
  return { visites, vues, parJour, provenance, connectees, courbe: points, pic: pic(points), tempsMoyenMin: moyen };
}
