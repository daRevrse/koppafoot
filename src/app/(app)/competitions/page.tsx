import { Suspense } from "react";
import Link from "next/link";
import { Trophy, ArrowRight } from "lucide-react";
import { getPublicCompetitions } from "@/lib/competition-admin";
import { getWorldCompetitions } from "@/lib/football-data";
import CompetitionDirectorySearch from "@/components/competition/CompetitionDirectorySearch";
import { textes } from "@/i18n/textes";
import { textesServeur } from "@/i18n/serveur";

// Public, login-free directory of all visible competitions, rendered inside
// the general app shell (the (app) layout treats /competitions as public).
// Server Component: fetches via the firebase-admin lib (getPublicCompetitions)
// and the server-only football-data lib, then hands the data to a small client
// search island as props, neither lib enters the client bundle.
//
// The directory carries both families: the Koppafoot competitions you can join,
// and the world game you can only follow. The second is what keeps the page
// worth opening on a day when no local competition is running.
export const revalidate = 60;

const T = textes(
  {
    titreMeta: "Compétitions, Koppafoot",
    description:
      "Suis les compétitions de football amateur et les grands championnats du monde : classements, résultats et calendriers en direct sur Koppafoot.",
    titre: "Compétitions",
    aucune: "Aucune compétition pour le moment.",
    reviens: "Reviens bientôt, ou crée la tienne sur Koppafoot.",
    rejoindre: "Rejoindre Koppafoot",
  },
  {
    titreMeta: "Competitions, Koppafoot",
    description:
      "Follow grassroots football competitions and the world's top leagues: standings, results and fixtures live on Koppafoot.",
    titre: "Competitions",
    aucune: "No competitions yet.",
    reviens: "Come back soon, or create your own on Koppafoot.",
    rejoindre: "Join Koppafoot",
  },
);

export async function generateMetadata() {
  const t = await textesServeur(T);
  return { title: t.titreMeta, description: t.description };
}

export default async function CompetitionsPage() {
  const [competitions, worldCompetitions, t] = await Promise.all([
    getPublicCompetitions(),
    getWorldCompetitions(),
    textesServeur(T),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
        {/* Hero strip, le titre seul : les onglets du répertoire annoncent
            déjà ce que la page contient, et leurs compteurs le chiffrent. */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-black tracking-tight text-gray-900">
            {t.titre}
          </h1>
        </div>

        {competitions.length === 0 && worldCompetitions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-5 border border-gray-100 bg-white py-20 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-400">
              <Trophy size={32} />
            </div>
            <div>
              <p className="font-display text-lg font-black text-gray-900">
                {t.aucune}
              </p>
              <p className="mt-1 text-sm font-bold text-gray-400 italic">
                {t.reviens}
              </p>
            </div>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-black text-white shadow-sm transition-colors hover:bg-emerald-600"
            >
              {t.rejoindre}
              <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          // Suspense: the search island reads ?q= via useSearchParams (the
          // header search bar lands here), required on a static page.
          <Suspense fallback={null}>
            <CompetitionDirectorySearch
              competitions={competitions}
              worldCompetitions={worldCompetitions}
            />
          </Suspense>
        )}
    </div>
  );
}
