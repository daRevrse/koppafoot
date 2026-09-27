import { useCallback, useSyncExternalStore } from "react";

/**
 * Une requête média, suivie : vrai quand l'écran y répond.
 *
 * Faux au rendu serveur, et à la première peinture : on ne suppose pas un
 * grand écran qu'on n'a pas encore mesuré.
 */
export function useMedia(requete: string): boolean {
  const abonner = useCallback((cb: () => void) => {
    const mq = window.matchMedia(requete);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  }, [requete]);
  return useSyncExternalStore(
    abonner,
    () => window.matchMedia(requete).matches,
    () => false,
  );
}
