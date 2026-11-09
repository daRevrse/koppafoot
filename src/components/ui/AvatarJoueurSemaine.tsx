import { PlayerAvatar } from "@/components/ui/EntityAvatar";
import type { Genre } from "@/lib/genre";

// ============================================
// Le portrait rond du joueur de la semaine : sa photo, sinon SON AVATAR.
//
// Le site montrait ses initiales quand il n'avait pas de photo, alors que
// l'affiche, elle, montrait un avatar (lib/og-joueur-semaine) : deux visages
// pour la même personne. Le rond reprend désormais le dessin de l'affiche —
// le joueur ou la joueuse qui fête —, cadré sur le visage.
//
// LE MÊME FICHIER QUE L'AFFICHE (`public/branding/avatars/`), 700 × 760, où
// le visage est centré en (350, 310). Le dessin est posé à 1,7 fois la
// largeur du rond, et décalé pour que ce point tombe en son centre : un
// `object-fit` seul aurait montré le buste entier, la tête grande comme un
// petit pois.
// ============================================

const AVATARS: Record<Genre, string> = {
  male: "/branding/avatars/joueur-semaine-homme.svg",
  female: "/branding/avatars/joueur-semaine-femme.svg",
};

/** Le dessin fait `ZOOM` fois la largeur du rond. */
const ZOOM = 1.7;
/** Le centre du visage dans le dessin, en parts de sa largeur. */
const VISAGE = { x: 350 / 700, y: 310 / 700 };

export default function AvatarJoueurSemaine({ nom, photo, genre, size = 40, className = "" }: {
  nom: string;
  photo?: string | null;
  /** Null ou absent : le joueur (lib/genre, le masculin quand on ne sait pas). */
  genre?: Genre | null;
  size?: number;
  className?: string;
}) {
  if (photo) return <PlayerAvatar name={nom} photo={photo} size={size} className={className} />;
  const largeur = size * ZOOM;
  return (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-full bg-emerald-950 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={AVATARS[genre === "female" ? "female" : "male"]}
        alt=""
        className="absolute max-w-none"
        style={{ width: largeur, left: size / 2 - largeur * VISAGE.x, top: size / 2 - largeur * VISAGE.y }}
      />
    </span>
  );
}
