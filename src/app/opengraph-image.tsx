import { ImageResponse } from "next/og";
import { AfficheDeMarque, TAILLE_OG } from "@/lib/og";

// ============================================
// L'aperçu par défaut, celui de tous les liens du produit.
//
// Posée à la racine de `app`, cette image sert TOUTES les routes qui n'en
// déclarent pas une à elles : la page d'accueil qu'on envoie en invitant un
// ami, l'annuaire, les Actus, une fiche joueur. Un segment plus profond peut
// la remplacer — voir matches/[id]/opengraph-image, qui dessine l'affiche du
// match.
//
// DESSINÉE PLUTÔT QUE LIVRÉE EN PNG : un fichier de 1200×630 dans `public`
// aurait fait le même effet, mais il aurait fallu le régénérer à la main au
// premier changement de nom ou de couleur, et personne ne pense à rouvrir un
// binaire. Ici le texte est du texte.
// ============================================

export const size = TAILLE_OG;
export const contentType = "image/png";
export const alt = "KoppaFoot, le football local en direct";

export default function Image() {
  return new ImageResponse(<AfficheDeMarque />, size);
}
