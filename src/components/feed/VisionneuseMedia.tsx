"use client";

import { useCallback, useEffect } from "react";
import { motion } from "motion/react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

// ============================================
// LA PHOTO EN GRAND, QUAND ON LA TOUCHE.
//
// POURQUOI ELLE EXISTE. Le fil pose les photos dans un cadre fixe et les
// RECADRE pour l'y faire tenir (`object-cover`) : une photo d'équipe en
// largeur y perd ses bords, un portrait y perd la tête ou les pieds. C'est le
// prix d'un fil au rythme régulier, et il n'est acceptable que si la photo
// entière reste atteignable — d'où cette vue, qui la rend telle qu'elle a été
// prise (`object-contain`), sans rien couper.
//
// ELLE NE FAIT QUE MONTRER. Pas de zoom, pas de partage, pas de téléchargement :
// on l'ouvre pour voir ce que le cadre a coupé, et on la referme. Tout ce qu'on
// peut faire d'un post se fait sur le post.
//
// QUATRE FAÇONS DE LA REFERMER, parce qu'on y entre par accident en faisant
// défiler : la croix, le fond, la touche d'échappement — et LA PHOTO
// ELLE-MÊME. Cette dernière n'est pas un supplément : sur un téléphone, la
// photo couvre presque tout l'écran, donc le fond qu'on croit toucher pour
// sortir est en réalité la photo neuf fois sur dix. Sans elle, le geste le
// plus naturel ne faisait rien, au milieu de l'écran, et il fallait aller
// chercher la croix dans un coin. Rien n'est perdu : cette vue ne zoome pas,
// un appui sur la photo n'avait donc aucun autre sens à porter.
// ============================================

export default function VisionneuseMedia({
  urls, index, onIndex, onClose,
}: {
  urls: string[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const plusieurs = urls.length > 1;

  // `useCallback` : les deux entrent dans les dépendances de l'effet clavier.
  const precedent = useCallback(
    () => onIndex((index - 1 + urls.length) % urls.length),
    [index, urls.length, onIndex],
  );
  const suivant = useCallback(
    () => onIndex((index + 1) % urls.length),
    [index, urls.length, onIndex],
  );

  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (plusieurs && e.key === "ArrowLeft") precedent();
      else if (plusieurs && e.key === "ArrowRight") suivant();
    };
    window.addEventListener("keydown", auClavier);
    // LE FOND NE DOIT PAS DÉFILER DERRIÈRE. Sans cela, le fil continue de
    // glisser sous la photo, et on la referme sur un post qui n'est plus
    // celui qu'on regardait.
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", auClavier);
      document.body.style.overflow = avant;
    };
  }, [onClose, precedent, suivant, plusieurs]);

  // `modal-layer` (z-index 80) suffit à la poser au-dessus de tout, barre de
  // navigation du bas comprise, qui monte à 50. On a cru le contraire en
  // regardant une capture — la barre s'y lisait encore sous la photo — et on a
  // mesuré : le pixel de la barre passe de rgb(2,44,34) à rgb(0,4,3) quand la
  // vue s'ouvre. Elle est bien dessous, à 10 % près, et ce qu'on lisait n'était
  // que ce que le voile laisse passer. Pas de portail, donc : la carte
  // n'enferme rien.
  return (
    <div
      className="fixed inset-0 modal-layer flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Photo en grand"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/90"
      />

      <button
        onClick={onClose}
        aria-label="Fermer"
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center bg-white/10 text-white transition-colors hover:bg-white/20"
        style={{ top: "calc(1rem + env(safe-area-inset-top, 0px))" }}
      >
        <X size={20} />
      </button>

      {plusieurs && (
        <>
          <button
            onClick={precedent}
            aria-label="Photo précédente"
            className="absolute left-2 z-10 flex h-11 w-11 items-center justify-center bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={suivant}
            aria-label="Photo suivante"
            className="absolute right-2 z-10 flex h-11 w-11 items-center justify-center bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}

      {/* `object-contain` : c'est tout l'objet de cette vue. Voir l'en-tête. */}
      <motion.img
        key={urls[index]}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        src={urls[index]}
        alt=""
        onClick={onClose}
        className="relative max-h-[85vh] max-w-[92vw] cursor-zoom-out object-contain"
      />

      {plusieurs && (
        <span
          // Le compteur s'écarte de la barre de geste du téléphone, que
          // `bottom` seul ignore.
          style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
          className="absolute z-10 bg-black/60 px-2.5 py-1 text-[11px] font-black tabular-nums text-white/80"
        >
          {index + 1} / {urls.length}
        </span>
      )}
    </div>
  );
}
