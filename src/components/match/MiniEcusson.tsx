// ============================================
// Un écusson à la taille d'une ligne de texte : le logo s'il existe, sinon
// l'initiale dans un carré.
//
// Il désigne une équipe là où son nom ne tient pas — un segment de pronostic,
// une pastille de forme. Sans lui, deux « V » côte à côte ne disent pas pour
// qui.
//
// Une balise <img> et non next/image : les logos viennent de n'importe quel
// hôte (stockage, import, lien collé par un organisateur), et le composant
// Image refuserait ceux que la configuration ne déclare pas.
// ============================================

export default function MiniEcusson({
  nom, logo, taille = 16, className = "",
}: {
  nom: string;
  logo: string | null;
  /** En pixels. */
  taille?: number;
  className?: string;
}) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt=""
        width={taille}
        height={taille}
        style={{ width: taille, height: taille }}
        className={`shrink-0 object-contain ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{ width: taille, height: taille, fontSize: Math.max(8, Math.round(taille * 0.55)) }}
      className={`flex shrink-0 items-center justify-center border border-current/25 font-black leading-none ${className}`}
    >
      {nom?.[0]?.toUpperCase() || "?"}
    </span>
  );
}
