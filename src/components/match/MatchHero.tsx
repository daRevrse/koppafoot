"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ChevronRight, MapPin, Share2 } from "lucide-react";
import TirsAuBut from "./TirsAuBut";

// ============================================
// Le tableau d'affichage d'un match. LE MÊME pour un amical et pour une
// rencontre de compétition.
//
// Il y en avait trois : celui de la fiche amicale, celui de la fiche
// compétition, celui de la vue « direct ». Trois hauteurs d'écusson, deux
// tailles de score, et des correctifs qui ne se portaient que d'un côté.
//
// LE FOND EST UNI. Il portait un dégradé sur trois teintes, deux halos
// colorés en `blur-[100px]`, et par-dessus la bannière du match en opacité
// 25 % avec son propre dégradé — quatre couches derrière un score. Un
// tableau d'affichage se lit d'un coup d'œil : ce qui doit ressortir, c'est
// le chiffre, pas ce qu'il y a derrière.
//
// CONSÉQUENCE ASSUMÉE : `bannerUrl` a disparu des propriétés. La bannière
// d'un match n'a plus aucune surface d'affichage dans le produit — elle
// n'était montrée qu'ici.
//
// LE SCORE EST AU CENTRE, D'UN SEUL BLOC. Chaque chiffre était sous son
// écusson, aux deux bouts de l'écran, avec l'état entre les deux : sur un
// téléphone, lire « 7 » puis « 0 » à 300 pixels d'écart ne donne pas un
// score, il faut le recomposer. « 7 – 0 » et, dessous, ce que cela vaut.
//
// LE FIL D'ARIANE EST DEVENU UN BOUTON RETOUR. Trois libellés tronqués sur
// 375 pixels apprenaient moins qu'une flèche, et coûtaient une ligne pleine
// largeur. La destination reste celle du fil : son dernier niveau cliquable.
// ============================================

export type HeroStatus =
  | "upcoming" | "scheduled" | "delayed" | "live" | "completed" | "cancelled";

export interface HeroSide {
  name: string;
  logo: string | null;
  score: number | null;
  /** La fiche de l'équipe. Rend le nom cliquable, sous l'écusson. */
  href?: string | null;
}

export interface Fil {
  label: string;
  href?: string;
}

/** Écusson : le vrai logo s'il existe, sinon l'initiale. */
export function TeamCrest({ name, logo }: { name: string; logo: string | null }) {
  // Pas de fond derrière un vrai écusson : beaucoup de logos sont des PNG
  // transparents, et la plaque se voyait au travers. Le cadre dépoli reste
  // pour l'initiale, qui a besoin d'un support.
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
    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center overflow-hidden border border-white/10 bg-white/5 sm:h-16 sm:w-16">
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

/** Une équipe : son écusson, son nom, et le lien vers sa fiche. */
function Camp({ side }: { side: HeroSide }) {
  return (
    <div className="min-w-0 text-center">
      <TeamCrest name={side.name} logo={side.logo} />
      <h2 className="truncate text-[11px] font-black uppercase tracking-tight sm:text-sm">
        {side.name}
      </h2>
      {side.href && (
        <Link
          href={side.href}
          className="mt-1 inline-block text-[9px] font-black uppercase tracking-[0.12em] text-white/35 transition-colors hover:text-emerald-400 sm:text-[10px]"
        >
          Voir l&apos;équipe
        </Link>
      )}
    </div>
  );
}

interface Props {
  /** Le fil, dont on ne garde que la destination : son dernier niveau cliquable. */
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
  /** Pastilles posées à droite du contexte (validation, contestation). */
  badges?: React.ReactNode;
  /** Le pronostic. Rendu dans le cadre, sur une ligne. */
  poll?: React.ReactNode;
  /** Le bouton de suivi, posé à côté du partage. */
  suivre?: React.ReactNode;
  onShare?: () => void;
}

export default function MatchHero({
  fil, context, status, home, away, date, time, venueName, venueCity,
  periodLabel, clock, penaltyHome, penaltyAway, badges, poll, suivre, onShare,
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

  // Le retour : le dernier niveau du fil qui porte une adresse. Sur une fiche
  // de compétition c'est la compétition, sur un amical la liste des matchs.
  const retour = [...fil].reverse().find((f) => f.href);

  /** Ce qui se lit sous le score : la période, le chrono, l'état. */
  const etat = () => {
    if (isLive) {
      return (
        <span className="flex items-center gap-2">
          {periodLabel && (
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-400">
              {periodLabel}
            </span>
          )}
          {clock && (
            <span className="font-mono text-sm font-black leading-none text-emerald-500">
              {clock}
            </span>
          )}
        </span>
      );
    }
    if (status === "completed") {
      return (
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">
          {periodLabel || "Terminé"}
        </span>
      );
    }
    if (status === "cancelled") {
      return (
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">
          Annulé
        </span>
      );
    }
    return null;
  };

  return (
    <section
      // Collé au header et aux bords : `main` porte `p-3 lg:p-5`, on l'annule.
      // Fond uni : voir l'en-tête du fichier.
      className="relative -mx-3 -mt-3 bg-gray-950 text-white lg:-mx-5 lg:-mt-5"
    >
      <div className="mx-auto max-w-4xl px-4 pb-4 pt-3 sm:px-6 sm:pb-5">
        {/* Retour à gauche, actions à droite. */}
        <div className="flex items-center justify-between gap-2">
          {retour ? (
            <Link
              href={retour.href!}
              aria-label={`Retour vers ${retour.label}`}
              className="flex h-8 w-8 shrink-0 items-center justify-center border border-white/15 text-white/60 transition-colors hover:border-white/40 hover:text-white"
            >
              <ArrowLeft size={15} />
            </Link>
          ) : (
            <span aria-hidden />
          )}

          <div className="flex shrink-0 items-center gap-1.5">
            {suivre}
            {onShare && (
              <button
                type="button"
                onClick={onShare}
                aria-label="Partager ce match"
                className="flex h-8 w-8 items-center justify-center border border-white/15 text-white/60 transition-colors hover:border-white/40 hover:text-white"
              >
                <Share2 size={14} />
              </button>
            )}
          </div>
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

        {/* L'affiche : deux camps, et le score entre eux d'un seul bloc. */}
        <div className="mt-4 grid grid-cols-3 items-start gap-2 sm:gap-6">
          <Camp side={home} />

          <div className="flex flex-col items-center justify-center gap-1.5 pt-2 sm:pt-4">
            {aCommence ? (
              <p className="flex items-baseline gap-2 font-display text-4xl font-black tabular-nums leading-none tracking-tight sm:gap-3 sm:text-6xl">
                <span>{home.score ?? 0}</span>
                <span className="text-white/25">–</span>
                <span>{away.score ?? 0}</span>
              </p>
            ) : status === "cancelled" ? (
              <p className="font-display text-4xl font-black leading-none text-white/20 sm:text-6xl">–</p>
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

            {etat()}

            {/* La séance de tirs au but : sans elle, un 2-2 se lit comme un nul. */}
            <TirsAuBut home={penaltyHome} away={penaltyAway} taille="court" />
          </div>

          <Camp side={away} />
        </div>

        {/* Où, et quand si le centre ne le dit plus. Une ligne. */}
        {metaVisible && (
          <p className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[11px] font-bold text-white/45">
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

        {/* Le pronostic, sur une ligne. */}
        {poll && <div className="mt-4 border-t border-white/10 pt-3">{poll}</div>}
      </div>
    </section>
  );
}
