// ============================================
// Le poste d'un joueur, en un seul vocabulaire.
//
// IL Y EN AVAIT TROIS, pour la même information. Le formulaire d'inscription
// écrivait l'anglais typé (`goalkeeper`), la page effectif d'une compétition
// écrivait le français d'un `<select>` (« Gardien »), et l'import TSV
// recopiait la troisième colonne telle quelle, sans rien contrôler. Sur les
// 121 lignes d'effectif de la base au 2026-09-02 : 80 vides, 38 en français,
// 3 en anglais. Impossible, dans cet état, de répondre à « qui est le gardien
// de ce match », ce que la console et le classement des gardiens demandent
// tous les deux.
//
// La forme CANONIQUE est l'anglais typé. Ce n'est pas un choix de goût : c'est
// déjà la forme obligatoire de `GhostPlayer.position`, le seul endroit du
// produit où le poste ne soit jamais vide, et celle que le formulaire
// d'inscription pose. Le français reste ce qu'il aurait toujours dû être, un
// libellé d'affichage.
//
// `normaliserPoste` lit TOUT ce qui traîne en base — l'anglais, le français
// accentué ou non, les initiales G/D/M/A de la feuille de match papier — et
// rend la forme canonique, ou null. Rien n'est migré : on normalise à la
// lecture, parce qu'une migration ne couvrirait pas les lignes que l'import
// TSV continuera d'écrire de travers.
// ============================================

import type { Langue } from "@/i18n/config";

export type Poste = "goalkeeper" | "defender" | "midfielder" | "forward";

/** Du but vers l'attaque, l'ordre dans lequel une feuille de match se lit. */
export const POSTES: readonly Poste[] = [
  "goalkeeper", "defender", "midfielder", "forward",
] as const;

export const LIBELLES_POSTE: Record<Langue, Record<Poste, string>> = {
  fr: {
    goalkeeper: "Gardien",
    defender: "Défenseur",
    midfielder: "Milieu",
    forward: "Attaquant",
  },
  en: {
    goalkeeper: "Goalkeeper",
    defender: "Defender",
    midfielder: "Midfielder",
    forward: "Forward",
  },
};

/** Le français, pour les écrans qui ne parlent encore que lui. */
export const LIBELLE_POSTE = LIBELLES_POSTE.fr;

/**
 * L'initiale portée par le maillot sur le terrain : G, D, M, A.
 *
 * ELLE NE SE TRADUIT PAS. C'est aussi une clé : la composition type la relit
 * sur le terrain pour retrouver le poste (voir CompositionsTypes). Pour un
 * lecteur anglais, `INITIALES_POSTE` ci-dessous.
 */
export const INITIALE_POSTE: Record<Poste, string> = {
  goalkeeper: "G",
  defender: "D",
  midfielder: "M",
  forward: "A",
};

/** L'initiale à AFFICHER : G, D, M, A en français ; GK, DF, MF, FW en anglais. */
export const INITIALES_POSTE: Record<Langue, Record<Poste, string>> = {
  fr: INITIALE_POSTE,
  en: { goalkeeper: "GK", defender: "DF", midfielder: "MF", forward: "FW" },
};

/**
 * Les orthographes acceptées, dans l'ordre où on les essaie.
 *
 * L'ordre compte : « défenseur central » contient « central » comme
 * « avant-centre » contient « centre », et « milieu offensif » ne doit pas
 * tomber en attaque. On teste donc du plus spécifique au plus vague, poste
 * par poste, et le premier qui répond gagne.
 */
const MOTIFS: readonly (readonly [Poste, readonly string[]])[] = [
  ["goalkeeper", ["goalkeeper", "gardien", "keeper", "goalie", "portier", "goal", "gk"]],
  ["defender", ["defender", "defenseur", "defense", "arriere", "lateral", "central", "back", "def"]],
  ["midfielder", ["midfielder", "midfield", "milieu", "recuperateur", "meneur", "relayeur", "mid"]],
  ["forward", ["forward", "striker", "attaquant", "attaque", "avant", "ailier", "buteur", "att"]],
] as const;

/** Les initiales de la feuille de match papier, essayées en dernier recours. */
const INITIALES: Record<string, Poste> = {
  g: "goalkeeper",
  d: "defender",
  m: "midfielder",
  a: "forward",
};

/** « Défenseur » et « defenseur » sont le même mot ; les accents partent. */
function sansAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/**
 * Le poste canonique derrière ce qu'on a sous la main, ou null.
 *
 * Null est un résultat normal, pas une erreur : deux tiers des lignes
 * d'effectif n'ont pas de poste, et un joueur sans poste reste un joueur. Les
 * appelants affichent alors le joueur sans étiquette plutôt que de deviner.
 */
export function normaliserPoste(brut: string | null | undefined): Poste | null {
  if (!brut) return null;
  const s = sansAccents(brut.trim().toLowerCase());
  if (s === "") return null;

  for (const [poste, motifs] of MOTIFS) {
    if (motifs.some((m) => s.includes(m))) return poste;
  }

  // Une seule lettre, et seulement une : « a » est un attaquant, mais
  // « arriere » est un défenseur, et il a déjà été attrapé au-dessus.
  return s.length === 1 ? INITIALES[s] ?? null : null;
}

/** Vrai si ce poste, sous n'importe laquelle de ses orthographes, est le but. */
export function estGardien(brut: string | null | undefined): boolean {
  return normaliserPoste(brut) === "goalkeeper";
}

/** Le libellé à afficher, ou la saisie d'origine si elle est illisible. */
export function libellePoste(brut: string | null | undefined, langue: Langue = "fr"): string | null {
  const poste = normaliserPoste(brut);
  if (poste) return LIBELLES_POSTE[langue][poste];
  const reste = brut?.trim();
  return reste ? reste : null;
}
