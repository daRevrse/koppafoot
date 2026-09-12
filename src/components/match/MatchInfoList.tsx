"use client";

import Link from "next/link";
import { CalendarDays, MapPin, Swords, Trophy } from "lucide-react";
import { Sifflet } from "@/components/ui/icones-foot";
import FollowCompetitionButton from "@/components/competition/FollowCompetitionButton";
import MiniEcusson from "@/components/match/MiniEcusson";

// ============================================
// Les détails du match, dans l'onglet Infos.
//
// LE LIEU, LA DATE ET L'HEURE SONT ICI, et plus dans le tableau d'affichage.
// Ils y tenaient une ligne sous l'affiche ; le tableau ne dit plus que le
// match — les deux camps, le score, et dessous ses buteurs. Infos dit où et
// quand. Avant le coup d'envoi, le tableau garde l'heure et le compte à
// rebours : c'est son contenu, pas une information annexe.
//
// UNE LISTE, un fait par ligne, son icône devant : deux cellules côte à côte
// tenaient pour deux faits, il y en a jusqu'à cinq.
//
// LA COMPÉTITION, POUR SON ÉTOILE. Depuis que la cloche du tableau suit le
// match, plus rien sur la fiche ne permettait de suivre la compétition
// entière. Sa ligne ici est la bonne place : on la suit depuis l'endroit où
// on la décrit.
//
// Une ligne sans valeur ne s'affiche pas, et la carte disparaît quand elle
// n'a rien à dire. Mieux vaut une carte de moins qu'une carte de tirets.
// ============================================

export interface MatchInfo {
  /** Le coup d'envoi prévu. */
  coupDEnvoi?: { date: string | null; time: string | null } | null;
  /** Le terrain, et sa ville. */
  lieu?: { nom: string | null; ville: string | null } | null;
  /** Le format de jeu, « 11v11 ». Absent sur une rencontre de compétition. */
  format?: string | null;
  /** L'arbitre. `null` quand la page n'a aucun officiel à annoncer. */
  referee?: { name: string | null; confirmed: boolean } | null;
  /** La compétition du match, pour la suivre. Absente sur un amical. */
  competition?: {
    id: string;
    name: string;
    /** La phase : « Poule A », « Demi-finale ». */
    sub?: string | null;
    logo?: string | null;
    href?: string | null;
  } | null;
}

function jour(iso: string): Date | null {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** « samedi 12 septembre 2026 ». */
function dateLongue(iso: string): string | null {
  const d = jour(iso);
  return d
    ? d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : null;
}

/** « Aujourd'hui », « Demain », « Hier » — rien au-delà, la date suffit. */
function jourProche(iso: string): string | null {
  const d = jour(iso);
  if (!d) return null;
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  const ecart = Math.round((d.getTime() - aujourdhui.getTime()) / 86_400_000);
  return ecart === 0 ? "Aujourd'hui" : ecart === 1 ? "Demain" : ecart === -1 ? "Hier" : null;
}

function Ligne({ visuel, label, valeur, note, href, action }: {
  visuel: React.ReactNode;
  label: string;
  valeur: string;
  note?: string | null;
  href?: string | null;
  action?: React.ReactNode;
}) {
  return (
    <li className="flex min-w-0 items-center gap-3 px-4 py-3 sm:px-5">
      <span className="flex w-7 shrink-0 justify-center text-gray-400">{visuel}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">{label}</p>
        {href ? (
          <Link href={href} className="block truncate text-sm font-bold text-gray-900 transition-colors hover:text-emerald-700">
            {valeur}
          </Link>
        ) : (
          <p className="truncate text-sm font-bold text-gray-900">{valeur}</p>
        )}
        {note && (
          <p className="truncate text-[10px] font-black uppercase tracking-[0.1em] text-gray-400">{note}</p>
        )}
      </div>
      {action}
    </li>
  );
}

const ICONE = { size: 16, strokeWidth: 1.8 } as const;

export default function MatchInfoList({
  info, className = "",
}: {
  info: MatchInfo;
  className?: string;
}) {
  const lignes: React.ReactNode[] = [];

  const coup = info.coupDEnvoi;
  if (coup && (coup.date || coup.time)) {
    const valeur = [coup.date ? dateLongue(coup.date) : null, coup.time].filter(Boolean).join(" · ");
    if (valeur) {
      lignes.push(
        <Ligne
          key="coup"
          visuel={<CalendarDays {...ICONE} />}
          label="Coup d'envoi"
          valeur={valeur}
          note={coup.date ? jourProche(coup.date) : null}
        />,
      );
    }
  }

  const lieu = info.lieu;
  if (lieu && (lieu.nom || lieu.ville)) {
    lignes.push(
      <Ligne
        key="lieu"
        visuel={<MapPin {...ICONE} />}
        label="Lieu"
        valeur={(lieu.nom || lieu.ville) as string}
        note={lieu.nom ? lieu.ville : null}
      />,
    );
  }

  if (info.competition) {
    const c = info.competition;
    lignes.push(
      <Ligne
        key="comp"
        visuel={c.logo ? <MiniEcusson nom={c.name} logo={c.logo} taille={24} /> : <Trophy {...ICONE} />}
        label="Compétition"
        valeur={c.name}
        note={c.sub}
        href={c.href}
        action={<FollowCompetitionButton cid={c.id} variant="star" />}
      />,
    );
  }

  if (info.referee) {
    lignes.push(
      <Ligne
        key="ref"
        visuel={<Sifflet {...ICONE} />}
        label="Arbitre"
        valeur={info.referee.name || "Non désigné"}
        note={info.referee.confirmed ? "Désigné" : "En attente"}
      />,
    );
  }

  if (info.format) {
    lignes.push(<Ligne key="fmt" visuel={<Swords {...ICONE} />} label="Format" valeur={info.format} />);
  }

  if (lignes.length === 0) return null;

  return (
    <section className={`border border-gray-200/70 bg-white ${className}`}>
      <h2 className="px-4 pt-4 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400 sm:px-5">
        Détails
      </h2>
      <ul className="mt-1 divide-y divide-gray-200/70">{lignes}</ul>
    </section>
  );
}
