import { getWorldCompetitionSummary } from "@/lib/football-data";
import { worldCompetitionMetadata } from "@/lib/world-competition-meta";
import WorldStandingsTable from "@/components/world/WorldStandingsTable";

// Classement tab. The layout only offers it when there is a table to show, so
// this page never renders the empty state in normal navigation — it stays as a
// guard for someone typing the URL while the season is between states.
export const revalidate = 600;

export async function generateMetadata({
  params,
}: PageProps<"/competitions/monde/[code]/classement">) {
  const { code } = await params;
  return worldCompetitionMetadata(code, {
    label: "classement",
    describe: (name) =>
      `Classement complet de ${name} : points, différence de buts et forme de chaque équipe.`,
  });
}

export default async function WorldCompetitionStandings({
  params,
}: PageProps<"/competitions/monde/[code]/classement">) {
  const { code } = await params;
  const summary = await getWorldCompetitionSummary(code);
  if (!summary) return null;

  return <WorldStandingsTable groups={summary.standings} />;
}
