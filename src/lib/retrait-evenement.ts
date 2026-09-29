import type { CompMatch } from "@/types";

// ============================================
// Retirer un événement de la console : ce qui part avec lui.
//
// RIEN NE SE RETIRAIT. Un joueur touché par erreur, une faute en trop, un
// carton donné au mauvais : tout restait dans l'historique, et de là dans les
// statistiques, les notes, la forme et le classement. Le seul recours était la
// VAR sur le dernier but, et seulement en compétition.
//
// UN ÉVÉNEMENT NE PART PAS SEUL quand d'autres écritures tiennent sur lui. Ce
// module dit lesquelles, et il est pur : la console s'en sert pour le bouton
// « Annuler » comme pour la corbeille de l'historique, et chaque pilote
// n'a plus qu'à écrire le plan qu'il reçoit.
//
//   but        → le score perd un point (sauf un but déjà refusé par la VAR,
//                qui l'a perdu à ce moment-là) ; son passeur part avec lui.
//   jaune      → s'il a provoqué une exclusion (second jaune), le rouge
//                automatique part aussi, et le joueur revient sur la pelouse.
//   rouge      → le joueur revient sur la pelouse ; un rouge de second jaune
//                emporte ce second jaune, sans quoi il resterait deux jaunes
//                sans exclusion.
//   changement → l'entrant ressort, le sortant revient. REFUSÉ quand la
//                pelouse a bougé depuis : le défaire mettrait douze joueurs
//                sur le terrain, ou en ferait revenir un qui n'y est plus.
//   le reste   → lui seul.
// ============================================

export type Evenement = NonNullable<CompMatch["liveState"]>["events"][number];
type Cote = "home" | "away";

/** Le `detail` du rouge que la console pose d'elle-même au second jaune. */
export const DETAIL_SECOND_JAUNE = "2e carton jaune";

export interface PlanDeRetrait {
  /** Ce qui part : l'événement touché, et ce qui ne tient pas sans lui. */
  ids: string[];
  /** Ce que chaque camp perd au tableau d'affichage (0 ou négatif). */
  score: { home: number; away: number };
  /** La pelouse d'un camp après le retrait, quand elle change. */
  surLeTerrain: Partial<Record<Cote, string[]>>;
}

export type ResultatRetrait =
  | { ok: true; plan: PlanDeRetrait }
  | { ok: false; raison: string };

export function planDuRetrait(
  events: Evenement[],
  eventId: string,
  contexte: { homeTeamId: string | null; surLeTerrain: Record<Cote, string[]> },
): ResultatRetrait {
  const cible = events.find((e) => e.id === eventId);
  if (!cible) return { ok: false, raison: "Cet événement n'est plus dans l'historique." };

  const cote: Cote = cible.teamId === contexte.homeTeamId ? "home" : "away";
  const plan: PlanDeRetrait = { ids: [cible.id], score: { home: 0, away: 0 }, surLeTerrain: {} };

  const remettreSurLaPelouse = (playerId: string | null | undefined) => {
    if (!playerId) return;
    const pelouse = plan.surLeTerrain[cote] ?? contexte.surLeTerrain[cote];
    if (!pelouse.includes(playerId)) plan.surLeTerrain[cote] = [...pelouse, playerId];
  };

  switch (cible.type) {
    case "goal":
      if (cible.varStatus !== "cancelled") plan.score[cote] -= 1;
      break;

    case "yellow_card": {
      const rougeAuto = events.find(
        (e) => e.type === "red_card" && e.playerId === cible.playerId && e.detail === DETAIL_SECOND_JAUNE,
      );
      if (rougeAuto) {
        plan.ids.push(rougeAuto.id);
        remettreSurLaPelouse(cible.playerId);
      }
      break;
    }

    case "red_card": {
      if (cible.detail === DETAIL_SECOND_JAUNE) {
        // Le jaune qui l'a déclenché : le dernier du joueur avant ce rouge.
        const avant = events.slice(0, events.indexOf(cible));
        const secondJaune = [...avant].reverse().find(
          (e) => e.type === "yellow_card" && e.playerId === cible.playerId,
        );
        if (secondJaune) plan.ids.push(secondJaune.id);
      }
      remettreSurLaPelouse(cible.playerId);
      break;
    }

    case "substitution": {
      const entrant = cible.playerId;
      const sortant = cible.outPlayerId;
      if (!entrant || !sortant) {
        return { ok: false, raison: "Ce changement est trop ancien pour être défait ici." };
      }
      const pelouse = contexte.surLeTerrain[cote];
      if (!pelouse.includes(entrant) || pelouse.includes(sortant)) {
        return {
          ok: false,
          raison: "La pelouse a changé depuis ce remplacement : retire d'abord ce qui l'a suivi.",
        };
      }
      plan.surLeTerrain[cote] = [...pelouse.filter((id) => id !== entrant), sortant];
      break;
    }

    default:
      break;
  }

  return { ok: true, plan };
}

/** « But de K. Dossou », pour la confirmation et le message qui la suit. */
export function libelleDuRetrait(plan: PlanDeRetrait, events: Evenement[]): string | null {
  const emportes = plan.ids.length - 1;
  if (emportes <= 0) return null;
  const autres = events.filter((e) => plan.ids.slice(1).includes(e.id));
  if (autres.some((e) => e.type === "red_card")) return "l'exclusion qu'il avait provoquée part avec lui";
  if (autres.some((e) => e.type === "yellow_card")) return "le second jaune qui l'avait provoquée part avec elle";
  return null;
}

/**
 * Le push qui corrige un retrait, ou `null` quand il n'y a rien à corriger.
 *
 * Les abonnés ont reçu « ⚽ BUT ! » ou « 🟥 Carton rouge » à la seconde de la
 * saisie. Retiré ensuite — « Annuler », ou la corbeille de l'historique —, le
 * but disparaissait du tableau mais restait sur leur écran verrouillé, sans
 * démenti. On ne corrige que ce qui a été annoncé : un but (sauf un but déjà
 * refusé par la VAR, dont le refus est parti à ce moment-là) et une exclusion.
 * Un jaune seul ne sonne plus, son retrait non plus.
 *
 * `score` est le score AVANT le retrait, tel que la console l'affiche.
 */
export function annonceDuRetrait(
  plan: PlanDeRetrait,
  events: Evenement[],
  match: { homeTeamId: string | null; homeTeamName: string; awayTeamName: string; score: { home: number; away: number } },
): { title: string; body: string } | null {
  const partis = events.filter((e) => plan.ids.includes(e.id));
  const nom = (e: Evenement) => e.playerName || (e.teamId === match.homeTeamId ? match.homeTeamName : match.awayTeamName);

  const but = partis.find((e) => e.type === "goal" && e.varStatus !== "cancelled");
  if (but) {
    const home = match.score.home + plan.score.home;
    const away = match.score.away + plan.score.away;
    return {
      title: "↩️ But annulé",
      body: `Le but de ${nom(but)} ne compte pas. ${match.homeTeamName} ${home} – ${away} ${match.awayTeamName}`,
    };
  }

  const rouge = partis.find((e) => e.type === "red_card");
  if (rouge) {
    return { title: "↩️ Exclusion annulée", body: `${nom(rouge)} n'est pas exclu.` };
  }
  return null;
}
