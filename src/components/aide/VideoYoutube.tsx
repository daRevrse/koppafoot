"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { ArrowUpRight, Play } from "lucide-react";
import { useLangue, useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import { idYoutube, miniatureYoutube } from "@/lib/youtube";
import type { VideoTutoriel } from "@/lib/tutoriels";

// ============================================
// Une vidéo YouTube, lue dans la page.
//
// D'ABORD UNE MINIATURE, PAS LE LECTEUR. Le lecteur de YouTube charge des
// centaines de kilo-octets de scripts et parle à Google dès qu'il s'affiche,
// que la vidéo soit regardée ou non. Ici, rien ne part chez YouTube avant le geste : la
// miniature passe par l'optimiseur d'images du site (next.config.ts, hôte
// i.ytimg.com), et le lecteur n'est chargé qu'au clic, depuis
// youtube-nocookie.com, déjà lancé. La politique de confidentialité le dit.
//
// La miniature HD n'existe pas pour toutes les vidéos : on retombe sur celle
// qui existe toujours, puis, si même elle manque, sur un cadre sombre au nom
// de la vidéo. Un lien illisible n'affiche rien du tout.
// ============================================

const T = textes(
  {
    lire: (titre: string) => `Lire la vidéo : ${titre}`,
    surYoutube: "Voir sur YouTube",
    enFrancais: "",
  },
  {
    lire: (titre: string) => `Play the video: ${titre}`,
    surYoutube: "Watch on YouTube",
    enFrancais: "In French",
  },
);

type Miniature = "maxres" | "hq" | "aucune";

export default function VideoYoutube({
  video,
  titre,
  enFrancais = false,
  sombre = false,
  sizes = "(min-width: 768px) 768px, 100vw",
  className = "",
}: {
  video: VideoTutoriel;
  /** Le nom de la vidéo pour les lecteurs d'écran, et le titre du lecteur. */
  titre: string;
  /** Vidéo française montrée en anglais, faute d'une version anglaise. */
  enFrancais?: boolean;
  /** Posée sur un fond sombre : la légende passe en clair. */
  sombre?: boolean;
  sizes?: string;
  className?: string;
}) {
  const t = useTextes(T);
  const { langue } = useLangue();
  const [lancee, setLancee] = useState(false);
  const [miniature, setMiniature] = useState<Miniature>("maxres");
  // Le focus suit le geste : celui qui a lancé la vidéo au clavier se
  // retrouve dans le lecteur, pas sur une page sans focus.
  const focaliser = useCallback((cadre: HTMLIFrameElement | null) => cadre?.focus(), []);

  const id = idYoutube(video.youtube);
  if (!id) return null;

  const legende = sombre ? "text-white/50 hover:text-white" : "text-gray-400 hover:text-emerald-700";

  return (
    <figure className={className}>
      <div className="relative aspect-video overflow-hidden bg-gray-900">
        {lancee ? (
          <iframe
            ref={focaliser}
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1&hl=${langue}`}
            title={titre}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setLancee(true)}
            aria-label={video.duree ? `${t.lire(titre)} (${video.duree})` : t.lire(titre)}
            className="group absolute inset-0 block h-full w-full cursor-pointer text-left"
          >
            {miniature !== "aucune" && (
              <Image
                src={miniatureYoutube(id, miniature)}
                alt=""
                fill
                sizes={sizes}
                onError={() => setMiniature((m) => (m === "maxres" ? "hq" : "aucune"))}
                className="object-cover transition-transform duration-300 ease-out motion-safe:group-hover:scale-[1.03]"
              />
            )}
            <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            <span
              aria-hidden
              className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-emerald-500 text-white transition-[background-color,scale] duration-150 ease-out group-hover:bg-emerald-400 group-active:scale-95 sm:h-20 sm:w-20"
            >
              <Play size={26} fill="currentColor" strokeWidth={0} className="ml-0.5 sm:size-8" />
            </span>
            {miniature === "aucune" && (
              <span aria-hidden className="absolute inset-x-0 bottom-0 p-4 font-display text-lg font-black uppercase leading-tight tracking-tight text-white sm:p-6 sm:text-2xl">
                {titre}
              </span>
            )}
            {video.duree && (
              <span aria-hidden className="absolute bottom-3 right-3 bg-black/80 px-1.5 py-0.5 text-[11px] font-black tabular-nums text-white">
                {video.duree}
              </span>
            )}
          </button>
        )}
      </div>
      <figcaption className="mt-2 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.14em]">
        <span className={sombre ? "text-white/50" : "text-gray-400"}>{enFrancais ? t.enFrancais : null}</span>
        <a
          href={`https://www.youtube.com/watch?v=${id}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 transition-colors ${legende}`}
        >
          {t.surYoutube}
          <ArrowUpRight size={12} />
        </a>
      </figcaption>
    </figure>
  );
}
