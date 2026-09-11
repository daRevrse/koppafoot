"use client";

import Link from "next/link";
import { Swords, Trophy } from "lucide-react";
import { Sifflet } from "@/components/ui/icones-foot";
import FollowCompetitionButton from "@/components/competition/FollowCompetitionButton";
import MiniEcusson from "@/components/match/MiniEcusson";

// ============================================
// Ce que le tableau d'affichage ne dit pas.
//
// Ce bloc portait la date, la compétition, le terrain, l'arbitre et le
// format : cinq lignes, dont trois que le hero écrit déjà trois centimètres
// plus haut. Un lecteur ne lit pas deux fois la même chose, il défile
// par-dessus — et sur un téléphone ce défilement coûte le seul écran dont on
// dispose.
//
// LE HERO EST DÉSORMAIS LA SOURCE UNIQUE de la rencontre elle-même : le lieu,
// la date, l'heure. Il ne reste ici que ce qu'il ne porte pas — qui arbitre,
// et à combien on joue.
//
// DEUX CELLULES CÔTE À CÔTE, pas deux lignes empilées : deux mots et deux
// valeurs courtes n'ont pas besoin de toute la largeur chacun.
//
// LA COMPÉTITION REVIENT, POUR SON ÉTOILE. Le hero la nomme déjà ; mais depuis
// que sa cloche suit le match, plus rien sur la fiche ne permettait de suivre
// la compétition entière. Sa ligne ici est la bonne place : on la suit depuis
// l'endroit où on la décrit. Un match de compétition n'a ni arbitre ni format
// rattachés, c'est donc souvent la seule cellule.
//
// Le bloc entier disparaît quand il n'a rien à dire. Mieux vaut une carte de
// moins qu'une carte de tirets.
// ============================================

export interface MatchInfo {
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

function Cellule({ Icon, label, valeur, note }: {
  // Le type d'une icone lucide, qui vaut aussi pour les notres : elles sont
  // dessinees a la meme signature (voir components/ui/icones-foot).
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string; valeur: string; note?: string | null;
}) {
  return (
    <div className="flex min-w-0 gap-2.5 px-4 py-3">
      <Icon size={15} strokeWidth={1.8} className="mt-0.5 shrink-0 text-gray-400" />
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">{label}</p>
        <p className="truncate text-sm font-bold text-gray-900">{valeur}</p>
        {note && (
          <p className="truncate text-[10px] font-black uppercase tracking-[0.1em] text-gray-400">{note}</p>
        )}
      </div>
    </div>
  );
}

export default function MatchInfoList({
  info, className = "",
}: {
  info: MatchInfo;
  className?: string;
}) {
  const cellules: React.ReactNode[] = [];

  if (info.competition) {
    const c = info.competition;
    cellules.push(
      <div key="comp" className="flex min-w-0 items-center gap-2.5 px-4 py-3">
        {c.logo ? (
          <MiniEcusson nom={c.name} logo={c.logo} taille={28} />
        ) : (
          <Trophy size={15} strokeWidth={1.8} className="shrink-0 text-gray-400" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">Compétition</p>
          {c.href ? (
            <Link href={c.href} className="block truncate text-sm font-bold text-gray-900 transition-colors hover:text-emerald-700">
              {c.name}
            </Link>
          ) : (
            <p className="truncate text-sm font-bold text-gray-900">{c.name}</p>
          )}
          {c.sub && (
            <p className="truncate text-[10px] font-black uppercase tracking-[0.1em] text-gray-400">{c.sub}</p>
          )}
        </div>
        <FollowCompetitionButton cid={c.id} variant="star" />
      </div>,
    );
  }

  if (info.referee) {
    cellules.push(
      <Cellule
        key="ref"
        Icon={Sifflet}
        label="Arbitre"
        valeur={info.referee.name || "Non désigné"}
        note={info.referee.confirmed ? "Désigné" : "En attente"}
      />,
    );
  }
  if (info.format) {
    cellules.push(<Cellule key="fmt" Icon={Swords} label="Format" valeur={info.format} />);
  }

  if (cellules.length === 0) return null;

  // Une cellule seule prend toute la largeur : dans une grille de deux, elle
  // laisserait une moitié vide.
  const deuxColonnes = cellules.length > 1 ? "sm:grid-cols-2 sm:divide-x sm:divide-y-0" : "";

  return (
    <section
      className={`grid divide-y divide-gray-200/70 border border-gray-200/70 bg-white ${deuxColonnes} ${className}`}
    >
      {cellules}
    </section>
  );
}
