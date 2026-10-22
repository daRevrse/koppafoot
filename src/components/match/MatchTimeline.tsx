"use client";

import { Goal, ArrowDown, ArrowRightLeft, ArrowUp, Flag, Hand, AlertTriangle, Target } from "lucide-react";
import { OWN_GOAL_DETAIL } from "@/lib/competition-firestore";
import { issuePenalty } from "@/lib/evenements";
import {
  TEXTES_FIL, composerFil, libelleDuFait, type Deroule, type EvenementDuFil,
} from "@/lib/fil-du-match";
import { joueursDuRemplacement } from "@/lib/recit-du-match";
import { libelleMinute } from "@/lib/minute-du-match";
import { useLangue, useTextes } from "@/i18n";

// La composition du fil vit dans lib/fil-du-match, partagée avec
// l'application mobile. Les pages importent `Deroule` d'ici.
export type { Deroule };

type Evt = EvenementDuFil;


// ============================================
// L'historique du match, en deux camps.
//
// C'était une liste : une colonne unique où chaque ligne portait, tout à
// droite et en gris pâle, le nom de l'équipe concernée. Il fallait donc LIRE
// pour savoir qui avait marqué — alors qu'un match se raconte en deux camps,
// et qu'une feuille de match se parcourt du regard, pas de haut en bas.
//
// Ici, un événement se range du côté de son acteur : à gauche pour l'équipe
// qui reçoit, à droite pour l'autre. Le côté PORTE l'information, la ligne
// n'a donc plus à répéter le nom de l'équipe à chaque fois.
//
// Ce qui n'appartient à personne — coup d'envoi, mi-temps, fin de rencontre —
// se pose au centre, en travers de l'axe. Ces repères découpent le récit ;
// les ranger d'un côté aurait dit qu'une équipe les a provoqués.
//
// LES REPÈRES SE DÉDUISENT DU DÉROULÉ, ils ne s'attendent plus. La timeline
// savait afficher des événements `period_start` / `period_end`, mais aucune
// console n'en écrit : il n'y avait jamais ni coup d'envoi ni mi-temps dans
// l'historique. Ils viennent maintenant de l'état du match (voir `Deroule`) :
// le coup d'envoi et son heure dès que le match est lancé, la mi-temps et son
// score entre les deux périodes, la fin et le score final quand il est
// terminé. D'éventuels `period_*` écrits un jour sont ignorés, pour ne pas
// doubler chaque repère.
//
// L'axe central porte les minutes. Il tient 44px de large : sur un écran de
// 375px, chaque camp garde environ 150px, de quoi lire un nom et une action.
// ============================================


function Marqueur({ e, annule }: { e: Evt; annule: boolean }) {
  if (e.type === "goal") {
    return <Goal size={14} className={`shrink-0 ${annule ? "text-gray-300" : "text-emerald-600"}`} />;
  }
  if (e.type === "yellow_card") return <span className="h-3.5 w-2.5 shrink-0 bg-amber-400" />;
  if (e.type === "red_card") return <span className="h-3.5 w-2.5 shrink-0 bg-red-500" />;
  if (e.type === "substitution") return <ArrowRightLeft size={13} className="shrink-0 text-blue-500" />;
  if (e.type === "save") return <Hand size={13} className="shrink-0 text-emerald-600" />;
  if (e.type === "foul") return <AlertTriangle size={13} className="shrink-0 text-orange-500" />;
  if (e.type === "offside") return <Flag size={13} className="shrink-0 text-gray-400" />;
  if (e.type === "penalty") {
    return <Target size={13} className={`shrink-0 ${annule ? "text-gray-300" : "text-emerald-600"}`} />;
  }
  return null;
}

/**
 * Un événement rangé dans son camp. `droite` inverse l'ordre et l'alignement.
 *
 * LE JOUEUR D'ABORD, L'ACTION ENSUITE. La ligne ouvrait sur « BUT » en noir
 * et en capitales, le nom du buteur dessous en gris : on lisait deux fois le
 * ballon, et on cherchait qui. L'icône dit déjà l'action ; le nom prend la
 * place forte, l'action passe en petit dessous, avec ce qui la complète — le
 * passeur d'un but.
 *
 * UN REMPLACEMENT SUR DEUX LIGNES, l'entrant puis le sortant. Il tenait en
 * une, « Sortant → Entrant », coupée à la largeur d'un camp : sur téléphone,
 * on lisait « Mawuena Dossou → … », et celui qui entrait disparaissait.
 */
