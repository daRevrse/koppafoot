import type { CompetitionFeed } from "@/lib/direct-shared";
import { API_URL } from "~/lib/config";

/**
 * Au-delà, on arrête d'attendre. `fetch` n'a aucun délai de lui-même : sur un
 * réseau qui rame, le squelette resterait affiché sans message ni bouton.
 */
export const DELAI_DU_DIRECT = 30_000;

/** GET /api/direct : le tableau tel que la page d'accueil du site l'affiche. */
export async function chargerDirect(): Promise<CompetitionFeed[]> {
  const interruption = new AbortController();
  const minuteur = setTimeout(() => interruption.abort(), DELAI_DU_DIRECT);
  try {
    const reponse = await fetch(`${API_URL}/api/direct`, { signal: interruption.signal });
    if (!reponse.ok) throw new Error(`/api/direct : ${reponse.status}`);
    const json = (await reponse.json()) as { board?: CompetitionFeed[] };
    return json.board ?? [];
  } finally {
    clearTimeout(minuteur);
  }
}

/** L'attente avant un nouvel essai, après `echecs` échecs de suite : le forfait compte. */
export function delaiDuNouvelEssai(echecs: number): number {
  return Math.min(15_000 * 2 ** (echecs - 1), 300_000);
}
