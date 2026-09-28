"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

// ============================================
// Lire une route de l'administration, avec le jeton du compte connecté.
//
// Chaque écran recopiait la même dizaine de lignes — jeton, en-tête, erreur,
// chargement — et chacun à sa façon : l'un avalait l'erreur, l'autre la
// signalait deux fois. Un seul chemin, et l'erreur s'affiche à l'écran au lieu
// d'une liste vide qui laisserait croire qu'il n'y a rien.
// ============================================

export function useAdminApi<T>(url: string | null) {
  const { firebaseUser } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!firebaseUser || !url) return;
    let annule = false;
    (async () => {
      try {
        const jeton = await firebaseUser.getIdToken();
        const res = await fetch(url, { headers: { Authorization: `Bearer ${jeton}` } });
        const corps = await res.json().catch(() => ({}));
        if (annule) return;
        if (!res.ok) {
          setErreur(corps.error ?? "Lecture impossible");
        } else {
          setData(corps as T);
          setErreur(null);
        }
      } catch {
        if (!annule) setErreur("Erreur réseau");
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => { annule = true; };
  }, [firebaseUser, url, version]);

  /** Relire sans vider l'écran : la liste reste en place jusqu'à la réponse. */
  const recharger = useCallback(() => setVersion((v) => v + 1), []);

  return { data, erreur, chargement: chargement && data === null, recharger, setData };
}

/** Écrire sur une route de l'administration. Lève l'erreur du serveur, lisible. */
export function useAdminAction() {
  const { firebaseUser } = useAuth();
  return useCallback(
    async <R = Record<string, unknown>>(url: string, methode: "POST" | "PATCH" | "DELETE", corps: unknown): Promise<R> => {
      if (!firebaseUser) throw new Error("Session expirée, reconnecte-toi");
      const jeton = await firebaseUser.getIdToken();
      const res = await fetch(url, {
        method: methode,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
        body: JSON.stringify(corps),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "L'opération a échoué");
      return data as R;
    },
    [firebaseUser],
  );
}
