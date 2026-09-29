"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLangue } from "@/i18n";
import {
  getTeamsByManager, getGhostPlayersByTeam, getMatchesByReferee, getMesCorpsArbitraux,
  getMatchesIModerate, getVenuesByOwner, onBookingsByOwner,
} from "@/lib/firestore";
import {
  listCompTeamsByManager, listCompetitionsByOrganizer, listCompTeams, listCompMatches,
  listModeratedCompetitions,
} from "@/lib/competition-firestore";
import {
  managerOnboarding, playerOnboarding, refereeOnboarding, spectatorOnboarding,
  organizerOnboarding, venueOwnerOnboarding, scorerOnboarding, profilsDuCompte,
  type OnboardingProgress, type ProfilGuide,
} from "@/lib/onboarding";
import type { Booking, UserProfile } from "@/types";
import type { Langue } from "@/i18n/config";

// ============================================
// Loads whatever each profile's guide needs, then derives the progress.
// Returns null while loading so callers can skip rendering rather than flash
// an empty checklist.
//
// CHAQUE PROFIL EST NOMMÉ, il n'y a plus de branche « tout le reste ». Elle
// menait au manager, si bien qu'un arbitre ouvrait son espace sur « Créer
// ton équipe » — étape bloquante, donc un guide arrêté net sur une consigne
// qui ne le concernait pas.
//
// UN COMPTE A PLUSIEURS GUIDES : un rôle et des casquettes se cumulent (une
// arbitre peut organiser un tournoi). On les charge tous, en parallèle ; un
// guide qui échoue à se charger tombe sur ses données vides plutôt que de
// faire tomber les autres.
// ============================================

/** L'application ouverte depuis l'écran d'accueil, et non un onglet. */
function appInstallee(): boolean {
  if (typeof window === "undefined") return false;
  const ios = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

function notificationsAutorisees(): boolean {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

/** Les demandes reçues, lues une fois : le guide n'a pas à suivre le direct. */
function demandesRecues(uid: string): Promise<Booking[]> {
  return new Promise((resolve) => {
    let fini = false;
    // `stop` n'existe qu'au retour de `onBookingsByOwner` : un premier appel
    // synchrone (réponse en cache) le trouverait encore vide, d'où le relais.
    let stop: (() => void) | null = null;
    stop = onBookingsByOwner(uid, (demandes) => {
      if (fini) return;
      fini = true;
      resolve(demandes);
      queueMicrotask(() => stop?.());
    });
  });
}

async function construire(user: UserProfile, profil: ProfilGuide, langue: Langue): Promise<OnboardingProgress> {
  switch (profil) {
    case "spectator":
      return spectatorOnboarding(user, { installe: appInstallee(), notifications: notificationsAutorisees() }, langue);

    case "player":
      // Everything the player checklist needs already lives on the profile.
      return playerOnboarding(user, { linkedCount: user.linkedCompPlayers?.length ?? 0 }, langue);

    case "referee": {
      // « A-t-il déjà un match ? », quel qu'en soit le statut : une
      // candidature en attente compte, le geste est fait.
      const [designations, corps] = await Promise.all([
        getMatchesByReferee(user.uid).catch(() => []),
        getMesCorpsArbitraux(user.uid).catch(() => []),
      ]);
      return refereeOnboarding(user, { designationCount: designations.length, corpsCount: corps.length }, langue);
    }

    case "manager": {
      const [teams, compTeams] = await Promise.all([
        getTeamsByManager(user.uid).catch(() => []),
        listCompTeamsByManager(user.uid).catch(() => []),
      ]);
      // Ghost players live in a subcollection, a squad made only of
      // players without smartphones still counts as a squad.
      const ghostCounts = await Promise.all(
        teams.map((t) => getGhostPlayersByTeam(t.id).then((g) => g.length).catch(() => 0)),
      );
      const rosterCount =
        teams.reduce((n, t) => n + t.memberIds.length, 0) + ghostCounts.reduce((n, c) => n + c, 0);
      return managerOnboarding(user, { teams, compTeams, rosterCount }, langue);
    }

    case "organizer": {
      const competitions = await listCompetitionsByOrganizer(user.uid).catch(() => []);
      // La plus récente : c'est celle qu'on est en train de monter.
      const competition = [...competitions].sort((a, b) =>
        String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))[0] ?? null;
      if (!competition) {
        return organizerOnboarding(user, { competition: null, equipes: 0, matchsDates: 0, matchsJoues: 0 }, langue);
      }
      const [equipes, matchs] = await Promise.all([
        listCompTeams(competition.id).catch(() => []),
        listCompMatches(competition.id).catch(() => []),
      ]);
      return organizerOnboarding(user, {
        competition,
        equipes: equipes.length,
        matchsDates: matchs.filter((m) => m.date != null).length,
        matchsJoues: matchs.filter((m) => m.status === "live" || m.status === "completed").length,
      }, langue);
    }

    case "venue_owner": {
      const [terrains, demandes] = await Promise.all([
        getVenuesByOwner(user.uid).catch(() => []),
        demandesRecues(user.uid).catch(() => [] as Booking[]),
      ]);
      return venueOwnerOnboarding(user, {
        terrains,
        demandesTraitees: demandes.filter((d) => d.status !== "pending").length,
      }, langue);
    }

    case "scorer": {
      const [corps, matchs, competitions] = await Promise.all([
        getMesCorpsArbitraux(user.uid).catch(() => []),
        getMatchesIModerate(user.uid).catch(() => []),
        listModeratedCompetitions(user.uid).catch(() => []),
      ]);
      return scorerOnboarding(user, { corps: corps.length, matchs: matchs.length + competitions.length }, langue);
    }
  }
}

/**
 * Les guides des profils demandés (par défaut, tous ceux du compte), dans
 * leur ordre. `null` pendant le chargement, ou sans compte.
 */
export function useGuidesDeDemarrage(profils?: ProfilGuide[]): OnboardingProgress[] | null {
  const { user } = useAuth();
  const { langue } = useLangue();
  const [guides, setGuides] = useState<{ cle: string; liste: OnboardingProgress[] } | null>(null);

  const voulus = (profils ?? profilsDuCompte(user)).filter((p) => profilsDuCompte(user).includes(p));
  const cle = user ? `${user.uid}|${langue}|${voulus.join(",")}` : "";

  useEffect(() => {
    if (!user || !cle) return;
    let annule = false;
    const liste = cle.split("|")[2].split(",").filter(Boolean) as ProfilGuide[];
    Promise.all(liste.map((p) => construire(user, p, langue)))
      .then((resultats) => { if (!annule) setGuides({ cle, liste: resultats }); })
      .catch((err) => console.error("useGuidesDeDemarrage :", err));
    return () => { annule = true; };
  }, [user, cle, langue]);

  // Dérivé, pas stocké : un compte qui change (déconnexion, nouveau rôle) ne
  // garde pas les guides du précédent.
  return user && guides?.cle === cle ? guides.liste : null;
}
