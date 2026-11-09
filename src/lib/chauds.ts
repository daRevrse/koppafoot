import { derniersResultats } from "@/lib/forme";
import type { CompMatch } from "@/types";

// ============================================
// Les matchs « chauds » : ceux qu'un organisateur met en tête des matchs mis
// en avant de l'accueil Direct (lib/direct-shared, `chaudsEnTete`). Voir
// docs/superpowers/specs/2026-10-22-matchs-chauds-design.md.
//
// L'ORGANISATEUR DÉCIDE, LA MACHINE SUGGÈRE. Les suggestions sont les matchs
// à venir où les deux équipes arrivent le plus en forme : la forme d'une
// équipe, c'est sa moyenne de points (3 la victoire, 1 le nul) sur ses cinq
// derniers matchs de la compétition avant celui-là (lib/forme), et une
// rencontre vaut la PLUS FAIBLE des deux — un choc oppose deux équipes en
// forme, pas une équipe en feu à la lanterne rouge.
//
// DEUX MATCHS CHAUDS À VENIR AU PLUS PAR COMPÉTITION : sans limite, un seul
// tournoi occuperait toutes les places de l'accueil.
//
// Module pur : aucun SDK.
// ============================================

export const CHAUDS_PAR_COMPETITION = 2;

/** Combien de matchs en suggestion. */
export const SUGGESTIONS = 3;

/** Une forme ne dit rien avant deux matchs joués : pas de suggestion. */
const JOUES_MIN = 2;

/** Un match qui peut encore être chaud : à venir ou en direct. */
export function estAVenir(m: Pick<CompMatch, "status">): boolean {
  return m.status === "scheduled" || m.status === "live";
}

/** Les matchs chauds qui comptent : à venir ou en direct. */
export function chaudsAVenir(matchs: CompMatch[]): CompMatch[] {
  return matchs.filter((m) => m.chaud && estAVenir(m));
}

/**
 * La flamme de ce match est-elle disponible ? Toujours pour l'éteindre ; pour
 * l'allumer, seulement sur un match à venir, et tant que la compétition n'a
 * pas déjà ses deux matchs chauds.
 */
export function peutMarquerChaud(matchs: CompMatch[], match: CompMatch): boolean {
  if (match.chaud) return true;
  return estAVenir(match) && chaudsAVenir(matchs).length < CHAUDS_PAR_COMPETITION;
}

/** La forme d'une équipe avant ce match : sa moyenne de points, et sur combien de matchs. */
export function formeDe(matchs: CompMatch[], equipe: string, avant: CompMatch): { moyenne: number; joues: number } {
  const r = derniersResultats(matchs, equipe, avant);
  if (r.length === 0) return { moyenne: 0, joues: 0 };
  const points = r.reduce((s, x) => s + (x.resultat === "V" ? 3 : x.resultat === "N" ? 1 : 0), 0);
  return { moyenne: points / r.length, joues: r.length };
}

const cleDeTemps = (m: CompMatch) => `${m.date ?? "9999-99-99"}T${m.time || "99:99"}`;

/**
 * Les matchs à venir à proposer comme chauds, les plus chauds d'abord : la
 * forme de la rencontre (la plus faible des deux), puis le plus proche dans
 * le temps, les matchs sans date à la fin. Ni un match déjà chaud, ni un
 * match d'une date passée, ni une place encore à déterminer, ni une équipe qui
 * n'a pas joué deux matchs.
 */
export function suggererChocs(
  matchs: CompMatch[],
  aujourdhui: string,
  combien = SUGGESTIONS,
): { match: CompMatch; forme: number }[] {
  return matchs
    .filter((m) => m.status === "scheduled" && !m.chaud && m.homeTeamId && m.awayTeamId
      && (m.date == null || m.date >= aujourdhui))
    .map((m) => {
      const dom = formeDe(matchs, m.homeTeamId!, m);
      const ext = formeDe(matchs, m.awayTeamId!, m);
      return { match: m, forme: Math.min(dom.moyenne, ext.moyenne), assez: dom.joues >= JOUES_MIN && ext.joues >= JOUES_MIN };
    })
    .filter((s) => s.assez)
    .sort((a, b) => b.forme - a.forme || cleDeTemps(a.match).localeCompare(cleDeTemps(b.match)))
    .slice(0, combien)
    .map(({ match, forme }) => ({ match, forme }));
}

// ============================================
// AVANT LE COUP D'ENVOI : le compte à rebours de la carte mise en avant.
//
// Un match chaud se voyait à une flamme de 14 pixels, et c'était tout : rien
// ne disait QUAND il fallait être là. Le bandeau de sa carte porte désormais
// le temps qui reste — « dans 2 h 15 », « J-3 » — ce qui est la seule chose
// qui fait venir quelqu'un au bord du terrain.
//
// L'heure d'un match s'écrit à l'heure de Lomé (UTC+0), et se lit ici à
// l'heure de l'appareil : le public est au Togo, et la carte dit ce que dit
// le calendrier.
// ============================================

