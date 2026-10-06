import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Trophy, CalendarDays, MapPin, Users, Radio, ArrowRight, CheckCircle2,
} from "lucide-react";
import { getCompetitionLanding } from "@/lib/competition-admin";
import { COMPETITION_TYPE_LABELS_PAR_LANGUE } from "@/lib/competition-format";
import CompetitionJoinCta from "@/components/competition/CompetitionJoinCta";
import { LOCALE, type Langue } from "@/i18n/config";
import { textes } from "@/i18n/textes";
import { langueServeur } from "@/i18n/serveur";

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

const T = textes(
  {
    duAu: (debut: string, fin: string) => `du ${debut} au ${fin}`,
    aPartirDu: (debut: string) => `à partir du ${debut}`,
    introuvable: "Compétition introuvable",
    descriptionOuverte: (ville: string | null, n: number) =>
      `Les inscriptions sont ouvertes${ville ? ` à ${ville}` : ""}. ${n} équipe${n > 1 ? "s" : ""} déjà engagée${n > 1 ? "s" : ""}, inscris la tienne sur KoppaFoot.`,
    descriptionSuivre: (nom: string, ville: string | null) =>
      `Suis ${nom}${ville ? ` à ${ville}` : ""} en direct sur KoppaFoot : calendrier, scores et classements.`,
    titre: (nom: string) => `${nom}, rejoindre la compétition`,
    inscriptionsOuvertes: "Inscriptions ouvertes",
    equipes: (n: number) => `${n} équipe${n > 1 ? "s" : ""}`,
    organisePar: (nom: string) => `Organisé par ${nom}`,
    ceQueCaChange: "Ce que ça change pour ton équipe",
    directTitre: "Tes matchs en direct",
    directTexte: "Score minute par minute, buteurs et cartons, suivis par tes supporters depuis leur téléphone.",
    classementsTitre: "Classements tenus pour toi",
    classementsTexte: "Poules, tableau final, meilleurs buteurs et passeurs : calculés tout seuls, plus de feuille de calcul.",
    pageTitre: "Une page publique pour ton équipe",
    pageTexte: "Effectif, calendrier, résultats, une adresse à partager, pas une capture d'écran.",
    dossier: "Dossier d'inscription",
    frais: (montant: string) => `Frais d'engagement : ${montant}`,
    lireReglement: "Lire le règlement",
    dejaEngagees: "Déjà engagées",
    voirCompetition: "Voir la compétition",
    calendrierScores: (n: number) =>
      n > 0 ? `Calendrier, scores et classements, ${n} rencontre${n > 1 ? "s" : ""}` : "Calendrier, scores et classements",
  },
  {
    duAu: (debut: string, fin: string) => `from ${debut} to ${fin}`,
    aPartirDu: (debut: string) => `from ${debut}`,
    introuvable: "Competition not found",
    descriptionOuverte: (ville: string | null, n: number) =>
      `Registration is open${ville ? ` in ${ville}` : ""}. ${n} team${n === 1 ? "" : "s"} already in, register yours on KoppaFoot.`,
    descriptionSuivre: (nom: string, ville: string | null) =>
      `Follow ${nom}${ville ? ` in ${ville}` : ""} live on KoppaFoot: fixtures, scores and standings.`,
    titre: (nom: string) => `${nom}, join the competition`,
    inscriptionsOuvertes: "Registration open",
    equipes: (n: number) => `${n} team${n === 1 ? "" : "s"}`,
    organisePar: (nom: string) => `Organised by ${nom}`,
    ceQueCaChange: "What it changes for your team",
    directTitre: "Your matches, live",
    directTexte: "Minute-by-minute score, scorers and cards, followed by your supporters on their phones.",
    classementsTitre: "Standings kept for you",
    classementsTexte: "Groups, bracket, top scorers and assists: worked out automatically, no more spreadsheets.",
    pageTitre: "A public page for your team",
    pageTexte: "Squad, fixtures, results: an address to share, not a screenshot.",
    dossier: "Registration pack",
    frais: (montant: string) => `Entry fee: ${montant}`,
    lireReglement: "Read the rules",
    dejaEngagees: "Already in",
    voirCompetition: "View the competition",
    calendrierScores: (n: number) =>
      n > 0 ? `Fixtures, scores and standings, ${n} match${n === 1 ? "" : "es"}` : "Fixtures, scores and standings",
  },
);

