"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormeJoueur } from "@/lib/etat-de-forme";

// ============================================
// La forme calculée de plusieurs joueurs, en une requête.
//
// Les clés sont celles de lib/etat-de-forme (`cleFormeCompte`,
// `cleFormeLigne`) : un effectif mêle des comptes et des joueurs sans compte,
// et les deux se demandent ensemble. La route relit un seul document côté
// serveur (voir lib/formes-admin), le coût ne dépend donc pas de la taille de
// l'effectif.
//
// UNE CLÉ ABSENTE DU RÉSULTAT N'EST PAS UNE ERREUR : c'est un joueur sans
// match récent. L'affichage se tait pour lui.
// ============================================

/** Le plafond de la route, par appel. Au-delà, on découpe. */
const PAR_APPEL = 60;

export function useFormes(cles: (string | null | undefined)[]): {
  formes: Record<string, FormeJoueur>;
  /** Vrai une fois la réponse arrivée pour ces clés-là. */
  charge: boolean;
} {
  // Une chaîne stable : le tableau est recréé à chaque rendu de l'appelant,
  // son contenu, lui, change rarement.
  const signature = useMemo(
    () => [...new Set(cles.filter((c): c is string => !!c))].sort().join(","),
    [cles],
  );
  const [resultat, setResultat] = useState<{ pour: string; formes: Record<string, FormeJoueur> }>({
    pour: "",
    formes: {},
  });

  useEffect(() => {
    if (!signature) return;
    let annule = false;
    const toutes = signature.split(",");
    const lots: string[][] = [];
    for (let i = 0; i < toutes.length; i += PAR_APPEL) lots.push(toutes.slice(i, i + PAR_APPEL));

    Promise.all(
      lots.map(async (lot) => {
        const res = await fetch(`/api/public/formes?cles=${encodeURIComponent(lot.join(","))}`);
        if (!res.ok) return {};
        const json = (await res.json()) as { formes?: Record<string, FormeJoueur> };
        return json.formes ?? {};
      }),
    )
      .then((parts) => {
        if (!annule) setResultat({ pour: signature, formes: Object.assign({}, ...parts) });
      })
      .catch(() => {
        // Une forme qui ne se charge pas ne doit rien casser : les pastilles
        // restent simplement absentes.
        if (!annule) setResultat({ pour: signature, formes: {} });
      });

    return () => { annule = true; };
  }, [signature]);

  return {
    formes: resultat.pour === signature ? resultat.formes : {},
    charge: !signature || resultat.pour === signature,
  };
}
