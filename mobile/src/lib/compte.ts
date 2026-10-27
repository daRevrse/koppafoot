import { offreAffichee, titresDuCompte } from "@/lib/offre";
import { NOM_OFFRE } from "@/lib/paiement";
import { SITE_URL } from "~/lib/config";

// L'écran Compte : ce que la feuille du bouton Compte du site propose
// (components/layout/AvatarBottomSheet), à la forme de l'application.

/**
 * Le nom de l'entrée Offre : celle que le compte peut avoir, KoppaFoot+ pour
 * qui gère (manager, organisateur, propriétaire de terrain), « Pas de pubs »
 * pour les autres (lib/offre, offreAffichee). Sans compte : les offres.
 */
export function nomDeLOffre(profil: Parameters<typeof titresDuCompte>[0]): string {
  return profil ? NOM_OFFRE[offreAffichee(titresDuCompte(profil))] : "Offres";
}

/** Le message partagé par « Inviter » : celui du site (invite.message), et l'adresse. */
export function messageDInvitation(prenom: string | null | undefined): string {
  const texte = prenom
    ? `${prenom} t'invite à suivre les compétitions de football en direct sur Koppafoot ⚽`
    : "Suis les compétitions de football en direct sur Koppafoot ⚽";
  return `${texte}\n${SITE_URL}`;
}

/** Le support du site (SupportBlock) : les tutoriels d'abord, la question des nouveaux. */
export const PAGES_D_AIDE = [
  { libelle: "Tutoriels", chemin: "/aide/tutoriels", icone: "book-outline" },
  { libelle: "Questions fréquentes", chemin: "/aide", icone: "help-circle-outline" },
  { libelle: "Nous faire un retour", chemin: "/aide#retour", icone: "chatbox-ellipses-outline" },
] as const;
