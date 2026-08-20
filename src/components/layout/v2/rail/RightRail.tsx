"use client";

import { usePathname } from "next/navigation";
import MovementsRail from "./MovementsRail";
import NewsRail from "./NewsRail";
import TodayMatchesRail from "./TodayMatchesRail";
import PerformanceRail from "./PerformanceRail";

// ============================================
// RightRail, ce qui occupe la colonne de droite, selon la page.
//
// La colonne de 320px était tenue ouverte et vide depuis le retrait du rail
// Tribune (voir ScoreShell) : la garder évitait de re-flower tout le produit,
// mais une gouttière vide n'est pas une décision, c'est une dette. Elle
// devient ici un emplacement contextuel, chaque page peut y poser ce qui
// l'accompagne sans encombrer sa propre colonne de lecture.
//
// Le choix se fait sur le chemin plutôt que par une prop passée depuis la
// page : dans l'App Router le layout enveloppe la page, donc une page ne peut
// pas alimenter le shell qui la contient sans passer par un slot parallèle.
// Un aiguillage à un seul endroit coûte moins cher que ça, tant que la liste
// reste courte.
//
// Une page sans module rend `null` : la gouttière reste ouverte et muette,
// exactement comme avant.
// ============================================

/**
 * Vrai quand la route rend elle-meme sa colonne de droite. Une page match a
 * besoin des donnees du match pour remplir son rail, et dans l'App Router une
 * page ne peut pas alimenter le layout qui l'enveloppe : elle porte donc son
 * rail dans sa propre grille, et le shell referme sa gouttiere pour ne pas
 * reserver 320px par-dessus.
 */
export function routeOwnsItsRail(pathname: string): boolean {
  return /^\/c\/[^/]+$/.test(pathname)
    || /^\/c\/[^/]+\/matches\/[^/]+$/.test(pathname)
    || /^\/c\/[^/]+\/teams\/[^/]+$/.test(pathname)
    // Une competition mondiale n'a pas de rail du tout : sans cette ligne le
    // shell lui reservait quand meme 320px, et cette colonne blanche vide
    // etait le seul « rail » qu'on y voyait.
    || /^\/competitions\/monde\/[^/]+$/.test(pathname)
    || /^\/matches\/[^/]+$/.test(pathname);
}

export default function RightRail() {
  const pathname = usePathname();

  // Le Direct porte ce qui se lit a cote d'un tableau de scores : ce que la
  // presse ecrit, et qui a signe ou. Pas de pronostic ici, il appartient a
  // la page d'un match, la ou on sait de quelle rencontre on parle.
  if (pathname === "/") {
    return (
      <div className="space-y-8">
        <NewsRail />
        <MovementsRail max={5} />
      </div>
    );
  }
  if (pathname === "/mercato") return <MovementsRail />;

  // La page Actus : ce qui se joue pendant qu'on lit.
  if (pathname === "/actus") return <TodayMatchesRail />;

  // Les fiches publiques : ce que cette equipe, ce joueur, a fait recemment.
  // L'identifiant se lit dans le chemin, le rail est monte par le shell, il
  // n'a pas acces aux donnees de la page.
  const team = pathname.match(/^\/teams\/([^/]+)$/);
  if (team) return <PerformanceRail team={team[1]} />;

  const player = pathname.match(/^\/profile\/([^/]+)$/);
  if (player) return <PerformanceRail player={player[1]} />;

  return null;
}
