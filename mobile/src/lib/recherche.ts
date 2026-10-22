import type { Competition } from "@/types";
import { competitionsPubliques, rechercher } from "~/lib/annuaire";

// La recherche de l'en-tête (components/layout/MobileSearchOverlay du site) :
// les compétitions, filtrées sur place, et les clubs, avec un compte. Les
// joueurs ne se cherchent pas, sur le site non plus.

/** Le site attend deux lettres avant de chercher. */
export const rechercheLancee = (terme: string) => terme.trim().length >= 2;

const MAX = 8;

export function competitionsTrouvees(toutes: Competition[], terme: string): Competition[] {
  return rechercher(competitionsPubliques(toutes), terme).slice(0, MAX);
}

/** Ce qu'il faut d'un club pour le montrer : lu du document `teams`, sans le reste. */
export interface ClubTrouve {
  id: string;
  nom: string;
  ville: string | null;
  logo: string | null;
  /** Un club « fantôme » (créé pour une feuille de match) n'a pas de fiche à montrer. */
  fantome: boolean;
  recrute: boolean;
}

const plier = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** La règle de `findTeams` du site : le nom et la ville, sans les fantômes, ceux qui recrutent d'abord. */
export function clubsTrouves(clubs: ClubTrouve[], terme: string): ClubTrouve[] {
  const q = plier(terme.trim());
  if (!q) return [];
  return clubs
    .filter((c) => !c.fantome && plier(`${c.nom} ${c.ville ?? ""}`).includes(q))
    .sort((a, b) => Number(b.recrute) - Number(a.recrute) || a.nom.localeCompare(b.nom))
    .slice(0, MAX);
}
