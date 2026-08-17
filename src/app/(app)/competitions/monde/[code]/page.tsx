import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getWorldCompetitionSummary } from "@/lib/football-data";
import { worldCompetitionMetadata } from "@/lib/world-competition-meta";
import WorldStandingsTable from "@/components/world/WorldStandingsTable";
import WorldMatchList from "@/components/world/WorldMatchList";
import WorldScorersTable from "@/components/world/WorldScorersTable";

// Accueil tab: a hub, not a fifth full page. Each block is the head of one tab —
// enough to be worth reading on its own, with a way through to the whole thing.
// Blocks with no data are omitted rather than shown empty; the layout has
// already hidden the matching tabs.
export const revalidate = 600;

export async function generateMetadata({ params }: PageProps<"/competitions/monde/[code]">) {
  const { code } = await params;
  return worldCompetitionMetadata(code, {
    label: "classement, résultats et calendrier",
    describe: (name) =>
      `Classement, derniers résultats, prochains matchs et meilleurs buteurs de ${name}, en direct sur Koppafoot.`,
  });
}

export default async function WorldCompetitionHome({
  params,
}: PageProps<"/competitions/monde/[code]">) {
  const { code } = await params;
  const summary = await getWorldCompetitionSummary(code);
  // The layout already rendered the unavailable state and withheld children.
  if (!summary) return null;

  const { competition, standings, recent, upcoming, scorers } = summary;
  const base = `/competitions/monde/${competition.code}`;

  // Head of the table only: the first group, cut to six lines. Cup groups are
  // four teams, so they arrive whole.
  const firstGroup = standings[0];
  const topOfTable = firstGroup ? [{ ...firstGroup, rows: firstGroup.rows.slice(0, 6) }] : [];
  const tableTruncated = standings.length > 1 || (firstGroup?.rows.length ?? 0) > 6;

  return (
    <div className="space-y-8">
      {upcoming.length > 0 && (
        <Block title="Prochains matchs" href={upcoming.length > 5 ? `${base}/calendrier` : null}>
          <WorldMatchList matches={upcoming.slice(0, 5)} emptyLabel="Aucun match programmé." />
        </Block>
      )}

      {recent.length > 0 && (
        <Block title="Derniers résultats" href={recent.length > 5 ? `${base}/calendrier` : null}>
          <WorldMatchList matches={recent.slice(0, 5)} emptyLabel="Aucun résultat récent." />
        </Block>
      )}

      {topOfTable.length > 0 && (
        <Block title="Classement" href={tableTruncated ? `${base}/classement` : null}>
          <WorldStandingsTable groups={topOfTable} />
        </Block>
      )}

      {scorers.length > 0 && (
        <Block title="Meilleurs buteurs" href={scorers.length > 5 ? `${base}/buteurs` : null}>
          <WorldScorersTable scorers={scorers.slice(0, 5)} />
        </Block>
      )}

      {upcoming.length === 0 && recent.length === 0 && standings.length === 0 && (
        <div className="rounded-[2rem] border border-gray-100 bg-white py-16 text-center shadow-sm">
          <p className="text-sm font-bold text-gray-400 italic">
            Cette compétition n&apos;a pas encore de données pour la saison en cours.
          </p>
        </div>
      )}
    </div>
  );
}

function Block({
  title,
  href,
  children,
}: {
  title: string;
  href: string | null;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="font-display text-sm font-black uppercase tracking-tight text-gray-900">
          {title}
        </h2>
        {href && (
          <Link
            href={href}
            className="flex shrink-0 items-center gap-1 text-[11px] font-black uppercase tracking-wide text-emerald-500 hover:text-emerald-600"
          >
            Tout voir
            <ChevronRight size={13} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
