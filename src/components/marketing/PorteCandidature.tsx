"use client";

import { ArrowRight } from "lucide-react";
import { useAuthModal } from "@/components/auth/AuthModal";
import { classeBoutonAuth, classeTitreAuth } from "@/components/auth/auth-ui";

// ============================================
// La porte d'une candidature, pour qui n'a pas encore de compte.
//
// TROIS CANDIDATURES, TROIS CARTES. Organize et Score ouvraient la fenêtre
// de connexion sous un petit titre en minuscules ; MyFields envoyait vers
// /login sous un grand titre en capitales, et sans lien pour qui avait déjà
// un compte. Une même étape, trois apparences, au moment où l'on demande un
// effort. Elles passent toutes par ici.
//
// Les deux gestes ouvrent la fenêtre (components/auth/AuthModal), dans le
// mode qui correspond au bouton : la page reste là, et la candidature
// s'affiche dès que le compte existe, au bout de /get-started s'il est neuf.
// ============================================

export default function PorteCandidature({
  titre,
  phrase,
  pourQuoi,
}: {
  titre: string;
  phrase: string;
  /** Ce que le compte permet ici : « déposer ta candidature d'organisateur ». */
  pourQuoi: string;
}) {
  const authModal = useAuthModal();
  const raison = `Il faut un compte KoppaFoot pour ${pourQuoi}. Google suffit.`;

  return (
    <div className="border border-gray-200/70 bg-white p-8 sm:p-12">
      <h1 className={`${classeTitreAuth} sm:text-4xl`}>{titre}</h1>
      <p className="mt-5 max-w-lg text-base leading-relaxed text-gray-600">{phrase}</p>
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
        <button
          type="button"
          onClick={() => authModal.open(raison, { mode: "inscription" })}
          className={`${classeBoutonAuth} sm:w-auto`}
        >
          Créer mon compte
          <ArrowRight size={16} />
        </button>
        <button
          type="button"
          onClick={() => authModal.open(raison, { mode: "connexion" })}
          className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-500 underline-offset-4 transition-colors hover:text-gray-900 hover:underline"
        >
          J&apos;ai déjà un compte
        </button>
      </div>
    </div>
  );
}
