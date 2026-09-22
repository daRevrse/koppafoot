"use client";

import { useEffect, useRef, useState } from "react";
import { getTeamsByIds } from "@/lib/firestore";

// ============================================
// L'ÉCUSSON VIVANT D'UNE ÉQUIPE, QUAND LE MATCH N'EN A PAS GARDÉ COPIE.
//
// Un match transporte le blason des deux camps dans ses propres champs
// (`FirestoreMatch.home_team_logo`), recopié au moment où on le crée. C'est
// une copie, donc elle se périme : un club qui met son écusson en ligne APRÈS
// que son match a été programmé ne le voit apparaître nulle part, et la fiche
// affiche une initiale grise pour une équipe qui a pourtant un logo. C'est
// exactement ce que réparaient `scripts/backfill-*-logos.ts`, à la main et
// après coup.
//
// Ici on ne répare plus, on ne se trompe plus : la copie sert de réponse
// immédiate, et quand elle manque — et SEULEMENT quand elle manque — on va
// lire la fiche de l'équipe. Une lecture, pour les rares camps concernés, et
// aucune pour un match dont les deux blasons ont bien voyagé.
//
// Le fan-out inverse — recopier sur tous ses matchs l'écusson d'un club qui
// change le sien — a été écarté : il fait écrire N documents à chaque envoi
// d'image, pour éviter une lecture qui n'arrive presque jamais.
// ============================================

export interface CampAResoudre {
  teamId?: string | null;
  logo?: string | null;
}

/**
 * Rend une fonction `(teamId, logo) => logo frais ou null`.
 *
 * La copie l'emporte quand elle existe : c'est elle qui est juste au moment du
 * match, et elle évite un aller-retour.
 */
export function useEcussons(
  camps: CampAResoudre[],
): (teamId?: string | null, logo?: string | null) => string | null {
  const [trouves, setTrouves] = useState<Map<string, string | null>>(new Map());
  // Ce qu'on a déjà demandé, succès ou non : sans ce garde-fou, une équipe
  // sans fiche serait redemandée à chaque rendu.
  const demandes = useRef<Set<string>>(new Set());

  // UNE CHAÎNE, ET NON LE TABLEAU. `camps` est reconstruit à chaque rendu :
  // en dépendance d'effet, son identité seule relancerait la lecture en
  // boucle. La chaîne, elle, ne change que si les identifiants changent.
  const cle = [
    ...new Set(
      camps
        .filter((c) => c.teamId && !c.logo)
        .map((c) => c.teamId as string),
    ),
  ]
    .sort()
    .join(",");

  useEffect(() => {
    const ids = (cle ? cle.split(",") : []).filter((id) => !demandes.current.has(id));
    if (ids.length === 0) return;
    ids.forEach((id) => demandes.current.add(id));

    let annule = false;
    getTeamsByIds(ids)
      .then((equipes) => {
        if (annule) return;
        setTrouves((prec) => {
          const suivant = new Map(prec);
          // `null` d'abord pour TOUS les demandés : une équipe absente de la
          // réponse (hors plateforme, fiche supprimée) a une réponse, et
          // c'est « pas d'écusson ».
          for (const id of ids) suivant.set(id, null);
          for (const e of equipes) suivant.set(e.id, e.logoUrl ?? null);
          return suivant;
        });
      })
      .catch(() => {
        // ON NE RETENTE PAS, et c'est délibéré.
        //
        // La cause la plus fréquente n'est pas une panne : `teams` est fermé
        // aux visiteurs sans compte (voir firestore.rules), et la lecture est
        // donc refusée à chaque fois pour eux. Rouvrir la porte ferait
        // repartir la requête à chaque rendu — et le Direct se redessine tout
        // seul toutes les 30 secondes —, pour un refus garanti et une ligne
        // rouge de plus dans la console du navigateur.
        //
        // Pas de réponse veut dire pas d'écusson, ce qui est exactement le
        // repli d'avant : l'initiale.
        if (annule) return;
        setTrouves((prec) => {
          const suivant = new Map(prec);
          for (const id of ids) suivant.set(id, null);
          return suivant;
        });
      });

    return () => {
      annule = true;
    };
  }, [cle]);

  return (teamId, logo) => logo ?? (teamId ? (trouves.get(teamId) ?? null) : null);
}
