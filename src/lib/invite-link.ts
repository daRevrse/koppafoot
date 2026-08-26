// "Inviter un ami", share (or copy) the public app link. Client-only:
// only ever called from click handlers, so navigator is always defined.
//
// Le geste lui-même vit dans lib/partage, avec celui de la Tribune, du match
// et de la compétition : ce module ne garde que le TEXTE de l'invitation.

import { APP_URL, partagerLien } from "@/lib/partage";

/**
 * Partage le lien public de l'appli.
 *
 * Le TEXTE est fourni par l'appelant plutot que construit ici : il est
 * traduit, et une fonction de la couche `lib` n'a pas acces au dictionnaire.
 * Le repli francais reste la pour les appels qui n'en passent pas.
 */
export async function shareInviteLink(
  firstName?: string,
  message?: string,
): Promise<"shared" | "copied" | "failed"> {
  const text = message
    ?? (firstName
      ? `${firstName} t'invite à suivre les compétitions de football en direct sur Koppafoot ⚽`
      : "Suis les compétitions de football en direct sur Koppafoot ⚽");

  const resultat = await partagerLien({ title: "Koppafoot", text, url: APP_URL });
  return resultat === "partage" ? "shared" : resultat === "copie" ? "copied" : "failed";
}
