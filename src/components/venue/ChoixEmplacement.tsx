"use client";

import { useState } from "react";
import { Crosshair, Link2, MapPin, X } from "lucide-react";
import toast from "react-hot-toast";
import { lienCarte, lienCarteIntegree, lirePosition, type Position } from "@/lib/carte";
import { positionDuLien } from "@/lib/terrains-client";
import { Bouton, classeChamp } from "@/components/venue/venue-ui";

// ============================================
// Poser l'épingle du terrain, dans le formulaire de « Mes terrains ».
//
// Deux chemins, parce que le propriétaire n'est pas toujours au même
// endroit quand il remplit sa fiche : sur place, « Je suis sur le terrain »
// prend la position du téléphone ; ailleurs, il colle le lien « Partager »
// de Google Maps. Dans les deux cas, il VOIT la carte avant d'enregistrer :
// une épingle posée à 2 km du terrain se repère à l'œil, pas en lisant
// « 6.1319, 1.2253 ».
// ============================================

/** Au-delà, le téléphone devine plus qu'il ne mesure : on le dit. */
const PRECISION_SUFFISANTE_M = 100;

export default function ChoixEmplacement({
  position,
  onChange,
}: {
  position: Position | null;
  onChange: (p: Position | null) => void;
}) {
  const [lien, setLien] = useState("");
  const [lecture, setLecture] = useState(false);
  const [reperage, setReperage] = useState(false);

  const lireLien = async () => {
    const texte = lien.trim();
    if (!texte) return;
    // Un lien complet ou des coordonnées se lisent ici ; un lien court se suit côté serveur.
    const ici = lirePosition(texte);
    if (ici) {
      onChange(ici);
      setLien("");
      return;
    }
    setLecture(true);
    try {
      onChange(await positionDuLien(texte));
      setLien("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ce lien ne donne pas de position.");
    } finally {
      setLecture(false);
    }
  };

  const reperer = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Ce navigateur ne donne pas sa position : colle plutôt le lien Google Maps.");
      return;
    }
    setReperage(true);
    navigator.geolocation.getCurrentPosition(
      (r) => {
        setReperage(false);
        const p = lirePosition(`${r.coords.latitude},${r.coords.longitude}`);
        if (!p) return;
        onChange(p);
        if (r.coords.accuracy > PRECISION_SUFFISANTE_M) {
          toast(`Position à ${Math.round(r.coords.accuracy)} m près : vérifie l'épingle sur la carte.`, { icon: "📍" });
        }
      },
      (e) => {
        setReperage(false);
        toast.error(
          e.code === e.PERMISSION_DENIED
            ? "Position refusée : autorise-la dans les réglages du navigateur, ou colle le lien Google Maps."
            : "Position introuvable : réessaie dehors, ou colle le lien Google Maps.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  return (
    <div className="space-y-3">
      {position ? (
        <div className="border border-gray-200/70 bg-white">
          <iframe
            title="Emplacement du terrain"
            src={lienCarteIntegree(position)}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="block h-48 w-full border-0"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <a
              href={lienCarte(position)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-500 hover:text-gray-900"
            >
              <MapPin size={13} />
              <span className="tabular-nums">{position.lat}, {position.lng}</span>
            </a>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-red-500"
            >
              <X size={13} />
              Retirer l&apos;épingle
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[11px] leading-relaxed text-gray-400">
          Les équipes qui viennent pour la première fois suivent l&apos;épingle
          jusqu&apos;au terrain, avec l&apos;itinéraire de Google Maps.
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="v-emplacement"
          type="text"
          inputMode="url"
          value={lien}
          onChange={(e) => setLien(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              lireLien();
            }
          }}
          placeholder="Lien Google Maps (bouton « Partager »)"
          className={`${classeChamp} min-w-0 flex-1`}
        />
        <Bouton variante="contour" petit Icon={Link2} occupe={lecture} disabled={!lien.trim()} onClick={lireLien}>
          {position ? "Déplacer" : "Placer"}
        </Bouton>
      </div>
      <Bouton variante="contour" petit Icon={Crosshair} occupe={reperage} onClick={reperer} className="w-full sm:w-auto">
        Je suis sur le terrain
      </Bouton>
    </div>
  );
}
