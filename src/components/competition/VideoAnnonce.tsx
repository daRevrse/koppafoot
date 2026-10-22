"use client";

import { useEffect, useState } from "react";
import { Clapperboard, Download, Loader2, Share2, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { avecVia } from "@/lib/audience";
import type { CalqueVideo } from "@/lib/og-joueur-semaine";
import { lienAbsolu, partagerLien } from "@/lib/partage";
import { DUREE_ANNONCE, etatCalqueAnnonce } from "@/lib/video-annonce";
import { fabriquerLaVideo, videoPossible } from "@/lib/video-joueur-semaine-client";
import type { CompMatch } from "@/types";

// ============================================
// La vidéo d'annonce d'un match chaud, depuis le calendrier de l'organisateur :
// le flyer MATCHDAY en vertical qui se construit (lib/og-annonce,
// lib/video-annonce), 8 secondes, pour les statuts WhatsApp, TikTok et les
// Shorts. Voir docs/superpowers/specs/2026-10-22-matchs-chauds-design.md.
//
// FABRIQUÉE ICI, DANS LE NAVIGATEUR, comme celle du joueur de la semaine :
// Vercel n'a pas ffmpeg. Le serveur rend les calques, le navigateur les anime
// et les encode en MP4 (WebCodecs). Chrome ou Edge sur ordinateur : ailleurs,
// la fenêtre le dit plutôt que d'échouer au milieu.
// ============================================

export default function VideoAnnonce({ cid, slug, match, onFermer }: {
  cid: string;
  slug: string;
  match: CompMatch;
  onFermer: () => void;
}) {
  const { firebaseUser } = useAuth();
  const [possible, setPossible] = useState<boolean | null>(null);
  const [progres, setProgres] = useState<number | null>(null);
  const [video, setVideo] = useState<{ fichier: File; adresse: string } | null>(null);

  useEffect(() => {
    videoPossible().then(setPossible).catch(() => setPossible(false));
  }, []);
  useEffect(() => () => { if (video) URL.revokeObjectURL(video.adresse); }, [video]);

  const nomFichier = `annonce-${slug}-${match.id}.mp4`;
  const titre = `${match.homeTeamName} – ${match.awayTeamName}`;

  const fabriquer = async () => {
    if (!firebaseUser) return;
    setProgres(0);
    try {
      const jeton = await firebaseUser.getIdToken();
      const res = await fetch(`/api/competitions/${cid}/matches/${match.id}/annonce`, {
        headers: { Authorization: `Bearer ${jeton}` },
      });
      const corps = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corps.error ?? "La vidéo n'a pas pu être préparée");
      const mp4 = await fabriquerLaVideo(corps.calques as CalqueVideo[], setProgres, {
        etat: etatCalqueAnnonce,
        duree: DUREE_ANNONCE,
      });
      setVideo({ fichier: new File([mp4], nomFichier, { type: "video/mp4" }), adresse: URL.createObjectURL(mp4) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "La vidéo n'a pas pu être fabriquée");
    } finally {
      setProgres(null);
    }
  };

  const partager = async () => {
    if (!video) return;
    const resultat = await partagerLien({
      title: titre,
      text: `${titre} : le match à ne pas manquer.`,
      url: avecVia(lienAbsolu(`/c/${slug}/matches/${match.id}`), "partage"),
      fichier: video.fichier,
    });
    if (resultat === "copie") toast.success("Lien copié — télécharge la vidéo pour la joindre");
    else if (resultat === "echec") toast.error("Partage impossible, télécharge la vidéo");
  };

  return (
    <div className="fixed inset-0 modal-layer flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col modal-sheet rounded-t-3xl bg-white p-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-gray-900">Vidéo d&apos;annonce</h2>
          <button type="button" onClick={onFermer} disabled={progres !== null} aria-label="Fermer" className="p-1.5 text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-gray-500">
          {titre} : le flyer MATCHDAY qui se construit, {DUREE_ANNONCE} secondes en vertical, pour les statuts WhatsApp,
          TikTok et les Shorts. Sans musique.
        </p>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {possible === false ? (
            <p className="bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
              Ce navigateur ne sait pas fabriquer la vidéo. Ouvre cette page dans Chrome ou Edge, sur ordinateur.
            </p>
          ) : video ? (
            <div className="space-y-3">
              <video src={video.adresse} controls playsInline className="mx-auto max-h-[55vh] border border-gray-200/70" />
              <div className="flex gap-2">
                <a
                  href={video.adresse}
                  download={nomFichier}
                  className="flex flex-1 items-center justify-center gap-1.5 border border-gray-200/70 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                  <Download size={14} />
                  Télécharger
                </a>
                <button
                  type="button"
                  onClick={() => void partager()}
                  className="flex flex-1 items-center justify-center gap-1.5 bg-gray-900 px-3 py-2 text-xs font-bold text-white hover:bg-black"
                >
                  <Share2 size={14} />
                  Partager
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void fabriquer()}
              disabled={possible !== true || progres !== null}
              className="flex w-full items-center justify-center gap-2 bg-orange-500 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {progres !== null ? <Loader2 size={16} className="animate-spin" /> : <Clapperboard size={16} />}
              {progres !== null ? `Fabrication… ${Math.round(progres * 100)} %` : "Fabriquer la vidéo"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
