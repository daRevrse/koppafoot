"use client";

import { Goal, ArrowRightLeft, Flag, Hand, AlertTriangle } from "lucide-react";
import { OWN_GOAL_DETAIL } from "@/lib/competition-firestore";
import type { Match } from "@/types";

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
// L'axe central porte les minutes. Il tient 44px de large : sur un écran de
// 375px, chaque camp garde environ 150px, de quoi lire un nom et une action.
// ============================================

type Evt = NonNullable<Match["liveState"]>["events"][number];

/** Ce qui n'appartient à aucun camp et se pose au centre. */
function estRepere(e: Evt): boolean {
  return e.type === "period_start" || e.type === "period_end";
}

const LIBELLE_PERIODE: Record<number, string> = {
  1: "Coup d'envoi",
  2: "Mi-temps",
  3: "Reprise",
  4: "Fin du match",
};

function libelle(e: Evt): string {
  switch (e.type) {
    case "goal":
      return e.detail === OWN_GOAL_DETAIL ? "But contre son camp" : "But";
    case "yellow_card":
      return "Carton jaune";
    case "red_card":
      return e.detail === "2e carton jaune" ? "Expulsion (2e jaune)" : "Carton rouge";
    case "substitution":
      return "Changement";
    case "save":
      return "Arrêt";
    case "foul":
      // La faute se lit avec sa victime : « Faute sur Mensah » raconte
      // l'action, « Faute » ne dit que la moitié de ce qui s'est passé.
      return e.victimPlayerName ? `Faute sur ${e.victimPlayerName}` : "Faute";
    case "offside":
      return "Hors-jeu";
    default:
      return "Événement";
  }
}

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
  return null;
}

/** Un événement rangé dans son camp. `droite` inverse l'ordre et l'alignement. */
function Ligne({ e, droite, auteur, action }: {
  e: Evt; droite: boolean;
  auteur?: (e: Evt) => string;
  action?: (e: Evt) => React.ReactNode;
}) {
  // Un but que la VAR examine, ou qu'elle a refusé. Le refusé reste dans le
  // fil : le stade l'a vu, et c'est l'historique qui explique pourquoi le
  // score n'a pas bougé.
  const enCours = e.type === "goal" && e.varStatus === "checking";
  const annule = e.type === "goal" && e.varStatus === "cancelled";
  const detail = auteur
    ? auteur(e)
    : e.type === "substitution" && e.detail ? e.detail : e.playerName || "";
  const commande = action?.(e);

  return (
    <div className={`flex min-w-0 items-start gap-1.5 ${droite ? "flex-row" : "flex-row-reverse"}`}>
      <Marqueur e={e} annule={annule} />
      <div className={`min-w-0 ${droite ? "text-left" : "text-right"}`}>
        <p
          className={`truncate text-[11px] font-black uppercase tracking-wide ${
            annule ? "text-gray-400 line-through" : "text-gray-900"
          }`}
        >
          {libelle(e)}
        </p>
        {detail && <p className="truncate text-[11px] font-bold text-gray-500">{detail}</p>}
        {(enCours || annule) && (
          <span
            className={`mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
              annule ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {enCours && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />}
            {annule ? "Refusé" : "VAR"}
          </span>
        )}
        {commande && <div className="mt-1">{commande}</div>}
      </div>
    </div>
  );
}

export default function MatchTimeline({
  events, homeTeamId, vide, auteur, action,
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
}) {
  if (events.length === 0) {
    return (
      <p className="py-10 text-center text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
        {vide ?? "Le match n'a pas encore commencé"}
      </p>
    );
  }

  // Le plus récent en haut : sur un match en cours, c'est ce qu'on vient
  // chercher, et sur un match fini le déroulé se relit dans les deux sens.
  const fil = [...events].reverse();

  return (
    <div className="relative">
      {/* L'axe central, derrière les minutes. */}
      <div className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-gray-100" />

      <ol className="relative space-y-3.5">
        {fil.map((e) => {
          if (estRepere(e)) {
            return (
              <li key={e.id} className="flex justify-center">
                <span className="inline-flex items-center gap-1.5 border border-gray-200/70 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                  <Flag size={11} className="shrink-0" />
                  {LIBELLE_PERIODE[e.period] ?? "Période"}
                </span>
              </li>
            );
          }

          const chezLui = e.teamId === homeTeamId;
          return (
            <li key={e.id} className="grid grid-cols-[minmax(0,1fr)_2.75rem_minmax(0,1fr)] items-start gap-1">
              <div className="min-w-0">
                {chezLui && <Ligne e={e} droite={false} auteur={auteur} action={action} />}
              </div>

              {/* La minute, sur l'axe. Un résultat saisi après coup n'en porte
                  pas (stockée à 0) : aucun but n'est marqué à la 0e. */}
              <div className="flex justify-center">
                <span className="flex h-7 w-7 items-center justify-center border border-gray-200/70 bg-white text-[10px] font-black tabular-nums text-gray-500">
                  {e.minute ? `${e.minute}'` : "·"}
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
