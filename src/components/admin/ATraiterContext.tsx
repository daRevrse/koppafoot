"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { A_TRAITER_VIDE, type ATraiter } from "@/lib/admin-tableau";

// ============================================
// Ce qui attend l'administration, partagé par le menu et les pages.
//
// Trois candidatures, un signalement et deux retours attendaient, et rien ne
// le disait : le tableau de bord montrait des répartitions, le menu des
// intitulés. Le compte est relu à chaque changement de page, et une page qui
// vient de trancher le fait relire aussitôt — le badge qui reste à « 1 » après
// avoir accepté la candidature est exactement le genre de détail qui fait
// douter de tout le reste.
// ============================================

const Ctx = createContext<{ aTraiter: ATraiter; charge: boolean; rafraichir: () => void }>({
  aTraiter: A_TRAITER_VIDE,
  charge: false,
  rafraichir: () => {},
});

export function ATraiterProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser } = useAuth();
  const pathname = usePathname();
  const [aTraiter, setATraiter] = useState<ATraiter>(A_TRAITER_VIDE);
  const [charge, setCharge] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!firebaseUser) return;
    let annule = false;
    firebaseUser.getIdToken()
      .then((jeton) => fetch("/api/admin/a-traiter", { headers: { Authorization: `Bearer ${jeton}` } }))
      .then((r) => (r.ok ? r.json() : null))
      .then((a: ATraiter | null) => {
        if (a && !annule) { setATraiter(a); setCharge(true); }
      })
      .catch(() => {});
    return () => { annule = true; };
  }, [firebaseUser, pathname, version]);

  const rafraichir = useCallback(() => setVersion((v) => v + 1), []);
  return <Ctx.Provider value={{ aTraiter, charge, rafraichir }}>{children}</Ctx.Provider>;
}

export const useATraiter = () => useContext(Ctx);
