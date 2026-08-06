// ============================================
// Onboarding — declarative, per-role step lists.
//
// Each role's space has a sequence a user must walk before the space is
// actually usable ("complete your profile", "create your team", …). Steps
// are declared here rather than hardcoded in the pages so every role gets
// the same guided treatment and the checklist can't drift from reality:
// `done` is derived from live data, never stored.
//
// Adding a role = adding one builder function below.
// ============================================

import type { CompTeam, Team, UserProfile } from "@/types";

export interface OnboardingStep {
  key: string;
  label: string;
  /** Why this step matters — shown under the label while it is the current one. */
  description: string;
  href: string;
  cta: string;
  done: boolean;
  /**
   * Nothing after a blocking step can be done until it is: the space has
   * nothing to show. Used to stop the guide rather than let the user wander
   * into empty screens.
   */
  blocking?: boolean;
}

export interface OnboardingProgress {
  steps: OnboardingStep[];
  doneCount: number;
  total: number;
  /** First unfinished step — what the guide asks for right now. */
  current: OnboardingStep | null;
  complete: boolean;
}

function progressOf(steps: OnboardingStep[]): OnboardingProgress {
  const doneCount = steps.filter((s) => s.done).length;
  return {
    steps,
    doneCount,
    total: steps.length,
    current: steps.find((s) => !s.done) ?? null,
    complete: doneCount === steps.length,
  };
}

/** A profile is "complete enough" once it's recognisable and reachable. */
function profileDone(user: UserProfile): boolean {
  return !!user.profilePictureUrl && !!user.locationCity && !!(user.phone || user.email);
}

// ============================================
// Manager
// ============================================

export interface ManagerContext {
  /** Clubs owned by this manager (the `teams` collection). */
  teams: Team[];
  /** Competition teams claimed by this manager (`comp_teams`). */
  compTeams: CompTeam[];
  /** Players + ghost players across the manager's clubs. */
  rosterCount: number;
}

export function managerOnboarding(
  user: UserProfile,
  ctx: ManagerContext,
): OnboardingProgress {
  const firstTeam = ctx.teams[0];
  return progressOf([
    {
      key: "profile",
      label: "Compléter ton profil",
      description: "Photo, ville et contact — c'est ce que voient les organisateurs qui t'invitent.",
      href: "/profile",
      cta: "Compléter mon profil",
      done: profileDone(user),
    },
    {
      key: "team",
      label: "Créer ton équipe",
      description: "Nom, couleurs, niveau. Sans équipe, le reste de ton espace n'a rien à afficher.",
      href: "/teams",
      cta: "Créer mon équipe",
      done: ctx.teams.length > 0,
      blocking: true,
    },
    {
      key: "roster",
      label: "Constituer ton effectif",
      description:
        "Ajoute tes joueurs — y compris ceux sans smartphone, en joueurs fictifs.",
      href: firstTeam ? `/teams/${firstTeam.id}` : "/teams",
      cta: "Ajouter des joueurs",
      done: ctx.rosterCount > 0,
    },
    {
      key: "competition",
      label: "Rejoindre une compétition",
      description:
        "Rattache ton équipe à une compétition pour jouer, suivre le classement et alimenter les stats de tes joueurs.",
      href: "/mon-equipe",
      cta: "Voir mes compétitions",
      done: ctx.compTeams.length > 0,
    },
  ]);
}

// ============================================
// Player
// ============================================

export interface PlayerContext {
  /** Roster lines validated as being this user. */
  linkedCount: number;
}

export function playerOnboarding(
  user: UserProfile,
  ctx: PlayerContext,
): OnboardingProgress {
  return progressOf([
    {
      key: "profile",
      label: "Compléter ton profil",
      description: "Photo, ville et contact — c'est ta carte de visite auprès des managers.",
      href: "/profile",
      cta: "Compléter mon profil",
      done: profileDone(user),
    },
    {
      key: "sport",
      label: "Renseigner ton profil sportif",
      description: "Poste et pied fort, pour apparaître sur les bonnes feuilles de match.",
      href: "/profile",
      cta: "Renseigner mon poste",
      done: !!user.position && !!user.strongFoot,
    },
    {
      key: "claim",
      label: "Te rattacher à ton équipe",
      description:
        "Sur la page de ton équipe, clique « C'est moi » sur ta ligne. Une fois validé, tes stats se remplissent toutes seules.",
      href: "/competitions",
      cta: "Trouver mon équipe",
      done: ctx.linkedCount > 0,
    },
  ]);
}
