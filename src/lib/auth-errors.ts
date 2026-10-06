import type { Langue } from "@/i18n/config";

/**
 * Un compte suspendu par l'administration est désactivé dans Firebase Auth
 * (lib/suspension-serveur) : toute tentative de connexion rend
 * `auth/user-disabled`. La page Aide se lit sans compte et porte le
 * formulaire de retour, seul chemin qui lui reste pour écrire.
 */
export const MESSAGES_COMPTE_SUSPENDU: Record<Langue, string> = {
  fr: "Ce compte est suspendu. Si tu penses qu'il s'agit d'une erreur, écris-nous depuis la page Aide.",
  en: "This account is suspended. If you think this is a mistake, write to us from the Help page.",
};

/** Le français : l'application mobile ne parle que lui. */
export const MESSAGE_COMPTE_SUSPENDU = MESSAGES_COMPTE_SUSPENDU.fr;

// Firebase Auth error codes → user-friendly messages, in both languages.
const AUTH_ERRORS: Record<Langue, Record<string, string>> = {
  fr: {
    "auth/email-already-in-use": "Cet email est déjà utilisé.",
    "auth/invalid-credential": "Email ou mot de passe incorrect.",
    "auth/user-not-found": "Email ou mot de passe incorrect.",
    "auth/wrong-password": "Email ou mot de passe incorrect.",
    "auth/invalid-email": "Adresse email invalide.",
    "auth/weak-password": "Le mot de passe doit contenir au moins 6 caractères.",
    "auth/too-many-requests": "Trop de tentatives. Réessaie dans quelques minutes.",
    "auth/popup-closed-by-user": "Connexion annulée.",
    "auth/account-exists-with-different-credential":
      "Un compte existe déjà avec cet email. Connecte-toi avec ta méthode habituelle.",
    "auth/invalid-verification-code": "Code de vérification invalide.",
    "auth/missing-verification-code": "Entre le code reçu par SMS.",
    "auth/code-expired": "Le code a expiré. Demande un nouveau code.",
    "auth/invalid-phone-number": "Numéro de téléphone invalide.",
    "auth/missing-phone-number": "Entre un numéro de téléphone.",
    "auth/provider-already-linked": "Ce compte est déjà lié.",
    "auth/credential-already-in-use": "Ces identifiants sont déjà utilisés par un autre compte.",
    // SMS / reCAPTCHA specifics, without these every failure of the phone
    // flow surfaced as the generic message, which makes it undebuggable.
    "auth/operation-not-allowed":
      "La connexion par téléphone n'est pas activée sur ce projet. Préviens l'administrateur.",
    "auth/quota-exceeded": "Quota de SMS atteint pour aujourd'hui. Réessaie plus tard.",
    "auth/captcha-check-failed": "Vérification anti-robot échouée. Recharge la page et réessaie.",
    "auth/invalid-app-credential": "Vérification anti-robot invalide. Recharge la page et réessaie.",
    "auth/missing-app-credential": "Vérification anti-robot manquante. Recharge la page et réessaie.",
    "auth/unauthorized-domain": "Ce domaine n'est pas autorisé pour la connexion. Préviens l'administrateur.",
    "auth/billing-not-enabled": "L'envoi de SMS n'est pas activé sur ce projet. Préviens l'administrateur.",
    "auth/user-disabled": MESSAGES_COMPTE_SUSPENDU.fr,
    "auth/network-request-failed": "Connexion impossible. Vérifie ton réseau et réessaie.",
    "auth/requires-recent-login": "Reconnecte-toi pour effectuer cette action.",
    // Backend refusal from the SMS layer (503). The SDK passes the numeric
    // code straight through, hence the odd shape.
    //
    // STILL BLOCKING PRODUCTION as of 2026-08-07: every real number is refused
    // while test numbers go through. Ruled out by test, per-number throttle
    // (reproduced on a fresh number, first attempt), browser extensions and
    // third-party cookies (reproduced in a clean private window), SMS region
    // policy (TG allowed), billing (Blaze active), authorized domain.
    //
    // Lead: a sister project hit the same symptom and traced it to Google's
    // project-level SMS anti-fraud defense, whose default enforcement is too
    // strict. Fixed there by PATCHing the Identity Toolkit project config to
    // `recaptchaConfig.phoneEnforcementState = AUDIT` with
    // `tollFraudManagedRules: [{action: BLOCK, startScore: 0.8}]`.
    //
    // 2026-10-06: that config IS in place on this project (read back:
    // AUDIT, BLOCK from 0.8, useSmsTollFraudProtection true), with no real
    // number tested since. Next step: a real number on the production domain
    // through /login?essai-sms=1, reading the `[sms]` console line
    // (signalerEchecSms below). If -39 persists, suspect that BLOCK rule
    // scoring our numbers at 0.8 or above: check the reCAPTCHA WEB key's SMS
    // toll fraud assessments before loosening it.
    //
    // The message stays neutral, the user can do nothing about it either way,
    // and we do not yet know the cause for THIS project.
    "auth/error-code:-39":
      "L'envoi du SMS a échoué. Réessaie dans quelques minutes ; si le problème persiste, préviens-nous.",
    generique: "Une erreur est survenue. Réessaie.",
  },
  en: {
    "auth/email-already-in-use": "This email is already in use.",
    "auth/invalid-credential": "Wrong email or password.",
    "auth/user-not-found": "Wrong email or password.",
    "auth/wrong-password": "Wrong email or password.",
    "auth/invalid-email": "Invalid email address.",
    "auth/weak-password": "The password must be at least 6 characters long.",
    "auth/too-many-requests": "Too many attempts. Try again in a few minutes.",
    "auth/popup-closed-by-user": "Sign-in cancelled.",
    "auth/account-exists-with-different-credential":
      "An account already exists with this email. Sign in with your usual method.",
    "auth/invalid-verification-code": "Invalid verification code.",
    "auth/missing-verification-code": "Enter the code you received by SMS.",
    "auth/code-expired": "The code has expired. Ask for a new one.",
    "auth/invalid-phone-number": "Invalid phone number.",
    "auth/missing-phone-number": "Enter a phone number.",
    "auth/provider-already-linked": "This account is already linked.",
    "auth/credential-already-in-use": "These credentials are already used by another account.",
    "auth/operation-not-allowed":
      "Phone sign-in is not enabled on this project. Let the administrator know.",
    "auth/quota-exceeded": "The SMS quota for today has been reached. Try again later.",
    "auth/captcha-check-failed": "The anti-robot check failed. Reload the page and try again.",
    "auth/invalid-app-credential": "The anti-robot check is invalid. Reload the page and try again.",
    "auth/missing-app-credential": "The anti-robot check is missing. Reload the page and try again.",
    "auth/unauthorized-domain": "This domain is not allowed to sign in. Let the administrator know.",
    "auth/billing-not-enabled": "SMS sending is not enabled on this project. Let the administrator know.",
    "auth/user-disabled": MESSAGES_COMPTE_SUSPENDU.en,
    "auth/network-request-failed": "Can't connect. Check your network and try again.",
    "auth/requires-recent-login": "Sign in again to do this.",
    "auth/error-code:-39":
      "The SMS could not be sent. Try again in a few minutes; if it keeps happening, let us know.",
    generique: "Something went wrong. Try again.",
  },
};

