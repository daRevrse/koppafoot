"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, ArrowRight } from "lucide-react";

// ============================================
// MarketingChrome — the header and footer of the organizer site.
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

const SECTIONS = [
  { href: "#methode", label: "La méthode" },
  { href: "#tutoriel", label: "Tutoriel" },
  { href: "#questions", label: "Questions" },
];

export function MarketingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200/70 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-5 sm:px-10 sm:py-7">
        {/* Back into the app proper — this page is a door, not a dead end. */}
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <Image src="/branding/logo_symbol.png" alt="KoppaFoot" width={34} height={34} />
          <span className="font-display text-xl font-black uppercase tracking-[0.18em] text-gray-900 sm:text-2xl">
            Koppafoot
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-9 md:flex">
          {SECTIONS.map((s) => (
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
        <Link
          href="/organisateurs/candidature"
          className="group ml-auto hidden shrink-0 items-center gap-2 border-b-2 border-gray-900 pb-1 text-[11px] font-black uppercase tracking-[0.2em] text-gray-900 transition-colors hover:border-emerald-600 hover:text-emerald-700 sm:flex md:ml-0"
        >
          Candidater
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </Link>

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
          {[...SECTIONS, { href: "/organisateurs/candidature", label: "Candidater" }].map((s) => (
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
    <footer className="relative overflow-hidden border-t border-gray-200/70 bg-white">
      <div className="mx-auto max-w-7xl px-6 pb-0 pt-20 sm:px-10 sm:pt-28">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <p className="max-w-sm font-display text-2xl font-black leading-tight tracking-tight text-gray-900 sm:text-3xl">
            Le football togolais, tenu comme il le mérite.
          </p>

          <div className="flex flex-col gap-3 text-sm font-bold text-gray-500">
            <Link href="/" className="transition-colors hover:text-emerald-700">
              Voir le direct
            </Link>
            <Link href="/competitions" className="transition-colors hover:text-emerald-700">
              Les compétitions
            </Link>
            <Link href="/organisateurs/candidature" className="transition-colors hover:text-emerald-700">
              Devenir organisateur
            </Link>
          </div>
        </div>

        {/* The name at poster size, cropped by the fold — the wordmark IS the
            bottom of the page rather than a line of small print in it. */}
        <p
          aria-hidden
          className="pointer-events-none mt-14 translate-y-[18%] select-none font-display text-[19vw] font-black leading-[0.78] tracking-[-0.03em] text-gray-900/[0.07]"
        >
          KOPPAFOOT
        </p>
      </div>
    </footer>
  );
}
