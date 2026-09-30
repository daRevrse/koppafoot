"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";

// ============================================
// « Comment faire ? », sous un écran vide.
//
// Un écran vide est exactement l'endroit où un nouveau venu se demande quoi
// faire : pas d'équipe, pas de compétition, pas de terrain. Le bouton d'action
// dit le premier geste ; ce lien mène au tutoriel qui dit tous les suivants.
// ============================================

const T = textes(
  { question: "Comment faire ?", lien: "Lire le tutoriel" },
  { question: "How does it work?", lien: "Read the guide" },
);

export default function CommentFaire({ tutoriel, className = "" }: { tutoriel: string; className?: string }) {
  const t = useTextes(T);
  return (
    <p className={`text-xs font-semibold text-gray-400 ${className}`}>
      {t.question}{" "}
      <Link
        href={`/aide/tutoriels/${tutoriel}`}
        className="inline-flex items-center gap-1 font-black text-gray-600 underline decoration-dotted underline-offset-2 transition-colors hover:text-emerald-700"
      >
        <BookOpen size={12} /> {t.lien}
      </Link>
    </p>
  );
}
