"use client";

import { Swords } from "lucide-react";
import { Sifflet } from "@/components/ui/icones-foot";

// ============================================
// Ce que le tableau d'affichage ne dit pas.
//
// Ce bloc portait la date, la compétition, le terrain, l'arbitre et le
// format : cinq lignes, dont trois que le hero écrit déjà trois centimètres
// plus haut. Un lecteur ne lit pas deux fois la même chose, il défile
// par-dessus — et sur un téléphone ce défilement coûte le seul écran dont on
// dispose.
//
// LE HERO EST DÉSORMAIS LA SOURCE UNIQUE de la rencontre elle-même : la
// compétition et sa journée, le lieu, la date, l'heure. Il ne reste ici que
// ce qu'il ne porte pas — qui arbitre, et à combien on joue.
//
// DEUX CELLULES CÔTE À CÔTE, pas deux lignes empilées : deux mots et deux
// valeurs courtes n'ont pas besoin de toute la largeur chacun.
//
// Le bloc entier disparaît quand il n'a rien à dire — c'est le cas d'un match
// de compétition, où la plateforme ne rattache ni arbitre ni format à la
// rencontre. Mieux vaut une carte de moins qu'une carte de tirets.
// ============================================

export interface MatchInfo {
  /** Le format de jeu, « 11v11 ». Absent sur une rencontre de compétition. */
  format?: string | null;
  /** L'arbitre. `null` quand la page n'a aucun officiel à annoncer. */
  referee?: { name: string | null; confirmed: boolean } | null;
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

  return (
    <section
      className={`grid divide-y divide-gray-200/70 border border-gray-200/70 bg-white sm:grid-cols-2 sm:divide-x sm:divide-y-0 ${className}`}
    >
      {cellules}
    </section>
  );
}
