"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { aDemanderAuJoueur, consentementPour, type ReponseConsentement } from "@/lib/consentement-image";
import { jourDeLome } from "@/lib/jour";

// ============================================
// LE CONSENTEMENT À L'IMAGE, DEMANDÉ AU JOUEUR LUI-MÊME.
//
// KoppaFoot publie chaque semaine l'affiche d'un joueur sur ses réseaux. Sa
// photo n'y paraît que s'il a dit oui POUR CETTE PHOTO ; sinon, un avatar.
// Voir lib/consentement-image.
//
// UNE SEULE FOIS, à la prochaine ouverture de l'appli, s'il a une photo de
// profil sans réponse pour elle ; puis à chaque nouvelle photo, puisque la
// réponse porte la photo pour laquelle elle a été donnée. Jamais pour un
// mineur, qui a toujours l'avatar. La réponse se change ensuite depuis le
// profil.
//
// Pas de bouton « plus tard » : la question est courte, et ne pas répondre
// vaut non de toute façon.
// ============================================

export default function ModalConsentementImage() {
  const { user, updateProfile } = useAuth();
  const [envoi, setEnvoi] = useState<ReponseConsentement | null>(null);

  if (!user?.profilePictureUrl) return null;
  const sujet = { photo: user.profilePictureUrl, consentement: user.consentementImage, dateNaissance: user.dateOfBirth };
  if (!aDemanderAuJoueur(sujet, jourDeLome())) return null;
  const photo = user.profilePictureUrl;

  const repondre = async (reponse: ReponseConsentement) => {
    setEnvoi(reponse);
    try {
      await updateProfile({ consentement_image: consentementPour(photo, reponse, user.uid) });
      toast.success(reponse === "oui"
        ? "Merci ! Ta photo pourra paraître sur nos affiches."
        : "C'est noté : un avatar remplacera ta photo sur nos affiches.");
    } catch {
      toast.error("Ta réponse n'a pas pu être enregistrée, réessaie.");
    } finally {
      setEnvoi(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consentement-image-titre"
      className="fixed inset-0 modal-layer flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
    >
      <div className="w-full max-w-md modal-sheet rounded-t-3xl bg-white p-6 sm:rounded-3xl">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-emerald-100" />
          <h2 id="consentement-image-titre" className="font-display text-lg font-bold text-gray-900">
            Ta photo sur nos affiches ?
          </h2>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-gray-600">
          Chaque semaine, KoppaFoot met un joueur à l&apos;honneur sur ses réseaux sociaux (affiches et vidéos
          sur Facebook, Instagram, TikTok, YouTube). Si c&apos;est toi, peut-on utiliser cette photo de profil ?
        </p>
        <p className="mt-2 text-xs leading-relaxed text-gray-400">
          Si tu dis non, un avatar la remplace. Tu pourras changer d&apos;avis à tout moment depuis ton profil.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            disabled={!!envoi}
            onClick={() => void repondre("oui")}
            className="flex flex-1 items-center justify-center gap-2 bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {envoi === "oui" && <Loader2 size={16} className="animate-spin" />}
            Oui, j&apos;autorise
          </button>
          <button
            type="button"
            disabled={!!envoi}
            onClick={() => void repondre("non")}
            className="flex flex-1 items-center justify-center gap-2 border border-gray-200/70 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:border-gray-900 disabled:opacity-50"
          >
            {envoi === "non" && <Loader2 size={16} className="animate-spin" />}
            Non, un avatar
          </button>
        </div>
      </div>
    </div>
  );
}
