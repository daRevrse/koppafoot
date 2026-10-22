import { versHex } from "@/lib/couleurs-equipe";
import type { CompetitionDuClub, JoueurDuClub, MatchDuClub, MembreDuStaff, Meneur } from "@/lib/fiche-club";
import type { Resultat } from "@/lib/forme";

// La fiche d'un club (app/(app)/teams/[id] du site, sa partie publique), lue
// de la route /api/public/team/[id] : une liste blanche des champs du club
// et sa fiche calculée par le serveur (lib/fiche-club-serveur) — bilan,
// forme, effectif, manager, staff, matchs, compétitions, meneurs.

export type FicheClub =
  | {
    genre: "fiche";
    id: string;
    nom: string;
    ville: string | null;
    slogan: string | null;
    description: string | null;
    logo: string | null;
    banniere: string | null;
    /** La couleur du club, pour l'initiale quand il n'a pas de logo. */
    couleur: string | null;
    niveau: string | null;
    recrute: boolean;
    abonnes: number;
    membres: number;
    bilan: { joues: number; gagnes: number; nuls: number; perdus: number; butsPour: number; butsContre: number; sansEncaisser: number };
    /** Les cinq derniers résultats, du plus ancien au plus récent (la route les donne à l'envers). */
    forme: Resultat[];
    effectif: JoueurDuClub[];
    manager: { uid: string; nom: string; photo: string | null } | null;
    staff: MembreDuStaff[];
    matchs: MatchDuClub[];
    competitions: CompetitionDuClub[];
    meneurs: { buteurs: Meneur[]; passeurs: Meneur[] };
  }
  /** Un club « fantôme », né d'une feuille de match : un nom, pas de fiche. */
  | { genre: "fantome"; id: string; nom: string; logo: string | null };

const NIVEAU: Record<string, string> = { beginner: "Débutant", amateur: "Amateur", intermediate: "Intermédiaire", advanced: "Confirmé" };

const texte = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const nombre = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const lien = (v: unknown): string | null => (typeof v === "string" && v.startsWith("http") ? v : null);
const liste = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export function ficheDuClubDepuisLaRoute(data: unknown): FicheClub | null {
  const t = ((data ?? {}) as { team?: Record<string, unknown> | null }).team;
  if (!t || typeof t.id !== "string") return null;
  const nom = texte(t.name) ?? "";
  if (t.is_ghost === true) return { genre: "fantome", id: t.id, nom, logo: lien(t.logo_url) };

  const manager = t.manager as { uid?: unknown; nom?: unknown; photo?: unknown } | null | undefined;
  const meneurs = (t.meneurs ?? {}) as { buteurs?: unknown; passeurs?: unknown };
  return {
    genre: "fiche",
    id: t.id,
    nom,
    ville: texte(t.city),
    slogan: texte(t.slogan),
    description: texte(t.description),
    logo: lien(t.logo_url),
    banniere: lien(t.banner_url),
    couleur: versHex(texte(t.color)),
    niveau: NIVEAU[texte(t.level) ?? ""] ?? null,
    recrute: t.is_recruiting === true,
    abonnes: nombre(t.followers_count),
    membres: nombre(t.member_count),
    bilan: {
      joues: nombre(t.matches_played), gagnes: nombre(t.wins), nuls: nombre(t.draws), perdus: nombre(t.losses),
      butsPour: nombre(t.goals_for), butsContre: nombre(t.goals_against), sansEncaisser: nombre(t.clean_sheets),
    },
    forme: liste<Resultat>(t.form).filter((r) => r === "V" || r === "N" || r === "D").slice(0, 5).reverse(),
    effectif: liste<JoueurDuClub>(t.effectif),
    manager: manager && typeof manager.uid === "string"
      ? { uid: manager.uid, nom: texte(manager.nom) ?? "", photo: lien(manager.photo) }
      : null,
    staff: liste<MembreDuStaff>(t.staff),
    matchs: liste<MatchDuClub>(t.matchs),
    competitions: liste<CompetitionDuClub>(t.competitions),
    meneurs: { buteurs: liste<Meneur>(meneurs.buteurs), passeurs: liste<Meneur>(meneurs.passeurs) },
  };
}
