import type { EvolutionRole } from "@/types";

/**
 * Les affiches des rôles, celles du site, embarquées dans l'appli
 * (scripts/generer-affiches-roles-mobile.mjs) : la pile de l'onglet Évolution
 * les montre sans réseau.
 */
export const AFFICHES: Record<EvolutionRole, number> = {
  player: require("../../../assets/roles/joueur.jpg"),
  manager: require("../../../assets/roles/manager.jpg"),
  referee: require("../../../assets/roles/arbitre.jpg"),
};
