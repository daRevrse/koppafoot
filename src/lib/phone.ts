// ============================================
// Phone number helpers, shared by the login phone tab and the profile's
// "Méthodes de connexion" card. Firebase wants E.164; users type their
// number the way they say it, so the country code comes from a picker and
// the national part is normalised here.
// ============================================

export const COUNTRY_CODES = [
  { code: "+228", label: "🇹🇬 Togo" },
  { code: "+229", label: "🇧🇯 Bénin" },
  { code: "+233", label: "🇬🇭 Ghana" },
  { code: "+225", label: "🇨🇮 Côte d'Ivoire" },
  { code: "+226", label: "🇧🇫 Burkina Faso" },
  { code: "+227", label: "🇳🇪 Niger" },
  { code: "+234", label: "🇳🇬 Nigeria" },
  { code: "+221", label: "🇸🇳 Sénégal" },
  { code: "+237", label: "🇨🇲 Cameroun" },
  { code: "+33", label: "🇫🇷 France" },
  { code: "+32", label: "🇧🇪 Belgique" },
  { code: "+1", label: "🇨🇦 Canada / USA" },
] as const;

export const DEFAULT_DIAL_CODE = COUNTRY_CODES[0].code;

/**
 * L'ENVOI DE SMS EST-IL OUVERT ? La connexion par SMS et l'ajout d'un numéro
 * au compte sont restés masqués tant que Firebase refusait les vrais numéros
 * (voir `auth/error-code:-39` dans lib/auth-errors, résolu le 2026-10-06 :
 * un vrai numéro togolais reçoit son SMS en production). Tout le circuit
 * reste compilé et testé sur l'émulateur.
 *
 * OUVERT PAR DÉFAUT depuis. L'interrupteur reste, comme frein d'urgence :
 * `NEXT_PUBLIC_CONNEXION_SMS=0` sur Vercel referme la connexion par SMS et
 * l'ajout d'un numéro si les envois cassent à nouveau, ou si la facture de
 * SMS s'emballe, sans toucher au code (un redéploiement suffit, la valeur est
 * figée à la construction). `/login?essai-sms=1` rouvre alors l'onglet pour
 * un essai.
 */
export const CONNEXION_SMS_OUVERTE = process.env.NEXT_PUBLIC_CONNEXION_SMS !== "0";

// Firebase throttles per number; a 60s floor keeps users from burning the
// project's daily SMS quota on the resend button.
export const RESEND_COOLDOWN_S = 60;

/** Strips separators and the trunk prefix ("0") users keep typing. */
export function normalizeNational(input: string): string {
  return input.replace(/[\s.()-]/g, "").replace(/^0+/, "");
}

/** Joins a dial code with a national number into an E.164 string. */
export function toE164(dialCode: string, national: string): string {
  return `${dialCode}${normalizeNational(national)}`;
}
