"use client";

import { useEffect, useState } from "react";
import type { PiloteConsole } from "@/lib/console-pilote";
import type { CompMatch, Competition } from "@/types";

// Une pièce de la console live (LiveMatchConsole).

/** Le match et sa compétition, tels que la base les envoie, et le premier chargement. */
export function useAbonnements(pilote: PiloteConsole) {
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [matchBrut, setMatch] = useState<CompMatch | null>(null);
  const [loading, setLoading] = useState(true);

  // Subscribe to match changes
  useEffect(() => {
    const unsub = pilote.onMatch((m) => {
      setMatch(m);
      setLoading(false);
    });
    return () => unsub();
  }, [pilote]);

  // Subscribe to the competition (for role-based exit/lock logic).
  useEffect(() => {
    const unsub = pilote.onCompetition(setCompetition);
    return () => unsub();
  }, [pilote]);

  return { competition, matchBrut, loading };
}
