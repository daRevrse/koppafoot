import { CalendarDays } from "lucide-react";
import type { FootballMatch } from "@/lib/football-data";

// ============================================
// WorldMatchList
//
// The provider's fixtures, bucketed by day. Server-rendered on purpose — this
// and the standings are what a search engine indexes — which forces one choice:
// the API gives real UTC instants, so a server render has to commit to a
// timezone rather than the visitor's. It commits to Lomé (GMT), the audience's
// own clock, and says so under the list. Change TZ here and the whole page
// follows.
// ============================================

const TZ = "Africa/Lome";
const TZ_LABEL = "Heures à Lomé (GMT)";

const dayKeyFmt = new Intl.DateTimeFormat("fr-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dayLabelFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
});
const timeFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
});

/** fr-CA gives an ISO-shaped YYYY-MM-DD, which sorts and compares cleanly. */
function dayKey(utcDate: string): string {
  return dayKeyFmt.format(new Date(utcDate));
}

export default function WorldMatchList({
  matches,
  emptyLabel,
}: {
  matches: FootballMatch[];
  emptyLabel: string;
}) {
  if (matches.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white py-12 text-center shadow-sm">
        <CalendarDays size={24} className="mx-auto text-gray-300" />
        <p className="mt-2 text-sm font-bold text-gray-400 italic">{emptyLabel}</p>
      </div>
    );
  }

  // Bucket by day, preserving the order the caller sorted them in.
  const days: { key: string; items: FootballMatch[] }[] = [];
  for (const match of matches) {
    const key = dayKey(match.utcDate);
    const last = days[days.length - 1];
    if (last && last.key === key) last.items.push(match);
    else days.push({ key, items: [match] });
  }

  return (
    <div className="space-y-4">
      {days.map((day) => (
        <div
          key={day.key}
          className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-4 py-2.5">
            <p className="text-xs font-black uppercase tracking-wide text-gray-500">
              {dayLabelFmt.format(new Date(day.items[0].utcDate))}
            </p>
            <span className="text-[11px] font-bold text-gray-400">
              {day.items.length} match{day.items.length > 1 ? "s" : ""}
            </span>
          </div>

          {day.items.map((match) => {
            const played = match.scoreHome != null && match.scoreAway != null;
            const isLive = match.status === "IN_PLAY" || match.status === "PAUSED";
            return (
              <div
                key={match.id}
                className="flex items-center gap-3 border-b border-gray-50 px-4 py-3 last:border-0"
              >
                {/* Time */}
                <div className="w-12 shrink-0 text-center">
                  {isLive ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-black text-red-500">
                      <span className="h-1 w-1 rounded-full bg-red-500" />
                      LIVE
                    </span>
                  ) : (
                    <time
                      dateTime={match.utcDate}
                      className="text-xs font-black tabular-nums text-gray-900"
                    >
                      {timeFmt.format(new Date(match.utcDate))}
                    </time>
                  )}
                </div>

                {/* Home */}
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <TeamCrest name={match.home.name} crest={match.home.crest} />
                  <span
                    className={`truncate text-sm font-bold ${
                      played && (match.scoreHome ?? 0) < (match.scoreAway ?? 0)
                        ? "text-gray-400"
                        : "text-gray-900"
                    }`}
                  >
                    {match.home.name}
                  </span>
                </div>

                {/* Score / VS */}
                {played ? (
                  <span
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-black tabular-nums text-white ${
                      isLive ? "bg-red-500" : "bg-gray-900"
                    }`}
                  >
                    {match.scoreHome}:{match.scoreAway}
                  </span>
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 text-[9px] font-black text-gray-400">
                    VS
                  </span>
                )}

                {/* Away */}
                <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                  <span
                    className={`truncate text-right text-sm font-bold ${
                      played && (match.scoreAway ?? 0) < (match.scoreHome ?? 0)
                        ? "text-gray-400"
                        : "text-gray-900"
                    }`}
                  >
                    {match.away.name}
                  </span>
                  <TeamCrest name={match.away.name} crest={match.away.crest} />
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <p className="px-1 text-[11px] font-bold text-gray-300">{TZ_LABEL}</p>
    </div>
  );
}

// Provider URLs → plain <img>, like the other football-data components.
function TeamCrest({ name, crest }: { name: string; crest: string | null }) {
  if (crest) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={crest} alt="" className="h-6 w-6 shrink-0 object-contain" />;
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[9px] font-bold text-emerald-700">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}
