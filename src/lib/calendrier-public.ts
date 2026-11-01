import type { CompMatch } from "@/types";

// ============================================
// L'ordre du calendrier public d'une compétition (onglet Calendrier de
// /c/[slug]).
//
// AUJOURD'HUI ET LA SUITE D'ABORD. Le calendrier rangeait les journées de la
// plus ancienne à la plus récente : à mi-parcours d'un tournoi, la page
// s'ouvrait sur les résultats du premier dimanche, et les matchs du jour
// attendaient tout en bas. Demande du propriétaire du produit, 2026-11-01 :
// la priorité aux matchs d'aujourd'hui et à venir.
//
// Deux parties, donc :
//   — « à venir » : aujourd'hui (matchs finis compris : c'est la journée en
//     cours), puis les jours suivants dans l'ordre, puis les matchs sans date ;
//   — « joués » : les jours passés, le plus récent d'abord.
// Dans un jour, les matchs restent dans l'ordre de leur heure.
//
// UN MATCH EN DIRECT EST TOUJOURS DEVANT, même daté de la veille : un coup
// d'envoi tardif peut passer minuit. Son jour rejoint les matchs à venir.
//
// Module pur : la page et scripts/test-calendrier-public.ts s'en servent.
// ============================================

export interface JourDuCalendrierPublic {
  /** « AAAA-MM-JJ », ou `null` pour les matchs dont la date reste à fixer. */
  date: string | null;
  matchs: CompMatch[];
}

/** Par heure, les matchs sans heure à la fin. « HH:mm » se trie comme une chaîne. */
const parHeure = (a: CompMatch, b: CompMatch): number => {
  if (a.time == null || b.time == null) return a.time == null ? (b.time == null ? 0 : 1) : -1;
  return a.time.localeCompare(b.time);
};

/**
 * Les jours du calendrier, rangés pour qu'on lise d'abord ce qui se joue.
 * `aujourdhui` est la date du jour à Lomé (voir `jourDeLome`), passée par
 * l'appelant pour que la règle se vérifie sans horloge.
 */
export function calendrierParPriorite(
  matchs: CompMatch[],
  aujourdhui: string,
): { aVenir: JourDuCalendrierPublic[]; joues: JourDuCalendrierPublic[] } {
  const parJour = new Map<string | null, CompMatch[]>();
  for (const m of matchs) {
    const cle = m.date ?? null;
    parJour.set(cle, [...(parJour.get(cle) ?? []), m]);
  }

  const aVenir: JourDuCalendrierPublic[] = [];
  const joues: JourDuCalendrierPublic[] = [];
  for (const [date, liste] of parJour) {
    const jour = { date, matchs: [...liste].sort(parHeure) };
    const enCours = date === null || date >= aujourdhui || liste.some((m) => m.status === "live");
    (enCours ? aVenir : joues).push(jour);
  }

  aVenir.sort((a, b) => (a.date === null ? 1 : b.date === null ? -1 : a.date.localeCompare(b.date)));
  joues.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return { aVenir, joues };
}
