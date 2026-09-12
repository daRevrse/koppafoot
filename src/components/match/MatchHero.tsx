"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Goal, Share2 } from "lucide-react";
import TirsAuBut from "./TirsAuBut";
import MiniEcusson from "./MiniEcusson";
import ClocheMatch, { useSuiviMatch } from "./ClocheMatch";
import { useCompteARebours, formatCompteARebours } from "@/hooks/useCompteARebours";
import { useHauteurPubliee } from "@/hooks/useHauteurPubliee";
import { MOT_RESULTAT, type Resultat } from "@/lib/forme";
import type { Buteur, ButeursDuMatch } from "@/lib/buteurs";

// ============================================
// Le tableau d'affichage d'un match. LE MÊME pour un amical et pour une
// rencontre de compétition.
//
// Il y en avait trois : celui de la fiche amicale, celui de la fiche
// compétition, celui de la vue « direct ». Trois hauteurs d'écusson, deux
// tailles de score, et des correctifs qui ne se portaient que d'un côté.
//
// SOMBRE PAR CONSTRUCTION, DANS LES DEUX THÈMES. Il avait pris le fond de la
// page pour ne plus découper de bandeau au-dessus du reste. On y revient, et
// c'est voulu : la fiche d'un match doit plonger dans le match, et le produit
// a déjà ce registre — la page d'une compétition ouvre sur un bandeau sombre,
// dans le prolongement du header. `text-white`, `bg-gray-950` et les blancs
// translucides sont précisément ce que styles/dark.css ne réécrit pas : le
// bandeau est identique en clair et en sombre, sans une ligne de `dark:`.
//
// SANS IMAGE. Ni photo de pelouse, ni bannière : un halo vert derrière
// l'affiche, comme l'éclairage d'un stade, qui s'éteint dans le noir avant
// d'atteindre la barre — sans quoi la barre, unie, se découperait dessus. La
// bannière d'un match ne sert qu'à son image de partage.
//
// DEUX ÉTATS, UNE SEULE BARRE. La rangée du haut — retour, partage, cloche —
// est collante et ne bouge jamais. En haut de page, son centre est vide et le
// tableau plein s'étale dessous : écussons, noms, forme, l'heure ou le score.
// Quand l'affiche a glissé sous la barre, les deux écussons et le score
// entrent au centre de cette même rangée, et les onglets s'épinglent juste
// dessous. On garde le match sous les yeux au fond d'un long fil.
//
// La première version doublait les boutons : ceux du tableau partaient avec
// lui, et une seconde barre apparaissait en fondu par-dessus — un saut, sous
// le header de l'app en plus. Rien ne bouge plus, sauf ce qui doit entrer.
// Sur téléphone, le header de l'app s'efface d'ailleurs sur cette page (voir
// ScoreShell) : la barre tient seule le haut de l'écran.
//
// LE SCORE EST AU CENTRE, D'UN SEUL BLOC. Chaque chiffre était sous son
// écusson, aux deux bouts de l'écran, avec l'état entre les deux : sur un
// téléphone, lire « 7 » puis « 0 » à 300 pixels d'écart ne donne pas un
// score, il faut le recomposer.
//
// AVANT LE COUP D'ENVOI, LE COMPTE À REBOURS au-dessus de l'heure, dans les
// 24 dernières heures (voir useCompteARebours). Il vivait en grandes cases
// au milieu du fil du match, là où personne ne regarde avant le direct.
//
// LE PRONOSTIC EST PARTI en tête de l'onglet Infos (voir PredictionPoll).
//
// LE LIEU ET LA DATE AUSSI, dans la carte « Détails » d'Infos. Le tableau ne
// dit plus que le match : les deux camps, le score, et dessous ses BUTEURS,
// groupés par joueur avec leurs minutes. Avant le coup d'envoi, il garde
// l'heure et le compte à rebours — c'est son contenu, pas une information
// annexe.
//
// LE BOUTON RETOUR REVIENT SUR SES PAS, il ne monte pas d'un cran. Il menait
// au parent du fil — /matches pour un amical — et envoyait donc un JOUEUR
// arrivé depuis le Direct sur une page faite pour les managers. Le parent
// reste le repli, et il compte : une fiche ouverte depuis un lien partagé
// n'a pas d'historique où revenir.
// ============================================

/**
 * La hauteur réelle de la barre, publiée pour que les onglets s'épinglent
 * juste dessous. Réelle, parce qu'elle varie : sur téléphone, la barre tient
 * le bord de l'écran et s'allonge de la marge de la barre d'état.
 */
export const VARIABLE_HAUTEUR_BARRE = "--barre-match-h";

export type HeroStatus =
  | "upcoming" | "scheduled" | "delayed" | "live" | "completed" | "cancelled";

