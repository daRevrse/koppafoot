// "Inviter un ami", share (or copy) the public app link. Client-only:
// only ever called from click handlers, so navigator is always defined.

const APP_URL = "https://www.koppafoot.com";

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

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title: "Koppafoot", text, url: APP_URL });
      return "shared";
    } catch (err) {
      // AbortError = user closed the share sheet, not a failure to report.
      if ((err as DOMException)?.name === "AbortError") return "shared";
      // fall through to clipboard
    }
  }

  try {
    await navigator.clipboard.writeText(`${text}\n${APP_URL}`);
    return "copied";
  } catch {
    return "failed";
  }
}
