// ============================================
// La mention « décidé aux tirs au but ».
//
// Le score seul ment sur ce genre de rencontre : un 2-2 affiché sans rien
// d'autre laisse croire à un nul alors qu'une équipe est passée. La séance
// n'était affichée QUE dans la console de compétition — nulle part sur le
// Direct, ni sur la fiche d'un match, ni dans l'historique d'un club.
//
// Un composant partagé plutôt qu'une phrase recopiée : la mention doit dire la
// même chose partout, et c'est justement de ne pas être partout qu'elle
// souffrait.
// ============================================

interface Props {
  home: number | null | undefined;
  away: number | null | undefined;
  /**
   * « court » pour une carte ou une ligne de tableau, « long » pour une fiche.
   * Rien d'autre ne change : les deux disent la même chose.
   */
  taille?: "court" | "long";
  className?: string;
}

/** Y a-t-il eu une séance ? Les deux totaux, ou rien. */
export function decideAuxTirsAuBut(
  home: number | null | undefined,
  away: number | null | undefined,
): boolean {
  return home != null && away != null;
}

export default function TirsAuBut({ home, away, taille = "court", className = "" }: Props) {
  if (!decideAuxTirsAuBut(home, away)) return null;

  if (taille === "long") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700 ${className}`}
      >
        Tirs au but {home} – {away}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-700 ${className}`}
      title={`Décidé aux tirs au but : ${home} – ${away}`}
    >
      t.a.b. {home}–{away}
    </span>
  );
}
