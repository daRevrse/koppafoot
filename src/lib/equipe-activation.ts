// L'équipe nommée en activant le rôle manager (components/roles/ChoixDuRole).
//
// LE NOM N'ALLAIT QUE DANS `team_name` DU PROFIL : aucune équipe n'était créée,
// et le nouveau manager arrivait dans un espace sans équipe. L'équipe se crée
// maintenant par la même route que « Créer une équipe » (/api/teams), avec les
// réglages par défaut de son formulaire. Sans SDK : l'application mobile a la
// même règle.

import type { Categorie, Genre } from "@/lib/genre";
import type { EvolutionRole } from "@/types";

/** Ce que reçoit createTeam (lib/firestore), sans le manager : c'est l'appelant. */
export interface EquipeACreer {
  name: string;
  city: string;
  level: string;
  category: Categorie;
  color: string;
  description: string;
  maxMembers: number;
}

export type EquipeDeLActivation =
  | { genre: "rien" }
  | { genre: "deja"; nom: string }
  | { genre: "sans-ville" }
  | { genre: "creer"; champs: EquipeACreer };

const forme = (nom: string) => nom.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Faut-il créer une équipe, et laquelle ? Pas pour un joueur ou un arbitre,
 * pas sans nom, pas en double d'une équipe qu'on gère déjà, et pas sans ville
 * (la route la refuse).
 */
export function equipeDeLActivation(
  role: EvolutionRole,
  c: { equipe: string; ville: string; genre: Genre | null },
  nomsDejaGeres: string[],
): EquipeDeLActivation {
  const nom = c.equipe.trim().replace(/\s+/g, " ");
  if (role !== "manager" || !nom) return { genre: "rien" };
  if (nomsDejaGeres.some((n) => forme(n) === forme(nom))) return { genre: "deja", nom };
  const ville = c.ville.trim();
  if (!ville) return { genre: "sans-ville" };
  return {
    genre: "creer",
    champs: {
      name: nom, city: ville, level: "amateur", category: c.genre === "female" ? "women" : "men",
      color: "emerald", description: "", maxMembers: 14,
    },
  };
}
