"use client";

// ============================================
// L'état « une navigation est en cours ».
//
// POURQUOI UN MODULE ET PAS `useLinkStatus`. Next expose bien un état
// d'attente par lien, mais il ne se lit QUE depuis un descendant du <Link>
// cliqué. Une barre posée sous le header n'en est pas un : pour l'alimenter,
// il aurait fallu glisser une sonde dans chacun des liens du produit, et le
// premier lien oublié serait une navigation sans retour visuel — c'est-à-dire
// exactement le cas qu'on cherche à couvrir.
//
// D'où l'écoute d'un clic en phase de CAPTURE, au niveau du document : elle
// voit tous les liens, ceux d'aujourd'hui et ceux qu'on écrira demain, sans
// que personne n'ait à y penser.
//
// CE QU'ELLE NE VOIT PAS : les navigations lancées par `router.push()` depuis
// un bouton. `demarrerNavigation()` est exportée pour ces cas-là.
// ============================================

let enCours = false;
const abonnes = new Set<() => void>();

function poser(valeur: boolean) {
  if (enCours === valeur) return;
  enCours = valeur;
  abonnes.forEach((f) => f());
}

export function demarrerNavigation() {
  poser(true);
}

export function terminerNavigation() {
  poser(false);
}

export function souscrireNavigation(callback: () => void): () => void {
  abonnes.add(callback);
  return () => abonnes.delete(callback);
}

export function navigationEnCours(): boolean {
  return enCours;
}

/** Le serveur ne navigue pas. */
export function navigationEnCoursServeur(): boolean {
  return false;
}

/**
 * Ce clic va-t-il vraiment changer de page ?
 *
 * Tout le reste est une barre qui démarre et ne s'arrête jamais, faute de
 * changement d'adresse pour la faire taire : un lien externe, un nouvel
 * onglet, un téléchargement, une ancre vers la même page, un clic modifié
 * pour ouvrir à côté. Le clic droit et le clic du milieu ne passent pas
 * ici, `click` ne les rapporte pas.
 */
export function clicNavigant(e: MouseEvent): boolean {
  if (e.defaultPrevented || e.button !== 0) return false;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;

  const lien = (e.target as Element | null)?.closest?.("a");
  if (!lien) return false;
  if (lien.target && lien.target !== "_self") return false;
  if (lien.hasAttribute("download")) return false;

  const href = lien.getAttribute("href");
  if (!href || href.startsWith("#")) return false;

  const cible = new URL(lien.href, location.href);
  if (cible.origin !== location.origin) return false;

  // Même adresse : Next ne rendra rien de nouveau, et rien ne viendrait
  // éteindre la barre.
  return cible.pathname + cible.search !== location.pathname + location.search;
}
