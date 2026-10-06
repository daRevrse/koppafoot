"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import MiniEcusson from "@/components/match/MiniEcusson";
import { useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import type { ClubDeLEquipe } from "@/lib/clubs";

// ============================================
// Sous le bandeau d'une équipe : le club dont elle est une section.
//
// Rien quand elle n'a pas de club, ou quand son club dort (lib/clubs) : la
// fiche redevient alors celle d'une équipe autonome, sans trace d'un lien
// qui ne mène plus nulle part.
// ============================================

const T = textes(
  { section: (libelle: string) => (libelle ? `Section ${libelle}` : "Section") },
  { section: (libelle: string) => (libelle ? `${libelle} section` : "Section") },
);

export default function SectionDuClub({ equipeId }: { equipeId: string }) {
  const t = useTextes(T);
  const [club, setClub] = useState<ClubDeLEquipe | null>(null);

  useEffect(() => {
    let vivant = true;
    fetch(`/api/public/team/${encodeURIComponent(equipeId)}/club`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivant) setClub(d?.club ?? null); })
      .catch(() => {});
    return () => { vivant = false; };
  }, [equipeId]);

  if (!club) return null;
  return (
    <Link
      href={`/clubs/${club.slug}`}
      className="mx-auto mt-3 flex max-w-6xl items-center gap-3 border border-gray-200/70 bg-white px-4 py-2.5 transition-colors hover:border-gray-400"
    >
      {club.logoUrl ? (
        <MiniEcusson nom={club.nom} logo={club.logoUrl} taille={28} />
      ) : (
        <span aria-hidden style={{ backgroundColor: club.couleur }}
          className="flex h-7 w-7 shrink-0 items-center justify-center text-xs font-black text-white">
          {club.nom.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-sm">
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">{t.section(club.libelle)}</span>
        <span className="mx-1.5 text-gray-300">·</span>
        <span className="font-bold text-gray-900">{club.nom}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-gray-400" />
    </Link>
  );
}
