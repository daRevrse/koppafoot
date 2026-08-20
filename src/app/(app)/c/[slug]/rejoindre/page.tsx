import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Trophy, CalendarDays, MapPin, Users, Radio, ArrowRight, CheckCircle2,
} from "lucide-react";
import { getCompetitionLanding } from "@/lib/competition-admin";
import { COMPETITION_TYPE_LABELS } from "@/lib/competition-format";
import CompetitionJoinCta from "@/components/competition/CompetitionJoinCta";

// ============================================
// The join page, the link an organizer sends to fill a competition.
//
// Separate from /c/[slug] on purpose: that page answers "what is the score",
// with fixtures, standings and scorers, and it is the right page for someone
// who already follows the competition. This one answers "why should I be in
// it", for someone who just received a WhatsApp message and knows nothing.
//
// Server-rendered with the admin SDK so the link carries a title, a
// description and a thumbnail in the chat preview before any JavaScript
// runs, for a page whose whole job is to be pasted into a conversation,
// that preview IS the first impression.
// ============================================

export const revalidate = 300;

function dateRange(start: string | null, end: string | null): string | null {
  const fmt = (iso: string) => {
    try {
      return new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", {
        day: "numeric", month: "long",
      });
    } catch {
      return iso;
    }
  };
  if (start && end) return `du ${fmt(start)} au ${fmt(end)}`;
  if (start) return `à partir du ${fmt(start)}`;
  return null;
}

export async function generateMetadata({ params }: PageProps<"/c/[slug]/rejoindre">) {
  const { slug } = await params;
  const landing = await getCompetitionLanding(slug);
  if (!landing) return { title: "Compétition introuvable" };

  const { competition, teams } = landing;
  const where = competition.venueCity ? ` à ${competition.venueCity}` : "";
  const description =
    competition.status === "registration"
      ? `Les inscriptions sont ouvertes${where}. ${teams.length} équipe${teams.length > 1 ? "s" : ""} déjà engagée${teams.length > 1 ? "s" : ""}, inscris la tienne sur KoppaFoot.`
      : `Suis ${competition.name}${where} en direct sur KoppaFoot : calendrier, scores et classements.`;

  return {
    title: `${competition.name}, rejoindre la compétition`,
    description,
    openGraph: {
      title: competition.name,
      description,
      images: competition.bannerUrl ? [competition.bannerUrl] : undefined,
    },
  };
}

export default async function JoinCompetitionPage({ params }: PageProps<"/c/[slug]/rejoindre">) {
  const { slug } = await params;
  const landing = await getCompetitionLanding(slug);
  if (!landing) notFound();

  const { competition, teams, matchCount } = landing;
  const open = competition.status === "registration";
  const period = dateRange(competition.startDate, competition.endDate);
  const fee = competition.entryFee;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* ---- Affiche ---- */}
      <div className="relative overflow-hidden">
        {competition.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={competition.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 to-emerald-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/95 via-emerald-950/60 to-emerald-950/30" />

        <div className="relative flex flex-col gap-3 p-5 sm:p-7">
          <span className="flex w-fit items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-950">
            <Trophy size={12} />
            {open ? "Inscriptions ouvertes" : COMPETITION_TYPE_LABELS[competition.competitionType]}
          </span>

          <h1 className="font-display text-2xl font-black leading-tight text-white sm:text-4xl">
            {competition.name}
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-bold text-emerald-100/90">
            {period && (
              <span className="flex items-center gap-1.5">
                <CalendarDays size={14} />
                {period}
              </span>
            )}
            {competition.venueCity && (
              <span className="flex items-center gap-1.5">
                <MapPin size={14} />
                {competition.venueCity}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Users size={14} />
              {teams.length} équipe{teams.length > 1 ? "s" : ""}
            </span>
          </div>

          {competition.organizerName && (
            <p className="text-xs font-bold text-emerald-200/70">
              Organisé par {competition.organizerName}
            </p>
          )}
        </div>
      </div>

      {/* ---- The ask ---- */}
      <CompetitionJoinCta competition={competition} />

      {/* ---- What being in it gets you ---- */}
      <div className=" border border-gray-200/70 bg-white p-5">
        <p className="font-display text-base font-black text-gray-900">
          Ce que ça change pour ton équipe
        </p>
        <ul className="mt-3 space-y-2.5">
          {[
            {
              Icon: Radio,
              title: "Tes matchs en direct",
              body: "Score minute par minute, buteurs et cartons, suivis par tes supporters depuis leur téléphone.",
            },
            {
              Icon: Trophy,
              title: "Classements tenus pour toi",
              body: "Poules, tableau final, meilleurs buteurs et passeurs : calculés tout seuls, plus de feuille de calcul.",
            },
            {
              Icon: Users,
              title: "Une page publique pour ton club",
              body: "Effectif, calendrier, résultats, une adresse à partager, pas une capture d'écran.",
            },
          ].map(({ Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center bg-emerald-50">
                <Icon size={16} className="text-emerald-600" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-gray-900">{title}</span>
                <span className="block text-xs text-gray-500">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* ---- Entry file: only what the organizer actually filled in ---- */}
      {(fee != null || competition.rulesText || competition.rulesUrl) && (
        <div className=" border border-gray-200/70 bg-white p-5">
          <p className="font-display text-base font-black text-gray-900">Dossier d&apos;inscription</p>
          {fee != null && (
            <p className="mt-2 flex items-center gap-2 text-sm font-bold text-gray-700">
              <CheckCircle2 size={15} className="shrink-0 text-emerald-500" />
              Frais d&apos;engagement : {fee.toLocaleString("fr-FR")} {competition.entryFeeCurrency}
            </p>
          )}
          {competition.rulesText && (
            <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-gray-500">
              {competition.rulesText}
            </p>
          )}
          {competition.rulesUrl && (
            <a
              href={competition.rulesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-black text-emerald-600 hover:text-emerald-700"
            >
              Lire le règlement
              <ArrowRight size={13} />
            </a>
          )}
        </div>
      )}

      {/* ---- Social proof: who is already in ---- */}
      {teams.length > 0 && (
        <div className=" border border-gray-200/70 bg-white p-5">
          <p className="font-display text-base font-black text-gray-900">Déjà engagées</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {teams.map((team) => (
              <span
                key={team.id}
                className="flex items-center gap-2 rounded-full bg-gray-50 py-1 pl-1 pr-3"
              >
                {team.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={team.logoUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-[9px] font-black text-emerald-700">
                    {team.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="text-xs font-bold text-gray-700">{team.name}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ---- The scores page, for whoever came only to watch ---- */}
      <Link
        href={`/c/${competition.slug}`}
        className="flex items-center justify-between gap-3 border border-gray-200/70 bg-white p-4 transition-colors hover:border-gray-200/70"
      >
        <span className="min-w-0">
          <span className="block text-sm font-bold text-gray-900">Voir la compétition</span>
          <span className="block text-xs text-gray-500">
            {matchCount > 0
              ? `Calendrier, scores et classements, ${matchCount} rencontre${matchCount > 1 ? "s" : ""}`
              : "Calendrier, scores et classements"}
          </span>
        </span>
        <ArrowRight size={18} className="shrink-0 text-emerald-500" />
      </Link>
    </div>
  );
}
