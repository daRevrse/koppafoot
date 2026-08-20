import { ExternalLink } from "lucide-react";
import ArticleHero from "@/components/actus/ArticleHero";
import { getSportsArticles, type Article } from "@/lib/news-rss";

// ============================================
// Actus — le fil d'articles de sport.
//
// Ce que cette page n'est pas : un deuxième tableau de scores. Elle en a été
// un — résultats, buteurs, mouvements journée par journée — et c'était un
// doublon de Direct sous un autre titre. Les scores vivent sur Direct, les
// mouvements dans le rail ; ici on lit ce que la presse écrit.
//
// La forme suit la lecture : ce qui est tombé aujourd'hui passe en grand dans
// un hero qu'on fait défiler, le reste s'empile par jour en grilles de six.
// Une journée chargée ne pousse pas la suivante hors de l'écran — sa grille
// défile sur elle-même.
//
// On affiche le titre, le média et l'heure, et le lien part chez l'éditeur.
// Rien n'est recopié : le flux ne porte pas de corps d'article.
// ============================================

export const revalidate = 900;

export const metadata = {
  title: "Actus — KoppaFoot",
  description:
    "L'actualité du football : ce que la presse publie, rassemblé en un fil.",
};

/** Deux lignes de trois : au-dela, la grille defile sur elle-meme. */
const GRID_FULL = 2 * 3;

/** « aujourd'hui », « hier », sinon « samedi 16 août ». */
function dayHeading(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Plus tôt";

  const midnight = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((midnight(new Date()) - midnight(d)) / 86_400_000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Hier";

  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/** « 14:05 » — l'heure, dans la journée déjà annoncée par le titre. */
function hour(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function byDay(articles: Article[]): { heading: string; items: Article[] }[] {
  const groups: { heading: string; items: Article[] }[] = [];
  for (const a of articles) {
    const heading = a.at ? dayHeading(a.at) : "Plus tôt";
    const last = groups[groups.length - 1];
    if (last && last.heading === heading) last.items.push(a);
    else groups.push({ heading, items: [a] });
  }
  return groups;
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col border border-gray-200/70 bg-white transition-colors hover:border-gray-900"
    >
      {article.image && (
        <span className="block aspect-[16/10] overflow-hidden bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={article.image} alt="" className="h-full w-full object-cover" />
        </span>
      )}

      <span className="flex flex-1 flex-col p-5">
        <span className="flex-1 text-base font-bold leading-snug text-gray-900 group-hover:text-emerald-700">
          {article.title}
        </span>
        <span className="mt-3 flex flex-wrap items-center gap-x-2 text-[11px] font-black uppercase tracking-[0.12em] text-gray-400">
          {article.source}
          {article.at && (
            <>
              <span className="text-gray-300">·</span>
              {hour(article.at)}
            </>
          )}
          <ExternalLink size={12} className="ml-auto shrink-0 text-gray-300" aria-hidden />
        </span>
      </span>
    </a>
  );
}

export default async function ActusPage() {
  const articles = await getSportsArticles();

  const days = byDay(articles);
  const today = days[0]?.heading === "Aujourd'hui" ? days[0] : null;

  // Les cinq premiers du jour passent en grand. Le hero ne dépend pas d'avoir
  // une image : aucune source atteignable n'en fournit (voir news-rss), et un
  // hero qui n'apparaît que le jour où une photo existe n'apparaîtrait jamais.
  const heroItems = today ? today.items.slice(0, 5) : [];
  const heroIds = new Set(heroItems.map((a) => a.id));

  const sections = days
    .map((d) =>
      d === today ? { ...d, items: d.items.filter((a) => !heroIds.has(a.id)) } : d,
    )
    .filter((d) => d.items.length > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-14 pb-24 pt-4">
      {days.length === 0 ? (
        <p className="border border-gray-200/70 bg-white px-6 py-16 text-center text-base font-bold text-gray-400">
          Le fil d&apos;actualité est injoignable pour le moment.
        </p>
      ) : (
        <>
          <ArticleHero articles={heroItems} />

          {sections.map((day) => (
            <section key={day.heading} className="space-y-5">
              <div className="flex items-baseline justify-between gap-4 border-b border-gray-200/70 pb-3">
                <h2 className="font-display text-2xl font-black tracking-tight text-gray-900 first-letter:uppercase sm:text-3xl">
                  {day.heading}
                </h2>
                <span className="shrink-0 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
                  {day.items.length} article{day.items.length > 1 ? "s" : ""}
                </span>
              </div>

              {/* Au-delà de six, la grille défile sur elle-même plutôt que de
                  repousser la journée suivante hors de l'écran. */}
              <div
                className={
                  day.items.length > GRID_FULL
                    ? "max-h-[46rem] overflow-y-auto pr-1"
                    : undefined
                }
              >
                {/* Classes litterales : Tailwind lit le source, une classe
                    construite par interpolation ne serait jamais generee. */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {day.items.map((a) => (
                    <ArticleCard key={a.id} article={a} />
                  ))}
                </div>
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
