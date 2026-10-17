// ============================================
// La feuille de secours au dossard.
//
// Une équipe arrive sans effectif saisi : la console exigeait les deux
// feuilles validées pour lancer, et le match n'était pas couvert. Le scoreur
// peut désormais tirer des lignes « N°9 » : il voit le numéro sur le
// maillot, et « le n°9 a marqué » est un fait vrai — contrairement à un
// prénom inventé, qui aurait été publié comme un buteur qui n'existe pas.
//
// UNE LIGNE AU DOSSARD N'EST PERSONNE tant qu'on ne l'a pas nommée : hors
// classements, hors homme du match, non revendicable. Son préfixe le dit,
// comme celui des « Joueur 9 » d'un adversaire hors plateforme (voir
// lib/effectif-match).
//
// LA NOMMER LUI DONNE UN AUTRE IDENTIFIANT. C'est l'exception assumée au
// principe de lib/fusion-import (« la ligne garde son identifiant ») : les
// matchs déjà joués sont réécrits de toute façon, pour le nom, et l'identifiant
// suit dans la même écriture. La ligne devient alors une ligne saisie à la
// main comme une autre — elle entre au classement, se revendique, et l'import
// d'un club peut la reprendre.
//
// Module pur : la console, la route /api/competitions/dossards et la suite de
// tests partagée (mobile/src/__tests__) s'en servent sans Firebase.
// ============================================

import type { CompPlayer, FirestoreLineupEntry } from "@/types";

/** Les dossards qu'on peut tirer : du 1 au 25. */
export const DOSSARD_MAX = 25;

const PREFIXE_DOSSARD = "dos-";

/** Cette ligne est-elle un dossard que personne n'a encore nommé ? */
export const estLigneDossard = (playerId: string | null | undefined): boolean =>
  !!playerId?.startsWith(PREFIXE_DOSSARD);

/**
 * L'identifiant d'un dossard dans une équipe. Déterministe : tirer deux fois
 * le n°9 de la même équipe donne la même ligne, jamais un doublon. L'équipe y
 * figure parce qu'un match oppose deux n°9, et qu'une feuille se cherche
 * parfois par identifiant seul.
 */
export const idDossard = (teamId: string, numero: number): string =>
  `${PREFIXE_DOSSARD}${teamId}-${numero}`;

/** « N°9 », quelle que soit la catégorie : le numéro est la seule chose qu'on sait. */
export function libelleDossard(numero: number | string): string {
  return `N°${numero}`;
}

/**
 * Les dossards à proposer : du 1 au 25, sauf les numéros déjà portés par
 * l'effectif. Le scoreur complète ainsi une équipe venue à onze avec six
 * joueurs saisis, sans créer un second n°7 à côté du vrai.
 */
export function lignesDeSecours(
  teamId: string,
  effectif: Pick<CompPlayer, "id" | "number">[],
): CompPlayer[] {
  const pris = new Set(effectif.map((l) => String(l.number ?? "").trim()).filter(Boolean));
  const ids = new Set(effectif.map((l) => l.id));
  const lignes: CompPlayer[] = [];
  for (let n = 1; n <= DOSSARD_MAX; n++) {
    const id = idDossard(teamId, n);
    if (pris.has(String(n)) || ids.has(id)) continue;
    lignes.push({ id, name: libelleDossard(n), number: String(n) });
  }
  return lignes;
}

/**
 * Les numéros arrivés d'un navigateur, relus : des entiers de 1 à 25, sans
 * doublon. `null` si la liste est vide ou si l'un d'eux n'en est pas un.
 */
export function lireNumeros(brut: unknown): number[] | null {
  if (!Array.isArray(brut) || brut.length === 0 || brut.length > DOSSARD_MAX) return null;
  const numeros = new Set<number>();
  for (const x of brut) {
    const n = typeof x === "number" ? x : Number.parseInt(String(x), 10);
    if (!Number.isInteger(n) || n < 1 || n > DOSSARD_MAX) return null;
    numeros.add(n);
  }
  return [...numeros].sort((a, b) => a - b);
}

// ---- Nommer un dossard après coup --------------------------------------------

