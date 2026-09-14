"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

// ============================================
// « L'affiche est-elle passée sous la barre ? »
//
// Une page qui ouvre sur un grand visuel — le tableau d'affichage d'un match,
// la fiche d'un joueur — replie ce visuel en une barre compacte dès qu'on l'a
// dépassé : le nom, le retour, l'essentiel. Reste à savoir QUAND.
//
// LE REPLI SUIT L'AFFICHE, PAS LA POSITION DE DÉFILEMENT. Un seuil en pixels
// (« replier après 300 px ») tombe juste sur une seule hauteur d'affiche et
// une seule taille d'écran ; un observateur d'intersection prévient quand
// l'affiche a réellement glissé sous la barre, et rien ne tourne entre deux.
//
// LE PLAFOND EST MESURÉ, PAS CALCULÉ. Il additionne le header de
// l'application — dont la hauteur change au point de rupture, et qui peut
// être absent —, la barre elle-même, et la marge de la barre d'état du
// téléphone. Un offset écrit à la main tombe juste sur la machine de celui
// qui l'a mesuré. L'observateur se rebranche au redimensionnement, parce que
// tout cela change avec la fenêtre.
//
// Ce calcul vivait dans MatchHero. La fiche de joueur en a eu besoin à son
// tour, et deux copies d'un observateur d'intersection, c'est deux
// comportements qui divergent au premier ajustement.
// ============================================

export function useReplieAuDefilement(
  /** La barre compacte : son bas est le plafond. */
  barre: RefObject<HTMLElement | null>,
  /** L'affiche qu'on surveille. */
  affiche: RefObject<HTMLElement | null>,
  /**
   * À brancher quand les deux éléments sont VRAIMENT dans le document.
   *
   * Une `ref` est stable : l'effet qui la lit ne se relance jamais tout seul.
   * Sur une page qui rend `null` le temps de charger — une fiche de joueur,
   * par exemple — l'effet tournait donc une fois, ne trouvait rien, et
   * abandonnait définitivement : la barre ne se repliait plus jamais. Passer
   * ici de quoi dire « c'est affiché » relance l'observateur au bon moment.
   */
  actif: boolean = true,
): boolean {
  const [replie, setReplie] = useState(false);
  // L'état lu dans l'effet sans le relancer : le brancher sur `replie`
  // rebrancherait l'observateur à chaque bascule.
  const dernier = useRef(false);

  useEffect(() => {
    if (!actif) return;
    const cible = affiche.current;
    const bandeau = barre.current;
    if (!cible || !bandeau) return;
    let observateur: IntersectionObserver | null = null;

    const brancher = () => {
      observateur?.disconnect();
      // Le bas de la barre, DÉPLIÉE ou non : une fois repliée elle a sa
      // hauteur de barre, et c'est bien celle-là qu'on veut.
      const plafond = Math.round(bandeau.getBoundingClientRect().bottom);
      observateur = new IntersectionObserver(
        ([entree]) => {
          // Sortie PAR LE HAUT seulement : une affiche encore sous le bas de
          // l'écran n'a pas été dépassée.
          const suivant =
            !entree.isIntersecting && entree.boundingClientRect.top < plafond;
          if (suivant !== dernier.current) {
            dernier.current = suivant;
            setReplie(suivant);
          }
        },
        { rootMargin: `-${plafond}px 0px 0px 0px` },
      );
      observateur.observe(cible);
    };

    brancher();
    window.addEventListener("resize", brancher);
    return () => {
      observateur?.disconnect();
      window.removeEventListener("resize", brancher);
    };
  }, [barre, affiche, actif]);

  return replie;
}
