"use client";

import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { useLangue } from "@/i18n";
import { TUTORIELS } from "@/lib/tutoriels";

// ============================================
// Les tutoriels, en cartes : une par profil, avec pour qui elle est écrite.
//
// Sur la page d'aide et sur le centre de tutoriels. On choisit sa carte à ce
// qu'on FAIT (« Tu diriges une équipe »), pas au nom d'un rôle qu'on ne
// connaît pas encore.
// ============================================

export default function CartesTutoriels({ sauf }: { sauf?: string }) {
  const { langue } = useLangue();
  return (
    <ul className="grid gap-px border border-gray-200/70 bg-gray-200/70 sm:grid-cols-2">
      {TUTORIELS.filter((t) => t.slug !== sauf).map((t) => (
        <li key={t.slug} className="bg-white">
          <Link
            href={`/aide/tutoriels/${t.slug}`}
            className="group flex h-full flex-col gap-1.5 p-4 transition-colors hover:bg-gray-50 sm:p-5"
          >
            <span className="flex items-center justify-between gap-3">
              <span className="font-display text-base font-black uppercase tracking-tight text-gray-900">
                {t.titre[langue]}
              </span>
              <ArrowRight size={15} className="shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-700" />
            </span>
            <span className="text-xs leading-relaxed text-gray-500">{t.pourQui[langue]}</span>
            {t.pdf && (
              <span className="mt-auto inline-flex items-center gap-1 pt-1 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                <FileText size={11} /> PDF
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