/** Ce qu'on lit d'un match de compétition pour y renommer une ligne. */
export interface MatchARenommer {
  home_lineup?: FirestoreLineupEntry[] | null;
  away_lineup?: FirestoreLineupEntry[] | null;
  home_on_pitch?: string[] | null;
  away_on_pitch?: string[] | null;
  mvp_player_id?: string | null;
  live_state?: {
    events?: Record<string, unknown>[] | null;
    tirs_au_but?: { tirs?: { playerId?: string | null; playerName?: string | null }[] | null } | null;
  } | null;
}

/** Les paires identifiant / nom d'un événement qui désignent un joueur. */
const CHAMPS_JOUEUR = [
  ["player_id", "player_name"],
  ["assist_player_id", "assist_player_name"],
  ["victim_player_id", "victim_player_name"],
  ["out_player_id", "out_player_name"],
] as const;

/**
 * `ancien` remplacé par `nouveau` dans un texte, mais pas comme début d'un
 * autre dossard : renommer « N°1 » ne doit pas faire de « N°14 »
 * un « Kossi4 ».
 */
function remplacerNom(texte: string, ancien: string, nouveau: string): string {
  let sortie = "";
  let i = 0;
  for (let j = texte.indexOf(ancien); j !== -1; j = texte.indexOf(ancien, i)) {
    const suivant = texte.charAt(j + ancien.length);
    const auMilieuDUnNumero = suivant >= "0" && suivant <= "9";
    sortie += texte.slice(i, j) + (auMilieuDUnNumero ? ancien : nouveau);
    i = j + ancien.length;
  }
  return sortie + texte.slice(i);
}

/**
 * Ce qu'il faut écrire sur un match pour que la ligne `ancien` y devienne
 * `nouveau` : les feuilles, la pelouse, chaque événement, la séance de tirs au
 * but et l'homme du match. Les clés sont des chemins Firestore
 * (`live_state.events`), pour ne pas écraser le reste de l'état du direct.
 *
 * `ancienNom` sert au `detail` d'un remplacement, qui écrit les deux noms en
 * toutes lettres (« N°9 → N°14 »). `null` quand le match ne désigne pas la
 * ligne.
 */
export function renommerDansLeMatch(
  match: MatchARenommer,
  ancien: string,
  nouveau: { id: string; nom: string },
  ancienNom: string,
): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};

  for (const cote of ["home_lineup", "away_lineup"] as const) {
    const feuille = match[cote] ?? [];
    if (!feuille.some((e) => e.player_id === ancien)) continue;
    patch[cote] = feuille.map((e) =>
      e.player_id === ancien ? { ...e, player_id: nouveau.id, name: nouveau.nom } : e,
    );
  }

  for (const cote of ["home_on_pitch", "away_on_pitch"] as const) {
    const ids = match[cote] ?? [];
    if (ids.includes(ancien)) patch[cote] = ids.map((id) => (id === ancien ? nouveau.id : id));
  }

  const events = match.live_state?.events ?? [];
  if (events.some((e) => CHAMPS_JOUEUR.some(([id]) => e[id] === ancien))) {
    patch["live_state.events"] = events.map((e) => {
      if (!CHAMPS_JOUEUR.some(([id]) => e[id] === ancien)) return e;
      const copie: Record<string, unknown> = { ...e };
      for (const [id, nom] of CHAMPS_JOUEUR) {
        if (copie[id] === ancien) {
          copie[id] = nouveau.id;
          copie[nom] = nouveau.nom;
        }
      }
      if (typeof copie.detail === "string" && ancienNom) {
        copie.detail = remplacerNom(copie.detail, ancienNom, nouveau.nom);
      }
      return copie;
    });
  }

  const tirs = match.live_state?.tirs_au_but?.tirs ?? [];
  if (tirs.some((t) => t.playerId === ancien)) {
    patch["live_state.tirs_au_but.tirs"] = tirs.map((t) =>
      t.playerId === ancien ? { ...t, playerId: nouveau.id, playerName: nouveau.nom } : t,
    );
  }

  if (match.mvp_player_id === ancien) {
    patch.mvp_player_id = nouveau.id;
    patch.mvp_player_name = nouveau.nom;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}