function dateRange(start: string | null, end: string | null, langue: Langue): string | null {
  const t = T[langue];
  const fmt = (iso: string) => {
    try {
      return new Date(`${iso}T00:00:00`).toLocaleDateString(LOCALE[langue], {
        day: "numeric", month: "long",
      });
    } catch {
      return iso;
    }
  };
  if (start && end) return t.duAu(fmt(start), fmt(end));
  if (start) return t.aPartirDu(fmt(start));
  return null;
}

export async function generateMetadata({ params }: PageProps<"/c/[slug]/rejoindre">) {
  const { slug } = await params;
  const [landing, langue] = await Promise.all([getCompetitionLanding(slug), langueServeur()]);
  const t = T[langue];
  if (!landing) return { title: t.introuvable };

  const { competition, teams } = landing;
  const ville = competition.venueCity ?? null;
  const description =
    competition.status === "registration"
      ? t.descriptionOuverte(ville, teams.length)
      : t.descriptionSuivre(competition.name, ville);

  return {
    title: t.titre(competition.name),
    description,
    openGraph: {
      title: competition.name,
      description,
      // LA CLÉ N'EST POSÉE QUE S'IL Y A UNE BANNIÈRE. Écrite en dur avec
      // `undefined` pour valeur, elle suffisait à écarter l'affiche du
      // segment (c/[slug]/opengraph-image) : cette page — celle qu'un
      // organisateur envoie à un président de club — partait donc sans
      // aucune vignette dès que la compétition n'avait pas de bannière.
      ...(competition.bannerUrl ? { images: [competition.bannerUrl] } : {}),
    },
    twitter: { card: "summary_large_image", title: competition.name, description },
  };
}

export default async function JoinCompetitionPage({ params }: PageProps<"/c/[slug]/rejoindre">) {
  const { slug } = await params;
  const [landing, langue] = await Promise.all([getCompetitionLanding(slug), langueServeur()]);
  if (!landing) notFound();
  const t = T[langue];

  const { competition, teams, matchCount } = landing;
  const open = competition.status === "registration";
  const period = dateRange(competition.startDate, competition.endDate, langue);
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
            {open ? t.inscriptionsOuvertes : COMPETITION_TYPE_LABELS_PAR_LANGUE[langue][competition.competitionType]}
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
              {t.equipes(teams.length)}
            </span>
          </div>

          {competition.organizerName && (
            <p className="text-xs font-bold text-emerald-200/70">
              {t.organisePar(competition.organizerName)}
            </p>
          )}
        </div>
      </div>

      {/* ---- The ask ---- */}
      <CompetitionJoinCta competition={competition} />

      {/* ---- What being in it gets you ---- */}
      <div className=" border border-gray-200/70 bg-white p-5">
        <p className="font-display text-base font-black text-gray-900">
          {t.ceQueCaChange}
        </p>
        <ul className="mt-3 space-y-2.5">
          {[
            {
              Icon: Radio,
              title: t.directTitre,
              body: t.directTexte,
            },
            {
              Icon: Trophy,
              title: t.classementsTitre,
              body: t.classementsTexte,
            },
            {
              Icon: Users,
              title: t.pageTitre,
              body: t.pageTexte,
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
          <p className="font-display text-base font-black text-gray-900">{t.dossier}</p>
          {fee != null && (
            <p className="mt-2 flex items-center gap-2 text-sm font-bold text-gray-700">
              <CheckCircle2 size={15} className="shrink-0 text-emerald-500" />
              {t.frais(`${fee.toLocaleString(LOCALE[langue])} ${competition.entryFeeCurrency ?? ""}`.trim())}
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
              {t.lireReglement}
              <ArrowRight size={13} />
            </a>
          )}
        </div>
      )}

      {/* ---- Social proof: who is already in ---- */}
      {teams.length > 0 && (
        <div className=" border border-gray-200/70 bg-white p-5">
          <p className="font-display text-base font-black text-gray-900">{t.dejaEngagees}</p>
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
          <span className="block text-sm font-bold text-gray-900">{t.voirCompetition}</span>
          <span className="block text-xs text-gray-500">
            {t.calendrierScores(matchCount)}
          </span>
        </span>
        <ArrowRight size={18} className="shrink-0 text-emerald-500" />
      </Link>
    </div>
  );
}
