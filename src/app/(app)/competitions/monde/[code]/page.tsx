import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe2 } from "lucide-react";
import { getWorldCompetitionSummary, isWorldCode } from "@/lib/football-data";
import { worldCompetitionMetadata } from "@/lib/world-competition-meta";
import WorldStandingsTable from "@/components/world/WorldStandingsTable";
import WorldMatchList from "@/components/world/WorldMatchList";
import WorldScorersTable from "@/components/world/WorldScorersTable";
import { textes } from "@/i18n/textes";
import { langueServeur } from "@/i18n/serveur";

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
  { id: "classement" },
  { id: "calendrier" },
  { id: "buteurs" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const T = textes(
  {
    onglet: (id: TabId) => ({ classement: "Classement", calendrier: "Calendrier", buteurs: "Buteurs" })[id],
    metaLabel: "classement, résultats et calendrier",
    metaDescription: (nom: string) =>
      `Classement, derniers résultats, prochains matchs et meilleurs buteurs de ${nom}, en direct sur Koppafoot.`,
    introuvable: "Compétition introuvable, Koppafoot",
    indisponibles: "Données momentanément indisponibles",
    fournisseur: "Le fournisseur de résultats ne répond pas. Réessaie dans un instant.",
    coupe: "Coupe",
    championnat: "Championnat",
    journee: (n: number) => `Journée ${n}`,
    buteursClasses: (n: number) => `${n} buteur${n > 1 ? "s" : ""} classé${n > 1 ? "s" : ""}`,
    buteursAVenir: "Buteurs à venir",
    tableaux: (n: number) => `${n} tableau${n > 1 ? "x" : ""}`,
    classementAVenir: "Classement à venir",
    prochainsMatchs: "Prochains matchs",
    aucunProgramme: "Aucun match programmé.",
    derniersResultats: "Derniers résultats",
    aucunRecent: "Aucun résultat récent.",
    donneesPar: "Données fournies par",
    filDAriane: "Fil d'ariane",
    direct: "Direct",
  },
  {
    onglet: (id: TabId) => ({ classement: "Standings", calendrier: "Fixtures", buteurs: "Top scorers" })[id],
    metaLabel: "standings, results and fixtures",
    metaDescription: (nom: string) =>
      `Standings, latest results, upcoming fixtures and top scorers of ${nom}, live on Koppafoot.`,
    introuvable: "Competition not found, Koppafoot",
    indisponibles: "Data temporarily unavailable",
    fournisseur: "The results provider is not responding. Try again in a moment.",
    coupe: "Cup",
    championnat: "League",
    journee: (n: number) => `Matchday ${n}`,
    buteursClasses: (n: number) => `${n} ranked scorer${n === 1 ? "" : "s"}`,
    buteursAVenir: "Top scorers to come",
    tableaux: (n: number) => `${n} table${n === 1 ? "" : "s"}`,
    classementAVenir: "Standings to come",
    prochainsMatchs: "Upcoming fixtures",
    aucunProgramme: "No fixtures scheduled.",
    derniersResultats: "Latest results",
    aucunRecent: "No recent results.",
    donneesPar: "Data provided by",
    filDAriane: "Breadcrumb",
    direct: "Live",
  },
);

export async function generateMetadata({ params }: PageProps<"/competitions/monde/[code]">) {
  const { code } = await params;
  const t = T[await langueServeur()];
  return worldCompetitionMetadata(code, {
    label: t.metaLabel,
    describe: t.metaDescription,
    introuvable: t.introuvable,
  });
}

export default async function WorldCompetitionPage({
  params,
  searchParams,
}: PageProps<"/competitions/monde/[code]">) {
  const { code } = await params;
  if (!isWorldCode(code)) notFound();

  const [summary, langue] = await Promise.all([getWorldCompetitionSummary(code), langueServeur()]);
  const t = T[langue];

  // Le fournisseur est injoignable, hors quota, ou le jeton manque. Un 404
  // serait faux, la compétition existe, donc on dit ce qui se passe.
  if (!summary) {
    return (
      <div className="mx-auto max-w-6xl pb-20">
        <Breadcrumb name={code} t={t} />
        <div className="border border-gray-200/70 bg-white py-16 text-center">
          <Globe2 size={28} className="mx-auto text-gray-300" />
          <p className="mt-3 font-display text-lg font-black text-gray-900">
            {t.indisponibles}
          </p>
          <p className="mt-1 text-sm font-bold text-gray-400">
            {t.fournisseur}
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
  const pays = langue === "en" ? (competition.areaEn ?? competition.area) : competition.area;


  return (
    <div className="mx-auto max-w-6xl pb-20">
      <Breadcrumb name={competition.name} area={pays} t={t} />

      {/* Hero collant, comme sur une compétition Koppafoot. */}
      <section className="sticky top-[var(--header-h,72px)] z-30 -mx-3 -mt-3 overflow-hidden bg-gray-900 text-white lg:-mx-5 lg:-mt-5">
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
                {competition.type === "CUP" ? t.coupe : t.championnat}
                {pays && <span className="text-white/40"> · {pays}</span>}
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
            {competition.currentMatchday != null && <span>{t.journee(competition.currentMatchday)}</span>}
            <span>{scorers.length > 0 ? t.buteursClasses(scorers.length) : t.buteursAVenir}</span>
            <span>{standings.length > 0 ? t.tableaux(standings.length) : t.classementAVenir}</span>
          </div>
        </div>
      </section>

      <div className="mt-6">
        {/* La grande carte : onglets et contenu. */}
        <div className="min-w-0 border border-gray-200/70 bg-white">
          {available.length > 1 && (
            <div className="flex gap-7 overflow-x-auto border-b border-gray-200/70 px-5">
              {available.map((o) => (
                <Link
                  key={o.id}
                  href={o.id === available[0].id ? base : `${base}?tab=${o.id}`}
                  scroll={false}
                  className={`shrink-0 whitespace-nowrap border-b-2 py-4 text-[11px] font-black uppercase tracking-[0.15em] transition-colors ${
                    tab === o.id
                      ? "border-gray-900 text-gray-900"
                      : "border-transparent text-gray-400 hover:text-gray-700"
                  }`}
                >
                  {t.onglet(o.id)}
                </Link>
              ))}
            </div>
          )}

          <div className="p-5">
            {tab === "classement" && <WorldStandingsTable groups={standings} langue={langue} />}

            {tab === "calendrier" && (
              <div className="space-y-8">
                {upcoming.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
                      {t.prochainsMatchs}
                    </h2>
                    <WorldMatchList matches={upcoming} emptyLabel={t.aucunProgramme} langue={langue} />
                  </section>
                )}
                {recent.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
                      {t.derniersResultats}
                    </h2>
                    <WorldMatchList matches={recent} emptyLabel={t.aucunRecent} langue={langue} />
                  </section>
                )}
              </div>
            )}

            {tab === "buteurs" && <WorldScorersTable scorers={scorers} langue={langue} />}
          </div>
        </div>
      </div>

      {/* Attribution : condition du plan gratuit de football-data.org. Elle
          vivait dans le rail ; celui-ci parti, elle prend sa place ici. */}
      <p className="mt-4 text-[11px] font-bold text-gray-400">
        {t.donneesPar}{" "}
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

function Breadcrumb({ name, area, t }: { name: string; area?: string | null; t: (typeof T)["fr"] }) {
  return (
    <nav
      aria-label={t.filDAriane}
      className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-black uppercase tracking-[0.12em] text-gray-400"
    >
      <Link href="/" className="transition-colors hover:text-emerald-700">{t.direct}</Link>
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
