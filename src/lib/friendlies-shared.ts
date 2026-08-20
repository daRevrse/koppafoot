import type { Competition } from "@/types";

// Partagé entre le serveur et le navigateur — donc AUCUN import de
// firebase-admin ici. Le lecteur qui remplit ces matchs vit dans
// friendlies-admin.ts, et le tableau du Direct (composant client) n'a besoin
// que du fanion : importer l'un depuis l'autre tirerait le SDK serveur dans
// le bundle client.

/**
 * L'identifiant de la compétition synthétique qui regroupe les amicaux.
 *
 * Il n'existe dans aucune collection : c'est un fanion. Le tableau du Direct
 * groupe ses lignes par compétition, et un amical n'appartient à aucune —
 * ce rattachement lui évite un second chemin de rendu pour des matchs qui
 * s'affichent exactement pareil. Les endroits qui mènent ailleurs (le lien
 * du match, l'en-tête du groupe, l'annuaire) testent ce fanion.
 */
export const FRIENDLY_COMP_ID = "__amicaux__";

export const FRIENDLY_COMPETITION: Competition = {
  id: FRIENDLY_COMP_ID,
  name: "Matchs amicaux",
  slug: FRIENDLY_COMP_ID,
  logoUrl: null,
  bannerUrl: null,
  status: "group_stage",
  organizerName: null,
  startDate: null,
  endDate: null,
  venueCity: null,
  updatedAt: "",
} as Competition;
