"use client";

import Link from "next/link";
import { CalendarDays, MapPin, Trophy, ChevronRight } from "lucide-react";
import PredictionPoll from "./PredictionPoll";

// ============================================
// La colonne de droite d'une page match.
//
// Elle est rendue PAR la page et non par le shell : son contenu dépend du
// match, et dans l'App Router une page ne peut pas alimenter le layout qui
// l'enveloppe. ScoreShell referme donc sa propre gouttière sur ces routes
// (voir routeOwnsItsRail) pour qu'on n'ait pas deux colonnes vides côte à
// côte.
//
// Ce qui n'y figure pas, et pourquoi : pas d'arbitre, aucun champ ne relie
// un match à un officiel, et la plateforme ne compte qu'un arbitre référencé ;
// pas de diffuseur, personne ne diffuse ces matchs. Mieux vaut trois blocs
// pleins que cinq dont deux mentent.
// ============================================

export interface RailMatch {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  date: string | null;
  time: string | null;
  venueName: string | null;
  venueCity: string | null;
  /** Le coup d'envoi est passé ou le match est joué. */
  started: boolean;
  competition?: { name: string; href: string; round: string | null } | null;
}

/** « mardi 19 août 2026 », ou l'ISO tel quel s'il est illisible. */
function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function Row({ Icon, label, children }: {
  Icon: typeof CalendarDays; label: string; children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 px-5 py-4">
      <Icon size={16} strokeWidth={1.8} className="mt-0.5 shrink-0 text-gray-400" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">{label}</p>
        <div className="mt-1 text-sm font-bold text-gray-900">{children}</div>
      </div>
    </div>
  );
}

export default function MatchRail({ match }: { match: RailMatch }) {
  const hasVenue = !!(match.venueName || match.venueCity);

  return (
    <div className="space-y-4">
      <PredictionPoll
        matchId={match.id}
        home={{ label: match.homeTeamName, logo: match.homeTeamLogo }}
        away={{ label: match.awayTeamName, logo: match.awayTeamLogo }}
        closed={match.started}
      />

      <section className="divide-y divide-gray-200/70 border border-gray-200/70 bg-white">
        {(match.date || match.time) && (
          <Row Icon={CalendarDays} label="Date et heure">
            {match.date ? longDate(match.date) : "Date à confirmer"}
            {match.time && <span className="text-gray-400"> · {match.time}</span>}
          </Row>
        )}

        {match.competition && (
          <Row Icon={Trophy} label="Compétition">
            <Link
              href={match.competition.href}
              className="inline-flex items-center gap-1 transition-colors hover:text-emerald-700"
            >
              {match.competition.name}
              <ChevronRight size={14} className="shrink-0 text-gray-300" />
            </Link>
            {match.competition.round && (
              <p className="mt-0.5 text-[11px] font-black uppercase tracking-[0.12em] text-gray-400">
                {match.competition.round}
              </p>
            )}
          </Row>
        )}
      </section>

      {hasVenue && (
        <section className="border border-gray-200/70 bg-white">
          <h2 className="border-b border-gray-200/70 px-5 py-3 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
            Lieu
          </h2>
          <Row Icon={MapPin} label={match.venueName ? "Stade" : "Ville"}>
            {match.venueName ?? match.venueCity}
            {match.venueName && match.venueCity && (
              <p className="mt-0.5 text-[11px] font-black uppercase tracking-[0.12em] text-gray-400">
                {match.venueCity}
              </p>
            )}
          </Row>
        </section>
      )}
    </div>
  );
}
