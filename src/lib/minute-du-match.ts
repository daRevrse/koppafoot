// ============================================
// La minute d'un match, telle qu'on l'ecrit au bord du terrain.
//
// LE TEMPS ADDITIONNEL S'ECRIT 45+2', ET NON 47'. Les faits sont stockes avec
// leur periode et la minute du chrono — un but a 46:30 de la premiere
// mi-temps porte « 47 » — et on les affichait tels quels : « 47' », c'est-a-
// dire le meme numero qu'une action du debut de la seconde mi-temps. Le fil
// d'un match les melangeait, et un supporter lisait un but de la seconde
// periode la ou il avait ete marque juste avant la pause.
//
// La notation se CALCULE, rien n'est reecrit : la periode dit quelle fin
// reglementaire on a depassee, la duree du format dit ou elle tombe. Les
// matchs deja joues en profitent sans migration.
//
// Une seule fonction pour tous ceux qui ecrivent une minute — la console, les
// notifications, le fil public, le Direct et l'app mobile — sans quoi l'un
// d'eux finirait par ecrire « 47' » a cote d'un autre qui ecrit « 45+2' ».
// ============================================

/**
 * La minute reglementaire ou s'acheve la periode, ou `null` quand la periode
 * n'en a pas : la pause, la fin du match, une periode inconnue.
 */
function finReglementaire(periode: number | null | undefined, dureeMiTempsMin: number): number | null {
  if (periode === 1) return dureeMiTempsMin;
  if (periode === 3) return dureeMiTempsMin * 2;
  return null;
}

/** Une minute de match prete a lire : « 12' », « 45+2' ». */
export function libelleMinute(
  periode: number | null | undefined,
  minute: number,
  dureeMiTempsMin: number,
  prime: string = "'",
): string {
  const fin = finReglementaire(periode, dureeMiTempsMin);
  if (fin !== null && minute > fin) return `${fin}+${minute - fin}${prime}`;
  return `${minute}${prime}`;
}

/**
 * Ce qu'affiche un match en direct a la place de sa minute.
 *
 * « AVANT » : le direct est ouvert, le chrono n'a jamais tourne. Le Direct
 * affichait « 1' » sur un match dont le coup d'envoi n'avait pas eu lieu.
 *
 * « PAUSE » : la mi-temps. Le chrono y est fige a 45:00, que la formule lisait
 * comme la 46e minute — le Direct annoncait donc « 46' » pendant toute la
 * pause.
 */
export type MinuteEnDirect =
  | { genre: "avant" }
  | { genre: "pause" }
  /**
   * Orage, incident : le seul arret de jeu qui se montre au public. Le chrono
   * s'y arrete, et sans le dire on verrait une minute figee sans raison.
   */
  | { genre: "interrompu" }
  | { genre: "jeu"; minute: number; plus: number };

/** Ce que `minuteEnDirect` lit d'un match : son statut et son horloge. */
interface HorlogeDuMatch {
  status: string;
  liveState?: {
    currentPeriod?: number | null;
    isTimerRunning?: boolean | null;
    timerStartAt?: string | null;
    timerOffset?: number | null;
    /** L'etat du jeu, quand la console l'a pose. Voir lib/etat-du-jeu. */
    jeu?: { raison: string | null } | null;
  } | null;
}

/**
 * La minute d'un match en direct, lue sur l'horloge du serveur
 * (`timerStartAt` + `timerOffset`), jamais sur un compteur local.
 *
 * `null` pour un match sans horloge : un match du monde, dont la minute vient
 * d'ailleurs, ou un document incomplet.
 */
export function minuteEnDirect(
  m: HorlogeDuMatch,
  dureeMiTempsMin: number,
  maintenant: number = Date.now(),
): MinuteEnDirect | null {
  const ls = m.liveState;
  if (!ls) return null;
  if (ls.jeu?.raison === "interruption") return { genre: "interrompu" };
  if (ls.jeu?.raison === "avant") return { genre: "avant" };
  if (ls.currentPeriod === 2) return { genre: "pause" };

  const offset = ls.timerOffset || 0;
  const tourne = m.status === "live" && !!ls.isTimerRunning && !!ls.timerStartAt;
  if (!tourne && offset === 0) return { genre: "avant" };

  const ecoule = tourne
    ? maintenant - new Date(ls.timerStartAt as string).getTime() + offset
    : offset;
  const minute = Math.floor(ecoule / 60_000) + 1;
  const fin = finReglementaire(ls.currentPeriod, dureeMiTempsMin);
  if (fin !== null && minute > fin) return { genre: "jeu", minute: fin, plus: minute - fin };
  return { genre: "jeu", minute, plus: 0 };
}

/** La minute en direct, en texte. Les libelles viennent de la page (langue). */
export function texteMinute(
  m: MinuteEnDirect,
  libelles: { avant: string; pause: string; interrompu: string },
  prime: string = "′",
): string {
  if (m.genre === "avant") return libelles.avant;
  if (m.genre === "pause") return libelles.pause;
  if (m.genre === "interrompu") return libelles.interrompu;
  return m.plus > 0 ? `${m.minute}+${m.plus}${prime}` : `${m.minute}${prime}`;
}
