"use client";

import { isOrganizer } from "@/lib/hats";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// "Organiser ma compétition", vit dans le pied du menu latéral, à côté
// d'« Inviter un ami ». Il était auparavant un lien discret en bas du
// répertoire /competitions : cette page sert à trouver une compétition, pas
// à en créer une, et le lien y passait inaperçu.
//
// Rien à afficher pour un organisateur : son espace est déjà dans le menu
// au-dessus. Tout le monde d'autre part sur le formulaire de candidature
// (les visiteurs sont renvoyés vers la connexion par le layout).
export default function OrganizeCompetitionCta() {
  const { user } = useAuth();
  if (isOrganizer(user)) {
    return null;
  }

  return (
    <Link
      href="/organisateurs"
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-full items-center justify-center gap-2 border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-700 transition-colors hover:bg-amber-100"
    >
      <Plus size={15} />
      Organiser ma compétition
    </Link>
  );
}
