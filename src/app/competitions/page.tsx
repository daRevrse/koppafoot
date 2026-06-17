import Image from "next/image";
import Link from "next/link";
import { Trophy, ArrowRight } from "lucide-react";
import { getPublicCompetitions } from "@/lib/competition-admin";
import CompetitionDirectorySearch from "@/components/competition/CompetitionDirectorySearch";

// Public, login-free directory of all visible competitions. Server Component:
// fetches via the firebase-admin lib (getPublicCompetitions) and hands the data
// to a small client search island as props — the admin lib never enters the
// client bundle. The middleware (src/proxy.ts) does NOT gate /competitions.
export const revalidate = 60;

export const metadata = {
  title: "Compétitions — Koppafoot",
  description: "Découvre et suis les compétitions de football amateur en direct sur Koppafoot.",
};

export default async function CompetitionsPage() {
  const competitions = await getPublicCompetitions();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Slim public header — mirrors the /c/[slug] shell, plus a join CTA. */}
      <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/branding/logo_symbol.png"
              alt="Koppafoot"
              width={28}
              height={28}
              priority
              className="h-7 w-7"
            />
            <span className="font-display text-base font-black tracking-tight text-gray-900">
              Koppafoot
            </span>
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-sm transition-colors hover:bg-emerald-600"
          >
            Rejoindre
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* Hero strip */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-black tracking-tight text-gray-900">
            Compétitions
          </h1>
          <p className="mt-1 text-sm font-bold text-gray-400">
            {competitions.length === 0
              ? "Le football amateur en direct sur Koppafoot."
              : `${competitions.length} compétition${competitions.length > 1 ? "s" : ""} à suivre en direct.`}
          </p>
        </div>

        {competitions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-5 rounded-[2.5rem] border border-gray-100 bg-white py-20 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-400">
              <Trophy size={32} />
            </div>
            <div>
              <p className="font-display text-lg font-black text-gray-900">
                Aucune compétition pour le moment.
              </p>
              <p className="mt-1 text-sm font-bold text-gray-400 italic">
                Reviens bientôt, ou crée la tienne sur Koppafoot.
              </p>
            </div>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-black text-white shadow-sm transition-colors hover:bg-emerald-600"
            >
              Rejoindre Koppafoot
              <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <CompetitionDirectorySearch competitions={competitions} />
        )}
      </main>
    </div>
  );
}
