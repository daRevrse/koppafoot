import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "~/lib/auth";
import { API_URL } from "~/lib/config";
import { db } from "~/lib/firebase";
import { vueDuCompte, vueVisiteur, type OffreDuCompte, type VueOffre } from "~/lib/offre-app";

/**
 * Ce que la page Offre montre. Les tarifs se lisent sans compte
 * (`settings/offre`, en lecture publique) ; connecté, l'état de l'offre du
 * compte vient de GET /api/offre, comme sur le site. Si cette route ne
 * répond pas, la page reste celle du visiteur : les offres et leurs tarifs.
 */
export function useOffre(): VueOffre | null {
  const { utilisateur } = useAuth();
  const uid = utilisateur?.uid ?? null;
  // `undefined` tant que ce n'est pas lu.
  const [prix, setPrix] = useState<unknown>(undefined);
  const [lu, setLu] = useState<{ uid: string; offre: OffreDuCompte | null } | null>(null);

  useEffect(() => {
    let vivant = true;
    getDoc(doc(db, "settings", "offre"))
      .then((s) => {
        if (vivant) setPrix(s.data()?.prix ?? null);
      })
      .catch(() => {
        if (vivant) setPrix(null);
      });
    return () => {
      vivant = false;
    };
  }, []);

  useEffect(() => {
    if (!utilisateur) return;
    let vivant = true;
    const pour = utilisateur.uid;
    utilisateur
      .getIdToken()
      .then((jeton) => fetch(`${API_URL}/api/offre`, { headers: { Authorization: `Bearer ${jeton}` } }))
      .then((r) => (r.ok ? (r.json() as Promise<OffreDuCompte>) : null))
      .catch(() => null)
      .then((offre) => {
        if (vivant) setLu({ uid: pour, offre });
      });
    return () => {
      vivant = false;
    };
  }, [utilisateur]);

  return useMemo(() => {
    if (prix === undefined) return null;
    if (!uid) return vueVisiteur(prix);
    if (lu?.uid !== uid) return null;
    return lu.offre ? vueDuCompte(lu.offre, prix) : vueVisiteur(prix);
  }, [prix, uid, lu]);
}
