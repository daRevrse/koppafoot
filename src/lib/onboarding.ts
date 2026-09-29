// ============================================
// Onboarding, declarative, per-profile step lists.
//
// Each profile has a sequence a user must walk before the product is
// actually useful to them ("follow a competition", "create your team", …).
// Steps are declared here rather than hardcoded in the pages so every
// profile gets the same guided treatment and the checklist can't drift from
// reality: `done` is derived from live data, never stored.
//
// LES NOUVEAUX INSCRITS SE PERDAIENT. Le guide ne couvrait que trois rôles
// (joueur, manager, arbitre) et n'apparaissait qu'APRÈS avoir choisi l'un
// d'eux : quelqu'un qui venait de créer son compte atterrissait sur le Direct
// sans une ligne pour lui dire quoi faire. Il y a maintenant un guide par
// profil — le spectateur, et chaque casquette (organisateur, propriétaire de
// terrain, scoreur) —, dans les deux langues, et chacun renvoie à son
// tutoriel (voir lib/tutoriels).
//
// Adding a profile = adding one builder function below, and its data in
// hooks/useRoleOnboarding.
// ============================================

import type { Langue } from "@/i18n/config";
import { accorder } from "@/lib/genre";
import { isOrganizer, isScorer, isVenueOwner } from "@/lib/hats";
import type { Competition, CompTeam, EvolutionRole, Team, UserProfile, Venue } from "@/types";

/**
 * Le role choisi sur la page publique, lu dans l'URL.
 *
 * LA DEMANDE DE COMPTE EST REPOUSSEE AU DERNIER MOMENT : on presente les roles
 * a qui n'a pas de compte, et on ne demande de s'inscrire qu'au clic sur
 * « Devenir joueur ». Encore faut-il que le choix survive au trajet — sans
 * quoi l'inscription se termine sur un profil sans role, et il faut recommencer
 * ce qu'on venait de faire.
 *
 * Lu depuis `window.location` et non `useSearchParams` : c'est le parti pris
 * du produit (voir /feed et /mercato), il evite une frontiere Suspense pour un
 * seul parametre.
 */
export function roleDepuisURL(recherche?: string): EvolutionRole | null {
  const brut = new URLSearchParams(
    recherche ?? (typeof window === "undefined" ? "" : window.location.search),
  ).get("role");
  return brut === "player" || brut === "manager" || brut === "referee" ? brut : null;
}

/**
 * Ce qu'on guide : le rôle Evolution, les casquettes, et le spectateur — le
 * compte qui n'a encore rien choisi, c'est-à-dire tout nouvel inscrit.
 */
export type ProfilGuide =
  | "spectator" | "player" | "manager" | "referee"
  | "organizer" | "venue_owner" | "scorer";

export interface OnboardingStep {
  key: string;
  label: string;
  /** Why this step matters, shown under the label while it is the current one. */
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
  profil: ProfilGuide;
  /** « Joueuse », « Organisateur » : l'onglet, quand un compte a plusieurs guides. */
  titre: string;
  /** Le tutoriel du profil, sous /aide/tutoriels (voir lib/tutoriels). */
  tutoriel: string;
  steps: OnboardingStep[];
  doneCount: number;
  total: number;
  /** First unfinished step, what the guide asks for right now. */
  current: OnboardingStep | null;
  complete: boolean;
  /**
   * Une porte, sous la liste, qui n'est pas une étape : le spectateur n'a pas
   * à choisir un rôle pour avoir « fini », mais doit savoir qu'il le peut.
   */
  suggestion?: { texte: string; href: string; cta: string } | null;
}

function progressOf(
  profil: ProfilGuide,
  titre: string,
  tutoriel: string,
  steps: OnboardingStep[],
  suggestion: OnboardingProgress["suggestion"] = null,
): OnboardingProgress {
  const doneCount = steps.filter((s) => s.done).length;
  return {
    profil,
    titre,
    tutoriel,
    steps,
    doneCount,
    total: steps.length,
    current: steps.find((s) => !s.done) ?? null,
    complete: doneCount === steps.length,
    suggestion,
  };
}

/** A profile is "complete enough" once it's recognisable and reachable. */
function profileDone(user: UserProfile): boolean {
  return !!user.profilePictureUrl && !!user.locationCity && !!(user.phone || user.email);
}

