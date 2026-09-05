"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Image as ImageIcon, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import { alleger, poidsLisible, REGLAGES, type ReglageImage } from "@/lib/images";

// ============================================
// Choisir une image, et l'alléger avant de l'envoyer.
//
// LE COLLAGE D'URL A DISPARU, et c'est le vrai sujet de ce fichier. Le champ
// « …ou coller une URL d'image » permettait de référencer n'importe quel hôte.
// Il coûtait deux choses, loin d'ici :
//
//   - `next.config.ts` devait autoriser `hostname: "**"`, c'est-à-dire ouvrir
//     l'optimiseur d'images de Next à n'importe quelle adresse — un proxy
//     ouvert, dont le commentaire de la config signalait déjà la dette ;
//   - `next/image` plantant sur un hôte non déclaré, le produit contournait
//     l'optimiseur : 71 endroits utilisent `<img>` brut avec `eslint-disable`
//     contre 27 qui utilisent `next/image`.
//
// Vérifié avant de couper : sur les 36 URL d'images de la base, **zéro** est
// externe. Tout est déjà sur Firebase Storage. La capacité coûtait cher et ne
// servait à personne.
//
// `url` reste dans les propriétés, mais ne se saisit plus : c'est l'aperçu de
// l'image DÉJÀ enregistrée, et `onUrlChange("")` sert à la retirer.
//
// L'ALLÈGEMENT EST FAIT ICI, au choix du fichier, pas à l'envoi. Le parent
// reçoit par `onFile` un fichier déjà réduit : aucun appelant n'a à y penser,
// et aucun ne peut l'oublier.
// ============================================

export default function ImageUploadField({
  label,
  url,
  onUrlChange,
  file,
  onFile,
  aspect = "square",
  maxMb = 5,
  hint,
  reglage,
}: {
  label: string;
  /** L'image déjà enregistrée. Affichée en aperçu, jamais saisie. */
  url: string;
  /** Appelé avec "" quand on retire l'image enregistrée. */
  onUrlChange: (v: string) => void;
  file: File | null;
  onFile: (f: File | null) => void;
  aspect?: "square" | "wide";
  maxMb?: number;
  hint?: string;
  /** Par défaut : logo pour un carré, photo pour un panoramique. */
  reglage?: ReglageImage;
}) {
  const [travaille, setTravaille] = useState(false);
  const [gain, setGain] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // L'APERÇU SE DÉDUIT DE `file`, il ne se recopie pas dans un état.
  //
  // Il vivait dans un `useState` que seul ce composant écrivait : quand le
  // parent remettait `file` à null — après un enregistrement réussi, par
  // exemple — l'aperçu restait affiché, montrant une image qui n'était plus
  // sélectionnée. Le déduire suit le parent sans une ligne de synchronisation,
  // et sans poser d'état depuis un effet.
  const apercu = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (apercu) URL.revokeObjectURL(apercu); }, [apercu]);

  const choisir = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Choisis une image (PNG, JPG, WebP).");
      return;
    }
    if (f.size > maxMb * 1024 * 1024) {
      toast.error(`Image trop lourde (${maxMb} Mo maximum).`);
      return;
    }

    setTravaille(true);
    setGain(null);
    try {
      const cible = reglage ?? (aspect === "square" ? REGLAGES.logo : REGLAGES.photo);
      const leger = await alleger(f, cible);
      onFile(leger);
      // On ne le dit que si le gain vaut la peine d'être lu.
      if (leger.size < f.size * 0.9) {
        setGain(`${poidsLisible(f.size)} → ${poidsLisible(leger.size)}`);
      }
    } catch {
      // L'allègement est un confort, pas une condition : en cas d'échec on
      // envoie l'original plutôt que de refuser le fichier.
      onFile(f);
    } finally {
      setTravaille(false);
    }
  };

  const montree = apercu ?? (url.trim() || null);
  const boite = aspect === "wide" ? "h-20 w-32" : "h-20 w-20";

  return (
    <div>
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
        {label}
      </p>

      <div className="flex flex-wrap items-start gap-4">
        <div
          className={`relative flex ${boite} shrink-0 items-center justify-center overflow-hidden border border-gray-200/70 bg-gray-50`}
        >
          {travaille ? (
            <Loader2 size={18} className="animate-spin text-gray-300" />
          ) : montree ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={montree} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon size={20} className="text-gray-300" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <label className="inline-flex w-fit cursor-pointer items-center gap-2 border border-gray-200/70 bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-gray-500 transition-colors hover:border-gray-900 hover:text-gray-900">
            <ImagePlus size={14} />
            {montree ? "Changer" : "Choisir une image"}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void choisir(e.target.files?.[0])}
            />
          </label>

          {montree && (
            <button
              type="button"
              onClick={() => {
                onFile(null);
                onUrlChange("");
                setGain(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="inline-flex w-fit items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 transition-colors hover:text-red-500"
            >
              <X size={12} /> Retirer
            </button>
          )}

          {gain ? (
            <p className="text-[11px] font-bold text-emerald-700">Allégée : {gain}</p>
          ) : hint ? (
            <p className="text-[11px] leading-relaxed text-gray-400">{hint}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
