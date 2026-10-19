"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { ImageIcon, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { consentementPour, etatDuConsentement, type ReponseConsentement } from "@/lib/consentement-image";
import { jourDeLome } from "@/lib/jour";

// ============================================
// Sur son profil, changer d'avis : sa photo peut-elle paraître sur les
// affiches et vidéos de KoppaFoot ? Le modal pose la question une fois
// (ModalConsentementImage) ; ici, on y revient quand on veut.
//
// Absent sans photo de profil, et pour un mineur, qui a toujours l'avatar.
// ============================================

export default function ReglageConsentementImage() {
  const { user, updateProfile } = useAuth();
  const [envoi, setEnvoi] = useState<ReponseConsentement | null>(null);
  if (!user?.profilePictureUrl) return null;
  const photo = user.profilePictureUrl;
  const etat = etatDuConsentement(
    { photo, consentement: user.consentementImage, dateNaissance: user.dateOfBirth },
    jourDeLome(),
  );
  if (etat === "mineur") return null;

  const choisir = async (reponse: ReponseConsentement) => {
    if (etat === reponse) return;
    setEnvoi(reponse);
    try {
      await updateProfile({ consentement_image: consentementPour(photo, reponse, user.uid) });
      toast.success(reponse === "oui" ? "Ta photo pourra paraître sur nos affiches" : "Un avatar remplacera ta photo sur nos affiches");
    } catch {
      toast.error("Ton choix n'a pas pu être enregistré");
    } finally {
      setEnvoi(null);
    }
  };

  const bouton = (reponse: ReponseConsentement, libelle: string) => (
    <button
      type="button"
      disabled={!!envoi}
      aria-pressed={etat === reponse}
      onClick={() => void choisir(reponse)}
      className={`flex items-center gap-1.5 border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
        etat === reponse ? "border-emerald-600 bg-emerald-600 text-white" : "border-gray-200/70 bg-white text-gray-700 hover:border-gray-900"
      }`}
    >
      {envoi === reponse && <Loader2 size={12} className="animate-spin" />}
      {libelle}
    </button>
  );

  return (
    <div className="border border-gray-200/70 bg-white p-4 md:col-span-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        <ImageIcon size={16} className="text-emerald-600" />
        Ma photo sur les affiches KoppaFoot
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-gray-500">
        Si tu es mis à l&apos;honneur sur nos réseaux (affiches et vidéos), ta photo de profil peut y paraître.
        Sinon, un avatar la remplace. {etat === "aucun" ? "Tu n'as pas encore répondu pour cette photo." : ""}
      </p>
      <div className="mt-3 flex gap-2">
        {bouton("oui", "J'autorise")}
        {bouton("non", "Je refuse")}
      </div>
    </div>
  );
}