/** L'étape « profil », la même pour tous, adressée à qui la lit. */
function etapeProfil(user: UserProfile, langue: Langue, pourQui: string): OnboardingStep {
  return langue === "en"
    ? {
        key: "profile",
        label: "Complete your profile",
        description: `Photo, city and contact: it's what ${pourQui} see.`,
        href: "/profile",
        cta: "Complete my profile",
        done: profileDone(user),
      }
    : {
        key: "profile",
        label: "Compléter ton profil",
        description: `Photo, ville et contact : c'est ce que voient ${pourQui}.`,
        href: "/profile",
        cta: "Compléter mon profil",
        done: profileDone(user),
      };
}

/**
 * Les profils d'un compte, dans l'ordre où on les guide : le rôle d'abord,
 * puis les casquettes. Le spectateur seulement quand il n'y a rien d'autre.
 */
export function profilsDuCompte(user: UserProfile | null | undefined): ProfilGuide[] {
  if (!user) return [];
  const profils: ProfilGuide[] = [];
  if (user.evolutionRole) profils.push(user.evolutionRole);
  if (isOrganizer(user)) profils.push("organizer");
  if (isVenueOwner(user)) profils.push("venue_owner");
  if (isScorer(user)) profils.push("scorer");
  return profils.length > 0 ? profils : ["spectator"];
}

// ============================================
// Spectateur : le compte qui vient d'être créé
// ============================================

export interface SpectatorContext {
  /** L'application est-elle installée sur cet appareil (écran d'accueil) ? */
  installe: boolean;
  /** Les notifications sont-elles autorisées sur cet appareil ? */
  notifications: boolean;
}

/**
 * Ce qu'un nouvel inscrit fait d'abord : suivre ce qui le concerne, et le
 * recevoir. Trois gestes, puis la porte des rôles pour qui joue, dirige ou
 * arbitre — qui n'est pas une étape : on peut n'être que spectateur.
 */
