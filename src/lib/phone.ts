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
