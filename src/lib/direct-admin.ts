import { getDirectFeed } from "@/lib/competition-admin";
import { getPublicFriendlies } from "@/lib/friendlies-admin";
import { FRIENDLY_COMPETITION } from "@/lib/friendlies-shared";
import { getWorldBoard } from "@/lib/world-board";
import type { CompetitionFeed } from "@/lib/direct-shared";

/**
 * Le tableau du Direct : les compétitions de la plateforme, les amicaux, le
 * football mondial du jour.
 *
 * Une seule fonction pour la page d'accueil et pour GET /api/direct, que lit
 * l'application mobile : les deux ne peuvent pas montrer deux tableaux.
 *
 * Les amicaux entrent comme une compétition de plus, en fin de liste : un
 * tournoi qui se joue passe avant un match entre deux clubs, et le tri par
 * heure fait le reste. Les locales d'abord, c'est le sujet du produit.
 *
 * Les trois lectures sont indépendantes, donc lancées de front. Chacune
 * dégrade en liste vide de son côté (quota football-data atteint, Firestore
 * injoignable) sans emporter les autres.
 */
export async function getDirectBoard(): Promise<CompetitionFeed[]> {
  const [feed, friendlies, worldBoard] = await Promise.all([
    getDirectFeed(),
    getPublicFriendlies(),
    getWorldBoard(),
  ]);
  return [
    ...feed,
    ...(friendlies.length > 0 ? [{ competition: FRIENDLY_COMPETITION, matches: friendlies }] : []),
    ...worldBoard,
  ];
}