/**
 * Ajouter un numéro à son compte, quand ce numéro appartient déjà à un autre
 * compte. Firebase répond `auth/credential-already-in-use` (ou, selon la
 * version et l'émulateur, `auth/account-exists-with-different-credential`),
 * dont le message général parle d'« email » : faux ici, et la personne
 * cherchait son adresse alors que c'est le numéro qui est pris.
 */
const NUMERO_DEJA_PRIS: Record<Langue, string> = {
  fr: "Ce numéro est déjà rattaché à un autre compte KoppaFoot. Connecte-toi avec ce numéro, ou choisis-en un autre.",
  en: "This number is already linked to another KoppaFoot account. Sign in with it, or pick another number.",
};

export function getPhoneLinkErrorMessage(error: unknown, langue: Langue = "fr"): string {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "auth/credential-already-in-use" || code === "auth/account-exists-with-different-credential") {
    return NUMERO_DEJA_PRIS[langue];
  }
  return getAuthErrorMessage(error, langue);
}

/**
 * Un envoi de SMS refusé, écrit en entier dans la console du navigateur.
 *
 * Le message affiché reste neutre (voir `auth/error-code:-39`), et
 * getAuthErrorMessage ne journalise que les codes qu'elle ne connaît pas :
 * sans cette ligne, un essai avec un vrai téléphone ne laissait rien à lire.
 * Code, message et `customData` (où Firebase range la réponse du serveur
 * quand il l'a) : de quoi diagnostiquer depuis le téléphone de l'essai, rien
 * qui parte ailleurs que dans sa propre console.
 */
export function signalerEchecSms(error: unknown): void {
  const e = (error ?? {}) as { code?: unknown; message?: unknown; customData?: unknown };
  console.error("[sms] envoi refusé :", e.code ?? "(sans code)", e.message ?? "", e.customData ?? "", error);
}

/**
 * Identity Toolkit failures the SDK does not give a distinct code for: the
 * real reason sits in the raw server body, so we match on that body.
 *
 * Kept as an extension point, "Error code: 39" is handled by its own SDK
 * code above, since in practice `customData.serverResponse` was not
 * populated when it fired.
 */
const SERVER_RESPONSE_ERRORS: { match: string; message: string }[] = [];

function serverResponseMessage(error: unknown): string | null {
  const raw = (error as { customData?: { serverResponse?: unknown } })?.customData
    ?.serverResponse;
  if (!raw) return null;
  const body = typeof raw === "string" ? raw : JSON.stringify(raw);
  return SERVER_RESPONSE_ERRORS.find((e) => body.includes(e.match))?.message ?? null;
}

export function getAuthErrorMessage(error: unknown, langue: Langue = "fr"): string {
  const messages = AUTH_ERRORS[langue];
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: string }).code;
    const known = code !== "generique" ? messages[code] : undefined;
    if (known) return known;

    const fromServer = serverResponseMessage(error);
    if (fromServer) return fromServer;
    // An unmapped code used to vanish behind the generic message, which made
    // every auth failure look identical in support. Log the raw error so the
    // next one is one glance away, Firebase nests the server's reason under
    // `customData.serverResponse`.
    console.error("[auth] unmapped Firebase error:", code, error);
    return messages.generique;
  }
  console.error("[auth] non-Firebase error:", error);
  return messages.generique;
}
