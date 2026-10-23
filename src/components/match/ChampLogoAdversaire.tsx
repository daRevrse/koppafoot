"use client";

import { useEffect, useMemo, useState } from "react";
import { ImagePlus, X } from "lucide-react";

// ============================================
// Le logo d'un adversaire hors plateforme, à joindre à un amical
// (lib/logo-hors-plateforme). Facultatif : sans lui, le match montre
// l'initiale de l'équipe, comme avant.
//
// Le fichier part APRÈS la création du match, qui donne son identifiant :
// `envoyerLogoAdversaire`, par le serveur (POST /api/matches/[mid]/logo-adversaire).
// ============================================

const POIDS_MAX = 2 * 1024 * 1024;

/** Le contenu en base64, sans `data:…;base64,` : ce que la route attend. */
function enBase64(fichier: File): Promise<string> {
  return new Promise((ok, ko) => {
    const lecteur = new FileReader();
    lecteur.onload = () => ok(String(lecteur.result).split(",")[1] ?? "");
    lecteur.onerror = () => ko(lecteur.error);
    lecteur.readAsDataURL(fichier);
  });
}

/** Envoie le logo du camp hors plateforme d'un match. Rend un message d'erreur, ou `null`. */
export async function envoyerLogoAdversaire(matchId: string, fichier: File, jeton: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/matches/${matchId}/logo-adversaire`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ image: { data: await enBase64(fichier), contentType: fichier.type } }),
    });
    if (res.ok) return null;
    const d = await res.json().catch(() => ({}));
    return d.error ?? "Le logo n'a pas pu être ajouté.";
  } catch {
    return "Le logo n'a pas pu être ajouté.";
  }
}

export default function ChampLogoAdversaire({ fichier, onChange, className = "" }: {
  fichier: File | null;
  onChange: (f: File | null) => void;
  className?: string;
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  // L'aperçu vient du fichier ; son adresse est rendue au navigateur quand il change.
  const apercu = useMemo(() => (fichier ? URL.createObjectURL(fichier) : null), [fichier]);
  useEffect(() => () => { if (apercu) URL.revokeObjectURL(apercu); }, [apercu]);

  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden border border-gray-200/70 bg-gray-50">
          {apercu ? (
            // L'aperçu d'un fichier local est une adresse blob:, que next/image ne sert pas.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={apercu} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <ImagePlus size={18} className="text-gray-300" />
          )}
        </span>
        <label className="min-w-0 cursor-pointer text-xs font-semibold text-gray-600">
          <span className="block font-bold text-gray-800">Logo de l&apos;adversaire (facultatif)</span>
          <span className="block text-gray-500">PNG ou JPG, 2 Mo au plus.</span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = "";
              if (f && (!f.type.startsWith("image/") || f.size > POIDS_MAX)) {
                setErreur("Une image de 2 Mo au plus.");
                return;
              }
              setErreur(null);
              onChange(f);
            }}
          />
        </label>
        {fichier && (
          <button type="button" onClick={() => onChange(null)} aria-label="Retirer le logo" className="ml-auto p-1.5 text-gray-400 hover:bg-gray-100">
            <X size={14} />
          </button>
        )}
      </div>
      {erreur && <p className="mt-1 text-xs font-semibold text-red-600">{erreur}</p>}
    </div>
  );
}
