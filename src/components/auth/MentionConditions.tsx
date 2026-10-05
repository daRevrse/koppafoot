"use client";

import Link from "next/link";
import { useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";

// ============================================
// La phrase qui accompagne chaque porte de création de compte.
//
// Sur /signup bien sûr, mais aussi sur /login et dans la fenêtre de
// connexion : « Continuer avec Google » y crée le compte quand il n'existe
// pas encore. Une seule phrase, un seul endroit, pour qu'elle ne diverge pas
// d'un écran à l'autre.
//
// Les deux pages qu'elle cite n'existent qu'en français pour l'instant ; la
// version anglaise le dit plutôt que de laisser croire à une traduction.
// ============================================

const lien = "font-semibold text-gray-600 underline underline-offset-2 transition-colors hover:text-emerald-700";

const T = textes(
  {
    phrase: (conditions: React.ReactNode, confidentialite: React.ReactNode) => (
      <>En continuant, tu acceptes les {conditions} et la {confidentialite} de KoppaFoot.</>
    ),
    conditions: "conditions d'utilisation",
    confidentialite: "politique de confidentialité",
  },
  {
    phrase: (conditions: React.ReactNode, confidentialite: React.ReactNode) => (
      <>By continuing, you accept KoppaFoot&apos;s {conditions} and {confidentialite} (in French).</>
    ),
    conditions: "terms of use",
    confidentialite: "privacy policy",
  },
);

export default function MentionConditions({ onNavigate, className = "" }: {
  /** La fenêtre de connexion se referme quand on suit un des liens. */
  onNavigate?: () => void;
  className?: string;
}) {
  const t = useTextes(T);
  return (
    <p className={`text-[11px] leading-relaxed text-gray-400 ${className}`}>
      {t.phrase(
        <Link href="/conditions" onClick={onNavigate} className={lien}>{t.conditions}</Link>,
        <Link href="/confidentialite" onClick={onNavigate} className={lien}>{t.confidentialite}</Link>,
      )}
    </p>
  );
}
