import { enGB, fr } from "date-fns/locale";
import type { Locale } from "date-fns";
import type { Langue } from "./config";

// La locale de date-fns, pour `format(…, { locale })`. Même choix que
// `LOCALE` (config.ts) : l'anglais britannique, jour avant mois, 24 h.
// À part de config.ts, que le serveur lit partout : inutile d'y tirer
// date-fns.
export const LOCALE_DATE_FNS: Record<Langue, Locale> = { fr, en: enGB };
