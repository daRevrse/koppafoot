import { useEffect, useState } from "react";
import { API_URL } from "~/lib/config";
import { ficheDuClubDepuisLaRoute, type FicheClub } from "~/lib/fiche-du-club";

/**
 * La fiche d'un club, par la route publique du site. `undefined` pendant la
 * lecture, `null` quand le club n'existe pas (ou plus) ; `id` nul : rien à lire.
 */
export function useFicheDuClub(id: string | null): FicheClub | null | undefined {
  const [lue, setLue] = useState<{ id: string; fiche: FicheClub | null } | null>(null);
  useEffect(() => {
    if (!id) return;
    let vivant = true;
    fetch(`${API_URL}/api/public/team/${encodeURIComponent(id)}`)
      .then((r) => r.json().catch(() => null))
      .then((data) => {
        if (vivant) setLue({ id, fiche: ficheDuClubDepuisLaRoute(data) });
      })
      .catch(() => {
        if (vivant) setLue({ id, fiche: null });
      });
    return () => {
      vivant = false;
    };
  }, [id]);
  if (!id) return null;
  return lue?.id === id ? lue.fiche : undefined;
}
