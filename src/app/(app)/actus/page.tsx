import Link from "next/link";
import { ArrowRight, ArrowLeftRight } from "lucide-react";
import { getDirectFeed } from "@/lib/competition-admin";
import { getConfirmedMovements } from "@/lib/mercato-admin";
import type { CompMatch, Competition } from "@/types";

// ============================================
// Actus — the recap of each match day.
//
// Not an editorial desk: nobody writes here. The page reads what actually
// happened — results, scorers, confirmed transfers — and lays it out day by
// day. That is the only kind of "news" a platform can publish without
// someone staffing it, and it is the kind that stays true.
//
// Server-rendered with the admin SDK and revalidated, so it is readable
// signed out: a recap behind a login is a recap nobody reads.
// ============================================

export const revalidate = 300;

export const metadata = {
  title: "Actus — KoppaFoot",
  description:
    "Le résumé de chaque journée du football togolais : résultats, buteurs et mouvements confirmés du mercato.",
};

interface DayRecap {
  date: string;
  matches: { match: CompMatch; competition: Competition }[];
  scorers: { name: string; goals: number }[];
}

const OWN_GOAL = "csc";

/** "samedi 16 août" — the heading of a day. */
function dayHeading(iso: string): string {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long",
    });
  } catch {
    return iso;
  }
}

/** Who scored that day, across every competition, best first. */
function scorersOf(matches: CompMatch[]): { name: string; goals: number }[] {
  const tally = new Map<string, number>();
  for (const m of matches) {
    for (const e of m.liveState?.events ?? []) {
      if (e.type !== "goal" || e.varStatus === "cancelled" || e.detail === OWN_GOAL) continue;
      const name = (e.playerName ?? "").trim();
      if (name === "") continue;
      tally.set(name, (tally.get(name) ?? 0) + 1);
    }
  }
  return [...tally.entries()]
    .map(([name, goals]) => ({ name, goals }))
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name))
    .slice(0, 6);
}

export default async function ActusPage() {
  const [feed, movements] = await Promise.all([
    getDirectFeed(),
    getConfirmedMovements(10),
  ]);

  // Every finished match, tagged with its competition, bucketed by day.
  const byDay = new Map<string, { match: CompMatch; competition: Competition }[]>();
  for (const { competition, matches } of feed) {
    for (const match of matches) {
      if (match.status !== "completed" || match.date == null) continue;
      const list = byDay.get(match.date) ?? [];
      list.push({ match, competition });
      byDay.set(match.date, list);
    }
  }

  const days: DayRecap[] = [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 6)
    .map(([date, entries]) => ({
      date,
      matches: entries,
      scorers: scorersOf(entries.map((e) => e.match)),
    }));

  return (
    <div className="mx-auto max-w-4xl space-y-16 pb-24 pt-4">
      <header>
        <h1 className="font-display text-4xl font-black uppercase leading-[0.95] tracking-tight text-gray-900 sm:text-6xl">
          Les actus
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-gray-500">
          Ce qui s&apos;est joué, journée par journée : résultats, buteurs et
          mouvements confirmés.
        </p>
      </header>

      {days.length === 0 ? (
        <p className="border border-gray-200/70 bg-white px-6 py-16 text-center text-base font-bold text-gray-400">
          Aucune journée terminée pour l&apos;instant.
        </p>
      ) : (
        days.map((day) => (
          <section key={day.date} className="space-y-5">
            <div className="flex items-baseline justify-between gap-4 border-b border-gray-200/70 pb-3">
              <h2 className="font-display text-2xl font-black tracking-tight text-gray-900 first-letter:uppercase sm:text-3xl">
                {dayHeading(day.date)}
              </h2>
              <span className="shrink-0 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
                {day.matches.length} match{day.matches.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="divide-y divide-gray-200/70 border border-gray-200/70 bg-white">
              {day.matches.map(({ match, competition }) => (
                <Link
                  key={`${competition.id}-${match.id}`}
                  href={`/c/${competition.slug}/matches/${match.id}`}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-gray-50"
                >
                  <span className="min-w-0 flex-1 truncate text-right text-base font-bold text-gray-900">
                    {match.homeTeamName}
                  </span>
                  <span className="shrink-0 font-display text-xl font-black tabular-nums text-gray-900">
                    {match.scoreHome ?? 0}
                    <span className="mx-1.5 text-gray-300">-</span>
                    {match.scoreAway ?? 0}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-base font-bold text-gray-900">
                    {match.awayTeamName}
                  </span>
                </Link>
              ))}
            </div>

            {day.scorers.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
                  Buteurs
                </span>
                {day.scorers.map((s) => (
                  <span key={s.name} className="text-sm font-bold text-gray-700">
                    {s.name}
                    {s.goals > 1 && (
                      <span className="ml-1 font-black text-emerald-600">×{s.goals}</span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </section>
        ))
      )}

      {/* ---- Confirmed transfers: public, because a done deal is news ---- */}
      {movements.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-baseline justify-between gap-4 border-b border-gray-200/70 pb-3">
            <h2 className="flex items-center gap-3 font-display text-2xl font-black tracking-tight text-gray-900 sm:text-3xl">
              <ArrowLeftRight size={26} strokeWidth={1.4} className="text-gray-400" />
              Mouvements confirmés
            </h2>
            <Link
              href="/mercato"
              className="flex shrink-0 items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400 transition-colors hover:text-emerald-700"
            >
              Le mercato
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="divide-y divide-gray-200/70 border border-gray-200/70 bg-white">
            {movements.map((m) => (
              <div key={m.id} className="flex items-center gap-4 px-5 py-4">
                {m.playerPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.playerPhoto} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-black text-gray-400">
                    {m.playerName.slice(0, 2).toUpperCase()}
                  </span>
                )}

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-bold text-gray-900">
                    {m.playerName}
                  </span>
                  <span className="block truncate text-xs font-bold text-gray-400">
                    {m.playerPosition ? `${m.playerPosition} · ` : ""}
                    rejoint {m.teamName}
                  </span>
                </span>

                {m.teamLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.teamLogo} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
