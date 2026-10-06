"use client";

import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { contexteAuth } from "@/config/auth-contextes";
import SymboleKoppafoot from "@/components/marque/SymboleKoppafoot";

// ============================================
// L'écran d'authentification, et la fin du même tunnel.
//
// DEUX COLONNES, ET C'EST LA GAUCHE QUI CHANGE. Le produit a quatre portes
// d'entrée — le direct, MyFields, Organize, Score — et elles ne promettent
// pas la même chose. Arriver par « référencer mon terrain » et lire
// « Connecte-toi pour accéder à ton espace » sur un aplat gris fait douter
// d'avoir cliqué au bon endroit, au moment précis où il ne faut pas douter.
//
// Le panneau porte donc la marque de la section d'où l'on vient (voir
// config/auth-contextes) ; le formulaire, lui, est le même pour tout le
// monde. Une seule mécanique, plusieurs visages.
//
// LE PANNEAU EST UNE AFFICHE : une photo, un voile, le nom en haut et
// l'accroche en bas. Il a été un aplat gris, puis un artwork sous un voile
// CLAIR écrit en dur — une valeur que le thème sombre ne pouvait pas
// réécrire, faute de passer par une classe, et le fond restait donc lumineux
// sous un texte prévu pour le noir. Un fond photographique sous un voile
// SOMBRE règle les deux : il ne dépend plus du thème, puisque le texte est
// blanc dans les deux cas.
//
// UN SEUL CADRE POUR (auth) ET /get-started. Ce dernier est la queue du même
// tunnel — on y arrive juste après Google ou le code SMS — et il avait son
// propre habillage : logo en image, fond gris écrit en dur, carte à bordure.
// On croyait changer de site au moment de finir son inscription.
// ============================================

