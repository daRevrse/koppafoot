import { PlayerAvatar } from "@/components/ui/EntityAvatar";
import type { Genre } from "@/lib/genre";

// ============================================
// Le portrait rond du joueur de la semaine : sa photo, sinon SON AVATAR.
//
// Le site montrait ses initiales quand il n'avait pas de photo, alors que
// l'affiche, elle, montrait un avatar (lib/og-joueur-semaine) : deux visages
// pour la même personne. Le rond reprend désormais le dessin de l'affiche —
// le joueur ou la joueuse qui sourit.
//
// UN CADRAGE À PART, PAS LE DESSIN ENTIER : le buste entier dans un rond de
// 60 px, c'est une tête grande comme un petit pois. Les fichiers `-rond`
// sont le même dessin recadré sur le visage, 256 × 256, une dizaine de
// kilo-octets (`public/branding/avatars/`).
// ============================================

const AVATARS: Record<Genre, string> = {
  male: "/branding/avatars/joueur-semaine-homme-rond.webp",
  female: "/branding/avatars/joueur-semaine-femme-rond.webp",
};

export default function AvatarJoueurSemaine({ nom, photo, genre, size = 40, className = "" }: {
  nom: string;
  photo?: string | null;
  /** Null ou absent : le joueur (lib/genre, le masculin quand on ne sait pas). */
  genre?: Genre | null;
  size?: number;
  className?: string;
}) {
  return (
    <PlayerAvatar
      name={nom}
      photo={photo || AVATARS[genre === "female" ? "female" : "male"]}
      size={size}
      className={className}
    />
  );
}
