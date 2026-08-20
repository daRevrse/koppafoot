import { NextResponse } from "next/server";
import { getDirectFeed } from "@/lib/competition-admin";
import { getPublicFriendlies } from "@/lib/friendlies-admin";

/**
 * GET /api/public/performances?player=<uid> | ?team=<id>
 *
 * Les dernières performances d'une entité, pour le rail de sa page publique.
 *
 * Une seule source : `getDirectFeed`, déjà lue et mise en cache pour le
 * tableau du Direct. Interroger Firestore une deuxième fois par joueur aurait
 * coûté un balayage des matchs de chaque compétition à chaque ouverture de
 * fiche, pour des données qu'on a déjà en mémoire.
 *
 * Compétitions de la plateforme uniquement : le fournisseur externe ne donne
 * pas le détail des buteurs par match, et un amical n'a pas de console de
 * score, ni l'un ni l'autre ne peut nourrir ce classement.
 */

export const revalidate = 300;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const player = url.searchParams.get("player");
  const team = url.searchParams.get("team");
  if (!player && !team) return NextResponse.json({ games: [] });

  try {
    const feed = await getDirectFeed(12);

    if (team) {
      // Une équipe : ses derniers résultats, du plus récent au plus ancien.
      //
      // Les amicaux comptent ici, contrairement au classement des buteurs :
      // un résultat est un résultat, et beaucoup de clubs jouent surtout des
      // amicaux. Ce qu'un amical ne peut pas donner, c'est le détail des
      // buteurs, d'où son absence côté joueur, juste en dessous.
      const friendlies = await getPublicFriendlies();
      const games = [
        ...feed.flatMap((f) => f.matches.map((m) => ({ m, competition: f.competition.name }))),
        ...friendlies.map((m) => ({ m, competition: "Match amical" })),
      ]
        .filter(({ m }) =>
          (m.homeTeamId === team || m.awayTeamId === team)
          && m.status === "completed"
          && m.scoreHome !== null && m.scoreAway !== null && m.date)
        .sort((a, b) => (b.m.date ?? "").localeCompare(a.m.date ?? ""))
        .slice(0, 5)
        .map(({ m, competition }) => {
          const home = m.homeTeamId === team;
          const own = (home ? m.scoreHome : m.scoreAway) ?? 0;
          const other = (home ? m.scoreAway : m.scoreHome) ?? 0;
          return {
            id: m.id,
            date: m.date,
            competition,
            opponent: home ? m.awayTeamName : m.homeTeamName,
            scored: own,
            conceded: other,
            result: own > other ? "W" : own < other ? "L" : "D",
          };
        });
      return NextResponse.json({ games });
    }

    // Un joueur : ses buts et passes, match par match, les cinq derniers.
    const rows = feed
      .flatMap((f) => f.matches.map((m) => ({ m, competition: f.competition.name })))
      .filter(({ m }) => m.date)
      .map(({ m, competition }) => {
        let goals = 0;
        let assists = 0;
        for (const e of m.liveState?.events ?? []) {
          if (e.type !== "goal" || e.varStatus === "cancelled") continue;
          if (e.playerId === player) goals += 1;
          if (e.assistPlayerId === player) assists += 1;
        }
        return {
          id: m.id,
          date: m.date,
          competition,
          opponent: `${m.homeTeamName}, ${m.awayTeamName}`,
          goals,
          assists,
        };
      })
      .filter((r) => r.goals > 0 || r.assists > 0)
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
      .slice(0, 5);

    return NextResponse.json({ games: rows });
  } catch (err) {
    console.error("GET performances failed:", err);
    return NextResponse.json({ games: [] });
  }
}
