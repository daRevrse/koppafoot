"use client";

import Link from "next/link";
import { useT, useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import CartesTutoriels from "@/components/aide/CartesTutoriels";

// ============================================
// Le centre de tutoriels : un guide par profil.
//
// Les retours des premiers inscrits disaient la même chose — « on ne savait
// pas quoi faire ». Les guides existaient, en PDF, mais nulle part dans le
// produit. Ils sont ici, avec une fiche courte à lire sur place pour chacun.
// ============================================

const T = textes(
  {
    fil: "Tutoriels",
    surtitre: "Aide",
    titre: "Tutoriels",
    chapeau: "Un guide par profil : l'essentiel en quelques étapes, et le guide complet en PDF pour tout voir ou l'imprimer.",
  },
  {
    fil: "Guides",
    surtitre: "Help",
    titre: "Guides",
    chapeau: "One guide per profile: the essentials in a few steps, and the full PDF to see everything or print it.",
  },
);

export default function TutorielsPage() {
  const t = useTextes(T);
  const trad = useT();
  return (
    <div className="mx-auto max-w-3xl pb-24">
      <nav
        aria-label="Fil d'ariane"
        className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-black uppercase tracking-[0.12em] text-gray-400"
      >
        <Link href="/" className="transition-colors hover:text-emerald-700">{trad("nav.direct")}</Link>
        <span aria-hidden className="text-gray-300">›</span>
        <Link href="/aide" className="transition-colors hover:text-emerald-700">{trad("aide.fil")}</Link>
        <span aria-hidden className="text-gray-300">›</span>
        <span className="text-gray-600">{t.fil}</span>
      </nav>

      <header className="mb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">{t.surtitre}</p>
        <h1 className="mt-1 font-display text-2xl font-black uppercase leading-tight tracking-tight text-gray-900 sm:text-4xl">
          {t.titre}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-500">{t.chapeau}</p>
      </header>

      <CartesTutoriels />
    </div>
  );
}
