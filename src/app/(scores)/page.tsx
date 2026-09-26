import DirectHomeV2 from "@/components/direct/DirectHomeV2";
import { getDirectBoard } from "@/lib/direct-admin";
import { getWorldCompetitions } from "@/lib/football-data";
import { lireClassements } from "@/lib/classement-admin";
import { classementPar, type LigneJoueurPubliee, type TriClassement } from "@/lib/classement";

/**
 * Les cinq de la carte d'accueil : les meilleures notes, gardiens compris. Tant
 * que personne n'a assez de matchs notés, les meilleurs contributeurs — une
 * carte vide se lit comme une panne.
 */
function topDeLAccueil(joueurs: LigneJoueurPubliee[]): { tri: TriClassement; lignes: LigneJoueurPubliee[] } {
  const parNote = classementPar(joueurs, "note");
  if (parNote.length > 0) return { tri: "note", lignes: parNote.slice(0, 5) };
  return { tri: "contribution", lignes: classementPar(joueurs, "contribution").slice(0, 5) };
}

// Public home: the live-score "Direct" board, inside the scores shell
// (ScoreShell) rather than the general app shell. Every public competition
// and its fixtures are server-fetched (ISR) for first paint and SEO/shares;
// DirectHomeV2 then attaches a real-time listener per competition client-side.
export const revalidate = 60;

export default async function Home() {
  // Le tableau s'assemble dans lib/direct-admin, que GET /api/direct lit
  // aussi : les competitions de la plateforme, les amicaux et le football
  // mondial, dans le meme annuaire. Le reste ne sert qu'au site : l'annuaire
  // mondial, et le classement, deja calcule, qu'on lit sans le refaire (il ne
  // change qu'a la fin d'un match, voir lib/classement-admin).
  //
  // Les lectures sont independantes, donc lancees de front ; chacune degrade
  // en liste vide de son cote sans emporter les autres.
  const [board, world, classements] = await Promise.all([
    getDirectBoard(),
    getWorldCompetitions(),
    lireClassements(),
  ]);

  return (
    <DirectHomeV2
      initialFeed={board}
      worldCompetitions={world}
      topPerformances={topDeLAccueil(classements.joueurs)}
    />
  );
}