export function spectatorOnboarding(
  user: UserProfile,
  ctx: SpectatorContext,
  langue: Langue = "fr",
): OnboardingProgress {
  const suit = (user.followedCompetitionIds?.length ?? 0) > 0;
  if (langue === "en") {
    return progressOf("spectator", "Fan", "spectateur", [
      {
        key: "follow",
        label: "Follow a competition",
        description: "Tap the bell on a competition: its goals and results come to you.",
        href: "/competitions",
        cta: "Find a competition",
        done: suit,
      },
      {
        key: "install",
        label: "Install the app",
        description: "One tap from your home screen, like any other app. Two minutes, no store.",
        href: "/aide/tutoriels/installation",
        cta: "How to install",
        done: ctx.installe,
      },
      {
        key: "notifications",
        label: "Turn on notifications",
        description: "Kick-offs, goals and final scores of what you follow, as they happen.",
        href: "/parametres",
        cta: "Open settings",
        done: ctx.notifications,
      },
    ], {
      texte: "You play, run a team or referee?",
      href: "/roles#choisir",
      cta: "Choose my role",
    });
  }
  return progressOf("spectator", "Supporter", "spectateur", [
    {
      key: "follow",
      label: "Suivre une compétition",
      description: "Touche la cloche d'une compétition : ses buts et ses résultats viennent à toi.",
      href: "/competitions",
      cta: "Trouver une compétition",
      done: suit,
    },
    {
      key: "install",
      label: "Installer l'application",
      description: "Un geste depuis ton écran d'accueil, comme une autre appli. Deux minutes, sans store.",
      href: "/aide/tutoriels/installation",
      cta: "Comment l'installer",
      done: ctx.installe,
    },
    {
      key: "notifications",
      label: "Activer les notifications",
      description: "Coups d'envoi, buts et scores finaux de ce que tu suis, au moment où ça arrive.",
      href: "/parametres",
      cta: "Ouvrir les paramètres",
      done: ctx.notifications,
    },
  ], {
    texte: "Tu joues, tu diriges une équipe ou tu arbitres ?",
    href: "/roles#choisir",
    cta: "Choisir mon rôle",
  });
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
  langue: Langue = "fr",
): OnboardingProgress {
  const firstTeam = ctx.teams[0];
  const effectif = firstTeam ? `/teams/${firstTeam.id}` : "/teams";
  if (langue === "en") {
    return progressOf("manager", "Manager", "manager", [
      etapeProfil(user, langue, "organisers inviting you"),
      {
        key: "team", label: "Create your team",
        description: "Name, colours, level. Without a team, the rest of your space has nothing to show.",
        href: "/teams", cta: "Create my team", done: ctx.teams.length > 0, blocking: true,
      },
      {
        key: "roster", label: "Build your squad",
        description: "Add your players, including those without a smartphone.",
        href: effectif, cta: "Add players", done: ctx.rosterCount > 0,
      },
      {
        key: "competition", label: "Join a competition",
        description: "Enter your team in a competition to play, follow the table and feed your players' stats.",
        href: "/competitions", cta: "Find a competition", done: ctx.compTeams.length > 0,
      },
    ]);
  }
  return progressOf("manager", "Manager", "manager", [
    etapeProfil(user, langue, "les organisateurs qui t'invitent"),
    {
      key: "team", label: "Créer ton équipe",
      description: "Nom, couleurs, niveau, catégorie. Sans équipe, le reste de ton espace n'a rien à afficher.",
      href: "/teams", cta: "Créer mon équipe", done: ctx.teams.length > 0, blocking: true,
    },
    {
      key: "roster", label: "Constituer ton effectif",
      description: "Ajoute tes joueurs, y compris ceux sans smartphone, en joueurs fictifs.",
      href: effectif, cta: "Ajouter des joueurs", done: ctx.rosterCount > 0,
    },
    {
      key: "competition", label: "Rejoindre une compétition",
      description: "Inscris ton équipe à une compétition pour jouer, suivre le classement et alimenter les stats de tes joueurs.",
      href: "/competitions", cta: "Trouver une compétition", done: ctx.compTeams.length > 0,
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
  langue: Langue = "fr",
): OnboardingProgress {
  const g = user.gender;
  if (langue === "en") {
    return progressOf("player", "Player", "joueur", [
      etapeProfil(user, langue, "managers"),
      {
        key: "sport", label: "Fill in your football profile",
        description: "Position and stronger foot, to appear on the right team sheets.",
        href: "/profile", cta: "Set my position", done: !!user.position && !!user.strongFoot,
      },
      {
        key: "claim", label: "Link yourself to your team",
        description: "On your team's page, tap “That's me” on your line. Once approved, your stats fill in by themselves.",
        href: "/competitions", cta: "Find my team", done: ctx.linkedCount > 0,
      },
    ]);
  }
  return progressOf("player", accorder(g, "Joueur", "Joueuse"), "joueur", [
    etapeProfil(user, langue, "les managers"),
    {
      key: "sport", label: "Renseigner ton profil sportif",
      description: "Poste et pied fort, pour apparaître sur les bonnes feuilles de match.",
      href: "/profile", cta: "Renseigner mon poste", done: !!user.position && !!user.strongFoot,
    },
    {
      key: "claim", label: "Te rattacher à ton équipe",
      description:
        "Sur la page de ton équipe, touche « C'est moi » sur ta ligne. Une fois validé, tes stats se remplissent toutes seules.",
      href: "/competitions", cta: "Trouver mon équipe", done: ctx.linkedCount > 0,
    },
  ]);
}

// ============================================
// Arbitre
// ============================================

export interface RefereeContext {
  /** Matchs où ce compte est inscrit comme arbitre, quel que soit le statut. */
  designationCount: number;
  /** Corps arbitraux dont il fait partie, celui qu'il dirige compris. */
  corpsCount: number;
}

/**
 * L'arbitre n'avait pas de liste à lui, et `useRoleOnboarding` faisait
 * tomber tout ce qui n'est pas joueur dans la branche manager : un arbitre
 * fraîchement activé se voyait donc réclamer « Créer ton équipe », étape
 * bloquante, dans un espace qui ne parle jamais d'équipe.
 *
 * Sa vraie séquence tient en trois gestes : être reconnaissable, être
 * crédible, être sur un match.
 */
export function refereeOnboarding(
  user: UserProfile,
  ctx: RefereeContext,
  langue: Langue = "fr",
): OnboardingProgress {
  if (langue === "en") {
    return progressOf("referee", "Referee", "arbitre", [
      etapeProfil(user, langue, "managers before trusting you with their match"),
      {
        key: "licence", label: "Enter your licence",
        description: "Level and licence number, to appear under Referees in search.",
        href: "/profile", cta: "Enter my licence", done: !!user.licenseLevel,
      },
      {
        key: "corps", label: "Form your refereeing team",
        description: "Invite your assistants and a scorer: while you referee, the scorer runs the live console.",
        href: "/corps-arbitral", cta: "Create my team", done: ctx.corpsCount > 0,
      },
      {
        key: "designation", label: "Take your first match",
        description: "Answer an invitation, or apply for a match still looking for a referee.",
        href: "/designations", cta: "See appointments", done: ctx.designationCount > 0,
      },
    ]);
  }
  return progressOf("referee", "Arbitre", "arbitre", [
    etapeProfil(user, langue, "les managers avant de te confier leur match"),
    {
      key: "licence", label: "Renseigner ta licence",
      description: "Niveau et numéro de licence, pour apparaître dans la recherche à la catégorie Arbitres.",
      href: "/profile", cta: "Renseigner ma licence", done: !!user.licenseLevel,
    },
    {
      key: "corps", label: "Former ton corps arbitral",
      description: "Invite tes assistants et un scoreur : pendant que tu diriges, c'est lui qui tient la console.",
      href: "/corps-arbitral", cta: "Créer mon corps arbitral", done: ctx.corpsCount > 0,
    },
    {
      key: "designation", label: "Prendre ton premier match",
      description: "Réponds à une invitation, ou porte-toi candidat sur un match qui cherche encore un arbitre.",
      href: "/designations", cta: "Voir les désignations", done: ctx.designationCount > 0,
    },
  ]);
}

// ============================================
// Organisateur
// ============================================

export interface OrganizerContext {
  /** Sa compétition la plus récente, celle qu'on accompagne ; null s'il n'en a pas. */
  competition: Competition | null;
  equipes: number;
  /** Matchs programmés (datés). */
  matchsDates: number;
  /** Matchs déjà joués ou en cours : la console a servi. */
  matchsJoues: number;
}

/**
 * De la création au premier match en direct. Le hub de chaque compétition
 * détaille ensuite le reste (poules, phase finale, staff : voir
 * OrganizerProgress) ; ce guide-ci dit seulement par où commencer.
 */
export function organizerOnboarding(
  user: UserProfile,
  ctx: OrganizerContext,
  langue: Langue = "fr",
): OnboardingProgress {
  const c = ctx.competition;
  const base = c ? `/organizer/competitions/${c.id}` : "/organizer/competitions/new";
  const ouverte = !!c && c.status !== "draft";
  if (langue === "en") {
    return progressOf("organizer", "Organiser", "organisateur", [
      {
        key: "create", label: "Create your competition",
        description: "Name, format (groups, cup, league), dates and category.",
        href: "/organizer/competitions/new", cta: "Create a competition", done: !!c, blocking: true,
      },
      {
        key: "teams", label: "Add the teams",
        description: "At least two. Managers can also enter on their own once registration is open.",
        href: `${base}/teams`, cta: "Add teams", done: ctx.equipes >= 2,
      },
      {
        key: "schedule", label: "Schedule the matches",
        description: "Generate the fixtures, or import yours, then set dates and pitches.",
        href: `${base}/schedule`, cta: "Open the fixtures", done: ctx.matchsDates > 0,
      },
      {
        key: "publish", label: "Open it to the public",
        description: "A draft is only visible to you. Open registration or start it to appear on Live.",
        href: base, cta: "Change the status", done: ouverte,
      },
      {
        key: "live", label: "Cover a match live",
        description: "On match day, the console sends goals and cards to followers in real time.",
        href: "/live-ops", cta: "Open the console", done: ctx.matchsJoues > 0,
      },
    ]);
  }
  return progressOf("organizer", accorder(user.gender, "Organisateur", "Organisatrice"), "organisateur", [
    {
      key: "create", label: "Créer ta compétition",
      description: "Nom, format (poules, coupe, championnat), dates et catégorie.",
      href: "/organizer/competitions/new", cta: "Créer une compétition", done: !!c, blocking: true,
    },
    {
      key: "teams", label: "Inscrire les équipes",
      description: "Au moins deux. Les managers peuvent aussi s'inscrire eux-mêmes une fois les inscriptions ouvertes.",
      href: `${base}/teams`, cta: "Ajouter des équipes", done: ctx.equipes >= 2,
    },
    {
      key: "schedule", label: "Programmer les matchs",
      description: "Génère le calendrier, ou importe le tien, puis fixe les dates et les terrains.",
      href: `${base}/schedule`, cta: "Ouvrir le calendrier", done: ctx.matchsDates > 0,
    },
    {
      key: "publish", label: "L'ouvrir au public",
      description: "Un brouillon n'est visible que de toi. Ouvre les inscriptions ou lance-la pour apparaître au Direct.",
      href: base, cta: "Changer le statut", done: ouverte,
    },
    {
      key: "live", label: "Couvrir un match en direct",
      description: "Le jour du match, la console envoie buts et cartons aux abonnés en temps réel.",
      href: "/live-ops", cta: "Ouvrir la console", done: ctx.matchsJoues > 0,
    },
  ]);
}

// ============================================
// Propriétaire de terrain
// ============================================

export interface VenueOwnerContext {
  terrains: Venue[];
  /** Demandes de créneau auxquelles il a déjà répondu (acceptées ou refusées). */
  demandesTraitees: number;
}

export function venueOwnerOnboarding(
  user: UserProfile,
  ctx: VenueOwnerContext,
  langue: Langue = "fr",
): OnboardingProgress {
  const t = ctx.terrains[0];
  const fiche = "/mes-terrains";
  const photo = !!t && (!!t.photoUrl || (t.galleryUrls?.length ?? 0) > 0);
  const horaires = !!t?.openingHours;
  if (langue === "en") {
    return progressOf("venue_owner", "Pitch owner", "terrain", [
      {
        key: "venue", label: "List your pitch",
        description: "Name, address, format and surface: teams find it in the directory.",
        href: "/mes-terrains", cta: "List a pitch", done: !!t, blocking: true,
      },
      {
        key: "photo", label: "Add photos",
        description: "The pitch, the changing rooms, the lights at night: teams want to see what they book.",
        href: fiche, cta: "Add photos", done: photo,
      },
      {
        key: "hours", label: "Set your opening hours",
        description: "Requests outside them are turned away automatically.",
        href: fiche, cta: "Set my hours", done: horaires,
      },
      {
        key: "requests", label: "Answer a booking request",
        description: "Until you answer, the slot stays free for others.",
        href: "/mes-terrains/reservations", cta: "See requests", done: ctx.demandesTraitees > 0,
      },
    ]);
  }
  return progressOf("venue_owner", "Propriétaire", "terrain", [
    {
      key: "venue", label: "Référencer ton terrain",
      description: "Nom, adresse, format et surface : les équipes le trouvent dans l'annuaire.",
      href: "/mes-terrains", cta: "Référencer un terrain", done: !!t, blocking: true,
    },
    {
      key: "photo", label: "Ajouter des photos",
      description: "La pelouse, les vestiaires, l'éclairage de nuit : les équipes veulent voir ce qu'elles réservent.",
      href: fiche, cta: "Ajouter des photos", done: photo,
    },
    {
      key: "hours", label: "Renseigner tes horaires",
      description: "Les demandes hors de tes horaires sont refusées d'elles-mêmes.",
      href: fiche, cta: "Mes horaires", done: horaires,
    },
    {
      key: "requests", label: "Répondre à une demande",
      description: "Tant que tu n'as pas répondu, le créneau reste libre pour les autres.",
      href: "/mes-terrains/reservations", cta: "Voir les demandes", done: ctx.demandesTraitees > 0,
    },
  ]);
}

// ============================================
// Scoreur
// ============================================

export interface ScorerContext {
  /** Corps arbitraux dont il fait partie. */
  corps: number;
  /** Matchs qu'il a le droit de couvrir (compétitions modérées, amicaux confiés). */
  matchs: number;
}

export function scorerOnboarding(
  user: UserProfile,
  ctx: ScorerContext,
  langue: Langue = "fr",
): OnboardingProgress {
  if (langue === "en") {
    return progressOf("scorer", "Scorer", "scoreur", [
      etapeProfil(user, langue, "referees and organisers"),
      {
        key: "corps", label: "Join a refereeing team",
        description: "A referee brings you to their matches: you run the console while they referee.",
        href: "/corps-arbitral", cta: "My refereeing teams", done: ctx.corps > 0,
      },
      {
        key: "match", label: "Cover your first match",
        description: "The console lists the matches you can cover. Kick-off, goals, cards: followers get them live.",
        href: "/live-ops", cta: "Open the console", done: ctx.matchs > 0,
      },
    ]);
  }
  return progressOf("scorer", accorder(user.gender, "Scoreur", "Scoreuse"), "scoreur", [
    etapeProfil(user, langue, "les arbitres et les organisateurs"),
    {
      key: "corps", label: "Rejoindre un corps arbitral",
      description: "Un arbitre t'emmène sur ses matchs : tu tiens la console pendant qu'il dirige.",
      href: "/corps-arbitral", cta: "Mes corps arbitraux", done: ctx.corps > 0,
    },
    {
      key: "match", label: "Couvrir ton premier match",
      description: "La console liste les matchs que tu peux couvrir. Coup d'envoi, buts, cartons : les abonnés les reçoivent en direct.",
      href: "/live-ops", cta: "Ouvrir la console", done: ctx.matchs > 0,
    },
  ]);
}
