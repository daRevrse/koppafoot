import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe2 } from "lucide-react";
import { getWorldCompetitionSummary, isWorldCode } from "@/lib/football-data";
import { worldCompetitionMetadata } from "@/lib/world-competition-meta";
import WorldStandingsTable from "@/components/world/WorldStandingsTable";
import WorldMatchList from "@/components/world/WorldMatchList";
import WorldScorersTable from "@/components/world/WorldScorersTable";

// ============================================
// Une compétition du football mondial, sur la même structure qu'une
// compétition Koppafoot (/c/[slug]) : fil d'ariane, hero collant sous le
// header, une grande carte dont les onglets changent le contenu, une carte
// de performances à côté.
//
// Comme côté local, les onglets ne sont plus des routes, « Accueil » a
// disparu avec elles. Il ne portait que les têtes des trois autres, ce qui
// obligeait à choisir entre lire un extrait et lire la chose.
//
// La page reste rendue côté serveur : l'onglet vit dans `?tab=` et se change
// par un lien. Aucun JavaScript client n'est nécessaire pour naviguer entre
// un classement et un calendrier.
// ============================================

export const revalidate = 600;

const TABS = [
  { id: "classement", label: "Classement" },
  { id: "calendrier", label: "Calendrier" },
  { id: "buteurs", label: "Buteurs" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export async function generateMetadata({ params }: PageProps<"/competitions/monde/[code]">) {
  const { code } = await params;
  return worldCompetitionMetadata(code, {
    label: "classement, résultats et calendrier",
    describe: (name) =>
      `Classement, derniers résultats, prochains matchs et meilleurs buteurs de ${name}, en direct sur Koppafoot.`,
  });
}

export default async function WorldCompetitionPage({
  params,
  searchParams,
}: PageProps<"/competitions/monde/[code]">) {
  const { code } = await params;
  if (!isWorldCode(code)) notFound();

  const summary = await getWorldCompetitionSummary(code);

  // Le fournisseur est injoignable, hors quota, ou le jeton manque. Un 404
  // serait faux, la compétition existe, donc on dit ce qui se passe.
  if (!summary) {
    return (
      <div className="mx-auto max-w-6xl pb-20">
        <Breadcrumb name={code} />
        <div className="border border-gray-200/70 bg-white py-16 text-center">
          <Globe2 size={28} className="mx-auto text-gray-300" />
          <p className="mt-3 font-display text-lg font-black text-gray-900">
            Données momentanément indisponibles
          </p>
          <p className="mt-1 text-sm font-bold text-gray-400">
            Le fournisseur de résultats ne répond pas. Réessaie dans un instant.
          </p>
        </div>
      </div>
    );
  }

  const { competition, standings, recent, upcoming, scorers } = summary;

  // Un onglet sans rien derrière ne s'affiche pas, mêmes règles qu'en local.
  const available = TABS.filter((t) =>
    t.id === "classement" ? standings.length > 0
      : t.id === "calendrier" ? recent.length + upcoming.length > 0
        : scorers.length > 0,
  );

  const asked = (await searchParams)?.tab;
  const wanted = typeof asked === "string" ? asked : null;
  const tab: TabId = (available.find((t) => t.id === wanted)?.id ?? available[0]?.id ?? "classement");

  const base = `/competitions/monde/${competition.code}`;


  return (
    <div className="mx-auto max-w-6xl pb-20">
      <Breadcrumb name={competition.name} area={competition.area} />

      {/* Hero collant, comme sur une compétition Koppafoot. */}
      <section className="sticky top-[var(--header-h,72px)] z-30 -mx-3 overflow-hidden bg-gray-900 text-white lg:-mx-5">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-gray-900 to-black" />

        <div className="relative mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border border-white/15 bg-white/5">
              {competition.emblem ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={competition.emblem} alt="" className="h-10 w-10 object-contain" />
              ) : (
                <Globe2 size={26} strokeWidth={1.2} className="text-emerald-400" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                {competition.type === "CUP" ? "Coupe" : "Championnat"}
                {competition.area && <span className="text-white/40"> · {competition.area}</span>}
              </p>
              <h1 className="mt-1 truncate font-display text-2xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
                {competition.name}
              </h1>
            </div>

            {competition.areaFlag && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={competition.areaFlag} alt="" className="hidden h-6 w-9 shrink-0 object-contain sm:block" />
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] font-black uppercase tracking-[0.15em] text-white/55">
            {competition.currentMatchday != null && <span>Journée {competition.currentMatchday}</span>}
            <span>{scorers.length > 0 ? `${scorers.length} buteurs classés` : "Buteurs à venir"}</span>
            <span>{standings.length > 0 ? `${standings.length} tableau${standings.length > 1 ? "x" : ""}` : "Classement à venir"}</span>
          </div>
        </div>
      </section>

      <div className="mt-6">
        {/* La grande carte : onglets et contenu. */}
        <div className="min-w-0 border border-gray-200/70 bg-white">
          {available.length > 1 && (
            <div className="flex gap-7 overflow-x-auto border-b border-gray-200/70 px-5">
              {available.map((t) => (
                <Link
                  key={t.id}
                  href={t.id === available[0].id ? base : `${base}?tab=${t.id}`}
                  scroll={false}
                  className={`shrink-0 whitespace-nowrap border-b-2 py-4 text-[11px] font-black uppercase tracking-[0.15em] transition-colors ${
                    tab === t.id
                      ? "border-gray-900 text-gray-900"
                      : "border-transparent text-gray-400 hover:text-gray-700"
                  }`}
                >
                  {t.label}
                </Link>
              ))}
            </div>
          )}

          <div className="p-5">
            {tab === "classement" && <WorldStandingsTable groups={standings} />}

            {tab === "calendrier" && (
              <div className="space-y-8">
                {upcoming.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
                      Prochains matchs
                    </h2>
                    <WorldMatchList matches={upcoming} emptyLabel="Aucun match programmé." />
                  </section>
                )}
                {recent.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
                      Derniers résultats
                    </h2>
                    <WorldMatchList matches={recent} emptyLabel="Aucun résultat récent." />
                  </section>
                )}
              </div>
            )}

            {tab === "buteurs" && <WorldScorersTable scorers={scorers} />}
          </div>
        </div>
      </div>

      {/* Attribution : condition du plan gratuit de football-data.org. Elle
          vivait dans le rail ; celui-ci parti, elle prend sa place ici. */}
      <p className="mt-4 text-[11px] font-bold text-gray-400">
        Données fournies par{" "}
        <a
          href="https://www.football-data.org"
          target="_blank"
          rel="noopener noreferrer"
          className="underline transition-colors hover:text-emerald-700"
        >
          football-data.org
        </a>
      </p>
    </div>
  );
}

function Breadcrumb({ name, area }: { name: string; area?: string | null }) {
  return (
    <nav
      aria-label="Fil d'ariane"
      className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-black uppercase tracking-[0.12em] text-gray-400"
    >
      <Link href="/" className="transition-colors hover:text-emerald-700">Direct</Link>
      <span aria-hidden className="text-gray-300">›</span>
      {area && (
        <>
          <span>{area}</span>
          <span aria-hidden className="text-gray-300">›</span>
        </>
      )}
      <span className="truncate text-gray-600">{name}</span>
    </nav>
  );
}
