"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import SymboleKoppafoot from "@/components/marque/SymboleKoppafoot";
import { usePathname } from "next/navigation";
import { useHauteurPubliee } from "@/hooks/useHauteurPubliee";
import { Menu, X, ArrowRight, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { VITRINES, vitrineDe, type Vitrine } from "@/config/vitrines";

// ============================================
// MarketingChrome, l'en-tête et le pied des vitrines (Organize, Score,
// MyFields, Evolution), lus dans config/vitrines.
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
 * L'EN-TÊTE DIT DANS QUEL ESPACE ON EST, ET PERMET D'EN CHANGER.
 *
 * Il ne portait que « KOPPAFOOT » : une fois la page défilée, rien ne disait
 * qu'on lisait Organize plutôt que Score, et passer d'un espace à l'autre
 * obligeait à descendre jusqu'au pied. Le nom de l'espace se lit maintenant à
 * côté de celui du produit, et c'est un menu vers les autres espaces.
 *
 * Les sections (ancres) ne valent que sur la page de présentation ; une
 * sous-page (candidature, annuaire, fiche d'un terrain) garde le nom de son
 * espace, qui y ramène. Les listes viennent de config/vitrines.
 *
 * CONNECTÉ, L'EN-TÊTE LE SAIT : « Retour au Direct » ramène à l'application,
 * et qui a déjà l'espace (un organisateur validé, un scoreur, un gérant) se
 * voit proposer son écran de travail plutôt que de candidater à nouveau.
 */
function nomCourt(v: Vitrine): string {
  return v.nom.replace(/^Koppafoot\s+/i, "");
}

function SelecteurEspace({ vitrine }: { vitrine: Vitrine }) {
  const [ouvert, setOuvert] = useState(false);
  const boite = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => {
      if (boite.current && !boite.current.contains(e.target as Node)) setOuvert(false);
    };
    const echap = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(false);
    document.addEventListener("mousedown", dehors);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("mousedown", dehors);
      document.removeEventListener("keydown", echap);
    };
  }, [ouvert]);

  return (
    <div ref={boite} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        aria-haspopup="true"
        className="flex min-w-0 items-center gap-1.5 font-display text-xl font-black uppercase tracking-[0.12em] text-emerald-700 transition-colors hover:text-emerald-800 sm:text-2xl"
      >
        <span className="truncate">{nomCourt(vitrine)}</span>
        <ChevronDown size={18} className={`shrink-0 transition-transform ${ouvert ? "rotate-180" : ""}`} />
      </button>

      {ouvert && (
        <div className="absolute left-0 top-full z-50 mt-3 w-[min(22rem,calc(100vw-3rem))] border border-gray-200/70 bg-white shadow-xl">
          {VITRINES.map((v) => {
            const ici = v.cle === vitrine.cle;
            const surLaPresentation = pathname === v.chemin;
            return (
              <Link
                key={v.cle}
                href={v.chemin}
                onClick={() => setOuvert(false)}
                aria-current={ici ? "page" : undefined}
                className={`group flex items-start gap-3.5 border-b border-gray-200/70 px-5 py-4 transition-colors last:border-b-0 ${
                  ici ? "bg-gray-50" : "hover:bg-gray-50"
                }`}
              >
                <v.Icone
                  size={20}
                  strokeWidth={1.5}
                  className={`mt-0.5 shrink-0 ${ici ? "text-emerald-600" : "text-gray-300 transition-colors group-hover:text-emerald-600"}`}
                />
                <span className="min-w-0">
                  <span className="block font-display text-base font-black uppercase leading-tight tracking-tight text-gray-900">
                    {v.nom}
                  </span>
                  <span className="mt-1 block text-xs font-medium leading-relaxed text-gray-500">
                    {ici && !surLaPresentation ? "Revenir à la présentation" : v.phrase.fr}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();
  const vitrine = vitrineDe(pathname);
  const surLaPresentation = vitrine?.chemin === pathname;
  const sections = vitrine && surLaPresentation ? vitrine.sections : [];
  const action = vitrine ? (vitrine.monEspace(user) ?? vitrine.action) : null;

  // L'en-tete publie sa hauteur reelle : l'annuaire des terrains y epingle sa
  // barre de filtres, et cette hauteur change de 16px entre mobile et
  // desktop (py-5 / sm:py-7). Un offset devine aurait laisse la barre glisser
  // sous l'en-tete sur l'un des deux.
  const ref = useHauteurPubliee<HTMLElement>("--marketing-header-h");

  return (
    <header ref={ref} className="sticky top-0 z-50 border-b border-gray-200/70 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-5 sm:px-10 sm:py-7">
        {/* Le produit, puis l'espace. Le nom du produit ramène à l'application :
            ces pages sont des portes, pas des impasses. */}
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 text-gray-900">
            <SymboleKoppafoot className="h-7 sm:h-8" />
            <span
              className={`font-display text-xl font-black uppercase tracking-[0.18em] sm:text-2xl ${
                vitrine ? "hidden sm:inline" : ""
              }`}
            >
              Koppafoot
            </span>
          </Link>
          {vitrine && (
            <>
              <span aria-hidden className="hidden h-6 w-px bg-gray-200 sm:block" />
              <SelecteurEspace vitrine={vitrine} />
            </>
          )}
        </div>

        <nav className="ml-auto hidden items-center gap-9 lg:flex">
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

        {user && (
          <Link
            href="/"
            className={`hidden shrink-0 text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 transition-colors hover:text-gray-900 md:block ${
              sections.length ? "" : "ml-auto"
            }`}
          >
            Retour au Direct
          </Link>
        )}

        {/* A link, dressed as a link. The wide CTAs live in the page. */}
        {action && (
          <Link
            href={action.href}
            className={`group hidden shrink-0 items-center gap-2 border-b-2 border-gray-900 pb-1 text-[11px] font-black uppercase tracking-[0.2em] text-gray-900 transition-colors hover:border-emerald-600 hover:text-emerald-700 sm:flex ${
              sections.length || user ? "" : "ml-auto"
            }`}
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
          className="ml-auto shrink-0 text-gray-900 transition-opacity hover:opacity-60 sm:ml-0 lg:hidden"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <nav className="max-h-[calc(100dvh-5rem)] overflow-y-auto border-t border-gray-200/70 px-6 py-3 lg:hidden">
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

          <p className="mt-3 border-t border-gray-200/70 pt-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
            Les espaces
          </p>
          {VITRINES.map((v) => (
            <Link
              key={v.cle}
              href={v.chemin}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 py-3 text-sm font-black uppercase tracking-[0.14em] ${
                v.cle === vitrine?.cle ? "text-emerald-700" : "text-gray-700"
              }`}
            >
              <v.Icone size={16} strokeWidth={1.75} className="shrink-0" />
              {v.nom}
            </Link>
          ))}

          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="mt-2 block border-t border-gray-200/70 py-4 text-sm font-black uppercase tracking-[0.18em] text-gray-900"
          >
            {user ? "Retour au Direct" : "Ouvrir l'application"}
          </Link>
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
          <div className="grid gap-x-16 gap-y-8 sm:grid-cols-3">
            <div className="flex flex-col gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
                Les espaces
              </p>
              {VITRINES.map((v) => (
                <Link
                  key={v.cle}
                  href={v.chemin}
                  className="text-sm font-bold text-white/60 transition-colors hover:text-white"
                >
                  {v.nom}
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

            <div className="flex flex-col gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
                Le cadre
              </p>
              {[
                { href: "/conditions", label: "Conditions d'utilisation" },
                { href: "/confidentialite", label: "Confidentialité" },
                { href: "/aide", label: "Nous écrire" },
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