function Ligne({ e, droite, auteur, action }: {
  e: Evt; droite: boolean;
  auteur?: (e: Evt) => string;
  action?: (e: Evt) => React.ReactNode;
}) {
  const { langue } = useLangue();
  const t = useTextes(TEXTES_FIL);
  // Un but que la VAR examine, ou qu'elle a refusé. Le refusé reste dans le
  // fil : le stade l'a vu, et c'est l'historique qui explique pourquoi le
  // score n'a pas bougé.
  const enCours = e.type === "goal" && e.varStatus === "checking";
  const issue = e.type === "penalty" ? issuePenalty(e.detail) : null;
  // Un penalty retiré se barre comme un but refusé : il a été accordé sous
  // les yeux de tout le monde, et le fil doit dire pourquoi rien n'a suivi.
  const annule = (e.type === "goal" && e.varStatus === "cancelled") || issue === "retire";
  // Accordé, et personne n'a encore dit ce qu'il en était. C'est l'état dans
  // lequel le tireur pose le ballon, et il dure le temps qu'il faut.
  const attente = e.type === "penalty" && !issue;
  const nom = (auteur ? auteur(e) : e.playerName ?? "").trim();
  // La page qui nomme l'auteur à la place de la donnée (une équipe hors
  // plateforme, dont les « Joueur 9 » ne nomment personne) a le dernier mot,
  // remplacements compris.
  const nomSurcharge = !!auteur && nom !== (e.playerName ?? "").trim();
  const remplacement = e.type === "substitution" && !nomSurcharge ? joueursDuRemplacement(e) : null;
  const passeur = e.type === "goal" && e.detail !== OWN_GOAL_DETAIL ? e.assistPlayerName?.trim() : null;
  const commande = action?.(e);
  const cote = droite ? "text-left" : "text-right";
  const rangee = droite ? "flex-row" : "flex-row-reverse";

  return (
    <div className={`flex min-w-0 items-start gap-1.5 ${rangee}`}>
      <span className="mt-0.5 flex h-4 shrink-0 items-center">
        <Marqueur e={e} annule={annule} />
      </span>
      <div className={`min-w-0 ${cote}`}>
        {remplacement ? (
          <>
            <p className="sr-only">{t.changementSr}</p>
            {remplacement.entre && (
              <p className={`flex items-center gap-1 text-[13px] font-black leading-tight text-gray-900 ${rangee}`}>
                <ArrowUp size={11} strokeWidth={3} aria-label={t.entre} className="shrink-0 text-emerald-600" />
                <span className="min-w-0 break-words">{remplacement.entre}</span>
              </p>
            )}
            {remplacement.sort && (
              <p className={`mt-0.5 flex items-center gap-1 text-[11px] font-bold leading-tight text-gray-500 ${rangee}`}>
                <ArrowDown size={11} strokeWidth={3} aria-label={t.sort} className="shrink-0 text-red-500" />
                <span className="min-w-0 break-words">{remplacement.sort}</span>
              </p>
            )}
          </>
        ) : (
          <>
            {nom && (
              <p
                className={`break-words text-[13px] font-black leading-tight ${
                  annule ? "text-gray-400 line-through" : "text-gray-900"
                }`}
              >
                {nom}
              </p>
            )}
            <p
              className={`${nom ? "mt-0.5" : ""} text-[10px] font-black uppercase leading-tight tracking-wide ${
                annule ? "text-gray-400 line-through" : "text-gray-500"
              }`}
            >
              {libelleDuFait(e, t, langue)}
            </p>
            {passeur && (
              <p className="mt-0.5 break-words text-[11px] font-semibold leading-tight text-gray-500">
                {t.passeDe(passeur)}
              </p>
            )}
          </>
        )}
        {(enCours || annule || attente) && (
          <span
            className={`mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
              annule ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {(enCours || attente) && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />}
            {annule ? (issue === "retire" ? t.retire : t.refuse) : attente ? t.aTirer : "VAR"}
          </span>
        )}
        {commande && <div className="mt-1">{commande}</div>}
      </div>
    </div>
  );
}


export default function MatchTimeline({
  events, homeTeamId, vide, auteur, action, deroule,
}: {
  events: Evt[];
  homeTeamId: string | null;
  /** Le message quand rien ne s'est encore passé. */
  vide?: string;
  /**
   * De qui vient l'événement, quand la page le sait mieux que la donnée.
   * Un amical contre une équipe hors plateforme n'a aucun nom de joueur en
   * face : c'est le nom de l'équipe qui tient lieu d'auteur.
   */
  auteur?: (e: Evt) => string;
  /** Une commande posée sous l'événement — contester, par exemple. */
  action?: (e: Evt) => React.ReactNode;
  /** L'état du match, d'où viennent coup d'envoi, mi-temps et fin. */
  deroule?: Deroule;
}) {
  const t = useTextes(TEXTES_FIL);
  const elements = composerFil(events, homeTeamId, deroule, vide, t);

  if (elements.length === 0) {
    return (
      <p className="py-10 text-center text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
        {vide ?? t.pasCommence}
      </p>
    );
  }

  // Le plus récent en haut : sur un match en cours, c'est ce qu'on vient
  // chercher, et sur un match fini le déroulé se relit dans les deux sens.
  const fil = [...elements].reverse();

  return (
    <div className="relative">
      {/* L'axe central, derrière les minutes. */}
      <div className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-gray-100" />

      <ol className="relative space-y-3.5">
        {fil.map((el) => {
          if (el.genre === "repere") {
            // Un trait de part en part, le repère au milieu : il coupe le
            // récit, comme il coupe le match. Son fond masque l'axe.
            return (
              <li key={el.cle} className="flex items-center gap-3">
                <span aria-hidden className="flex-1 border-t border-gray-200/70" />
                <span className="shrink-0 bg-white px-1 text-[11px] font-black uppercase tracking-[0.12em] text-gray-500">
                  {el.texte}
                </span>
                <span aria-hidden className="flex-1 border-t border-gray-200/70" />
              </li>
            );
          }

          if (el.genre === "note") {
            return (
              <li key="note" className="flex justify-center py-4">
                <span className="bg-white px-2 text-center text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
                  {el.texte}
                </span>
              </li>
            );
          }

          const e = el.e;
          const chezLui = e.teamId === homeTeamId;
          return (
            <li key={e.id} className="grid grid-cols-[minmax(0,1fr)_2.75rem_minmax(0,1fr)] items-start gap-1">
              <div className="min-w-0">
                {chezLui && <Ligne e={e} droite={false} auteur={auteur} action={action} />}
              </div>

              {/* La minute, sur l'axe. Un résultat saisi après coup n'en porte
                  pas (stockée à 0) : aucun but n'est marqué à la 0e. */}
              <div className="flex justify-center">
                {/* La minute, nue sur l'axe. Elle portait un carré bordé : sur
                    une timeline de quinze événements, quinze cadres alignés
                    faisaient un tableau là où il ne fallait qu'une graduation.
                    Son fond était `bg-[#F4F6FA]`, celui de la PAGE — alors
                    qu'elle est posée sur le panneau, qui est blanc : d'où un
                    rectangle gris en clair, et franchement sombre en thème
                    sombre où `#F4F6FA` devient le fond de page. Il prend la
                    couleur du panneau, donc il ne se voit plus dans aucun des
                    deux thèmes, tout en masquant l'axe qui passe derrière —
                    sans lui, le trait barrerait les chiffres. */}
                {/* `min-w` ET NON `w` : « 45+2' » ne tient pas dans un carré
                    de vingt-huit pixels, et le temps additionnel s'écrit
                    ainsi depuis qu'il ne se confond plus avec la 47e. */}
                <span className="flex h-7 min-w-7 items-center justify-center whitespace-nowrap bg-white px-0.5 text-[11px] font-black tabular-nums text-gray-500">
                  {e.minute ? libelleMinute(e.period, e.minute, deroule?.dureeMiTemps ?? 45, "'", deroule?.dureeProlongation) : "·"}
                </span>
              </div>

              <div className="min-w-0">
                {!chezLui && <Ligne e={e} droite auteur={auteur} action={action} />}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
