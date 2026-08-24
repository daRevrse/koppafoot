"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  clicNavigant, demarrerNavigation, navigationEnCours,
  navigationEnCoursServeur, souscrireNavigation, terminerNavigation,
} from "@/lib/nav-progress";

// ============================================
// La barre de chargement, au bas du header mobile.
//
// CE QU'ELLE RÉPARE : sur un téléphone, une navigation vers une page qui doit
// aller chercher ses données ne montre RIEN. L'écran reste sur la page
// précédente, immobile, une seconde ou deux. On croit que le clic n'a pas
// pris, on reclique, et le deuxième clic tombe parfois sur autre chose.
//
// AU BAS DU HEADER, pas en travers de l'écran ni sous le doigt : c'est la
// seule bande qui ne bouge jamais, et le regard y revient déjà pour savoir où
// il est. Sur grand écran elle ne s'affiche pas, la navigation y est
// instantanée et le pointeur donne déjà son propre retour.
//
// ELLE ATTEND AVANT DE PARAÎTRE. La plupart des navigations sont préchargées
// et se règlent en moins de cent millisecondes : afficher une barre à chaque
// clic ferait clignoter le header en permanence, ce qui fatigue davantage
// qu'une attente courte.
//
// ELLE ABANDONNE au bout de quelques secondes. Une barre qui tourne encore
// après un échec réseau ment sur ce qui se passe, et il n'existe aucun
// signal fiable qui dise « la navigation a échoué ».
// ============================================

/** Sous ce délai, une navigation est considérée comme instantanée. */
const AVANT_AFFICHAGE = 140;

/** Au-delà, on renonce : plus personne ne viendra éteindre la barre. */
const ABANDON = 8000;

export default function HeaderProgress() {
  const enCours = useSyncExternalStore(
    souscrireNavigation,
    navigationEnCours,
    navigationEnCoursServeur,
  );
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  // Le clic est écouté en capture : un lien qui appelle stopPropagation, ou
  // un composant qui gère son propre clic, ne doit pas nous rendre aveugle.
  useEffect(() => {
    const surClic = (e: MouseEvent) => {
      if (clicNavigant(e)) demarrerNavigation();
    };
    document.addEventListener("click", surClic, true);
    return () => document.removeEventListener("click", surClic, true);
  }, []);

  // L'ADRESSE A CHANGÉ, DONC C'EST FINI. C'est le seul signal de fin dont on
  // dispose, et il suffit : le rendu de la nouvelle page est ce qu'on
  // attendait. Le retour arrière du navigateur passe aussi par ici.
  useEffect(() => {
    terminerNavigation();
  }, [pathname]);

  useEffect(() => {
    if (!enCours) {
      setVisible(false);
      return;
    }
    const paraitre = setTimeout(() => setVisible(true), AVANT_AFFICHAGE);
    const renoncer = setTimeout(terminerNavigation, ABANDON);
    return () => {
      clearTimeout(paraitre);
      clearTimeout(renoncer);
    };
  }, [enCours]);

  if (!visible) return null;

  return (
    <div
      // `aria-hidden` : le changement de page est déjà annoncé par le titre et
      // le focus. Une barre bavarde doublerait l'annonce à chaque navigation.
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] overflow-hidden bg-emerald-400/15 lg:hidden"
    >
      <div className="animate-barre-navigation h-full w-full bg-emerald-300" />
    </div>
  );
}
