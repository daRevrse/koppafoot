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
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white shadow-md border-b border-gray-100"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/branding/logo_full_name.png"
            alt="KOPPAFOOT"
            width={140}
            height={36}
            className={scrolled ? "" : "brightness-0 invert"}
            priority
          />
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              scrolled
                ? "border border-gray-300 text-gray-700 hover:bg-gray-50"
                : "border border-white/30 text-white hover:bg-white/10"
            }`}
          >
            Se connecter
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
          >
            Rejoindre
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className={`md:hidden rounded-lg p-2 ${scrolled ? "text-gray-700" : "text-white"}`}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-gray-100 bg-white px-6 py-4 shadow-lg md:hidden">
          <div className="flex flex-col gap-3">
            <Link href="/login" onClick={() => setMobileOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2.5 text-center text-sm font-medium text-gray-700">
              Se connecter
            </Link>
            <Link href="/signup" onClick={() => setMobileOpen(false)} className="rounded-lg bg-primary-600 px-4 py-2.5 text-center text-sm font-medium text-white">
              Rejoindre
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