export interface HeroSide {
  name: string;
  logo: string | null;
  score: number | null;
  /** La fiche de l'équipe. Rend le nom cliquable, sous l'écusson. */
  href?: string | null;
  /** Les derniers résultats, du plus ancien au plus récent. */
  forme?: Resultat[];
}

export interface Fil {
  label: string;
  href?: string;
}

/** Écusson : le vrai logo s'il existe, sinon l'initiale. */
function TeamCrest({ name, logo }: { name: string; logo: string | null }) {
  // Pas de fond derrière un vrai écusson : beaucoup de logos sont des PNG
  // transparents, et la plaque se voyait au travers. Le cadre reste pour
  // l'initiale, qui a besoin d'un support.
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
    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center overflow-hidden border border-white/15 bg-white/5 sm:h-16 sm:w-16">
      <span className="text-xl font-black sm:text-2xl">{name?.[0]?.toUpperCase() || "?"}</span>
    </div>
  );
}

const POINT: Record<Resultat, string> = {
  V: "bg-emerald-400",
  N: "bg-white/40",
  D: "bg-red-500",
};

/**
 * La forme en cinq points, sous le nom. Le plus récent à droite, souligné.
 *
 * Des points sans lettre : à cette taille, la couleur seule tient dans la
 * ligne. Elle ne suffit pas à un daltonien rouge-vert, d'où le libellé lu
 * par les lecteurs d'écran, et la carte « Derniers résultats » de l'onglet
 * Infos, qui porte les lettres et les adversaires.
 */