export type AvantLeCoupDEnvoi =
  | { type: "direct" }
  /** L'heure est passée et personne n'a lancé la console : ça commence. */
  | { type: "imminent" }
  /** Moins de 24 heures : le décompte en minutes. */
  | { type: "minutes"; n: number }
  /** Aujourd'hui, sans heure connue. */
  | { type: "aujourdhui" }
  /** Plus loin : le nombre de jours, « J-n ». */
  | { type: "jours"; n: number };

const cleLocale = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Jours entiers entre deux clés « AAAA-MM-JJ », sans souci d'heure d'été. */
function joursEntre(de: string, a: string): number {
  const ms = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))
    - Date.UTC(+de.slice(0, 4), +de.slice(5, 7) - 1, +de.slice(8, 10));
  return Math.round(ms / 86_400_000);
}

/**
 * Ce qui reste avant le coup d'envoi, ou `null` quand il n'y a rien à dire :
 * un match sans date, joué, annulé, ou d'une date passée.
 */
export function avantLeCoupDEnvoi(
  m: Pick<CompMatch, "status" | "date" | "time">,
  maintenant: Date,
): AvantLeCoupDEnvoi | null {
  if (m.status === "live") return { type: "direct" };
  if (m.status !== "scheduled" || !m.date) return null;
  const aujourdhui = cleLocale(maintenant);
  if (m.date < aujourdhui) return null;

  if (m.time && /^\d{1,2}:\d{2}$/.test(m.time)) {
    const coup = new Date(`${m.date}T${m.time.padStart(5, "0")}:00`);
    const ms = coup.getTime() - maintenant.getTime();
    if (Number.isNaN(ms)) return null;
    if (ms <= 0) return { type: "imminent" };
    if (ms < 24 * 3_600_000) return { type: "minutes", n: Math.ceil(ms / 60_000) };
  } else if (m.date === aujourdhui) {
    return { type: "aujourdhui" };
  }
  return { type: "jours", n: Math.max(1, joursEntre(aujourdhui, m.date)) };
}

// ============================================
// LES NOTIFICATIONS D'AVANT MATCH, leurs mots. Le serveur les envoie
// (lib/chauds-serveur) ; leurs textes vivent ici pour être vérifiés sans base.
//
// DEUX MOMENTS, PAS PLUS :
//  - L'ANNONCE, quand l'organisateur allume la flamme : « voilà le match à ne
//    pas manquer ». Une fois par match, même s'il éteint et rallume.
//  - LE RAPPEL DU MATIN, le jour du match (tâche de 6 h) : « c'est
//    aujourd'hui, à telle heure, à tel endroit ». Une fois par date : un
//    match reporté se rappelle à sa nouvelle date.
// Un match chaud allumé le jour même n'a que son annonce : deux messages en
// quelques heures pour le même match apprennent à couper les notifications.
// ============================================

type MatchAnnonce = {
  homeTeamName: string;
  awayTeamName: string;
  date: string | null;
  time: string | null;
  venueName?: string | null;
};

const heureLisible = (t: string | null) => (t ? t.replace(":", "h") : null);

/** « samedi 14 novembre », d'une clé « AAAA-MM-JJ ». */
export function jourEnToutesLettres(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

/** L'annonce d'un match chaud, à la flamme allumée. */
export function texteAnnonceChaud(m: MatchAnnonce, competition: string, aujourdhui: string): { title: string; body: string } {
  const affiche = `${m.homeTeamName} – ${m.awayTeamName}`;
  const heure = heureLisible(m.time);
  const quand = !m.date
    ? null
    : m.date === aujourdhui
      ? `aujourd'hui${heure ? ` à ${heure}` : ""}`
      : `${jourEnToutesLettres(m.date)}${heure ? ` à ${heure}` : ""}`;
  return {
    title: `🔥 Match à ne pas manquer · ${competition}`.slice(0, 120),
    body: `${affiche}${quand ? `, ${quand}` : ""}${m.venueName ? `, ${m.venueName}` : ""}. Suis-le en direct sur KoppaFoot.`.slice(0, 300),
  };
}

/** Le rappel du matin d'un match chaud. */
export function texteRappelChaud(m: MatchAnnonce, competition: string): { title: string; body: string } {
  const heure = heureLisible(m.time);
  return {
    title: `🔥 C'est aujourd'hui : ${m.homeTeamName} – ${m.awayTeamName}`.slice(0, 120),
    body: `${heure ? `Coup d'envoi à ${heure}` : "Le match à ne pas manquer se joue aujourd'hui"}${m.venueName ? `, ${m.venueName}` : ""}. ${competition}, à suivre en direct sur KoppaFoot.`.slice(0, 300),
  };
}
