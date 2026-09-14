"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

// ============================================
// Le thème, clair ou sombre.
//
// Trois endroits doivent s'accorder, et l'ordre compte :
//
// 1. Le script en tête de document (voir layout.tsx) pose `data-theme` AVANT
//    le premier rendu. Sans lui, la page s'affiche en clair puis bascule,
//    et cet éclair blanc au chargement est précisément ce qu'un thème sombre
//    est censé éviter.
// 2. Ce module LIT ce que le script a posé plutôt que de le recalculer. La
//    source de vérité est donc le DOM, pas un état React, et c'est pour ça
//    qu'on passe par `useSyncExternalStore` : c'est le seul moyen d'abonner
//    React à une valeur qui vit dehors sans provoquer un rendu en cascade au
//    montage, ni un écart entre le rendu serveur et le rendu client.
// 3. Le choix se garde dans localStorage, sur l'appareil et pas sur le compte.
//    On ne lit pas de la même façon un téléphone dehors et un écran de bureau
//    le soir, et un visiteur sans compte a droit au même réglage.
//
// Sans choix enregistré, on suit le système. C'est le seul défaut qui ne
// suppose rien : l'utilisateur a déjà dit à son téléphone ce qu'il préférait.
// ============================================

export type Theme = "light" | "dark";

export const CLE_THEME = "koppafoot:theme";

/**
 * La couleur de la barre système du téléphone, qui doit suivre l'entête.
 *
 * L'entête était vert nuit, elle était verte avec lui. Il est blanc en clair
 * et noir en sombre — `--k-surface`, le même noir légèrement vert que le
 * reste du thème sombre — et elle le suit.
 */
const COULEUR_BARRE: Record<Theme, string> = {
  light: "#ffffff",
  dark: "#101714",
};

const abonnes = new Set<() => void>();
let ecouteSysteme: (() => void) | null = null;

function appliquer(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  peindreLaBarre(theme);
  abonnes.forEach((f) => f());
}

/**
 * Ecrit la couleur de barre dans TOUTES les balises `theme-color`.
 *
 * Il peut y en avoir deux : le script de tete la pose avant le premier
 * rendu, et Next en emet une depuis `viewport.themeColor`. Le navigateur
 * retient la premiere qui s'applique — les mettre toutes a la meme valeur
 * rend donc l'ordre sans importance.
 *
 * ON N'EN SUPPRIME AUCUNE, et c'est le point. Ces noeuds appartiennent a
 * React : en retirer un sous lui faisait echouer son propre nettoyage plus
 * tard, `removeChild` sur un parent devenu nul. Ecrire un attribut ne le
 * derange pas, arracher un noeud si.
 */
function peindreLaBarre(theme: Theme) {
  const balises = document.querySelectorAll('meta[name="theme-color"]');
  if (balises.length === 0) {
    const m = document.createElement("meta");
    m.setAttribute("name", "theme-color");
    m.setAttribute("content", COULEUR_BARRE[theme]);
    document.head.appendChild(m);
    return;
  }
  balises.forEach((m) => m.setAttribute("content", COULEUR_BARRE[theme]));
}

function souscrire(callback: () => void): () => void {
  abonnes.add(callback);

  // Tant que personne n'a choisi, le thème suit le système en direct : bascule
  // automatique le soir sur un téléphone réglé ainsi. Dès qu'un choix est
  // enregistré, il l'emporte et cet écouteur ne fait plus rien.
  if (!ecouteSysteme && typeof window !== "undefined" && window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const suivre = (e: MediaQueryListEvent) => {
      if (localStorage.getItem(CLE_THEME)) return;
      appliquer(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", suivre);
    ecouteSysteme = () => mq.removeEventListener("change", suivre);
  }

  return () => {
    abonnes.delete(callback);
    if (abonnes.size === 0 && ecouteSysteme) {
      ecouteSysteme();
      ecouteSysteme = null;
    }
  };
}

const instantane = (): Theme =>
  document.documentElement.dataset.theme === "dark" ? "dark" : "light";

// Le serveur ne sait rien de l'appareil. Il rend en clair, et le script de
// tête a déjà corrigé l'attribut avant que la page ne s'affiche.
const instantaneServeur = (): Theme => "light";

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
  const theme = useSyncExternalStore(souscrire, instantane, instantaneServeur);

  const setTheme = useCallback((t: Theme) => {
    appliquer(t);
    try {
      localStorage.setItem(CLE_THEME, t);
    } catch {
      // Navigation privée, quota plein : le thème vaut pour cette visite,
      // ce n'est pas une raison de refuser la bascule.
    }
  }, []);

  return { theme, setTheme };
}

/**
 * Ne porte aucun état : il tient l'abonnement au réglage système ouvert pour
 * toute l'application, y compris sur les pages où aucun composant ne lit le
 * thème. Sans lui, un téléphone qui passe en sombre à la tombée du jour ne
 * changerait rien tant qu'on n'ouvre pas le menu du compte.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  // Au montage seulement : `appliquer` ne tourne qu'a la bascule, et c'est
  // apres l'hydratation que la balise de Next est sure d'etre la. Sans ca, la
  // doublure posee par le script de tete resterait en place toute la visite.
  useEffect(() => {
    peindreLaBarre(theme);
  }, [theme]);

  return <>{children}</>;
}
