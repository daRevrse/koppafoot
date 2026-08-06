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
  // SMS / reCAPTCHA specifics — without these every failure of the phone
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
};

export function getAuthErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: string }).code;
    const known = AUTH_ERRORS[code];
    if (known) return known;
    // An unmapped code used to vanish behind the generic message, which made
    // every auth failure look identical in support. Log the raw error so the
    // next one is one glance away — Firebase nests the server's reason under
    // `customData.serverResponse`.
    console.error("[auth] unmapped Firebase error:", code, error);
    return "Une erreur est survenue. Veuillez réessayer.";
  }
  console.error("[auth] non-Firebase error:", error);
  return "Une erreur est survenue. Veuillez réessayer.";
}
