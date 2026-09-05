"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRoleOnboarding } from "@/hooks/useRoleOnboarding";
import OnboardingChecklist from "@/components/onboarding/OnboardingChecklist";

// ============================================
// « Pour bien démarrer », sur le direct.
//
// LA LISTE A SUIVI CELUI QU'ELLE GUIDE. Elle vivait sur /evolution, la page
// du rôle, qui n'ouvre plus : le choix du rôle est parti sur la vitrine, et
// on en revient sur le direct. Quelqu'un qui vient d'activer son espace
// atterrit donc ici — c'est exactement le moment où « et maintenant ? » se
// pose, et c'était l'unique surface du produit qui savait y répondre.
//
// ELLE NE S'AFFICHE QUE QUAND ELLE A QUELQUE CHOSE À DIRE. Le direct est un
// tableau de scores que la plupart des gens ouvrent dix fois par semaine :
// une liste terminée qui reste en tête de page devient du mobilier. Trois
// conditions, donc — un compte, un rôle activé, et au moins une étape qui
// manque. Elle disparaît d'elle-même le jour où tout est fait, sans que
// personne ait à la fermer.
//
// Elle reste par ailleurs repliable, et le choix se retient (voir
// OnboardingChecklist) : replier vaut pour le direct comme pour ailleurs.
//
// CE QU'ELLE COÛTE, PUISQU'ELLE VIT MAINTENANT SUR LA PAGE LA PLUS OUVERTE.
// Rien pour un visiteur ni pour un compte sans rôle : le hook ne lance aucune
// requête. Rien non plus pour un joueur, dont la liste se déduit du seul
// profil. Un manager coûte deux requêtes plus une lecture par équipe, un
// arbitre une requête — à chaque ouverture du direct, y compris quand tout
// est déjà fait, puisque c'est justement la lecture qui l'apprend. C'est
// négligeable aux volumes actuels ; le jour où ce ne le sera plus, la parade
// tient en une ligne : retenir dans le navigateur qu'un compte a fini, et ne
// plus jamais redemander.
// ============================================

export default function GuideDeDemarrage() {
  const { user } = useAuth();
  const progression = useRoleOnboarding();

  // Pas de squelette pendant le chargement : ce bloc est un accompagnement,
  // pas le contenu de la page. Réserver sa place ferait sauter le tableau
  // vers le bas à chaque ouverture, pour un encart qui souvent ne viendra
  // même pas.
  if (!user?.evolutionRole || !progression || progression.complete) return null;

  return <OnboardingChecklist progress={progression} />;
}
