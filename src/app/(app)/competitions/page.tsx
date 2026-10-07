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
    surTitre: "Tournois et championnats",
    titre: "Compétitions",
    accroche: "Inscris ton équipe près de chez toi, ou suis les grands championnats.",
    aucune: "Aucune compétition pour le moment.",
    reviens: "Reviens bientôt, ou crée la tienne sur Koppafoot.",
    rejoindre: "Rejoindre Koppafoot",
  },
  {
    titreMeta: "Competitions, Koppafoot",
    description:
      "Follow grassroots football competitions and the world's top leagues: standings, results and fixtures live on Koppafoot.",
    surTitre: "Tournaments and leagues",
    titre: "Competitions",
    accroche: "Enter your team near you, or follow the world's top leagues.",
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

  // La page a la largeur et l'en-tête des autres répertoires (Actus,
  // annuaire des terrains) : un sur-titre, le titre en capitales, une phrase
  // qui dit ce qu'on vient faire ici.
  return (
    <div className="mx-auto max-w-6xl pb-24 pt-2 sm:pt-4">
      <header className="mb-8 sm:mb-10">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">{t.surTitre}</p>
        <h1 className="mt-2 font-display text-4xl font-black uppercase leading-[0.9] tracking-[-0.03em] text-gray-900 sm:text-6xl">
          {t.titre}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-600 sm:text-base">{t.accroche}</p>
      </header>

      {competitions.length === 0 && worldCompetitions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 border border-gray-200/70 bg-white px-6 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center bg-emerald-50 text-emerald-500">
            <Trophy size={30} strokeWidth={1.6} />
          </div>
          <div>
            <p className="font-display text-lg font-black text-gray-900">
              {t.aucune}
            </p>
            <p className="mt-1 text-sm font-bold text-gray-400">
              {t.reviens}
            </p>
          </div>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-emerald-600 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-700"
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
