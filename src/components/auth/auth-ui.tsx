"use client";

// ============================================
// Les champs de l'authentification.
//
// POURQUOI ILS NE SONT PAS CEUX DU SOCLE. Un champ d'authentification porte
// une icône à gauche — enveloppe, cadenas, téléphone — et parfois un bouton à
// droite pour révéler le mot de passe. Le `Champ` du socle n'en veut pas :
// ailleurs dans le produit, l'étiquette suffit et l'icône ferait du bruit.
//
// Ce qui EST commun, en revanche, ne se recopie pas : mêmes filets, mêmes
// capitales, même focus qui noircit la bordure au lieu d'allumer un anneau
// vert. Ces trois-là étaient les écarts qui faisaient parler à la connexion
// une autre langue que les pages ouvertes juste après.
// ============================================

const BASE =
  "w-full border border-gray-200/70 bg-white py-3 text-sm font-semibold text-gray-900 " +
  "placeholder:font-medium placeholder:text-gray-300 focus:border-gray-900 focus:outline-none transition-colors";

/** Avec l'icône à gauche. */
export const classeChampAuth = `${BASE} pl-11 pr-4`;
/** Avec l'icône à gauche ET le bouton « afficher » à droite. */
export const classeChampAuthMdp = `${BASE} pl-11 pr-11`;
/** Sans icône, pour un select ou un champ court. */
export const classeChampAuthNu = `${BASE} px-4`;

export const classeIconeChamp =
  "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-300";

export const classeEtiquetteAuth =
  "mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400";

/** Le bouton qui engage : noir, vert au survol, vert plein en thème sombre. */
export const classeBoutonAuth =
  "flex w-full items-center justify-center gap-2 border border-gray-900 bg-gray-900 px-6 py-4 " +
  "text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors " +
  "hover:border-emerald-700 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40";

/** Le geste secondaire : « Retour », « Passer ». */
export const classeBoutonAuthSecondaire =
  "flex items-center justify-center gap-2 border border-gray-200/70 px-6 py-4 " +
  "text-[11px] font-black uppercase tracking-[0.15em] text-gray-500 transition-colors " +
  "hover:border-gray-900 hover:text-gray-900 disabled:opacity-40";

/** Le titre d'un écran d'authentification, et sa phrase. */
export function EnTeteAuth({ titre, phrase }: { titre: string; phrase: string }) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-3xl font-black uppercase leading-[0.95] tracking-[-0.02em] text-gray-900">
        {titre}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-gray-500">{phrase}</p>
    </div>
  );
}

/** « ou », entre deux filets. */
export function Separateur({ children = "ou" }: { children?: React.ReactNode }) {
  return (
    <div className="my-7 flex items-center gap-4">
      <span aria-hidden className="h-px flex-1 bg-gray-200/70" />
      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-300">
        {children}
      </span>
      <span aria-hidden className="h-px flex-1 bg-gray-200/70" />
    </div>
  );
}

/**
 * Continuer avec Google.
 *
 * Il reste en tête : c'est le chemin le plus court, un tap et aucun mot de
 * passe à retrouver. Le contour plutôt que le noir, pour que le bouton qui
 * ENGAGE — se connecter, créer le compte — garde le seul aplat de l'écran.
 */
export function BoutonGoogle({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-3 border border-gray-200/70 bg-white px-6 py-4 text-[11px] font-black uppercase tracking-[0.15em] text-gray-600 transition-colors hover:border-gray-900 hover:text-gray-900 disabled:opacity-40"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      {children}
    </button>
  );
}
