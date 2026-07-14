// "Inviter un ami" — share (or copy) the public app link. Client-only:
// only ever called from click handlers, so navigator is always defined.

const APP_URL = "https://koppafoot.com";

export async function shareInviteLink(firstName?: string): Promise<"shared" | "copied" | "failed"> {
  const text = firstName
    ? `${firstName} t'invite à suivre les compétitions de football en direct sur Koppafoot ⚽`
    : "Suis les compétitions de football en direct sur Koppafoot ⚽";

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title: "Koppafoot", text, url: APP_URL });
      return "shared";
    } catch (err) {
      // AbortError = user closed the share sheet — not a failure to report.
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
