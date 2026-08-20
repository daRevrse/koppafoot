"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

// ============================================
// Les matchs du jour, dans le rail de la page Actus.
//
// On y lit ce que la presse écrit ; savoir ce qui se joue pendant qu'on lit
// est le complément exact — et évite l'aller-retour vers le Direct pour
// vérifier une heure de coup d'envoi.
//
// Les trois familles y sont (plateforme, amicaux, football mondial), les
// matchs en cours d'abord. Un match du fournisseur externe renvoie vers sa
// compétition : il n'a pas de page chez nous, et c'est voulu.
// ============================================

interface Row {
  id: string;
  home: string;
  away: string;
  homeLogo: string | null;
  awayLogo: string | null;
  time: string | null;
  status: string;
  scoreHome: number | null;
  scoreAway: number | null;
  competition: string;
  href: string | null;
}

const SHOWN = 6;

function Side({ name, logo }: { name: string; logo: string | null }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-4 w-4 shrink-0 object-contain" />
      ) : (
        <span className="h-4 w-4 shrink-0 bg-gray-100" aria-hidden />
      )}
      <span className="min-w-0 truncate text-sm font-bold text-gray-900">{name}</span>
    </span>
  );
}

export default function TodayMatchesRail() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/matches/today")
      .then((r) => (r.ok ? r.json() : { matches: [] }))
      .then((d) => { if (alive) setRows(d.matches ?? []); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, []);

  // Aucun match aujourd'hui : le rail se tait plutôt que d'annoncer un vide.
  if (rows !== null && rows.length === 0) return null;

  return (
    <section aria-labelledby="rail-aujourdhui">
      <div className="flex items-baseline justify-between gap-3 border-b border-gray-200/70 pb-3">
        <h2
          id="rail-aujourdhui"
          className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400"
        >
          Aujourd&apos;hui
        </h2>
        <Link
          href="/"
          className="shrink-0 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400 transition-colors hover:text-emerald-700"
        >
          Le direct
        </Link>
      </div>

      {rows === null ? (
        <div className="flex justify-center py-10">
          <Loader2 size={20} className="animate-spin text-gray-300" />
        </div>
      ) : (
        <ul className="divide-y divide-gray-200/70">
          {rows.slice(0, SHOWN).map((m) => {
            const played = m.scoreHome !== null && m.scoreAway !== null;
            const body = (
              <>
                <p className="mb-2 truncate text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                  {m.competition}
                </p>
                <div className="flex items-center gap-2">
                  <Side name={m.home} logo={m.homeLogo} />
                  <span className="shrink-0 font-display text-sm font-black tabular-nums text-gray-900">
                    {played ? `${m.scoreHome} – ${m.scoreAway}` : (m.time ?? "—")}
                  </span>
                  <Side name={m.away} logo={m.awayLogo} />
                </div>
                {m.status === "live" && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-red-500">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                    En direct
                  </p>
                )}
              </>
            );

            return (
              <li key={m.id} className="py-4">
                {m.href ? (
                  <Link href={m.href} className="block transition-opacity hover:opacity-70">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
