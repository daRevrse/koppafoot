import type { LucideProps } from "lucide-react";

// ============================================
// Les icônes que lucide n'a pas.
//
// `Whistle` n'existe pas dans lucide-react 1.8.0 — vérifié — alors que le
// sifflet est LE signe de l'arbitre, et qu'un bouclier (ce qu'on affichait)
// évoque la protection ou la modération, pas l'arbitrage.
//
// Dessinée aux conventions de lucide pour se mêler aux autres sans se
// remarquer : boîte 24×24, tracé seul, `currentColor`, épaisseur 2,
// extrémités arrondies. Les propriétés sont celles d'une icône lucide, donc
// `size` et `className` marchent comme partout ailleurs.
// ============================================

export function Sifflet({ size = 24, className, strokeWidth = 2, ...rest }: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {/* Le corps, et le bec qui part vers la gauche. */}
      <path d="M21 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z" />
      <path d="M9 10H4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h5" />
      {/* Le trou : ce qui fait qu'on reconnaît un sifflet et pas une poêle. */}
      <circle cx="15" cy="12" r="1.5" />
    </svg>
  );
}
