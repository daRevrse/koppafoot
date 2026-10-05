// ============================================
// Les chiffres de l'administration, comptés sur ce qui existe vraiment.
//
// LE TABLEAU DE BORD MENTAIT PAR TROIS CÔTÉS.
//
//   — Il comptait les comptes par `user_type`, qui vaut « user » pour
//     presque tout le monde depuis que le rôle vit dans `evolution_role` :
//     « 0 joueur, 0 manager, 0 arbitre » sur une plateforme qui en compte des
//     dizaines, et chaque inscrit étiqueté « Joueur » par défaut.
//   — « Matchs joués » additionnait tous les amicaux, à venir compris, et
//     ignorait les compétitions.
//   — « Plateforme opérationnelle, tous les systèmes fonctionnent
//     normalement » était écrit en dur. Rien ne le vérifiait.
//
// Ici, un compte a le rôle que lui donne `roleEffectifBrut` (le même que
// l'écran des utilisateurs et que les envois), et un match est joué quand il
// est terminé. Module pur : la route le nourrit de documents bruts.
// ============================================

import { roleEffectifBrut } from "@/lib/admin-segments";
import { statutPublicAmical, statutPublicCompetition } from "@/lib/fiche-club";

type Brut = Record<string, unknown>;

/** Une date Firestore sous l'une de ses formes : Timestamp, chaîne ISO, secondes. */
export function dateLue(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "object") {
    const o = v as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof o.toDate === "function") return o.toDate();
    const s = o.seconds ?? o._seconds;
    if (typeof s === "number") return new Date(s * 1000);
  }
  return null;
}

export interface ComptesDeLaPlateforme {
  total: number;
  suspendus: number;
  joueurs: number;
  managers: number;
  arbitres: number;
  /** Ni rôle activé, ni rôle déclaré : ne voit que les scores. */
  sansRole: number;
  /** Déclaré à l'inscription, jamais activé dans Évolution. */
  rolesHerites: number;
  organisateurs: number;
  proprietaires: number;
  scoreurs: number;
  admins: number;
  nouveaux7j: number;
  nouveaux30j: number;
}

const JOUR = 24 * 60 * 60 * 1000;

export function compterLesComptes(comptes: Brut[], maintenant: Date): ComptesDeLaPlateforme {
  const c: ComptesDeLaPlateforme = {
    total: 0, suspendus: 0, joueurs: 0, managers: 0, arbitres: 0, sansRole: 0,
    rolesHerites: 0, organisateurs: 0, proprietaires: 0, scoreurs: 0, admins: 0,
    nouveaux7j: 0, nouveaux30j: 0,
  };
  for (const d of comptes) {
    c.total += 1;
    if (d.is_active === false) c.suspendus += 1;
    const role = roleEffectifBrut(d);
    if (role === "player") c.joueurs += 1;
    else if (role === "manager") c.managers += 1;
    else if (role === "referee") c.arbitres += 1;
    else c.sansRole += 1;
    if (role && !d.evolution_role) c.rolesHerites += 1;
    if (d.is_organizer === true) c.organisateurs += 1;
    if (d.is_venue_owner === true) c.proprietaires += 1;
    if (d.is_scorer === true) c.scoreurs += 1;
    if (d.is_superadmin === true || d.user_type === "superadmin") c.admins += 1;
    const cree = dateLue(d.created_at);
    if (cree) {
      const age = maintenant.getTime() - cree.getTime();
      if (age <= 7 * JOUR) c.nouveaux7j += 1;
      if (age <= 30 * JOUR) c.nouveaux30j += 1;
    }
  }
  return c;
}

export interface MatchsDeLaPlateforme {
  /** Terminés : les seuls qui ont un résultat. */
  joues: number;
  aVenir: number;
  enDirect: number;
  amicauxJoues: number;
  competitionJoues: number;
  /** Terminés dans les sept derniers jours, d'après leur date de jeu. */
  joues7j: number;
}

/**
 * Les matchs, amicaux et compétitions ensemble, comme sur une fiche de club.
 *
 * Un défi pas encore accepté, un brouillon, un match annulé ne sont ni joués
 * ni à venir : ils ne comptent nulle part, comme sur les pages publiques.
 */
export function compterLesMatchs(
  amicaux: { status: string; date: string | null }[],
  competition: { status: string; date: string | null }[],
  maintenant: Date,
): MatchsDeLaPlateforme {
  const m: MatchsDeLaPlateforme = {
    joues: 0, aVenir: 0, enDirect: 0, amicauxJoues: 0, competitionJoues: 0, joues7j: 0,
  };
  const ilYA7j = new Date(maintenant.getTime() - 7 * JOUR).toISOString().slice(0, 10);
  const lire = (statut: ReturnType<typeof statutPublicAmical>, date: string | null, amical: boolean) => {
    if (statut === "termine") {
      m.joues += 1;
      if (amical) m.amicauxJoues += 1;
      else m.competitionJoues += 1;
      if (date && date.slice(0, 10) >= ilYA7j) m.joues7j += 1;
    } else if (statut === "a_venir") m.aVenir += 1;
    else if (statut === "en_direct") m.enDirect += 1;
  };
  for (const a of amicaux) lire(statutPublicAmical(a.status), a.date, true);
  for (const x of competition) lire(statutPublicCompetition(x.status), x.date, false);
  return m;
}

/**
 * Combien d'équipes gère chaque manager.
 *
 * La cible du statut club (lib/clubs) : un manager qui gère plusieurs
 * équipes, seniors, jeunes, féminines, est une structure qui gagnerait à les
 * réunir. Les équipes fantômes (adversaires sans compte) ne comptent pas.
 */
export interface ManagersParEquipes {
  une: number;
  deux: number;
  troisEtPlus: number;
  /** Les managers aux équipes les plus nombreuses, pour aller leur parler. */
  plusGrands: { uid: string; equipes: number }[];
}

export function repartirLesManagers(equipes: Brut[], combien = 10): ManagersParEquipes {
  const parManager = new Map<string, number>();
  for (const e of equipes) {
    if (e.is_ghost === true || typeof e.manager_id !== "string" || !e.manager_id) continue;
    parManager.set(e.manager_id, (parManager.get(e.manager_id) ?? 0) + 1);
  }
  const r: ManagersParEquipes = { une: 0, deux: 0, troisEtPlus: 0, plusGrands: [] };
  for (const n of parManager.values()) {
    if (n === 1) r.une += 1;
    else if (n === 2) r.deux += 1;
    else r.troisEtPlus += 1;
  }
  r.plusGrands = [...parManager.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, combien)
    .map(([uid, equipes]) => ({ uid, equipes }));
  return r;
}

/** Ce qui attend l'administration. Chaque ligne mène à la page qui le traite. */
export interface ATraiter {
  organisateurs: number;
  scoreurs: number;
  terrains: number;
  signalements: number;
  retours: number;
  contestations: number;
  competitions: number;
}

export const A_TRAITER_VIDE: ATraiter = {
  organisateurs: 0, scoreurs: 0, terrains: 0, signalements: 0,
  retours: 0, contestations: 0, competitions: 0,
};

export function totalATraiter(a: ATraiter): number {
  return Object.values(a).reduce((n, x) => n + x, 0);
}
