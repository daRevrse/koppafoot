"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getTeamsByManager, getGhostPlayersByTeam } from "@/lib/firestore";
import { listCompTeamsByManager } from "@/lib/competition-firestore";
import { managerOnboarding, playerOnboarding, type OnboardingProgress } from "@/lib/onboarding";

// ============================================
// Loads whatever the activated role's onboarding needs, then derives the
// progress. Returns null while loading (or when no role is activated) so
// callers can skip rendering rather than flash an empty checklist.
// ============================================

export function useRoleOnboarding(): OnboardingProgress | null {
  const { user } = useAuth();
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const role = user?.evolutionRole ?? null;

  useEffect(() => {
    if (!user || !role) return;
    let cancelled = false;

    (async () => {
      if (role === "player") {
        // Everything the player checklist needs already lives on the profile.
        if (!cancelled) {
          setProgress(
            playerOnboarding(user, { linkedCount: user.linkedCompPlayers?.length ?? 0 }),
          );
        }
        return;
      }

      try {
        const [teams, compTeams] = await Promise.all([
          getTeamsByManager(user.uid),
          listCompTeamsByManager(user.uid),
        ]);
        // Ghost players live in a subcollection, a squad made only of
        // players without smartphones still counts as a squad.
        const ghostCounts = await Promise.all(
          teams.map((t) => getGhostPlayersByTeam(t.id).then((g) => g.length).catch(() => 0)),
        );
        const rosterCount =
          teams.reduce((n, t) => n + t.memberIds.length, 0) +
          ghostCounts.reduce((n, c) => n + c, 0);

        if (!cancelled) {
          setProgress(managerOnboarding(user, { teams, compTeams, rosterCount }));
        }
      } catch (err) {
        console.error("useRoleOnboarding: failed to load manager context", err);
        if (!cancelled) {
          setProgress(managerOnboarding(user, { teams: [], compTeams: [], rosterCount: 0 }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, role]);

  // Derived, not stored: a user who logs out or drops their role must not
  // keep a stale checklist from the previous one.
  return role ? progress : null;
}
