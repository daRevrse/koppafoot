import { useEffect, useState } from "react";
import { cleFormeCompte, type FormeJoueur } from "@/lib/etat-de-forme";
import { API_URL } from "~/lib/config";
import { ficheDepuisLaRoute, type FicheJoueur } from "~/lib/fiche-joueur";

export interface EtatFicheJoueur {
  /** `undefined` pendant la lecture, `null` quand le compte n'existe pas (ou plus). */
  fiche: FicheJoueur | null | undefined;
  /** La forme calculée par le site ; `null` tant qu'elle n'est pas lue, ou sans match noté. */
  forme: FormeJoueur | null;
}

/**
 * La fiche d'un joueur, comme sa page sur le site : la route publique du
 * profil, puis sa forme (`/api/public/formes`, la même que la carte de bilan).
 */
export function useFicheJoueur(uid: string): EtatFicheJoueur {
  const [lue, setLue] = useState<{ uid: string; fiche: FicheJoueur | null } | null>(null);
  const [forme, setForme] = useState<{ uid: string; forme: FormeJoueur | null } | null>(null);

  useEffect(() => {
    let vivant = true;
    fetch(`${API_URL}/api/public/profile/${encodeURIComponent(uid)}`)
      .then((r) => r.json().catch(() => null))
      .then((data) => {
        if (vivant) setLue({ uid, fiche: ficheDepuisLaRoute(uid, data) });
      })
      .catch(() => {
        if (vivant) setLue({ uid, fiche: null });
      });
    const cle = cleFormeCompte(uid);
    fetch(`${API_URL}/api/public/formes?cles=${encodeURIComponent(cle)}`)
      .then((r) => (r.ok ? r.json() : { formes: {} }))
      .then((d: { formes?: Record<string, FormeJoueur> }) => {
        if (vivant) setForme({ uid, forme: d.formes?.[cle] ?? null });
      })
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, [uid]);

  return {
    fiche: lue?.uid === uid ? lue.fiche : undefined,
    forme: forme?.uid === uid ? forme.forme : null,
  };
}
