import { NextResponse } from "next/server";
import { getDirectFeed } from "@/lib/competition-admin";
import { getWorldBoard } from "@/lib/world-board";
import { getPublicFriendlies } from "@/lib/friendlies-admin";

/**
 * GET /api/matches/today — ce qui se joue aujourd'hui, toutes familles.
 *
 * Sert le rail de la page Actus : on y lit ce que la presse écrit, et savoir
 * ce qui se joue pendant qu'on lit est exactement le complément utile.
 *
 * Les trois sources du tableau du Direct sont reprises telles quelles —
 * compétitions de la plateforme, amicaux, football mondial — puis filtrées
 * sur la date du jour. Dégrade en liste vide plutôt que d'échouer.
 */

export const revalidate = 120;

interface Row {
  id: string;
  home: string;
  away: string;
  homeLogo: string | null;
  awayLogo: string | null;
  time: string | null;
  status: string;
  scoreHome: number | null;
  scoreAway: number | null;
  competition: string;
  href: string | null;
}

export async function GET() {
  const today = (() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  })();

  try {
    const [feed, friendlies, world] = await Promise.all([
      getDirectFeed(8),
      getPublicFriendlies(),
      getWorldBoard(),
    ]);

    const rows: Row[] = [];

    for (const entry of feed) {
      for (const m of entry.matches) {
        if (m.date !== today) continue;
        rows.push({
          id: m.id, home: m.homeTeamName, away: m.awayTeamName,
          homeLogo: m.homeTeamLogo, awayLogo: m.awayTeamLogo,
          time: m.time, status: m.status,
          scoreHome: m.scoreHome, scoreAway: m.scoreAway,
          competition: entry.competition.name,
          href: entry.competition.slug ? `/c/${entry.competition.slug}/matches/${m.id}` : null,
        });
      }
    }

    for (const m of friendlies) {
      if (m.date !== today) continue;
      rows.push({
        id: m.id, home: m.homeTeamName, away: m.awayTeamName,
        homeLogo: null, awayLogo: null,
        time: m.time, status: m.status,
        scoreHome: m.scoreHome, scoreAway: m.scoreAway,
        competition: "Match amical",
        href: `/matches/${m.id}`,
      });
    }

    for (const group of world) {
      for (const m of group.matches) {
        if (m.date !== today) continue;
        rows.push({
          id: m.id, home: m.homeTeamName, away: m.awayTeamName,
          homeLogo: m.homeTeamLogo, awayLogo: m.awayTeamLogo,
          time: m.time, status: m.status,
          scoreHome: m.scoreHome, scoreAway: m.scoreAway,
          competition: group.competition.name,
          // Pas de page de match chez nous pour le fournisseur externe.
          href: group.competition.slug ? `/competitions/monde/${group.competition.slug}` : null,
        });
      }
    }

    // En cours d'abord, puis par heure de coup d'envoi.
    rows.sort((a, b) => {
      const rank = (s: string) => (s === "live" ? 0 : s === "scheduled" ? 1 : 2);
      return rank(a.status) - rank(b.status) || (a.time ?? "").localeCompare(b.time ?? "");
    });

    return NextResponse.json({ matches: rows });
  } catch (err) {
    console.error("GET today matches failed:", err);
    return NextResponse.json({ matches: [] });
  }
}
