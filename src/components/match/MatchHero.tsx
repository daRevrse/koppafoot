"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, MapPin, Share2 } from "lucide-react";
import TirsAuBut from "./TirsAuBut";

// ============================================
// Le tableau d'affichage d'un match. LE MÊME pour un amical et pour une
// rencontre de compétition.
//
// Il y en avait trois : celui de la fiche amicale, celui de la fiche
// compétition, celui de la vue « direct ». Trois hauteurs d'écusson, deux
// tailles de score, et des correctifs qui ne se portaient que d'un côté — un
// match à venir affichait « 0 – 0 » sur l'amical alors que la page
// compétition savait déjà mettre un tiret.
//
// IL PORTE TOUT CE QU'UNE FICHE DIT DE LA RENCONTRE ELLE-MÊME, et il est le
// seul à le dire. Une page match tient sur un écran de téléphone ou elle ne
// tient nulle part, et chaque fait répété plus bas est un écran de défilement
// gagné pour rien :
//
//  - LE FIL D'ARIANE est dedans. Posé au-dessus, il décollait le hero du
//    header d'une bande grise de 40px qui ne portait qu'un chemin.
//  - LA COMPÉTITION et sa journée tiennent sur UNE ligne (« Miabé CAN 2026 ·
//    Finale ») au lieu de deux. La fiche de détails ne les redit plus.
//  - LE LIEU ET LA DATE sont dans le cadre, sur une ligne, sous l'affiche.
//    Ils appartiennent à la rencontre, pas à une carte posée à côté d'elle —
//    et ils y sont écrits une seule fois pour tout le produit.
//  - LE PRONOSTIC est dedans, sur une seule ligne (voir PredictionPoll). Il
//    vivait dans la colonne de droite, donc, sur un téléphone, sous les
//    onglets, sous les bannières manager et sous la validation post-match :
//    trois écrans avant la seule question qu'on ait envie de poser à
//    quelqu'un devant une affiche.
//
// Le centre annonce le coup d'envoi au lieu d'écrire « VS » : avant le match,
// « VS » ne dit rien que les deux écussons ne disent déjà.
// ============================================

export type HeroStatus =
  | "upcoming" | "scheduled" | "delayed" | "live" | "completed" | "cancelled";

export interface HeroSide {
  name: string;
  logo: string | null;
  score: number | null;
}

export interface Fil {
  label: string;
  href?: string;
}

/** Écusson : le vrai logo s'il existe, sinon l'initiale. */
export function TeamCrest({ name, logo }: { name: string; logo: string | null }) {
  // Pas de fond derrière un vrai écusson : beaucoup de logos sont des PNG
  // transparents, et la plaque se voyait au travers. Le cadre dépoli reste pour l'initiale, qui a besoin d'un support.
  if (logo) {
    return (
      <Image
        src={logo}
        alt={name}
        width={64}
        height={64}
        className="mx-auto mb-2 h-12 w-12 object-contain sm:h-16 sm:w-16"
      />
    );
  }
  return (
    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center overflow-hidden border border-white/10 bg-white/5 shadow-inner backdrop-blur-xl sm:h-16 sm:w-16">
      <span className="text-xl font-black sm:text-2xl">{name?.[0]?.toUpperCase() || "?"}</span>
    </div>
  );
}

/**
 * « Aujourd'hui », « Demain », sinon « sam. 12 sept. ». On compare des jours
 * calendaires et non des millisecondes : un match à 22h ce soir est
 * aujourd'hui, pas « dans 3 heures ».
 */
