// Firebase Auth error codes → user-friendly French messages
const AUTH_ERRORS: Record<string, string> = {
  "auth/email-already-in-use": "Cet email est déjà utilisé.",
  "auth/invalid-credential": "Email ou mot de passe incorrect.",
  "auth/user-not-found": "Email ou mot de passe incorrect.",
  "auth/wrong-password": "Email ou mot de passe incorrect.",
  "auth/invalid-email": "Adresse email invalide.",
  "auth/weak-password": "Le mot de passe doit contenir au moins 6 caractères.",
  "auth/too-many-requests": "Trop de tentatives. Réessayez dans quelques minutes.",
  "auth/popup-closed-by-user": "Connexion annulée.",
  "auth/account-exists-with-different-credential":
    "Un compte existe déjà avec cet email. Connectez-vous avec votre méthode habituelle.",
  "auth/invalid-verification-code": "Code de vérification invalide.",
  "auth/missing-verification-code": "Veuillez entrer le code reçu par SMS.",
  "auth/code-expired": "Le code a expiré. Demandez un nouveau code.",
  "auth/invalid-phone-number": "Numéro de téléphone invalide.",
  "auth/missing-phone-number": "Veuillez entrer un numéro de téléphone.",
  "auth/provider-already-linked": "Ce compte est déjà lié.",
  "auth/credential-already-in-use": "Ces identifiants sont déjà utilisés par un autre compte.",
  // SMS / reCAPTCHA specifics, without these every failure of the phone
  // flow surfaced as the generic message, which makes it undebuggable.
  "auth/operation-not-allowed":
    "La connexion par téléphone n'est pas activée sur ce projet. Contactez l'administrateur.",
  "auth/quota-exceeded": "Quota de SMS atteint pour aujourd'hui. Réessayez plus tard.",
  "auth/captcha-check-failed": "Vérification anti-robot échouée. Rechargez la page et réessayez.",
  "auth/invalid-app-credential": "Vérification anti-robot invalide. Rechargez la page et réessayez.",
  "auth/missing-app-credential": "Vérification anti-robot manquante. Rechargez la page et réessayez.",
  "auth/unauthorized-domain": "Ce domaine n'est pas autorisé pour la connexion. Contactez l'administrateur.",
  "auth/billing-not-enabled": "L'envoi de SMS n'est pas activé sur ce projet. Contactez l'administrateur.",
  "auth/user-disabled": "Ce compte a été désactivé.",
  "auth/network-request-failed": "Connexion impossible. Vérifiez votre réseau et réessayez.",
  "auth/requires-recent-login": "Reconnectez-vous pour effectuer cette action.",
  // Backend refusal from the SMS layer (503). The SDK passes the numeric
  // code straight through, hence the odd shape.
  //
  // STILL BLOCKING PRODUCTION as of 2026-08-07: every real number is refused
  // while test numbers go through. Ruled out by test, per-number throttle
  // (reproduced on a fresh number, first attempt), browser extensions and
  // third-party cookies (reproduced in a clean private window), SMS region
  // policy (TG allowed), billing (Blaze active), authorized domain.
  //
  // Lead, NOT yet applied here: a sister project hit the same symptom and
  // traced it to Google's project-level SMS anti-fraud defense, whose
  // default enforcement is too strict. Fixed there by PATCHing the Identity
  // Toolkit project config to `recaptchaConfig.phoneEnforcementState = AUDIT`
  // with `tollFraudManagedRules: [{action: BLOCK, startScore: 0.8}]`.
  //
  // The message stays neutral, the user can do nothing about it either way,
  // and we do not yet know the cause for THIS project.
  "auth/error-code:-39":
    "L'envoi du SMS a échoué. Réessayez dans quelques minutes, si le problème persiste, prévenez-nous.",
};

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

export function getAuthErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: string }).code;
    const known = AUTH_ERRORS[code];
    if (known) return known;

    const fromServer = serverResponseMessage(error);
    if (fromServer) return fromServer;
    // An unmapped code used to vanish behind the generic message, which made
    // every auth failure look identical in support. Log the raw error so the
    // next one is one glance away, Firebase nests the server's reason under
    // `customData.serverResponse`.
    console.error("[auth] unmapped Firebase error:", code, error);
    return "Une erreur est survenue. Veuillez réessayer.";
  }
  console.error("[auth] non-Firebase error:", error);
  return "Une erreur est survenue. Veuillez réessayer.";
}
