"use client";

// ============================================
// L'installation de l'application.
//
// POURQUOI UN MODULE, et pas un état dans le composant. `beforeinstallprompt`
// ne se produit QU'UNE FOIS, très tôt, juste après le chargement. Un
// composant qui l'écoute depuis son effet arrive après la bataille : c'est
// exactement ce qui condamnait l'ancienne bannière à ne s'afficher que sur la
// page de connexion, montée assez tôt par hasard. L'écouteur est donc posé à
// l'import du module, et l'événement est GARDÉ jusqu'à ce que quelqu'un le
// réclame.
//
// L'ÉVÉNEMENT NE SE REJOUE PAS. Une fois `prompt()` appelé, il est consommé :
// on le jette, et l'état retombe. C'est le navigateur qui décide de le
// renvoyer plus tard, ou pas.
//
// SUR IPHONE IL N'ARRIVE JAMAIS. Safari n'a pas d'installation par appel :
// elle passe par le menu Partager, à la main. D'où un état à part plutôt
// qu'un bouton qui ne ferait rien — et ça n'a rien d'un détail, sans
// application installée, iOS ne délivre aucune notification push.
// ============================================

export type EtatInstallation =
  /** Déjà installée, ou lancée depuis l'écran d'accueil. */
  | "installee"
  /** Le navigateur nous a donné la main : un bouton suffit. */
  | "possible"
  /** iPhone ou iPad hors application : il faut passer par Partager. */
  | "ios-manuel"
  /** Rien à proposer ici, et rien à afficher. */
  | "indisponible";

interface EvenementInstallation extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let evenement: EvenementInstallation | null = null;
let installee = false;
const abonnes = new Set<() => void>();

function prevenir() {
  abonnes.forEach((f) => f());
}

function estIOS(): boolean {
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    // iPadOS 13+ se présente comme un Mac, le tactile le trahit.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function lanceeDepuisEcranAccueil(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Sans ça, Chrome affiche sa propre invite, au moment qu'il choisit. On la
    // retient pour la proposer là où l'utilisateur la cherche.
    e.preventDefault();
    evenement = e as EvenementInstallation;
    prevenir();
  });

  window.addEventListener("appinstalled", () => {
    evenement = null;
    installee = true;
    prevenir();
  });
}

export function souscrireInstallation(callback: () => void): () => void {
  abonnes.add(callback);
  return () => abonnes.delete(callback);
}

export function etatInstallation(): EtatInstallation {
  if (typeof window === "undefined") return "indisponible";
  if (installee || lanceeDepuisEcranAccueil()) return "installee";
  if (evenement) return "possible";
  if (estIOS()) return "ios-manuel";
  return "indisponible";
}

/** Le rendu serveur ne sait rien de l'appareil, et ne doit rien affirmer. */
export function etatInstallationServeur(): EtatInstallation {
  return "indisponible";
}

/**
 * Ouvre l'invite du navigateur. À n'appeler que sur un geste utilisateur,
 * `prompt()` étant refusé sans lui.
 */
export async function installer(): Promise<"acceptee" | "refusee" | "impossible"> {
  if (!evenement) return "impossible";
  const invite = evenement;
  // Consommé quoi qu'il arrive : un événement déjà présenté ne se rejoue pas,
  // le garder afficherait un bouton mort jusqu'au rechargement.
  evenement = null;
  prevenir();

  await invite.prompt();
  const { outcome } = await invite.userChoice;
  return outcome === "accepted" ? "acceptee" : "refusee";
}