function jourRelatif(iso: string): string | null {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  const jours = Math.round((d.getTime() - aujourdhui.getTime()) / 86_400_000);
  if (jours === 0) return "Aujourd'hui";
  if (jours === 1) return "Demain";
  if (jours === -1) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

/** « sam. 29 août », la date sous sa forme courte pour la ligne de contexte. */
function dateCourte(iso: string): string | null {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

interface Props {
  /** Le fil d'ariane, dernier élément compris. Rendu dans le cadre. */
  fil: Fil[];
  /** La ligne de contexte : la compétition et sa journée, ou « Match amical ». */
  context: { label: string; href?: string | null; sub?: string | null };
  status: HeroStatus;
  home: HeroSide;
  away: HeroSide;
  date: string | null;
  time: string | null;
  venueName?: string | null;
  venueCity?: string | null;
  /** Libellé de période, affiché pendant et après la rencontre. */
  periodLabel?: string | null;
  /** Le chrono déjà formaté, « 12:34 ». Rendu seulement si le match est en cours. */
  clock?: string | null;
  penaltyHome?: number | null;
  penaltyAway?: number | null;
  bannerUrl?: string | null;
  /** Pastilles posées à droite du contexte (validation, contestation). */
  badges?: React.ReactNode;
  /** Le pronostic. Rendu dans le cadre, sur une ligne. */
  poll?: React.ReactNode;
  onShare?: () => void;
}

export default function MatchHero({
  fil, context, status, home, away, date, time, venueName, venueCity,
  periodLabel, clock, penaltyHome, penaltyAway, bannerUrl, badges, poll, onShare,
}: Props) {
  const isLive = status === "live";
  // Un match à venir n'a pas de score : « 0 » se lit comme un 0-0 en cours.
  const aCommence = status === "live" || status === "completed";
  const relatif = date ? jourRelatif(date) : null;

  // La ligne lieu/date sous l'affiche. Avant le coup d'envoi le centre porte
  // déjà le jour et l'heure : les répéter ici ne ferait qu'user une ligne.
  const lieu = [venueName, venueCity].filter(Boolean).join(", ");
  const quand = aCommence && date ? [dateCourte(date), time].filter(Boolean).join(" · ") : null;
  const metaVisible = Boolean(lieu || quand);

  return (
    <section
      // Collé au header et aux bords : `main` porte `p-3 lg:p-5`, on l'annule.
      // Le hero est le sujet de la page, il n'a pas à commencer 12px plus bas
      // derrière une bande grise.
      //
      // PAS D'ANIMATION D'ENTRÉE. Il en portait une, héritée de l'ancien
      // tableau d'affichage : un fondu de 400ms sur le bloc qui porte
      // désormais le fil d'ariane, le score et le pronostic — c'est-à-dire
      // sur tout ce qu'on est venu lire, et sur la navigation. Faire attendre
      // le sujet de la page pour l'annoncer joliment est un mauvais échange.
      className="relative -mx-3 -mt-3 overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white lg:-mx-5 lg:-mt-5"
    >
      {bannerUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/85 via-gray-900/75 to-black/85" />
        </>
      )}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-blue-500/10 blur-[100px]" />

      <div className="relative z-10 mx-auto max-w-4xl px-4 pb-4 pt-2.5 sm:px-6 sm:pb-5 sm:pt-3">
        {/* Fil d'ariane et partage, sur la même ligne. */}
        <div className="flex items-center gap-2">
          {/* Les niveaux intermédiaires disparaissent sous `sm`. Un fil complet
              sur 375px ne tient pas : les trois libellés se chevauchaient. Le
              parent direct et la page courante suffisent à dire où l'on est —
              et « Direct » est de toute façon dans la barre du bas. */}
          <nav
            aria-label="Fil d'ariane"
            className="flex min-w-0 flex-1 items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-white/40"
          >
            {fil.map((f, i) => {
              const dernier = i === fil.length - 1;
              const avantDernier = i === fil.length - 2;
              return (
                <span
                  key={i}
                  className={`flex min-w-0 items-center gap-1.5 ${
                    dernier || avantDernier ? "flex" : "hidden sm:flex"
                  }`}
                >
                  {i > 0 && <span aria-hidden className={avantDernier ? "hidden text-white/20 sm:inline" : "text-white/20"}>›</span>}
                  {f.href ? (
                    <Link href={f.href} className="truncate transition-colors hover:text-white">
                      {f.label}
                    </Link>
                  ) : (
                    <span className="truncate text-white/60">{f.label}</span>
                  )}
                </span>
              );
            })}
          </nav>
          {onShare && (
            <button
              type="button"
              onClick={onShare}
              aria-label="Partager ce match"
              className="flex h-7 w-7 shrink-0 items-center justify-center border border-white/15 text-white/50 transition-colors hover:border-white/40 hover:text-white"
            >
              <Share2 size={13} />
            </button>
          )}
        </div>

        {/* Contexte : d'où vient ce match, sur UNE ligne. */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
          {isLive && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-500" />}
          {context.href ? (
            <Link
              href={context.href}
              className="inline-flex items-center gap-0.5 text-[13px] font-black uppercase tracking-[0.06em] transition-colors hover:text-emerald-400"
            >
              {context.label}
              <ChevronRight size={13} className="shrink-0 text-white/30" />
            </Link>
          ) : (
            <span className="text-[13px] font-black uppercase tracking-[0.06em]">{context.label}</span>
          )}
          {context.sub && (
            <>
              <span aria-hidden className="text-white/20">·</span>
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">
                {context.sub}
              </span>
            </>
          )}
          {badges}
        </div>

        {/* L'affiche */}
        <div className="mt-3 grid grid-cols-3 items-start gap-2 sm:gap-6">
          <div className="min-w-0 text-center">
            <TeamCrest name={home.name} logo={home.logo} />
            <h2 className="truncate text-[11px] font-black uppercase tracking-tight sm:text-sm">{home.name}</h2>
            <div className="text-4xl font-black tabular-nums leading-none tracking-tighter sm:text-6xl">
              {aCommence ? home.score ?? 0 : <span className="text-white/25">–</span>}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-1 pt-3 sm:pt-5">
            {isLive ? (
              <>
                {periodLabel && (
                  <span className="whitespace-nowrap rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-400 sm:px-3 sm:text-[10px]">
                    {periodLabel}
                  </span>
                )}
                {clock && (
                  <span className="font-mono text-xl font-black leading-none text-emerald-500 sm:text-4xl">{clock}</span>
                )}
              </>
            ) : status === "completed" ? (
              <span className="whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white/50 sm:px-3 sm:text-[10px]">
                {periodLabel || "Terminé"}
              </span>
            ) : status === "cancelled" ? (
              <span className="whitespace-nowrap rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-red-400 sm:px-3 sm:text-[10px]">
                Annulé
              </span>
            ) : (
              // Le coup d'envoi, à la place du « VS » : c'est ce qu'on vient
              // vérifier sur la fiche d'un match qui n'a pas commencé.
              <>
                {relatif && (
                  <span className="text-[10px] font-black uppercase tracking-[0.1em] text-emerald-400 sm:text-xs">
                    {relatif}
                  </span>
                )}
                {time && <span className="text-base font-black leading-none sm:text-2xl">{time}</span>}
                {!relatif && !time && <span className="font-black italic text-white/30">VS</span>}
              </>
            )}
            {/* La séance de tirs au but : sans elle, un 2-2 se lit comme un nul. */}
            <TirsAuBut home={penaltyHome} away={penaltyAway} taille="court" className="mt-1" />
          </div>

          <div className="min-w-0 text-center">
            <TeamCrest name={away.name} logo={away.logo} />
            <h2 className="truncate text-[11px] font-black uppercase tracking-tight sm:text-sm">{away.name}</h2>
            <div className="text-4xl font-black tabular-nums leading-none tracking-tighter sm:text-6xl">
              {aCommence ? away.score ?? 0 : <span className="text-white/25">–</span>}
            </div>
          </div>
        </div>

        {/* Où, et quand si le centre ne le dit plus. Une ligne. */}
        {metaVisible && (
          <p className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[11px] font-bold text-white/45">
            {lieu && (
              <span className="flex min-w-0 items-center gap-1">
                <MapPin size={11} className="shrink-0" />
                <span className="truncate">{lieu}</span>
              </span>
            )}
            {lieu && quand && <span aria-hidden className="text-white/20">·</span>}
            {quand && <span className="shrink-0">{quand}</span>}
          </p>
        )}

        {/* Le pronostic, sur une ligne. Voir l'en-tête du fichier. */}
        {poll && <div className="mt-3 border-t border-white/10 pt-3">{poll}</div>}
      </div>
    </section>
  );
}
