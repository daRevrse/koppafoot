import { getWorldCompetitionSummary } from "@/lib/football-data";
import { worldCompetitionMetadata } from "@/lib/world-competition-meta";
import WorldMatchList from "@/components/world/WorldMatchList";

// Calendrier tab: the full fixture window, fixtures first then results. Each
// half is dropped when empty — a competition mid-season has both, one whose
// season is over has only results, one before kickoff only fixtures.
export const revalidate = 600;

export async function generateMetadata({
  params,
}: PageProps<"/competitions/monde/[code]/calendrier">) {
  const { code } = await params;
  return worldCompetitionMetadata(code, {
    label: "calendrier et résultats",
    describe: (name) =>
      `Calendrier complet et derniers résultats de ${name} : dates, heures et scores.`,
  });
}

export default async function WorldCompetitionCalendar({
  params,
}: PageProps<"/competitions/monde/[code]/calendrier">) {
  const { code } = await params;
  const summary = await getWorldCompetitionSummary(code);
  if (!summary) return null;

  const { recent, upcoming } = summary;

  return (
    <div className="space-y-8">
      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="px-1 font-display text-sm font-black uppercase tracking-tight text-gray-900">
            Prochains matchs
          </h2>
          <WorldMatchList matches={upcoming} emptyLabel="Aucun match programmé." />
        </section>
      )}

      {recent.length > 0 && (
        <section className="space-y-3">
          <h2 className="px-1 font-display text-sm font-black uppercase tracking-tight text-gray-900">
            Derniers résultats
          </h2>
          <WorldMatchList matches={recent} emptyLabel="Aucun résultat récent." />
        </section>
      )}
    </div>
  );
}
