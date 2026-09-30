"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useGuidesDeDemarrage } from "@/hooks/useRoleOnboarding";
import OnboardingChecklist from "@/components/onboarding/OnboardingChecklist";
import type { ProfilGuide } from "@/lib/onboarding";

// ============================================
// « Pour bien démarrer », sur le direct et dans chaque espace.
//
// LA LISTE A SUIVI CELUI QU'ELLE GUIDE. Elle vivait sur /evolution, la page
// du rôle, qui n'ouvre plus : le choix du rôle est parti sur la vitrine, et
// on en revient sur le direct. Quelqu'un qui vient d'activer son espace
// atterrit donc ici — c'est exactement le moment où « et maintenant ? » se
// pose.
//
// ET ELLE PARLE AUSSI À CELUI QUI N'A RIEN CHOISI. Un compte tout neuf est un
// spectateur : il avait droit à un tableau de scores et à rien d'autre, et
// les premiers inscrits l'ont dit — ils ne savaient pas quoi faire. Il a
// maintenant son guide, qui lui montre aussi la porte des rôles.
//
// SUR LE DIRECT, TOUS LES PROFILS DU COMPTE ; DANS UN ESPACE, LE SIEN
// (`profils`) : l'espace organisateur n'a pas à rappeler de compléter un
// profil de joueur. Un compte à plusieurs guides inachevés les voit en
// onglets, un seul à la fois.
//
// ELLE NE S'AFFICHE QUE QUAND ELLE A QUELQUE CHOSE À DIRE. Le direct est un
// tableau de scores que la plupart des gens ouvrent dix fois par semaine :
// une liste terminée qui reste en tête de page devient du mobilier. Elle
// disparaît d'elle-même le jour où tout est fait, sans que personne ait à la
// fermer. Elle reste par ailleurs repliable, et le choix se retient (voir
// OnboardingChecklist).
//
// CE QU'ELLE COÛTE : rien pour un visiteur ; pour un compte, les quelques
// lectures de ses profils (voir useGuidesDeDemarrage), à chaque ouverture,
// puisque c'est justement la lecture qui apprend qu'une étape est faite.
// ============================================

export default function GuideDeDemarrage({ profils }: { profils?: ProfilGuide[] }) {
  const { user } = useAuth();
  const guides = useGuidesDeDemarrage(profils);
  const [choisi, setChoisi] = useState<ProfilGuide | null>(null);

  // Pas de squelette pendant le chargement : ce bloc est un accompagnement,
  // pas le contenu de la page. Réserver sa place ferait sauter le tableau
  // vers le bas à chaque ouverture, pour un encart qui souvent ne viendra
  // même pas.
  if (!user || !guides) return null;
  const inacheves = guides.filter((g) => !g.complete);
  if (inacheves.length === 0) return null;

  const actif = inacheves.find((g) => g.profil === choisi) ?? inacheves[0];

  const onglets = inacheves.length > 1 ? (
    <div className="mt-3 flex flex-wrap gap-1.5" role="tablist">
      {inacheves.map((g) => (
        <button
          key={g.profil}
          type="button"
          role="tab"
          aria-selected={g.profil === actif.profil}
          onClick={() => setChoisi(g.profil)}
          className={`border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] transition-colors ${
            g.profil === actif.profil
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-200/70 bg-white text-gray-500 hover:border-gray-900 hover:text-gray-900"
          }`}
        >
          {g.titre} · {g.doneCount}/{g.total}
        </button>
      ))}
    </div>
  ) : null;

  return <OnboardingChecklist progress={actif} onglets={onglets} />;
}