function PointsDeForme({ forme }: { forme: Resultat[] }) {
  return (
    <span
      role="img"
      aria-label={`Forme, du plus ancien au plus récent : ${forme.map((r) => MOT_RESULTAT[r]).join(", ")}`}
      className="mt-1.5 flex justify-center gap-1"
    >
      {forme.map((r, i) => (
        <span key={i} className="flex flex-col items-center gap-0.5">
          <span className={`h-2 w-2 ${POINT[r]}`} />
          <span className={`h-0.5 w-2 ${i === forme.length - 1 ? POINT[r] : "bg-transparent"}`} />
        </span>
      ))}
    </span>
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

/**
 * Une équipe : son écusson, son nom qui mène à sa fiche, et sa forme.
 *
 * Le lien était une ligne « Voir l'équipe » SOUS le nom. Elle disait deux
 * fois la même chose — le nom d'une équipe est déjà ce sur quoi on clique
 * pour la voir. Le nom porte le lien.
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
        <Link href={side.href} className="block min-w-0 transition-colors hover:text-emerald-300">
          {nom}
        </Link>
      ) : (
        nom
      )}
      {side.forme && side.forme.length > 0 && <PointsDeForme forme={side.forme} />}
    </div>
  );
}

/**
 * Les buteurs d'un camp, alignés vers le centre, leurs minutes à la suite.
 * Un match renseigné n'a pas de minutes : le nombre de buts parle à leur place.
 */
function ListeDeButeurs({ buteurs, droite }: { buteurs: Buteur[]; droite: boolean }) {
  return (
    <ul className={`min-w-0 space-y-0.5 ${droite ? "text-left" : "text-right"}`}>
      {buteurs.map((b) => (
        <li key={`${b.nom}-${b.csc}`} className="break-words">
          {b.nom}
          {b.csc && <span className="text-white/45"> (c.s.c.)</span>}
          {b.minutes.length > 0 ? (
            <span className="ml-1.5 tabular-nums text-white/45">{b.minutes.join(", ")}</span>
          ) : b.nombre > 1 ? (
            <span className="ml-1.5 tabular-nums text-white/45">×{b.nombre}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

const BOUTON =
  "flex h-8 w-8 shrink-0 items-center justify-center border border-white/15 text-white/70 transition-colors hover:border-white hover:text-white";

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
  /** Qui a marqué, de chaque côté, avec ses minutes. Voir lib/buteurs. */
  buteurs?: ButeursDuMatch;
  /** Libellé de période, affiché pendant et après la rencontre. */
  periodLabel?: string | null;
  /** Le chrono déjà formaté, « 12:34 ». Rendu seulement si le match est en cours. */
  clock?: string | null;
  penaltyHome?: number | null;
  penaltyAway?: number | null;
  /** Le match que suit la cloche, et sa compétition s'il en a une. */
  suivi: { mid: string; cid?: string | null };
  onShare?: () => void;
}

export default function MatchHero({
  fil, context, status, home, away, date, time, buteurs,
  periodLabel, clock, penaltyHome, penaltyAway, suivi, onShare,
}: Props) {
  const router = useRouter();
  const cloche = useSuiviMatch(suivi.mid, suivi.cid);
  const isLive = status === "live";
  // Un match à venir n'a pas de score : « 0 » se lit comme un 0-0 en cours.
  const aCommence = status === "live" || status === "completed";
  const relatif = date ? jourRelatif(date) : null;
  const reste = useCompteARebours(aCommence || status === "cancelled" ? null : date, time);
  const compte = reste !== null ? formatCompteARebours(reste) : null;

  // Le repli du retour : le dernier niveau du fil qui porte une adresse.
  const retour = [...fil].reverse().find((f) => f.href);

  const revenir = () => {
    // `history.length > 1` distingue une navigation interne d'une arrivée
    // directe (lien partagé, onglet neuf), où `back()` sortirait du site.
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else if (retour?.href) router.push(retour.href);
    else router.push("/");
  };

  /**
   * LE REPLI SUIT L'AFFICHE, pas la position de défilement. Un observateur
   * d'intersection prévient quand les écussons et le score ont entièrement
   * glissé sous la barre : rien ne tourne à chaque pixel de défilement.
   *
   * Le plafond est le BAS DE LA BARRE, mesuré plutôt que calculé : il
   * additionne le header de l'app (absent sur téléphone), la barre, et la
   * marge de la barre d'état. L'observateur se rebranche quand la fenêtre
   * change de taille, parce que tout cela change avec elle.
   */
  const barre = useHauteurPubliee<HTMLDivElement>(VARIABLE_HAUTEUR_BARRE);
  const affiche = useRef<HTMLDivElement>(null);
  const [replie, setReplie] = useState(false);

  useEffect(() => {
    const cible = affiche.current;
    const bandeau = barre.current;
    if (!cible || !bandeau) return;
    let observateur: IntersectionObserver | null = null;

    const brancher = () => {
      observateur?.disconnect();
      const plafond = Math.round(bandeau.getBoundingClientRect().bottom);
      observateur = new IntersectionObserver(
        ([entree]) => {
          // Sortie PAR LE HAUT seulement : une affiche encore sous le bas de
          // l'écran n'a pas été dépassée.
          setReplie(!entree.isIntersecting && entree.boundingClientRect.top < plafond);
        },
        { rootMargin: `-${plafond}px 0px 0px 0px` },
      );
      observateur.observe(cible);
    };

    brancher();
    window.addEventListener("resize", brancher);
    return () => {
      observateur?.disconnect();
      window.removeEventListener("resize", brancher);
    };
  }, [barre]);

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
            <span className="font-mono text-sm font-black leading-none text-emerald-400">
              {clock}
            </span>
          )}
        </span>
      );
    }
    if (status === "completed") {
      return (
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/50">
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

  /** Le centre de la barre repliée : le score, ou l'heure et ce qu'il en reste. */
  const centreReplie = () => {
    if (aCommence) {
      return (
        <span className="flex flex-col items-center leading-none">
          <span className="font-display text-lg font-black tabular-nums">
            {home.score ?? 0}
            <span className="mx-1.5 text-white/30">–</span>
            {away.score ?? 0}
          </span>
          {isLive && clock ? (
            <span className="mt-1 font-mono text-[10px] font-black text-emerald-400">{clock}</span>
          ) : (
            <span className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-white/45">
              {periodLabel || "Terminé"}
            </span>
          )}
        </span>
      );
    }
    if (status === "cancelled") {
      return <span className="text-[10px] font-black uppercase tracking-[0.14em] text-red-400">Annulé</span>;
    }
    return (
      <span className="flex flex-col items-center leading-none">
        {(compte || relatif) && (
          <span className="text-[10px] font-black tabular-nums text-emerald-400">{compte ?? relatif}</span>
        )}
        <span className="mt-1 font-display text-lg font-black">{time || "VS"}</span>
      </span>
    );
  };

  return (
    <>
      {/* LA BARRE. Collante, et posée AVANT le tableau plutôt que dedans : un
          élément collant ne colle qu'à l'intérieur de son parent, et dans le
          tableau elle partirait avec lui. Ici, son parent est la page entière.
          Collée au header et aux bords : `main` porte `p-3 lg:p-5`, on
          l'annule. `pt-safe` la décolle de la barre d'état quand elle tient
          le bord de l'écran, sur téléphone. */}
      <div
        ref={barre}
        style={{ top: "var(--header-h, 72px)" }}
        className="sticky z-30 -mx-3 -mt-3 bg-gray-950 pt-safe text-white lg:-mx-5 lg:-mt-5"
      >
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4 sm:px-6">
          <button type="button" onClick={revenir} aria-label="Revenir à l'écran précédent" className={BOUTON}>
            <ArrowLeft size={15} />
          </button>

          {/* Le centre, vide tant que l'affiche est à l'écran. Il entre en
              glissant quand elle est passée dessous, et reste inerte d'ici
              là : ni clic, ni tabulation, ni lecteur d'écran ne le trouvent
              en double de l'affiche. */}
          <div
            inert={!replie}
            className={`flex min-w-0 flex-1 items-center justify-center gap-4 transition-[opacity,transform] duration-300 ease-out ${
              replie ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1.5 opacity-0"
            }`}
          >
            <MiniEcusson nom={home.name} logo={home.logo} taille={28} />
            {centreReplie()}
            <MiniEcusson nom={away.name} logo={away.logo} taille={28} />
          </div>

          {/* La cloche au bord, le partage avant elle. */}
          <div className="flex shrink-0 items-center gap-1.5">
            {onShare && (
              <button type="button" onClick={onShare} aria-label="Partager ce match" className={BOUTON}>
                <Share2 size={14} />
              </button>
            )}
            <ClocheMatch etat={cloche} />
          </div>
        </div>
      </div>

      <section className="relative -mx-3 overflow-hidden bg-gray-950 text-white lg:-mx-5">
        {/* Le halo, sans image : l'éclairage d'un stade derrière l'affiche,
            éteint avant les bords. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_85%_at_50%_50%,rgba(6,95,70,0.42),transparent_72%)]"
        />

        <div className="relative mx-auto max-w-4xl px-4 pb-5 pt-1 sm:px-6 sm:pb-6">
          {/* Contexte : d'où vient ce match, sur UNE ligne. */}
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
            {isLive && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-500" />}
            {context.href ? (
              <Link
                href={context.href}
                className="inline-flex items-center gap-0.5 text-[13px] font-black uppercase tracking-[0.06em] transition-colors hover:text-emerald-300"
              >
                {context.label}
                <ChevronRight size={13} className="shrink-0 text-white/30" />
              </Link>
            ) : (
              <span className="text-[13px] font-black uppercase tracking-[0.06em]">{context.label}</span>
            )}
            {context.sub && (
              <>
                <span aria-hidden className="text-white/30">·</span>
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">
                  {context.sub}
                </span>
              </>
            )}
          </div>

          {/* L'affiche : deux camps, et le score entre eux d'un seul bloc.
              C'est elle que surveille le repli. */}
          <div ref={affiche} className="mt-4 grid grid-cols-3 items-start gap-2 sm:gap-6">
            <Camp side={home} />

            <div className="flex flex-col items-center justify-center gap-1.5 pt-2 sm:pt-4">
              {aCommence ? (
                <p className="flex items-baseline gap-2 font-display text-4xl font-black tabular-nums leading-none tracking-tight sm:gap-3 sm:text-6xl">
                  <span>{home.score ?? 0}</span>
                  <span className="text-white/30">–</span>
                  <span>{away.score ?? 0}</span>
                </p>
              ) : status === "cancelled" ? (
                <p className="font-display text-4xl font-black leading-none text-white/25 sm:text-6xl">–</p>
              ) : (
                // Le coup d'envoi, à la place du « VS » : c'est ce qu'on vient
                // vérifier sur la fiche d'un match qui n'a pas commencé. Le
                // compte à rebours remplace le jour dans les dernières 24 h.
                <>
                  {(compte || relatif) && (
                    <span
                      role={compte ? "timer" : undefined}
                      aria-live="off"
                      className="text-[11px] font-black uppercase tabular-nums tracking-[0.1em] text-emerald-400 sm:text-sm"
                    >
                      {compte ?? relatif}
                    </span>
                  )}
                  {time && (
                    <span className="font-display text-3xl font-black leading-none tabular-nums sm:text-5xl">{time}</span>
                  )}
                  {!relatif && !time && <span className="font-black italic text-white/30">VS</span>}
                </>
              )}

              {etat()}

              {/* La séance de tirs au but : sans elle, un 2-2 se lit comme un nul. */}
              <TirsAuBut home={penaltyHome} away={penaltyAway} taille="court" />
            </div>

            <Camp side={away} />
          </div>

          {/* LES BUTEURS, sous l'affiche : chacun de son côté, ses minutes à
              la suite. Le ballon tient l'axe, comme le score au-dessus. */}
          {buteurs && (buteurs.home.length > 0 || buteurs.away.length > 0) && (
            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-3 text-[11px] font-bold text-white/75 sm:text-xs">
              <ListeDeButeurs buteurs={buteurs.home} droite={false} />
              <Goal size={13} aria-hidden className="mt-0.5 text-white/35" />
              <ListeDeButeurs buteurs={buteurs.away} droite />
            </div>
          )}
        </div>
      </section>
    </>
  );
}
