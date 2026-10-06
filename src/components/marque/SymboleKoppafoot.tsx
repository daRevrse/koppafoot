// ============================================
// Le symbole de KoppaFoot : l'anneau posé sur sa hampe, le koppa (Ϙ).
//
// EN SVG, PAS EN IMAGE. La source est branding/new_symbol_black.png et
// new_symbol_white.png (500×500) : deux fichiers pour une seule forme, qui
// ne différaient que par la couleur. Redessinée ici d'après leurs mesures
// (anneau de 217 px de diamètre extérieur et 96 de trou, hampe de 64 sur
// 254 aux bouts ronds, 20 px d'écart), elle prend la couleur du texte
// (`currentColor`) : noire sur fond clair, blanche sur fond sombre et dans
// le thème sombre, sans second fichier ni filtre d'inversion, et nette à
// toutes les tailles.
//
// LA HAUTEUR SE RÈGLE PAR LA CLASSE (`h-5`, `h-6`…) ; la largeur suit, le
// symbole est étroit (218 sur 490).
// ============================================

export default function SymboleKoppafoot({ className = "h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 218 490"
      fill="currentColor"
      aria-hidden
      focusable="false"
      className={`w-auto shrink-0 ${className}`}
    >
      {/* L'anneau : un cercle évidé, la règle evenodd perce le trou. */}
      <path
        fillRule="evenodd"
        d="M109 0a108.5 108.5 0 1 0 0 217a108.5 108.5 0 1 0 0-217zM109 60.5a48 48 0 1 1 0 96a48 48 0 1 1 0-96z"
      />
      {/* La hampe. */}
      <rect x="77" y="236" width="64" height="254" rx="32" />
    </svg>
  );
}
