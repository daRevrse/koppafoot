"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
// LE FOND EST CELUI DE LA PAGE. Il portait un dégradé sur trois teintes, deux
// halos colorés en `blur-[100px]`, et par-dessus la bannière du match — quatre
// couches derrière un score. Puis un aplat sombre, qui découpait encore un
// bandeau au-dessus du reste.
//
// Il n'y a plus de bandeau : le tableau d'affichage est la première chose de
// la page, pas un bloc pose dessus. D'où le passage AU VOCABULAIRE NEUTRE —
// `text-gray-900`, `border-gray-200/70`, `bg-[#F4F6FA]` — le seul que
// styles/dark.css sache réécrire. Le blanc sur fond sombre qu'il employait
// jusqu'ici ne se retournait pas : en thème clair il aurait fallu l'inverser
// à la main, classe par classe, et il n'y a pas de main pour ça.
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
// largeur.
//
// IL REVIENT SUR SES PAS, il ne monte pas d'un cran. Il menait au parent du
// fil — /matches pour un amical — et envoyait donc un JOUEUR arrivé depuis le
// Direct sur une page faite pour les managers, qu'il n'avait jamais demandée.
// Un bouton retour promet l'écran d'avant, pas un rangement théorique.
//
// Le parent reste le repli, et il compte : une fiche ouverte depuis un lien
// partagé n'a pas d'historique où revenir.
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
    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center overflow-hidden border border-gray-200/70 bg-gray-50 sm:h-16 sm:w-16">
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

/**
 * Une équipe : son écusson et son nom, qui mène à sa fiche.
 *
 * Le lien était une ligne « Voir l'équipe » SOUS le nom. Elle disait deux
 * fois la même chose — le nom d'une équipe est déjà ce sur quoi on clique
 * pour la voir — et ajoutait une ligne à un bloc qu'on cherche à tenir sur
 * un écran. Le nom porte le lien.
 */
function Camp({ side }: { side: HeroSide }) {
  const nom = (
    <h2 className="truncate text-[11px] font-black uppercase tracking-tight sm:text-sm">
      {side.name}
    </h2>
  );
  return (
    <div className="min-w-0 text-center">
      <TeamCrest name={side.name} logo={side.logo} />
      {side.href ? (
        <Link href={side.href} className="block min-w-0 transition-colors hover:text-emerald-700">
          {nom}
        </Link>
      ) : (
        nom
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
  const router = useRouter();
  const isLive = status === "live";
  // Un match à venir n'a pas de score : « 0 » se lit comme un 0-0 en cours.
  const aCommence = status === "live" || status === "completed";
  const relatif = date ? jourRelatif(date) : null;

  // La ligne lieu/date sous l'affiche. Avant le coup d'envoi le centre porte
  // déjà le jour et l'heure : les répéter ici ne ferait qu'user une ligne.
  const lieu = [venueName, venueCity].filter(Boolean).join(", ");
  const quand = aCommence && date ? [dateCourte(date), time].filter(Boolean).join(" · ") : null;
  const metaVisible = Boolean(lieu || quand);

  // Le repli du retour : le dernier niveau du fil qui porte une adresse.
  const retour = [...fil].reverse().find((f) => f.href);

  const revenir = () => {
    // `history.length > 1` distingue une navigation interne d'une arrivée
    // directe (lien partagé, onglet neuf), où `back()` sortirait du site.
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else if (retour?.href) router.push(retour.href);
    else router.push("/");
  };

  /** Ce qui se lit sous le score : la période, le chrono, l'état. */
  const etat = () => {
    if (isLive) {
      return (
        <span className="flex items-center gap-2">
          {periodLabel && (
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-600">
              {periodLabel}
            </span>
          )}
          {clock && (
            <span className="font-mono text-sm font-black leading-none text-emerald-600">
              {clock}
            </span>
          )}
        </span>
      );
    }
    if (status === "completed") {
      return (
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">
          {periodLabel || "Terminé"}
        </span>
      );
    }
    if (status === "cancelled") {
      return (
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-red-600">
          Annulé
        </span>
      );
    }
    return null;
  };

  return (
    <section
      // Collé au header et aux bords : `main` porte `p-3 lg:p-5`, on l'annule.
      // Même fond que `main` (voir ScoreShell), donc aucune couture visible.
      className="relative -mx-3 -mt-3 bg-[#F4F6FA] text-gray-900 lg:-mx-5 lg:-mt-5"
    >
      <div className="mx-auto max-w-4xl px-4 pb-4 pt-3 sm:px-6 sm:pb-5">
        {/* Retour à gauche, actions à droite. */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={revenir}
            aria-label="Revenir à l'écran précédent"
            className="flex h-8 w-8 shrink-0 items-center justify-center border border-gray-200/70 text-gray-500 transition-colors hover:border-gray-900 hover:text-gray-900"
          >
            <ArrowLeft size={15} />
          </button>

          <div className="flex shrink-0 items-center gap-1.5">
            {suivre}
            {onShare && (
              <button
                type="button"
                onClick={onShare}
                aria-label="Partager ce match"
                className="flex h-8 w-8 items-center justify-center border border-gray-200/70 text-gray-500 transition-colors hover:border-gray-900 hover:text-gray-900"
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
              className="inline-flex items-center gap-0.5 text-[13px] font-black uppercase tracking-[0.06em] transition-colors hover:text-emerald-700"
            >
              {context.label}
              <ChevronRight size={13} className="shrink-0 text-gray-300" />
            </Link>
          ) : (
            <span className="text-[13px] font-black uppercase tracking-[0.06em]">{context.label}</span>
          )}
          {context.sub && (
            <>
              <span aria-hidden className="text-gray-300">·</span>
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">
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
                <span className="text-gray-300">–</span>
                <span>{away.score ?? 0}</span>
              </p>
            ) : status === "cancelled" ? (
              <p className="font-display text-4xl font-black leading-none text-gray-200 sm:text-6xl">–</p>
            ) : (
              // Le coup d'envoi, à la place du « VS » : c'est ce qu'on vient
              // vérifier sur la fiche d'un match qui n'a pas commencé.
              <>
                {relatif && (
                  <span className="text-[10px] font-black uppercase tracking-[0.1em] text-emerald-600 sm:text-xs">
                    {relatif}
                  </span>
                )}
                {time && <span className="text-base font-black leading-none sm:text-2xl">{time}</span>}
                {!relatif && !time && <span className="font-black italic text-gray-300">VS</span>}
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
          <p className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[11px] font-bold text-gray-500">
            {lieu && (
              <span className="flex min-w-0 items-center gap-1">
                <MapPin size={11} className="shrink-0" />
                <span className="truncate">{lieu}</span>
              </span>
            )}
            {lieu && quand && <span aria-hidden className="text-gray-300">·</span>}
            {quand && <span className="shrink-0">{quand}</span>}
          </p>
        )}

        {/* Le pronostic, sur une ligne. Sans filet au-dessus : il separait
            deux choses qui parlent du meme match, et ajoutait un trait a un
            bloc qui en compte deja assez. */}
        {poll && <div className="mt-5">{poll}</div>}
      </div>
    </section>
  );
}
