"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled
        ? "bg-white/95 backdrop-blur-xl shadow-lg"
        : "bg-white"
        }`}
    >
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-6 lg:px-8">
        {/* Logo — normal, no filters */}
        <Link href="/" className="relative h-10 w-44">
          <Image
            src="/branding/logo_full_name.png"
            alt="KOPPAFOOT"
            fill
            className="object-contain object-left"
            sizes="176px"
            priority
          />
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-2 md:flex">
          <a
            href="#roles"
            className="rounded-full px-5 py-2 text-sm font-medium text-[#1A1715]/70 transition-colors hover:text-[#1A1715] hover:bg-[#1A1715]/5"
          >
            Rôles
          </a>
          <a
            href="#features"
            className="rounded-full px-5 py-2 text-sm font-medium text-[#1A1715]/70 transition-colors hover:text-[#1A1715] hover:bg-[#1A1715]/5"
          >
            Fonctionnalités
          </a>
          <a
            href="#community"
            className="rounded-full px-5 py-2 text-sm font-medium text-[#1A1715]/70 transition-colors hover:text-[#1A1715] hover:bg-[#1A1715]/5"
          >
            Communauté
          </a>
        </div>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="rounded-full px-5 py-2.5 text-sm font-medium text-[#1A1715]/70 transition-colors hover:text-[#1A1715]"
          >
            Se connecter
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-600 hover:shadow-lg hover:shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98]"
          >
            Rejoindre
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden rounded-full p-2.5 text-[#1A1715]/70 hover:text-[#1A1715] hover:bg-[#1A1715]/5 transition-colors"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-[#1A1715]/10 bg-white px-6 py-6 md:hidden">
          <div className="flex flex-col gap-2 mb-4">
            <a
              href="#roles"
              onClick={() => setMobileOpen(false)}
              className="rounded-2xl px-4 py-3 text-sm font-medium text-[#1A1715]/70 hover:text-[#1A1715] hover:bg-[#1A1715]/5 transition-colors"
            >
              Rôles
            </a>
            <a
              href="#features"
              onClick={() => setMobileOpen(false)}
              className="rounded-2xl px-4 py-3 text-sm font-medium text-[#1A1715]/70 hover:text-[#1A1715] hover:bg-[#1A1715]/5 transition-colors"
            >
              Fonctionnalités
            </a>
            <a
              href="#testimonials"
              onClick={() => setMobileOpen(false)}
              className="rounded-2xl px-4 py-3 text-sm font-medium text-[#1A1715]/70 hover:text-[#1A1715] hover:bg-[#1A1715]/5 transition-colors"
            >
              Témoignages
            </a>
          </div>
          <div className="flex flex-col gap-3 pt-4 border-t border-[#1A1715]/10">
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="rounded-2xl border border-[#1A1715]/15 px-4 py-3 text-center text-sm font-medium text-[#1A1715]"
            >
              Se connecter
            </Link>
            <Link
              href="/signup"
              onClick={() => setMobileOpen(false)}
              className="rounded-2xl bg-emerald-500 px-4 py-3 text-center text-sm font-semibold text-white"
            >
              Rejoindre
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
