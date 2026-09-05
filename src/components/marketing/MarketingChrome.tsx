"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useHauteurPubliee } from "@/hooks/useHauteurPubliee";
import { Menu, X, ArrowRight } from "lucide-react";

// ============================================
// MarketingChrome, the header and footer of the organizer site.
//
// Deliberately NOT the app shell. Someone who opens this link has not signed
// in and has no competition: Direct / Compétitions / Mercato would be
// furniture for a product they have not agreed to use yet. The app and the
// pitch are two organs of one body, and this is the skin of the second.
//
// Editorial rules, applied here and on the page below: nothing that is a
// link pretends to be a button, type is large and set in caps with wide
// tracking, and the footer carries the name at poster size.
// ============================================

/**
 * Chaque vitrine a ses sections et son action.
 *
 * Le chrome portait celles de la page organisateur, en dur, pour les trois
 * vitrines : sur Evolution et MyFields, « La méthode » et « Tutoriel »
 * pointaient vers des ancres inexistantes, un clic qui ne fait rien, et
 * « Candidater » envoyait vers la candidature ORGANISATEUR depuis la page
 * des terrains.
 */
interface Vitrine {
  sections: { href: string; label: string }[];
  action: { href: string; label: string } | null;
}

const VITRINES: Record<string, Vitrine> = {
  "/organisateurs": {
    sections: [
      { href: "#methode", label: "La méthode" },
      { href: "#tutoriel", label: "Tutoriel" },
      { href: "#questions", label: "Questions" },
    ],
    action: { href: "/organisateurs/candidature", label: "Candidater" },
  },
  "/roles": {
    sections: [
      { href: "#ouverts", label: "Les rôles" },
      { href: "#choisir", label: "Choisir" },
    ],
    // Une ancre, et non /evolution : le choix se fait sur cette page même,
    // dans la section que la barre désigne deux entrées plus tôt.
    action: { href: "#choisir", label: "Choisir mon rôle" },
  },
  "/terrains": {
    sections: [
      { href: "#etapes", label: "Comment ça marche" },
      { href: "#cadre", label: "Le cadre" },
    ],
    action: { href: "/terrains/candidature", label: "Référencer" },
  },
  // L'annuaire s'adresse au public inverse : celui qui cherche un terrain.
  // Son action est donc la candidature elle aussi, mais ses ancres n'ont pas
  // lieu d'être — la page est une liste, on y descend en filtrant.
  "/terrains/annuaire": {
    sections: [],
    action: { href: "/terrains", label: "J'ai un terrain" },
  },
};

/** Une page inconnue garde le logo et le retour au direct, rien d'invente. */
const VITRINE_NEUTRE: Vitrine = { sections: [], action: null };

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { sections, action } = VITRINES[pathname] ?? VITRINE_NEUTRE;

  // L'en-tete publie sa hauteur reelle : l'annuaire des terrains y epingle sa
  // barre de filtres, et cette hauteur change de 16px entre mobile et
  // desktop (py-5 / sm:py-7). Un offset devine aurait laisse la barre glisser
  // sous l'en-tete sur l'un des deux.
  const ref = useHauteurPubliee<HTMLElement>("--marketing-header-h");

  return (
    <header ref={ref} className="sticky top-0 z-50 border-b border-gray-200/70 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-5 sm:px-10 sm:py-7">
        {/* Back into the app proper, this page is a door, not a dead end. */}
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <Image src="/branding/logo_symbol.png" alt="KoppaFoot" width={34} height={34} />
          <span className="font-display text-xl font-black uppercase tracking-[0.18em] text-gray-900 sm:text-2xl">
            Koppafoot
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-9 md:flex">
          {sections.map((s) => (
            <a
              key={s.href}
              href={s.href}
              className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 transition-colors hover:text-gray-900"
            >
              {s.label}
            </a>
          ))}
        </nav>

        {/* A link, dressed as a link. The wide CTAs live in the page. */}
        {action && (
          <Link
            href={action.href}
            className="group ml-auto hidden shrink-0 items-center gap-2 border-b-2 border-gray-900 pb-1 text-[11px] font-black uppercase tracking-[0.2em] text-gray-900 transition-colors hover:border-emerald-600 hover:text-emerald-700 sm:flex md:ml-0"
          >
            {action.label}
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={open}
          className="ml-auto shrink-0 text-gray-900 transition-opacity hover:opacity-60 md:hidden"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-gray-200/70 px-6 py-3 md:hidden">
          {[...sections, ...(action ? [action] : [])].map((s) => (
            <a
              key={s.href}
              href={s.href}
              onClick={() => setOpen(false)}
              className="block py-3 text-sm font-black uppercase tracking-[0.18em] text-gray-700"
            >
              {s.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}

export function MarketingFooter() {
  return (
    // Inverse : fond sombre, texte clair. Le pied ferme la page au lieu de
    // la laisser se dissoudre dans le blanc, et les trois vitrines
    // partagent la meme assise, quel que soit le fond de leur contenu.
    <footer className="relative overflow-hidden bg-gray-900 text-white">
      <div className="mx-auto max-w-7xl px-6 pb-0 pt-20 sm:px-10 sm:pt-28">
        <div className="flex flex-col gap-12 sm:flex-row sm:justify-between">
          <p className="max-w-sm font-display text-2xl font-black leading-tight tracking-tight sm:text-3xl">
            Le football amateur, tenu comme il le mérite.
          </p>

          {/* Les trois portes du produit d'un cote, l'application de l'autre.
              Le pied ne portait que « Devenir organisateur » : depuis la page
              des terrains, c'etait la seule sortie proposee, et elle menait
              ailleurs. */}
          <div className="grid gap-x-16 gap-y-8 sm:grid-cols-2">
            <div className="flex flex-col gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
                Les espaces
              </p>
              {[
                { href: "/organisateurs", label: "Koppafoot Organize" },
                { href: "/roles", label: "Koppafoot Evolution" },
                { href: "/terrains", label: "MyFields" },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="text-sm font-bold text-white/60 transition-colors hover:text-white"
                >
                  {l.label}
                </Link>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
                L&apos;application
              </p>
              {[
                { href: "/", label: "Le direct" },
                { href: "/competitions", label: "Les compétitions" },
                { href: "/actus", label: "Les actus" },
                { href: "/login", label: "Se connecter" },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="text-sm font-bold text-white/60 transition-colors hover:text-white"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Le nom en taille d'affiche, coupe par le pli, la signature EST le
            bas de la page, pas une ligne de mentions legales dedans. */}
        <p
          aria-hidden
          className="pointer-events-none mt-16 translate-y-[18%] select-none font-display text-[19vw] font-black leading-[0.78] tracking-[-0.03em] text-white/[0.06]"
        >
          KOPPAFOOT
        </p>
      </div>
    </footer>
  );
}
