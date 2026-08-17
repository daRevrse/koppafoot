import { getWorldCompetitionSummary } from "@/lib/football-data";
import { worldCompetitionMetadata } from "@/lib/world-competition-meta";
import WorldScorersTable from "@/components/world/WorldScorersTable";

// Buteurs tab. Offered by the layout only when the chart has at least one goal,
// so an empty scoring chart never becomes an empty tab.
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: PageProps<"/competitions/monde/[code]/buteurs">) {
  const { code } = await params;
  return worldCompetitionMetadata(code, {
    label: "meilleurs buteurs",
    describe: (name) =>
      `Classement des meilleurs buteurs de ${name} : buts, passes décisives et matchs joués.`,
  });
}

export default async function WorldCompetitionScorers({
  params,
}: PageProps<"/competitions/monde/[code]/buteurs">) {
  const { code } = await params;
  const summary = await getWorldCompetitionSummary(code);
  if (!summary) return null;

  return <WorldScorersTable scorers={summary.scorers} />;
}
