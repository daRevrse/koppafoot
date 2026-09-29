import { OWN_GOAL_DETAIL, type TypeEvenement } from "@/lib/evenements";

// ============================================
// Ce qu'un match a fait de chaque joueur, pour le raconter ailleurs que dans
// le fil.
//
// LA COMPOSITION NE RACONTAIT RIEN. Onze pastilles, les mêmes avant et après
// le match : le buteur du doublé, l'expulsé de la 40e et le titulaire sorti à
// la pause s'y lisaient pareil, et le remplaçant entré pour marquer restait
// sur le banc. Le fil avait tout, dans l'ordre des minutes ; ce module le
// range par joueur, pour que le terrain porte ses marques.
//
// PAR IDENTIFIANT DE FEUILLE, jamais par nom. Deux « Mensah » dans un même
// match ne sont pas rares, et c'est l'identifiant que la console écrit sur
// chaque fait (voir LiveMatchConsole). Un fait sans identifiant — saisi avant
// qu'il existe, ou d'une équipe hors plateforme — ne marque personne.
//
// Pur et sans SDK, comme le reste de ce qui lit des événements : la fiche
// publique, la console et les tests en partagent la règle.
// ============================================

/** Ce que ce module lit d'un événement, et rien de plus. */
export interface FaitRaconte {
  type: TypeEvenement;
  minute: number;
  playerId?: string | null;
  playerName?: string | null;
  detail?: string | null;
  assistPlayerId?: string | null;
  outPlayerId?: string | null;
  outPlayerName?: string | null;
  varStatus?: string | null;
}

/** Les marques d'un joueur. Une minute à 0 est une minute inconnue. */
export interface MarquesJoueur {
  /** Ses buts, contre son camp exclus. Un but refusé par la VAR ne compte pas. */
  buts: number;
  /** Les buts qu'il a marqués contre son propre camp. */
  csc: number;
  passes: number;
  jaunes: number;
  rouge: boolean;
  /** La minute de sa (dernière) sortie, ou `null` s'il n'est pas sorti. */
  sortieA: number | null;
  /** La minute de sa (première) entrée, ou `null` s'il n'est pas entré en jeu. */
  entreeA: number | null;
}

const VIERGE: MarquesJoueur = {
  buts: 0, csc: 0, passes: 0, jaunes: 0, rouge: false, sortieA: null, entreeA: null,
};

/** Les marques de chaque joueur qui en a, par identifiant de feuille. */
export function marquesDesJoueurs(faits: readonly FaitRaconte[]): Record<string, MarquesJoueur> {
  const marques: Record<string, MarquesJoueur> = {};
  const de = (id: string | null | undefined): MarquesJoueur | null => {
    if (!id) return null;
    marques[id] ??= { ...VIERGE };
    return marques[id];
  };

  // Dans l'ordre des minutes : une sortie après une entrée est la dernière
  // sortie, et c'est elle que le banc doit dire.
  const ordonnes = [...faits].sort((a, b) => (a.minute || 0) - (b.minute || 0));
  for (const f of ordonnes) {
    switch (f.type) {
      case "goal": {
        if (f.varStatus === "cancelled") break;
        if (f.detail === OWN_GOAL_DETAIL) {
          const m = de(f.playerId);
          if (m) m.csc += 1;
          break;
        }
        const m = de(f.playerId);
        if (m) m.buts += 1;
        const passeur = de(f.assistPlayerId);
        if (passeur) passeur.passes += 1;
        break;
      }
      case "yellow_card": {
        const m = de(f.playerId);
        if (m) m.jaunes += 1;
        break;
      }
      case "red_card": {
        const m = de(f.playerId);
        if (m) m.rouge = true;
        break;
      }
      case "substitution": {
        const entrant = de(f.playerId);
        if (entrant && entrant.entreeA === null) entrant.entreeA = f.minute;
        const sortant = de(f.outPlayerId);
        if (sortant) sortant.sortieA = f.minute;
        break;
      }
      default:
        break;
    }
  }
  return marques;
}

/** « 2 buts · 1 passe », ou `null` quand il n'y a rien à dire. */
export function motifDesMarques(m: MarquesJoueur | null | undefined, langue: "fr" | "en" = "fr"): string | null {
  if (!m) return null;
  const morceaux: string[] = [];
  if (langue === "en") {
    if (m.buts > 0) morceaux.push(`${m.buts} goal${m.buts === 1 ? "" : "s"}`);
    if (m.passes > 0) morceaux.push(`${m.passes} assist${m.passes === 1 ? "" : "s"}`);
    return morceaux.length > 0 ? morceaux.join(" · ") : null;
  }
  if (m.buts > 0) morceaux.push(`${m.buts} but${m.buts > 1 ? "s" : ""}`);
  if (m.passes > 0) morceaux.push(`${m.passes} passe${m.passes > 1 ? "s" : ""}`);
  return morceaux.length > 0 ? morceaux.join(" · ") : null;
}

/**
 * Qui entre, et qui sort.
 *
 * La console écrit l'entrant dans `player_name` et le sortant dans
 * `out_player_name` ; avant ce champ, les deux n'étaient que dans le texte de
 * `detail`, « Sortant → Entrant ». On lit l'un, sinon l'autre. `null` quand on
 * ne sait nommer ni l'un ni l'autre.
 */
export function joueursDuRemplacement(
  f: Pick<FaitRaconte, "playerName" | "outPlayerName" | "detail">,
): { entre: string; sort: string } | null {
  const [avant, apres] = String(f.detail ?? "").split(" → ").map((s) => s.trim());
  const entre = f.playerName?.trim() || (apres ?? "");
  const sort = f.outPlayerName?.trim() || (apres !== undefined ? avant : "");
  if (!entre && !sort) return null;
  return { entre, sort };
}