function PanneauSection() {
  const params = useSearchParams();
  const ctx = contexteAuth(params.get("for"));

  return (
    // LE PANNEAU N'EXISTE PAS SUR TÉLÉPHONE. Il y occupait 252px sur 812,
    // c'est-à-dire le tiers de l'écran, pour redire une marque que le titre
    // du formulaire porte déjà — « Référencer un terrain » dit MyFields
    // aussi bien que le panneau. Sur un écran étroit, la place va au geste :
    // on vient ici pour se connecter, pas pour lire une accroche.
    <aside className="relative hidden overflow-hidden bg-gray-900 text-white lg:block lg:min-h-screen">
      {/* QUATRE COUCHES, ET L'ORDRE COMPTE.

          Le dégradé D'ABORD, et il reste : c'est le repli. Si la photo manque
          — fichier absent, cache vide, réseau coupé —, le panneau garde un
          fond dessiné au lieu d'un rectangle noir avec du texte dessus.

          La photo ENSUITE, en `cover`. Elle est déjà recadrée en portrait à la
          fabrication (voir scripts/preparer-image-login) : la source est un
          collage CARRÉ, et un carré posé dans cette colonne se recadre pile
          sur la couture entre ses vignettes.

          Puis DEUX VOILES, et deux valent mieux qu'un seul : un voile uniforme
          qui garantit un minimum de contraste PARTOUT — les photos sont
          claires, ciel et terre battue, et le nom du produit est écrit en
          blanc dans le coin haut —, et par-dessus un dégradé qui s'épaissit
          vers le bas, là où l'accroche se pose. Un dégradé seul laissait le
          haut trop lumineux pour du texte blanc. */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-gray-900 to-black" />
      <Image
        src="/branding/login_side.jpg"
        alt=""
        fill
        priority
        sizes="(min-width: 1024px) 42vw, 0px"
        className="object-cover"
      />
      <div aria-hidden className="absolute inset-0 bg-black/20" />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"
      />

      <div className="relative flex h-full flex-col px-12 py-14">
        {/* LE MOT, PAS L'IMAGE. Le logo dessiné était un fichier de plus à
            charger pour écrire un nom que la police du produit écrit déjà —
            et il fallait l'inverser au filtre pour le poser sur du sombre.
            C'est la même typographie que le header (voir ScoreHeader), en
            plus grand : on est sur la porte d'entrée, le nom a le droit d'y
            tenir sa place. Le symbole à côté n'est pas une image non plus :
            un SVG qui prend la couleur du texte (components/marque). */}
        <Link
          href="/"
          className="flex w-fit items-center gap-3 font-display text-3xl font-black uppercase tracking-[0.14em] text-white drop-shadow-lg transition-opacity hover:opacity-80"
        >
          <SymboleKoppafoot className="h-10" />
          Koppafoot
        </Link>

        {/* L'ACCROCHE DESCEND EN BAS. Elle flottait au milieu d'une colonne
            répartie en trois, ce qui la laissait sans appui : ni alignée sur
            le formulaire d'en face, ni posée sur quoi que ce soit. Contre le
            bas, elle a le voile le plus dense sous elle et le sujet de la
            photo au-dessus — c'est la mise en page d'une affiche, et c'est ce
            que ce panneau est.

            LE SURTITRE A DISPARU : il répétait « KOPPAFOOT » à trois
            centimètres du nom écrit en grand juste au-dessus. */}
        <div className="mt-auto">
          <p className="max-w-md font-display text-4xl font-black uppercase leading-[0.9] tracking-[-0.02em] lg:text-5xl">
            {ctx.accroche}
          </p>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/75">
            {ctx.promesse}
          </p>

          {ctx.retour && (
            <Link
              href={ctx.retour.href}
              className="mt-8 flex w-fit items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-white/60 transition-colors hover:text-white"
            >
              ← Retour à {ctx.retour.label}
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}

/**
 * Le retour vers l'espace d'où l'on vient, SUR TÉLÉPHONE.
 *
 * Sur ordinateur, le panneau photo le porte (« ← Retour à Koppafoot
 * Organize ») ; sur téléphone, le panneau n'existe pas, et la seule sortie
 * était « Retour à l'accueil », c'est-à-dire l'application, pas la vitrine
 * qu'on lisait une seconde plus tôt.
 */
function RetourSectionMobile() {
  const params = useSearchParams();
  const ctx = contexteAuth(params.get("for"));
  if (!ctx.retour) return null;
  return (
    <Link
      href={ctx.retour.href}
      className="-mt-5 mb-8 flex w-fit items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 transition-colors hover:text-gray-900 lg:hidden"
    >
      ← Retour à {ctx.retour.label}
    </Link>
  );
}

/** Le lien discret sous le formulaire : « Retour à l'accueil », « Changer de compte ». */
export const classeLienPiedAuth =
  "mt-10 text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 transition-colors hover:text-emerald-700";

/** L'attente de l'état de connexion : le fond du panneau, plein écran. */
export function ChargementAuth() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900">
      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-gray-900 to-black" />
      <div className="relative h-8 w-8 animate-spin border-2 border-white/20 border-t-emerald-400" />
    </div>
  );
}

export default function CadreAuth({ children, pied }: { children: React.ReactNode; pied: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* `Suspense` parce que le panneau lit `?for=` : sans lui, Next refuse
          de rendre l'arbre au moment de la génération. Le repli porte le même
          `hidden lg:block`, sans quoi un aplat sombre apparaîtrait en haut des
          téléphones le temps de la résolution. */}
      <Suspense fallback={<div className="hidden bg-gray-900 lg:block lg:min-h-screen" />}>
        <PanneauSection />
      </Suspense>

      <main className="flex flex-col items-center justify-center bg-white px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">
          {/* LE NOM REPREND SA PLACE ICI SUR TÉLÉPHONE : il vivait dans le
              panneau, qui n'y est plus.

              ÉCRIT, ET NON DESSINÉ. C'était encore le logo en image pendant
              que le panneau du desktop, lui, écrivait le nom dans la police
              du produit : deux marques différentes sur le même écran selon
              la largeur. Même typographie que le header et que le panneau,
              en encre sombre — le fond est clair de ce côté. */}
          <Link
            href="/"
            className="mb-9 flex w-fit items-center gap-2.5 font-display text-2xl font-black uppercase tracking-[0.14em] text-gray-900 transition-opacity hover:opacity-70 lg:hidden"
          >
            <SymboleKoppafoot className="h-8" />
            Koppafoot
          </Link>
          <Suspense fallback={null}>
            <RetourSectionMobile />
          </Suspense>

          {children}
        </div>

        {pied}
      </main>
    </div>
  );
}
