import { ExternalLink } from "lucide-react";
import ArticleHero from "@/components/actus/ArticleHero";
import { getSportsArticles } from "@/lib/news-rss";
import { filParJour, type Article } from "@/lib/fil-actus";
import { cleDuJour, decalerDeJours } from "@/lib/dates";
import { LOCALE, type Langue } from "@/i18n/config";
import { textes } from "@/i18n/textes";
import { langueServeur } from "@/i18n/serveur";
import Emplacement from "@/components/partenaires/Emplacement";

// ============================================
// Actus, le fil d'articles de sport.
//
// Ce que cette page n'est pas : un deuxième tableau de scores. Elle en a été
// un, résultats, buteurs, mouvements journée par journée, et c'était un
// doublon de Direct sous un autre titre. Les scores vivent sur Direct, les
// mouvements dans le rail ; ici on lit ce que la presse écrit.
//
// La forme suit la lecture : ce qui est tombé aujourd'hui passe en grand dans
// un hero qu'on fait défiler, le reste s'empile par jour en grilles de six.
// Une journée chargée ne pousse pas la suivante hors de l'écran, sa grille
// défile sur elle-même.
//
// On affiche le titre, le média et l'heure, et le lien part chez l'éditeur.
// Rien n'est recopié : le flux ne porte pas de corps d'article.
// ============================================

export const revalidate = 900;

// Les articles restent dans la langue de la presse qui les publie : on
// traduit la page, pas les titres des autres.
const T = textes(
  {
    titre: "Actus, KoppaFoot",
    description: "L'actualité du football : ce que la presse publie, rassemblé en un fil.",
    plusTot: "Plus tôt",
    aujourdhui: "Aujourd'hui",
    hier: "Hier",
    articles: (n: number) => `${n} article${n > 1 ? "s" : ""}`,
    injoignable: "Le fil d'actualité est injoignable pour le moment.",
  },
  {
    titre: "News, KoppaFoot",
    description: "Football news: what the press publishes, gathered in one feed.",
    plusTot: "Earlier",
    aujourdhui: "Today",
    hier: "Yesterday",
    articles: (n: number) => `${n} article${n === 1 ? "" : "s"}`,
    injoignable: "The news feed can't be reached right now.",
  },
);

type Textes = (typeof T)["fr"];

export async function generateMetadata() {
  const t = T[await langueServeur()];
  return { title: t.titre, description: t.description };
}

/** Deux lignes de trois : au-dela, la grille defile sur elle-meme. */
const GRID_FULL = 2 * 3;

/** « aujourd'hui », « hier », sinon « samedi 16 août ». La journée vient de `filParJour`. */
function dayHeading(cle: string | null, now: Date, langue: Langue, t: Textes): string {
  if (cle === null) return t.plusTot;

  const today = cleDuJour(now);
  if (cle === today) return t.aujourdhui;
  if (cle === decalerDeJours(today, -1)) return t.hier;

  return new Date(`${cle}T00:00:00`).toLocaleDateString(LOCALE[langue], { weekday: "long", day: "numeric", month: "long" });
}

/** « 14:05 », l'heure, dans la journée déjà annoncée par le titre. */
function hour(iso: string, langue: Langue): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(LOCALE[langue], { hour: "2-digit", minute: "2-digit" });
}

function ArticleCard({ article, langue }: { article: Article; langue: Langue }) {
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
              {hour(article.at, langue)}
            </>
          )}
          <ExternalLink size={12} className="ml-auto shrink-0 text-gray-300" aria-hidden />
        </span>
      </span>
    </a>
  );
}

export default async function ActusPage() {
  const [articles, langue] = await Promise.all([getSportsArticles(), langueServeur()]);
  const t = T[langue];

  // La une (cinq articles du jour, photos d'abord) et les journées : le même
  // découpage que l'onglet Actus de l'application (lib/fil-actus).
  const now = new Date();
  const { une, journees } = filParJour(articles, now);

  return (
    <div className="mx-auto max-w-6xl space-y-14 pb-24 pt-4">
      {articles.length === 0 ? (
        <p className="border border-gray-200/70 bg-white px-6 py-16 text-center text-base font-bold text-gray-400">
          {t.injoignable}
        </p>
      ) : (
        <>
          <ArticleHero articles={une} />

          {/* La zone partenaire des Actus, sous la une. Rien sans marque à
              l'affiche (`empty:hidden`). */}
          <div className="empty:hidden">
            <Emplacement emplacement="actus" />
          </div>

          {journees.map((day) => (
            <section key={day.cle ?? "plus-tot"} className="space-y-5">
              <div className="flex items-baseline justify-between gap-4 border-b border-gray-200/70 pb-3">
                <h2 className="font-display text-2xl font-black tracking-tight text-gray-900 first-letter:uppercase sm:text-3xl">
                  {dayHeading(day.cle, now, langue, t)}
                </h2>
                <span className="shrink-0 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
                  {t.articles(day.articles.length)}
                </span>
              </div>

              {/* Au-delà de six, la grille défile sur elle-même plutôt que de
                  repousser la journée suivante hors de l'écran. */}
              <div
                className={
                  day.articles.length > GRID_FULL
                    ? "max-h-[46rem] overflow-y-auto pr-1"
                    : undefined
                }
              >
                {/* Classes litterales : Tailwind lit le source, une classe
                    construite par interpolation ne serait jamais generee. */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {day.articles.map((a) => (
                    <ArticleCard key={a.id} article={a} langue={langue} />
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
