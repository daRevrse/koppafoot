import { avecVia } from "@/lib/audience";

const sansBarreFinale = (url: string) => url.replace(/\/+$/, "");

/** Le site : ses pages s'ouvrent dans le navigateur intégré. */
export const SITE_URL = sansBarreFinale(process.env.EXPO_PUBLIC_SITE_URL ?? "https://www.koppafoot.com");

/** L'API. Le site par défaut ; un `next dev` local si on le demande. */
export const API_URL = sansBarreFinale(process.env.EXPO_PUBLIC_API_URL ?? SITE_URL);

/**
 * Une page du site, ouverte depuis l'appli. Marquée `?via=app` : la mesure
 * d'audience du site compte ainsi ce qui vient de l'appli (lib/audience).
 */
export function urlDuSite(chemin: string): string {
  return avecVia(`${SITE_URL}${chemin}`, "app");
}
