// ============================================
// Ce que les routes de l'administration renvoient, lu par ses écrans.
//
// Types seulement : ce module ne tire aucun SDK, les pages clientes
// l'importent sans embarquer firebase-admin (voir lib/admin-serveur).
// ============================================

import type { ATraiter, ComptesDeLaPlateforme, MatchsDeLaPlateforme } from "@/lib/admin-tableau";
import type { BilanClub } from "@/lib/bilan-club";
import type { StatutValidation } from "@/types";

export interface CompteResume {
  uid: string;
  nom: string;
  photo: string | null;
  ville: string | null;
  role: "player" | "manager" | "referee" | null;
  creeLe: string | null;
}

export interface TableauDeBord {
  aTraiter: ATraiter;
  comptes: ComptesDeLaPlateforme;
  matchs: MatchsDeLaPlateforme;
  equipes: number;
  terrains: number;
  competitions: { total: number; enCours: number };
  derniersComptes: CompteResume[];
  derniersMatchs: MatchAdmin[];
  /** Les villes des comptes, de la plus représentée à la moins. */
  villes: { ville: string; comptes: number }[];
  /** Combien d'équipes gère chaque manager : la cible du statut club. */
  managers: {
    une: number;
    deux: number;
    troisEtPlus: number;
    plusGrands: { uid: string; nom: string; equipes: number }[];
  };
  /** Quand ces chiffres ont été comptés : ils ne se mettent pas à jour seuls. */
  calculeLe: string;
}

export type GenreMatch = "amical" | "competition";

export interface EquipeDuMatch {
  nom: string;
  logo: string | null;
  /** Le club sur la plateforme, quand il y en a un. */
  clubId: string | null;
}

/** Un match, amical ou de compétition, tel que l'administration le liste. */
export interface MatchAdmin {
  /** « a:<id> » pour un amical, « c:<compétition>:<id> » pour une compétition. */
  cle: string;
  id: string;
  genre: GenreMatch;
  lien: string;
  competition: { id: string; nom: string; lien: string } | null;
  etape: string | null;
  domicile: EquipeDuMatch;
  exterieur: EquipeDuMatch;
  date: string | null;
  heure: string | null;
  /** Le statut brut : `upcoming`, `scheduled`, `completed`… */
  statut: string;
  scoreDomicile: number | null;
  scoreExterieur: number | null;
  tabDomicile: number | null;
  tabExterieur: number | null;
  terrain: string | null;
  ville: string | null;
  format: string | null;
  arbitre: string | null;
  /** La validation d'un amical entre deux clubs ; null ailleurs. */
  validation: StatutValidation | null;
  /** Renseigné après coup, et non couvert en direct. */
  renseigne: boolean;
}

export interface EquipeAdmin {
  id: string;
  nom: string;
  ville: string;
  niveau: string;
  logo: string | null;
  couleur: string | null;
  recrute: boolean;
  manager: { uid: string; nom: string } | null;
  /** Les comptes ET les joueurs sans compte, comme sur la fiche publique. */
  effectif: number;
  comptes: number;
  bilan: BilanClub;
  creeLe: string | null;
  // Ce que la correction d'une fiche édite.
  description: string;
  slogan: string;
  maxMembres: number;
}

export interface RetourAdmin {
  id: string;
  message: string;
  auteur: { uid: string; nom: string } | null;
  page: string | null;
  appareil: string | null;
  traite: boolean;
  creeLe: string | null;
}

export interface ContestationAdmin {
  matchId: string;
  match: MatchAdmin;
  /** Ce que chaque camp a dit du match. */
  retours: { camp: "home" | "away"; equipe: string; validation: string; commentaire: string | null; par: string; le: string }[];
  /** Les événements contestés un par un (un but, un carton), avec leur motif. */
  evenements: { id: string; libelle: string; camp: "home" | "away"; motif: string; le: string }[];
  /** Crédité aux joueurs : un match renseigné contesté ne l'est pas encore. */
  statsCreditees: boolean;
  arbitrage: ArbitrageAdmin | null;
}

export interface ArbitrageAdmin {
  decision: "valide" | "annule";
  motif: string;
  par: string;
  le: string;
}

export interface CandidatureDuCompte {
  genre: "organisateur" | "scoreur" | "terrain";
  statut: string;
  le: string | null;
  motifRefus: string | null;
}

export interface FicheCompteAdmin {
  uid: string;
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  ville: string | null;
  bio: string | null;
  /** Homme, femme, ou non déclaré (voir lib/genre). */
  genre: "male" | "female" | null;
  photo: string | null;
  actif: boolean;
  /** Présente quand le compte est suspendu. `par` est nul si l'auteur n'existe plus. */
  suspension: { motif: string | null; le: string | null; par: { uid: string; nom: string } | null } | null;
  /** Selon Firebase Auth. `null` : le compte n'a pas d'identifiant de connexion. */
  connexionBloquee: boolean | null;
  creeLe: string | null;
  fournisseurs: string[];
  role: "player" | "manager" | "referee" | null;
  /** Déclaré à l'inscription, jamais activé : le produit n'ouvre pas son espace. */
  roleHerite: boolean;
  poste: string | null;
  casquettes: { organisateur: boolean; proprietaire: boolean; scoreur: boolean; admin: boolean };
  moderateur: boolean;
  nomOrganisateur: string | null;
  equipesDirigees: { id: string; nom: string }[];
  equipesJouees: { id: string; nom: string }[];
  competitions: { id: string; nom: string; lien: string | null; publique: boolean }[];
  candidatures: CandidatureDuCompte[];
  activite: {
    matchsCrees: number;
    matchsArbitres: number;
    designationsEnAttente: number;
    noteMoyenne: number | null;
    publications: number;
  };
}
