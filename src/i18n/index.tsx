"use client";

import { createContext, useCallback, useContext } from "react";
import { useRouter } from "next/navigation";
import { fr, type CleTraduction } from "./fr";
import { en } from "./en";
import { CLE_LANGUE, DUREE_COOKIE_LANGUE, type Langue } from "./config";

// ============================================
// La langue.
//
// POURQUOI UN COOKIE, et pas localStorage comme pour le thème. Le thème est
// une couleur : le poser après le premier rendu se voit à peine, et un script
// en tête de document suffit. La langue est du TEXTE. Si le serveur rend
// « Direct » et que le client rend « Live », React signale l'écart et le
// remplace, ce qui fait clignoter chaque phrase de la page à chaque
// chargement.
//
// Un cookie, lui, part avec la requête. Le serveur sait donc dans quelle
// langue rendre, et le rendu client est identique. C'est le seul moyen
// d'avoir une langue choisie sans clignotement ni décalage d'hydratation.
//
// POURQUOI PAS DE ROUTES /fr ET /en. Elles obligeraient à réécrire chaque lien
// du produit et à doubler les URL partagées, pour un bénéfice de référencement
// que deux langues sur un produit local ne justifient pas encore.
//
// Ce qui n'est pas traduit s'affiche en français. Une phrase manquante reste
// lisible, une clé brute à l'écran ne l'est pas.
// ============================================

// Le nom du cookie et sa durée vivent dans ./config, sans directive, pour que
// le layout serveur puisse les lire (voir l'explication là-bas).
export { CLE_LANGUE, langueDepuisCookie } from "./config";
export type { Langue } from "./config";

const DICTIONNAIRES: Record<Langue, Partial<Record<CleTraduction, string>>> = {
  fr,
  en,
};

export type Traduire = (cle: CleTraduction, vars?: Record<string, string | number>) => string;

interface LangueValue {
  langue: Langue;
  setLangue: (l: Langue) => void;
  t: Traduire;
}

const LangueCtx = createContext<LangueValue>({
  langue: "fr",
  setLangue: () => {},
  t: (cle) => fr[cle],
});

/** Remplace les {jetons} d'une phrase par leurs valeurs. */
function interpoler(phrase: string, vars?: Record<string, string | number>): string {
  if (!vars) return phrase;
  return phrase.replace(/\{(\w+)\}/g, (entier, nom) =>
    nom in vars ? String(vars[nom]) : entier,
  );
}

/** Traduit hors composant, quand on a déjà la langue sous la main. */
export function traduire(langue: Langue, cle: CleTraduction, vars?: Record<string, string | number>): string {
  const phrase = DICTIONNAIRES[langue][cle] ?? fr[cle];
  return interpoler(phrase, vars);
}

export function LangueProvider({
  langue,
  children,
}: {
  langue: Langue;
  children: React.ReactNode;
}) {
  const router = useRouter();

  const t = useCallback<Traduire>(
    (cle, vars) => traduire(langue, cle, vars),
    [langue],
  );

  const setLangue = useCallback(
    (l: Langue) => {
      document.cookie = `${CLE_LANGUE}=${l}; path=/; max-age=${DUREE_COOKIE_LANGUE}; samesite=lax`;
      document.documentElement.lang = l;
      // Le serveur a rendu la page dans l'ancienne langue : il faut la lui
      // redemander. `refresh` rejoue le rendu serveur sans recharger la page,
      // donc sans perdre le défilement ni l'état des composants.
      router.refresh();
    },
    [router],
  );

  return (
    <LangueCtx.Provider value={{ langue, setLangue, t }}>
      {children}
    </LangueCtx.Provider>
  );
}

export function useLangue(): LangueValue {
  return useContext(LangueCtx);
}

/** Raccourci pour le cas courant : on ne veut que traduire. */
export function useT(): Traduire {
  return useContext(LangueCtx).t;
}
