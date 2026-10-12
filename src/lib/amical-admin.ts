import { TEAM_SIZE_OPTIONS } from "@/lib/competition-format";

// ============================================
// L'amical que l'administration ajoute elle-même : ce que le formulaire
// envoie, relu champ par champ.
//
// Module pur : le formulaire et la route le partagent, et il se vérifie sans
// base (voir scripts/test-passes-changements-fusion.ts). L'écriture vit dans
// lib/amical-admin-server.
// ============================================

export interface AmicalAdmin {
  homeTeamId: string;
  /** Un club de la plateforme, ou "" quand l'adversaire n'y est pas. */
  awayTeamId: string;
  /** Le nom de l'adversaire hors plateforme. Vide quand `awayTeamId` est donné. */
  awayName: string;
  date: string;
  time: string;
  venueName: string;
  venueCity: string;
  format: string;
}

/** Les formats proposés : le même NvN qu'une compétition. */
export const FORMATS_AMICAL = TEAM_SIZE_OPTIONS.map((n) => `${n}v${n}`);

const ID = /^[A-Za-z0-9_-]{1,128}$/;

const texte = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : "");

/** « AAAA-MM-JJ », et un jour qui existe : le 31 février n'en est pas un. */
function jourValide(x: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
  const d = new Date(`${x}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === x;
}

function heureValide(x: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(x);
  return !!m && Number(m[1]) < 24 && Number(m[2]) < 60;
}

/**
 * Relit le corps reçu. `aujourdhui` vient de l'appelant, en « AAAA-MM-JJ » :
 * on programme un match à venir, et un amical déjà joué se renseigne par un
 * autre parcours (voir /api/matches/record).
 */
export function lireAmicalAdmin(
  corps: unknown,
  aujourdhui: string,
): { valeur: AmicalAdmin } | { erreur: string } {
  const c = (corps && typeof corps === "object" ? corps : {}) as Record<string, unknown>;

  const homeTeamId = texte(c.homeTeamId, 128);
  if (!ID.test(homeTeamId)) return { erreur: "Choisis l'équipe à domicile." };

  const awayTeamId = texte(c.awayTeamId, 128);
  if (awayTeamId && !ID.test(awayTeamId)) return { erreur: "Adversaire invalide." };
  if (awayTeamId === homeTeamId) return { erreur: "Un club ne joue pas contre lui-même." };

  const awayName = awayTeamId ? "" : texte(c.awayName, 80);
  if (!awayTeamId && !awayName) return { erreur: "Indique l'adversaire : un club, ou son nom." };

  const date = texte(c.date, 10);
  if (!jourValide(date)) return { erreur: "Date invalide." };
  if (date < aujourdhui) return { erreur: "Cette date est déjà passée." };

  const time = texte(c.time, 5);
  if (!heureValide(time)) return { erreur: "Heure invalide." };

  const format = c.format === undefined || c.format === null ? "11v11" : texte(c.format, 10);
  if (!FORMATS_AMICAL.includes(format)) return { erreur: "Format de jeu invalide." };

  return {
    valeur: {
      homeTeamId, awayTeamId, awayName, date, time,
      venueName: texte(c.venueName, 120),
      venueCity: texte(c.venueCity, 80),
      format,
    },
  };
}
