import DirectHomeV2 from "@/components/direct/DirectHomeV2";
import { getDirectFeed } from "@/lib/competition-admin";
import { getWorldCompetitions } from "@/lib/football-data";
import { getPublicFriendlies } from "@/lib/friendlies-admin";
import { FRIENDLY_COMPETITION } from "@/lib/friendlies-shared";
import { getWorldBoard } from "@/lib/world-board";

// Public home: the live-score "Direct" board, inside the scores shell
// (ScoreShell) rather than the general app shell. Every public competition
// and its fixtures are server-fetched (ISR) for first paint and SEO/shares;
// DirectHomeV2 then attaches a real-time listener per competition client-side.
export const revalidate = 60;

export default async function Home() {
  // Les deux familles arrivent ensemble : celles de la plateforme, qu'on peut
  // rejoindre, et le football mondial, qu'on ne fait que suivre. Elles vivent
  // desormais dans le meme annuaire — il n'y a pas de raison qu'un supporter
  // aille les chercher sur deux ecrans differents.
  //
  // Les deux lectures sont independantes, donc lancees de front. Chacune
  // degrade en liste vide de son cote (quota football-data atteint, Firestore
  // injoignable) sans emporter l'autre.
  const [feed, world, friendlies, worldBoard] = await Promise.all([
    getDirectFeed(),
    getWorldCompetitions(),
    getPublicFriendlies(),
    getWorldBoard(),
  ]);

  // Les amicaux entrent dans le tableau comme une competition de plus. Ils
  // arrivent en fin de liste : un tournoi qui se joue passe avant un match
  // entre deux clubs, et le tri par heure du tableau fait le reste.
  // Le tableau porte les trois familles : les competitions de la plateforme,
  // les amicaux, et le football mondial du jour. Les locales d'abord — c'est
  // le sujet du produit — le reste derriere, le tri par heure faisant foi a
  // l'interieur de chaque groupe.
  const board = [
    ...feed,
    ...(friendlies.length > 0 ? [{ competition: FRIENDLY_COMPETITION, matches: friendlies }] : []),
    ...worldBoard,
  ];

  return <DirectHomeV2 initialFeed={board} worldCompetitions={world} />;
}
