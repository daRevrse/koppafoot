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
  "auth/code-expired": "Le code a expiré. Demandez un nouveau code.",
  "auth/invalid-phone-number": "Numéro de téléphone invalide.",
  "auth/missing-phone-number": "Veuillez entrer un numéro de téléphone.",
  "auth/provider-already-linked": "Ce compte est déjà lié.",
  "auth/credential-already-in-use": "Ces identifiants sont déjà utilisés par un autre compte.",
};

export function getAuthErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: string }).code;
    return AUTH_ERRORS[code] ?? "Une erreur est survenue. Veuillez réessayer.";
  }
  return "Une erreur est survenue. Veuillez réessayer.";
}
