import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Globe2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale/fr";
import { getWorldCompetitionSummary, isWorldCode } from "@/lib/football-data";
import WorldCompetitionNav from "@/components/world/WorldCompetitionNav";

// Public, login-free hub for one football-data.org competition, shaped like the
// Koppafoot competition hub (/c/[slug]): this layout owns the header and the tab
// bar, each child owns one tab.
//
// It decides which tabs exist. The provider serves competitions in every state —
// a league before kickoff has no table, a dormant cup has no scorers — so a tab
// is only offered when its page would actually have something on it. The data is
// fetched here and again in each child; Next dedupes, so it stays three calls.
export const revalidate = 600;

function seasonLabel(start: string | null, end: string | null): string | null {
  const fmt = (d: string) => {
    try {
      return format(parseISO(d), "MMMM yyyy", { locale: fr });
    } catch {
      return d;
    }
  };
  if (start && end) return `Saison ${fmt(start)} — ${fmt(end)}`;
  if (start) return `Saison ouverte en ${fmt(start)}`;
  return null;
}

export default async function WorldCompetitionLayout({
  children,
  params,
}: LayoutProps<"/competitions/monde/[code]">) {
  const { code } = await params;
  if (!isWorldCode(code)) notFound();

  const summary = await getWorldCompetitionSummary(code);

  // The provider is unreachable, out of quota, or the token is missing. A 404
  // would be wrong — the competition exists — so say what happened and drop the
  // tab bar rather than offer tabs onto empty pages.
  if (!summary) {
    return (
      <div className="mx-auto max-w-4xl">
        <BackLink />
        <div className="rounded-[2rem] border border-gray-100 bg-white py-16 text-center shadow-sm">
          <Globe2 size={28} className="mx-auto text-gray-300" />
          <p className="mt-3 font-display text-lg font-black text-gray-900">
            Données momentanément indisponibles
          </p>
          <p className="mt-1 text-sm font-bold text-gray-400 italic">
            Le fournisseur de résultats ne répond pas. Réessaie dans un instant.
          </p>
        </div>
      </div>
    );
  }

  const { competition, standings, recent, upcoming, scorers } = summary;
  const season = seasonLabel(competition.seasonStart, competition.seasonEnd);
  const base = `/competitions/monde/${competition.code}`;

  const tabs = [
    { href: base, label: "Accueil", exact: true },
    ...(standings.length > 0 ? [{ href: `${base}/classement`, label: "Classement" }] : []),
    ...(recent.length + upcoming.length > 0
      ? [{ href: `${base}/calendrier`, label: "Calendrier" }]
      : []),
    ...(scorers.length > 0 ? [{ href: `${base}/buteurs`, label: "Buteurs" }] : []),
  ];

  return (
    <div className="mx-auto max-w-4xl pb-20">
      <BackLink />

      {/* Header */}
      <header className="flex items-center gap-4 rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm">
        {competition.emblem ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={competition.emblem}
            alt=""
            className="h-16 w-16 shrink-0 object-contain sm:h-20 sm:w-20"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-400">
            <Globe2 size={28} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-black tracking-tight text-gray-900">
            {competition.name}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold text-gray-400">
            {competition.area && (
              <span className="flex items-center gap-1.5">
                {competition.areaFlag ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={competition.areaFlag} alt="" className="h-3 w-4 object-cover" />
                ) : (
                  <Globe2 size={12} className="text-gray-300" />
                )}
                {competition.area}
              </span>
            )}
            {season && (
              <>
                <span className="text-gray-200">·</span>
                <span>{season}</span>
              </>
            )}
            {competition.currentMatchday != null && (
              <>
                <span className="text-gray-200">·</span>
                <span>Journée {competition.currentMatchday}</span>
              </>
            )}
          </p>
        </div>
      </header>

      {/* Tab bar — omitted entirely when Accueil is the only tab, so an empty
          competition does not get a bar with nothing to switch to. */}
      {tabs.length > 1 ? (
        <div className="my-4 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <WorldCompetitionNav tabs={tabs} />
        </div>
      ) : (
        <div className="h-4" />
      )}

      {children}

      {/* Attribution is a condition of the free plan. */}
      <p className="mt-8 px-1 text-[11px] font-bold text-gray-300">
        Données fournies par{" "}
        <a
          href="https://www.football-data.org"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-400"
        >
          football-data.org
        </a>
        .
      </p>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/competitions"
      className="mb-4 inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-gray-400 transition-colors hover:text-emerald-500"
    >
      <ArrowLeft size={14} />
      Toutes les compétitions
    </Link>
  );
}
