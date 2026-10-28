import {
  MATCHS_NOTES_CLASSEMENT, classementPar,
  type LigneJoueurPubliee, type TriClassement,
} from "@/lib/classement";
import { API_URL } from "~/lib/config";

// Le classement des joueurs (/top-players du site, ClassementComplet) : une
// seule liste, gardiens compris, triée sur la note ou sur les buts et passes.
// Le filtre montre les gardiens entre eux avec leur rang dans la liste
// commune, et la liste se lit dix lignes à la fois, comme sur le site.

export type FiltreClassement = "tous" | "joueurs" | "gardiens";

export const PAR_PAGE = 10;

/** GET /api/rankings : le classement que le site recalcule à la fin de chaque match. */
export async function chargerClassement(): Promise<LigneJoueurPubliee[]> {
  const reponse = await fetch(`${API_URL}/api/rankings`);
  if (!reponse.ok) throw new Error(`/api/rankings : ${reponse.status}`);
  const json = (await reponse.json()) as { joueurs?: LigneJoueurPubliee[] };
  return json.joueurs ?? [];
}

/**
 * Tant que personne n'a assez de matchs notés — les premières semaines —, le
 * tri par note serait une page vide : on ouvre alors sur les buts et passes.
 */
export function triDOuverture(joueurs: LigneJoueurPubliee[]): TriClassement {
  return classementPar(joueurs, "note").length === 0 && classementPar(joueurs, "contribution").length > 0
    ? "contribution"
    : "note";
}

export interface PageDuClassement {
  lignes: LigneJoueurPubliee[];
  /** Les lignes de la sélection, toutes pages confondues. */
  total: number;
  /** La page montrée, bornée : 0 en tête. */
  page: number;
  pages: number;
  /** Les positions de la première et de la dernière ligne de la page, à partir de 1. */
  premier: number;
  dernier: number;
}

/**
 * Une page de la sélection. La page est bornée ici : changer de tri depuis la
 * page 7 d'un classement qui n'en compte que 2 ne doit pas vider l'écran.
 */
export function pageDuClassement(
  joueurs: LigneJoueurPubliee[], tri: TriClassement, filtre: FiltreClassement, page: number,
): PageDuClassement {
  const selection = classementPar(joueurs, tri).filter((l) =>
    filtre === "tous" ? true : filtre === "gardiens" ? l.gardien : !l.gardien,
  );
  const pages = Math.max(1, Math.ceil(selection.length / PAR_PAGE));
  const sure = Math.min(Math.max(page, 0), pages - 1);
  const lignes = selection.slice(sure * PAR_PAGE, (sure + 1) * PAR_PAGE);
  return {
    lignes, total: selection.length, page: sure, pages,
    premier: sure * PAR_PAGE + 1, dernier: sure * PAR_PAGE + lignes.length,
  };
}

/** Les deux lignes d'une sélection vide : le classement entier, ou ce tri et ce filtre. */
export function messageVide(nombreDeJoueurs: number, tri: TriClassement): [string, string] {
  if (nombreDeJoueurs === 0) return ["Le classement se remplit à la fin de chaque match.", "Personne n'y figure encore."];
  return [
    tri === "note"
      ? `Personne ici n'a encore ${MATCHS_NOTES_CLASSEMENT} matchs notés.`
      : "Personne ici n'a encore marqué ni fait marquer.",
    "Essaie l'autre tri, ou un autre filtre.",
  ];
}
