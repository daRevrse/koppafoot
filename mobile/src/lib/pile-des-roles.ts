import type { EvolutionRole } from "@/types";
import { ROLES } from "~/lib/roles";

// La pile des rôles de l'onglet Évolution (compte sans rôle) : on feuillette
// joueur, manager, arbitre, chacun avec son affiche et ses couleurs, et la
// carte se retourne sur le formulaire d'activation. Ici, la logique seule :
// l'ordre qui tourne, le glissé, les couleurs, le rôle visé.

/** Les couleurs d'un rôle, les mêmes sur les deux thèmes. */
export type CouleursDuRole = {
  /** Le fond de la carte, sous l'affiche. */
  carte: string;
  /** Le bandeau du titre, au dos de la carte (sous un texte blanc). */
  profond: string;
  /** Le cadre de la carte ; l'accroche et les points sur le thème sombre. */
  accentSombre: string;
  /** L'accroche et les points sur le thème clair. */
  accentClair: string;
  /** Le fond du bouton « Devenir … », sous un texte blanc. */
  bouton: string;
};

/** L'accroche de chaque rôle (celle de la page /roles du site) et ses couleurs. */
export const PRESENTATION: Record<EvolutionRole, { accroche: string; couleurs: CouleursDuRole }> = {
  player: {
    accroche: "Tu joues, on tient le compte",
    couleurs: { carte: "#27500A", profond: "#173404", accentSombre: "#C0DD97", accentClair: "#3B6D11", bouton: "#3B6D11" },
  },
  manager: {
    accroche: "Tu tiens l'effectif",
    couleurs: { carte: "#0C447C", profond: "#042C53", accentSombre: "#B5D4F4", accentClair: "#185FA5", bouton: "#185FA5" },
  },
  referee: {
    accroche: "Tu tiens le sifflet",
    couleurs: { carte: "#444441", profond: "#2C2C2A", accentSombre: "#FAC775", accentClair: "#854F0B", bouton: "#2C2C2A" },
  },
};

/** Les cartes de part et d'autre de celle de devant : la pile tourne. */
export function voisins(index: number, n: number): { precedent: number; suivant: number } {
  return { precedent: (index - 1 + n) % n, suivant: (index + 1) % n };
}

/**
 * Le geste prend la carte : franchement horizontal, au-delà d'un petit
 * tremblement. Un défilement vertical sur un petit écran ne change jamais de
 * rôle.
 */
export function estUnGlisseHorizontal(dx: number, dy: number): boolean {
  return Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy);
}

/** La carte de devant une fois le doigt levé : vers la gauche le suivant, vers la droite le précédent. */
export function apresGlisse(index: number, dx: number, n: number, seuil = 40): number {
  if (dx < -seuil) return voisins(index, n).suivant;
  if (dx > seuil) return voisins(index, n).precedent;
  return index;
}

/**
 * Le rôle qu'un visiteur sans compte voulait prendre. Il vit dans le module,
 * pas dans l'écran : les onglets se démontent pendant la connexion et la
 * création du profil, et la pile doit se rouvrir sur ce rôle-là.
 */
let roleVise: EvolutionRole | null = null;

export function retenirLeRoleVise(role: EvolutionRole): void {
  roleVise = role;
}

/** Le rôle visé, une seule fois : rendu, il est oublié. */
export function prendreLeRoleVise(): EvolutionRole | null {
  const r = roleVise;
  roleVise = null;
  return r;
}

/** La position d'un rôle dans la pile ; la première carte sans rôle visé. */
export function indexInitial(role: EvolutionRole | null): number {
  const i = ROLES.findIndex((r) => r.role === role);
  return i < 0 ? 0 : i;
}
