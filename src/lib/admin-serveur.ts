import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { A_TRAITER_VIDE, compterLesComptes, compterLesMatchs, dateLue, type ATraiter } from "@/lib/admin-tableau";
import { roleEffectifBrut } from "@/lib/admin-segments";
import { bilanDuClub, BILAN_VIDE, type MatchPourBilan } from "@/lib/bilan-club";
import { auNomDuClub } from "@/lib/bilan-club-serveur";
import { LIBELLE_EVENEMENT } from "@/lib/evenements";
import { matchsDeLaPlateforme, recalculerClassements } from "@/lib/classement-admin";
import { publierFormes } from "@/lib/formes-admin";
import { crediter, type Buteur } from "@/lib/match-renseigne-server";
import { refValidation } from "@/lib/validation-server";
import { connexionBloquee } from "@/lib/suspension-serveur";
import { sendPushToUser } from "@/lib/fcm-server";
import type {
  ArbitrageAdmin, CandidatureDuCompte, CompteResume, ContestationAdmin, EquipeAdmin,
  FicheCompteAdmin, MatchAdmin, RetourAdmin, TableauDeBord,
} from "@/lib/admin-types";
import type { CompMatchRound, FirestoreMatch, FirestoreMatchValidation, StatutValidation } from "@/types";

// ============================================
// Ce que l'administration lit, lu par le serveur.
//
// POURQUOI LE SERVEUR, ET PAS LE NAVIGATEUR COMME AVANT. Les écrans lisaient
// eux-mêmes Firestore, avec leurs propres copies des convertisseurs du
// produit — des copies restées en arrière : sans rôle, sans casquettes, sans
// date lisible. D'où « 14 comptes, 14 sans aucun espace », une fiche d'équipe
// qui plantait, un tableau de bord à « 0 joueur ». Et une partie de ce qu'il
// faut voir n'est pas lisible depuis un navigateur du tout : les retours des
// utilisateurs, les validations de match, fermées au public par les règles.
//
// Ici on lit tout d'un même endroit, avec les règles du produit (le rôle
// effectif, le bilan d'un club, les statuts publics d'un match), et chaque
// écran reçoit des chiffres qui ne se contredisent pas d'une page à l'autre.
// ============================================

type Doc = FirebaseFirestore.DocumentData;

const texte = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const nombre = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const nomComplet = (d: Doc | undefined) => `${d?.first_name ?? ""} ${d?.last_name ?? ""}`.trim();
const iso = (v: unknown): string | null => dateLue(v)?.toISOString() ?? null;

const TOURS: Record<CompMatchRound, string> = {
  round_of_16: "8es de finale",
  quarter: "Quart de finale",
  semi: "Demi-finale",
  final: "Finale",
  third_place: "Petite finale",
};

const compter = (q: FirebaseFirestore.Query) =>
  q.count().get().then((s) => s.data().count).catch((err) => {
    console.error("[admin] compte impossible", err);
    return 0;
  });

// ============================================
// À traiter
// ============================================

/**
 * Ce qui attend l'administration, en quelques requêtes de comptage.
 *
 * Les contestations et les compétitions se filtrent en mémoire : Firestore ne
 * sait pas demander « pas encore tranché » ni « ni bac à sable ni brouillon »,
 * et il y en a toujours peu.
 */
export async function compterATraiter(): Promise<ATraiter> {
  const [organisateurs, scoreurs, terrains, signalements, retours, contestes, aValider] = await Promise.all([
    compter(adminDb.collection("organizer_applications").where("status", "==", "pending")),
    compter(adminDb.collection("scorer_applications").where("status", "==", "pending")),
    compter(adminDb.collection("venue_applications").where("status", "==", "pending")),
    compter(adminDb.collection("post_reports").where("status", "==", "pending")),
    compter(adminDb.collection("feedback").where("handled", "==", false)),
    adminDb.collection("match_validations").where("status", "==", "contested").get()
      .then((s) => s.docs.filter((d) => !d.data().arbitrage).length).catch(() => 0),
    adminDb.collection("competitions").where("is_validated", "==", false).get()
      .then((s) => s.docs.filter((d) => !d.data().is_sandbox && d.data().status !== "draft").length)
      .catch(() => 0),
  ]);
  return {
    ...A_TRAITER_VIDE,
    organisateurs, scoreurs, terrains, signalements, retours,
    contestations: contestes, competitions: aValider,
  };
}

// ============================================
// Les matchs, amicaux et compétitions ensemble
// ============================================

function amicalVersAdmin(id: string, d: Doc, clubs: Set<string>, validation: StatutValidation | null): MatchAdmin {
  const club = (x: unknown) => {
    const id = texte(x);
    return id && clubs.has(id) ? id : null;
  };
  return {
    cle: `a:${id}`,
    id,
    genre: "amical",
    lien: `/matches/${id}`,
    competition: null,
    etape: null,
    domicile: { nom: texte(d.home_team_name) ?? "Domicile", logo: texte(d.home_team_logo), clubId: club(d.home_team_id) },
    exterieur: { nom: texte(d.away_team_name) ?? "Extérieur", logo: texte(d.away_team_logo), clubId: club(d.away_team_id) },
    date: texte(d.date),
    heure: texte(d.time),
    statut: String(d.status ?? ""),
    scoreDomicile: nombre(d.score_home),
    scoreExterieur: nombre(d.score_away),
    tabDomicile: nombre(d.penalty_home),
    tabExterieur: nombre(d.penalty_away),
    terrain: texte(d.venue_name),
    ville: texte(d.venue_city),
    format: texte(d.format),
    arbitre: texte(d.referee_name) ?? texte(d.local_referee_name),
    validation,
    renseigne: !!d.recorded_at,
  };
}

interface CompetitionLue {
  id: string;
  nom: string;
  lien: string;
  /** Inscription en compétition → club revendiqué. */
  clubs: Map<string, string>;
  matchs: { id: string; data: Doc }[];
}

/** Les compétitions réelles (ni bac à sable), avec leurs inscriptions revendiquées et leurs matchs. */
async function competitionsLues(): Promise<CompetitionLue[]> {
  const comps = await adminDb.collection("competitions").get();
  const lues = await Promise.all(
    comps.docs
      .filter((c) => !c.data().is_sandbox)
      .map(async (c) => {
        const d = c.data();
        const [equipes, matchs] = await Promise.all([
          c.ref.collection("comp_teams").get(),
          c.ref.collection("comp_matches").get(),
        ]);
        const clubs = new Map<string, string>();
        for (const e of equipes.docs) {
          const club = texte(e.data().claimed_by_team_id);
          if (club) clubs.set(e.id, club);
        }
        return {
          id: c.id,
          nom: texte(d.name) ?? "Compétition",
          lien: d.slug ? `/c/${d.slug}` : `/competitions/${c.id}`,
          clubs,
          matchs: matchs.docs.map((m) => ({ id: m.id, data: m.data() })),
        };
      })
      .map((p) => p.catch((err) => {
        console.error("[admin] compétition illisible", err);
        return null;
      })),
  );
  return lues.filter((c): c is CompetitionLue => c !== null);
}

function compVersAdmin(c: CompetitionLue, id: string, d: Doc): MatchAdmin {
  const club = (x: unknown) => {
    const inscription = texte(x);
    return inscription ? c.clubs.get(inscription) ?? null : null;
  };
  return {
    cle: `c:${c.id}:${id}`,
    id,
    genre: "competition",
    lien: c.lien.startsWith("/c/") ? `${c.lien}/matches/${id}` : c.lien,
    competition: { id: c.id, nom: c.nom, lien: c.lien },
    etape: texte(d.group) ? `Groupe ${d.group}` : d.round ? TOURS[d.round as CompMatchRound] ?? null : null,
    domicile: { nom: texte(d.home_team_name) ?? "À désigner", logo: texte(d.home_team_logo), clubId: club(d.home_team_id) },
    exterieur: { nom: texte(d.away_team_name) ?? "À désigner", logo: texte(d.away_team_logo), clubId: club(d.away_team_id) },
    date: texte(d.date),
    heure: texte(d.time),
    statut: String(d.status ?? ""),
    scoreDomicile: nombre(d.score_home),
    scoreExterieur: nombre(d.score_away),
    tabDomicile: nombre(d.penalty_home),
    tabExterieur: nombre(d.penalty_away),
    terrain: texte(d.venue_name),
    ville: texte(d.venue_city),
    format: null,
    arbitre: texte(d.referee_name),
    validation: null,
    renseigne: false,
  };
}

/** Les identifiants des vrais clubs : un adversaire d'amical fantôme n'en est pas un. */
async function idsDesClubs(): Promise<Set<string>> {
  const snap = await adminDb.collection("teams").select("is_ghost").get();
  return new Set(snap.docs.filter((d) => d.data().is_ghost !== true).map((d) => d.id));
}

/** Du plus récent au plus ancien, les matchs sans date à la fin. */
function parDateDecroissante(a: MatchAdmin, b: MatchAdmin): number {
  const qa = `${a.date ?? ""}${a.heure ?? ""}`;
  const qb = `${b.date ?? ""}${b.heure ?? ""}`;
  if (!qa) return 1;
  if (!qb) return -1;
  return qb.localeCompare(qa);
}

export async function matchsPourAdmin(): Promise<MatchAdmin[]> {
  const [amicaux, validations, clubs, competitions] = await Promise.all([
    adminDb.collection("matches").get(),
    adminDb.collection("match_validations").select("status").get(),
    idsDesClubs(),
    competitionsLues(),
  ]);
  const statuts = new Map(validations.docs.map((v) => [v.id, (v.data().status ?? null) as StatutValidation | null]));
  return [
    ...amicaux.docs.map((d) => amicalVersAdmin(d.id, d.data(), clubs, statuts.get(d.id) ?? null)),
    ...competitions.flatMap((c) => c.matchs.map((m) => compVersAdmin(c, m.id, m.data))),
  ].sort(parDateDecroissante);
}

// ============================================
// Le tableau de bord
// ============================================

export async function tableauDeBord(): Promise<TableauDeBord> {
  const maintenant = new Date();
  const [aTraiter, comptes, matchs, equipes, terrains, competitions] = await Promise.all([
    compterATraiter(),
    adminDb.collection("users").select(
      "first_name", "last_name", "profile_picture_url", "location_city", "user_type", "evolution_role",
      "is_active", "is_organizer", "is_venue_owner", "is_scorer", "is_superadmin", "created_at",
    ).get(),
    matchsPourAdmin(),
    adminDb.collection("teams").select("is_ghost").get(),
    compter(adminDb.collection("venues")),
    adminDb.collection("competitions").select("is_sandbox", "status").get(),
  ]);

  const docsComptes = comptes.docs.map((d) => ({ uid: d.id, data: d.data() }));
  const derniersComptes: CompteResume[] = docsComptes
    .map(({ uid, data }) => ({ uid, data, cree: dateLue(data.created_at)?.getTime() ?? 0 }))
    .sort((a, b) => b.cree - a.cree)
    .slice(0, 8)
    .map(({ uid, data }) => ({
      uid,
      nom: nomComplet(data) || "Compte sans nom",
      photo: texte(data.profile_picture_url),
      ville: texte(data.location_city),
      role: roleEffectifBrut(data),
      creeLe: iso(data.created_at),
    }));

  const reelles = competitions.docs.filter((c) => !c.data().is_sandbox && c.data().status !== "draft");
  // La ville telle qu'on l'a tapée, rapprochée sans accents ni casse : « Lomé »,
  // « lome » et « LOMÉ » sont la même ville.
  const villes = new Map<string, { ville: string; comptes: number }>();
  for (const { data } of docsComptes) {
    const ville = texte(data.location_city);
    if (!ville) continue;
    const cle = ville.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const v = villes.get(cle) ?? { ville, comptes: 0 };
    v.comptes += 1;
    villes.set(cle, v);
  }
  const jour = maintenant.toISOString().slice(0, 10);

  return {
    aTraiter,
    comptes: compterLesComptes(docsComptes.map((c) => c.data), maintenant),
    matchs: compterLesMatchs(
      matchs.filter((m) => m.genre === "amical").map((m) => ({ status: m.statut, date: m.date })),
      matchs.filter((m) => m.genre === "competition").map((m) => ({ status: m.statut, date: m.date })),
      maintenant,
    ),
    equipes: equipes.docs.filter((d) => d.data().is_ghost !== true).length,
    terrains,
    competitions: {
      total: reelles.length,
      enCours: reelles.filter((c) => ["registration", "group_stage", "knockout"].includes(String(c.data().status))).length,
    },
    derniersComptes,
    // Les matchs du jour d'abord (en direct ou à venir aujourd'hui), puis les
    // derniers joués : ce qu'on vient vérifier en ouvrant l'administration.
    derniersMatchs: [
      ...matchs.filter((m) => m.statut === "live"),
      ...matchs.filter((m) => m.statut !== "live" && m.date === jour && m.statut !== "cancelled"),
      ...matchs.filter((m) => m.statut === "completed" && m.date !== jour),
    ].slice(0, 8),
    villes: [...villes.values()].sort((a, b) => b.comptes - a.comptes).slice(0, 12),
    calculeLe: maintenant.toISOString(),
  };
}

// ============================================
// Les équipes, au bilan de leur fiche publique
// ============================================

function versBilan(d: Doc): MatchPourBilan {
  return {
    status: String(d.status ?? ""),
    homeTeamId: texte(d.home_team_id),
    awayTeamId: texte(d.away_team_id),
    scoreHome: nombre(d.score_home),
    scoreAway: nombre(d.score_away),
  };
}

/**
 * Toutes les équipes, avec le bilan que leur fiche publique affiche.
 *
 * L'administration lisait les compteurs `wins`/`losses` du document, que rien
 * ne tient à jour (voir lib/bilan-club) et qui ignorent les compétitions :
 * « 2 V, 100 % » dans l'admin pour « 4 joués, 3 G, 1 N » sur la fiche. Ici,
 * comme la fiche : les amicaux et les matchs des inscriptions revendiquées,
 * lus une seule fois pour toutes les équipes.
 */
export async function equipesPourAdmin(): Promise<EquipeAdmin[]> {
  const [equipes, amicaux, competitions, fantomes] = await Promise.all([
    adminDb.collection("teams").get(),
    adminDb.collection("matches").select("status", "home_team_id", "away_team_id", "score_home", "score_away").get(),
    competitionsLues(),
    adminDb.collectionGroup("ghost_players").select().get(),
  ]);

  const clubs = equipes.docs.filter((d) => d.data().is_ghost !== true);
  const fantomesParEquipe = new Map<string, number>();
  for (const f of fantomes.docs) {
    const equipe = f.ref.parent.parent?.id;
    if (equipe) fantomesParEquipe.set(equipe, (fantomesParEquipe.get(equipe) ?? 0) + 1);
  }

  const managers = [...new Set(clubs.map((c) => texte(c.data().manager_id)).filter((x): x is string => !!x))];
  const lus = managers.length > 0
    ? await adminDb.getAll(...managers.map((uid) => adminDb.collection("users").doc(uid)))
    : [];
  const nomDuManager = new Map(lus.filter((u) => u.exists).map((u) => [u.id, nomComplet(u.data()) || "Manager"]));

  const tousAmicaux = amicaux.docs.map((d) => versBilan(d.data()));
  const tousEnCompetition = competitions.flatMap((c) => c.matchs.map((m) => versBilan(m.data)));
  // Les inscriptions revendiquées, club par club.
  const inscriptions = new Map<string, Set<string>>();
  for (const c of competitions) {
    for (const [inscription, club] of c.clubs) {
      if (!inscriptions.has(club)) inscriptions.set(club, new Set());
      inscriptions.get(club)!.add(inscription);
    }
  }

  return clubs.map((c) => {
    const d = c.data();
    const comptes = Array.isArray(d.member_ids) ? d.member_ids.length : 0;
    const nous = new Set([c.id, ...(inscriptions.get(c.id) ?? [])]);
    const siens = [
      ...tousAmicaux.filter((m) => m.homeTeamId === c.id || m.awayTeamId === c.id),
      ...auNomDuClub(tousEnCompetition, nous, c.id),
    ];
    const managerId = texte(d.manager_id);
    return {
      id: c.id,
      nom: texte(d.name) ?? "Équipe",
      ville: texte(d.city) ?? "",
      niveau: texte(d.level) ?? "",
      logo: texte(d.logo_url),
      couleur: texte(d.color),
      recrute: d.is_recruiting === true,
      manager: managerId ? { uid: managerId, nom: nomDuManager.get(managerId) ?? "Compte supprimé" } : null,
      effectif: comptes + (fantomesParEquipe.get(c.id) ?? 0),
      comptes,
      bilan: siens.length > 0 ? bilanDuClub(siens, c.id) : BILAN_VIDE,
      creeLe: iso(d.created_at),
      description: texte(d.description) ?? "",
      slogan: texte(d.slogan) ?? "",
      maxMembres: nombre(d.max_members) ?? 0,
    };
  }).sort((a, b) => (b.creeLe ?? "").localeCompare(a.creeLe ?? ""));
}

// ============================================
// Les retours des utilisateurs
// ============================================

/**
 * Le formulaire « Un retour ? » écrivait dans `feedback`, que les règles
 * ferment à tout navigateur, et aucun écran ne le lisait : les messages des
 * utilisateurs s'accumulaient sans que personne puisse les ouvrir.
 */
export async function retoursPourAdmin(): Promise<RetourAdmin[]> {
  const snap = await adminDb.collection("feedback").orderBy("created_at", "desc").limit(300).get();
  return snap.docs.map((d) => {
    const x = d.data();
    const uid = texte(x.uid);
    return {
      id: d.id,
      message: String(x.message ?? ""),
      auteur: uid ? { uid, nom: texte(x.author_name) ?? "Compte" } : null,
      page: texte(x.page),
      appareil: texte(x.user_agent),
      traite: x.handled === true,
      creeLe: iso(x.created_at),
    };
  });
}

export async function marquerRetour(id: string, traite: boolean, par: string): Promise<boolean> {
  const ref = adminDb.collection("feedback").doc(id);
  if (!(await ref.get()).exists) return false;
  await ref.update({
    handled: traite,
    handled_by: traite ? par : FieldValue.delete(),
    handled_at: traite ? FieldValue.serverTimestamp() : FieldValue.delete(),
  });
  return true;
}

// ============================================
// Les amicaux contestés, et leur arbitrage
// ============================================

function arbitrageLu(v: FirestoreMatchValidation): ArbitrageAdmin | null {
  const a = v.arbitrage;
  return a ? { decision: a.decision, motif: a.motif, par: a.by, le: a.at } : null;
}

/**
 * Les amicaux où les deux camps ne s'accordent pas : ceux à trancher, puis
 * les derniers tranchés. `match_validations` ne se lit que depuis le serveur.
 */
export async function contestationsPourAdmin(): Promise<ContestationAdmin[]> {
  const [snap, clubs] = await Promise.all([
    adminDb.collection("match_validations").where("status", "==", "contested").get(),
    idsDesClubs(),
  ]);
  // Les tranchées par validation ont quitté « contested » : on les retrouve
  // par leur arbitrage, pour garder la trace de ce qui a été décidé.
  const tranchees = await adminDb.collection("match_validations").where("arbitrage.decision", "==", "valide").get()
    .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }));
  const docs = new Map<string, FirestoreMatchValidation>();
  for (const d of [...snap.docs, ...tranchees.docs]) docs.set(d.id, d.data() as FirestoreMatchValidation);
  if (docs.size === 0) return [];

  const matchs = await adminDb.getAll(...[...docs.keys()].map((id) => adminDb.collection("matches").doc(id)));
  const liste: ContestationAdmin[] = [];
  for (const m of matchs) {
    if (!m.exists) continue;
    const d = m.data() as FirestoreMatch;
    const v = docs.get(m.id)!;
    const equipe = (camp: "home" | "away") => (camp === "home" ? d.home_team_name : d.away_team_name);
    const evenements = (d.live_state?.events ?? []);
    liste.push({
      matchId: m.id,
      match: amicalVersAdmin(m.id, d as unknown as Doc, clubs, v.status),
      retours: (["home", "away"] as const).flatMap((camp) => {
        const r = v.feedback?.[camp];
        if (!r) return [];
        return [{
          camp, equipe: equipe(camp), validation: r.validation,
          commentaire: r.comments ?? null, par: r.by, le: r.at,
        }];
      }),
      evenements: Object.entries(v.contested_events ?? {}).map(([id, c]) => {
        const e = evenements.find((x) => x.id === id);
        const libelle = e
          ? `${LIBELLE_EVENEMENT[e.type as keyof typeof LIBELLE_EVENEMENT] ?? e.type}${e.player_name ? ` · ${e.player_name}` : ""}${e.minute != null ? ` · ${e.minute}'` : ""}`
          : "Événement retiré de la feuille";
        return { id, libelle, camp: c.side, motif: c.reason, le: c.at };
      }),
      statsCreditees: !!(d as FirestoreMatch & { stats_credited_at?: unknown }).stats_credited_at || !d.recorded_at,
      arbitrage: arbitrageLu(v),
    });
  }
  // À trancher d'abord, puis les plus récents.
  return liste.sort((a, b) => {
    if (!a.arbitrage !== !b.arbitrage) return a.arbitrage ? 1 : -1;
    return parDateDecroissante(a.match, b.match);
  });
}

export class ArbitrageImpossible extends Error {}

/**
 * Trancher un amical contesté.
 *
 * VALIDER : le score compte. Un score RENSEIGNÉ après coup et refusé par
 * l'adversaire n'avait rien crédité (voir lib/match-renseigne-server) : il
 * l'est maintenant, par la même règle que la contresignature qui lui a
 * manqué. Un match couvert en direct l'était déjà au coup de sifflet.
 *
 * ANNULER : le match ne compte plus. Il passe « annulé », ce qui le sort des
 * bilans, des classements et des statistiques calculées (qui ne lisent que
 * les matchs terminés) ; ce qu'un score renseigné avait crédité est repris.
 *
 * Le motif est gardé sur la validation, que les deux camps lisent sur la page
 * du match, et part avec la notification.
 */
export async function trancherContestation(
  matchId: string,
  decision: "valide" | "annule",
  motif: string,
  par: string,
): Promise<void> {
  const ref = adminDb.collection("matches").doc(matchId);
  const vref = refValidation(matchId);
  let match: FirestoreMatch | null = null;

  await adminDb.runTransaction(async (tx) => {
    const [ms, vs] = await Promise.all([tx.get(ref), tx.get(vref)]);
    if (!ms.exists || !vs.exists) throw new ArbitrageImpossible("Match introuvable");
    const m = ms.data() as FirestoreMatch & { recorded_scorers?: Buteur[]; stats_credited_at?: unknown };
    const v = vs.data() as FirestoreMatchValidation;
    if (v.status !== "contested" || v.arbitrage) throw new ArbitrageImpossible("Ce match n'attend plus d'arbitrage");
    match = m;

    const equipeQuiSaisit = m.is_home ? m.home_team_id : m.away_team_id;
    const arbitrage = { decision, motif, by: par, at: new Date().toISOString() };

    if (decision === "valide") {
      if (m.recorded_at && !m.stats_credited_at) {
        crediter(tx, m, matchId, m.recorded_scorers ?? [], equipeQuiSaisit, 1);
        tx.update(ref, {
          stats_credited_at: FieldValue.serverTimestamp(),
          stats_credited_by: par,
          recorded_scorer_stats: false,
          updated_at: FieldValue.serverTimestamp(),
        });
      }
      tx.update(vref, { status: "validated", arbitrage, updated_at: FieldValue.serverTimestamp() });
    } else {
      if (m.recorded_at && m.stats_credited_at) {
        crediter(tx, m, matchId, m.recorded_scorers ?? [], equipeQuiSaisit, -1);
      }
      tx.update(ref, {
        status: "cancelled",
        ...(m.recorded_at && m.stats_credited_at ? { stats_credited_at: FieldValue.delete() } : {}),
        updated_at: FieldValue.serverTimestamp(),
      });
      tx.update(vref, { arbitrage, auto_validate_at: FieldValue.delete(), updated_at: FieldValue.serverTimestamp() });
    }
  });

  const m = match as FirestoreMatch | null;
  if (!m) return;

  // Le classement et les formes relisent les matchs terminés : un match annulé
  // doit en sortir, un match validé y rester. Au mieux : la décision est prise.
  await recalculerLeClassement();

  const affiche = `${m.home_team_name} ${m.score_home ?? 0} – ${m.score_away ?? 0} ${m.away_team_name}`;
  const titre = decision === "valide" ? "Score validé par KoppaFoot" : "Match annulé par KoppaFoot";
  const corps = `${affiche}. ${decision === "valide" ? "Le score compte." : "Le match ne compte plus."}${motif ? ` Motif : ${motif}` : ""}`;
  const managers = [m.manager_id, m.away_manager_id].filter((x): x is string => !!x);
  await Promise.allSettled(managers.flatMap((uid) => [
    adminDb.collection("notifications").add({
      user_id: uid, type: "match_update", title: titre, body: corps,
      link: `/matches/${matchId}`, read: false, created_at: FieldValue.serverTimestamp(),
    }),
    sendPushToUser(uid, { title: titre, body: corps, link: `/matches/${matchId}`, category: "perso" }),
  ]));
}

/**
 * Refaire le classement des joueurs et leurs formes, après un geste de
 * l'administration sur un match. Ils ne se recalculent sinon qu'au coup de
 * sifflet final (voir /api/rankings/rebuild) : un score corrigé, un match
 * supprimé ou annulé seraient restés comptés jusqu'au prochain match joué.
 * Au mieux : le geste est déjà fait.
 */
export async function recalculerLeClassement(): Promise<void> {
  try {
    const tous = await matchsDeLaPlateforme();
    await recalculerClassements(tous);
    await publierFormes(tous).catch(() => null);
  } catch (err) {
    console.error("[admin] classement non recalculé", err);
  }
}

// ============================================
// La fiche d'un compte
// ============================================

export async function ficheCompteAdmin(uid: string): Promise<FicheCompteAdmin | null> {
  const profil = await adminDb.collection("users").doc(uid).get();
  if (!profil.exists) return null;
  const d = profil.data()!;

  const [
    dirigees, jouees, crees, arbitres, comps, notes, orga, scoreur, terrain, publications, moderees,
  ] = await Promise.all([
    adminDb.collection("teams").where("manager_id", "==", uid).get(),
    adminDb.collection("teams").where("member_ids", "array-contains", uid).get(),
    compter(adminDb.collection("matches").where("manager_id", "==", uid)),
    adminDb.collection("matches").where("referee_id", "==", uid).select("status", "referee_status").get(),
    adminDb.collection("competitions").where("organizer_ids", "array-contains", uid).get(),
    adminDb.collection("player_ratings").where("player_id", "==", uid).select("score").get(),
    adminDb.collection("organizer_applications").where("uid", "==", uid).get(),
    adminDb.collection("scorer_applications").where("uid", "==", uid).get(),
    adminDb.collection("venue_applications").where("uid", "==", uid).get(),
    compter(adminDb.collection("posts").where("author_id", "==", uid)),
    compter(adminDb.collection("competitions").where("moderator_ids", "array-contains", uid)),
  ]);

  const candidatures: CandidatureDuCompte[] = [
    ...orga.docs.map((x) => ({ genre: "organisateur" as const, data: x.data() })),
    ...scoreur.docs.map((x) => ({ genre: "scoreur" as const, data: x.data() })),
    ...terrain.docs.map((x) => ({ genre: "terrain" as const, data: x.data() })),
  ].map(({ genre, data }) => ({
    genre,
    statut: String(data.status ?? "pending"),
    le: iso(data.created_at),
    motifRefus: texte(data.rejection_reason),
  })).sort((a, b) => (b.le ?? "").localeCompare(a.le ?? ""));

  const scores = notes.docs.map((n) => nombre(n.data().score) ?? 0).filter((n) => n > 0);
  const role = roleEffectifBrut(d);
  const actif = d.is_active !== false;
  const [bloquee, auteur] = await Promise.all([
    connexionBloquee(uid),
    !actif && typeof d.suspended_by === "string" ? adminDb.collection("users").doc(d.suspended_by).get() : null,
  ]);
  const reelle = (t: FirebaseFirestore.QueryDocumentSnapshot) => t.data().is_ghost !== true;

  return {
    uid,
    prenom: texte(d.first_name) ?? "",
    nom: texte(d.last_name) ?? "",
    email: texte(d.email),
    telephone: texte(d.phone),
    ville: texte(d.location_city),
    bio: texte(d.bio),
    photo: texte(d.profile_picture_url),
    actif,
    suspension: actif ? null : {
      motif: texte(d.suspension_reason),
      le: iso(d.suspended_at),
      par: auteur?.exists
        ? { uid: auteur.id, nom: `${auteur.data()?.first_name ?? ""} ${auteur.data()?.last_name ?? ""}`.trim() || "Un administrateur" }
        : null,
    },
    connexionBloquee: bloquee,
    creeLe: iso(d.created_at),
    fournisseurs: Array.isArray(d.auth_providers) ? d.auth_providers.map(String) : [],
    role,
    roleHerite: role !== null && !d.evolution_role,
    poste: texte(d.position),
    casquettes: {
      organisateur: d.is_organizer === true,
      proprietaire: d.is_venue_owner === true,
      scoreur: d.is_scorer === true,
      admin: d.is_superadmin === true || d.user_type === "superadmin",
    },
    moderateur: moderees > 0,
    nomOrganisateur: texte(d.organizer_name),
    equipesDirigees: dirigees.docs.filter(reelle).map((t) => ({ id: t.id, nom: texte(t.data().name) ?? "Équipe" })),
    equipesJouees: jouees.docs.filter(reelle).map((t) => ({ id: t.id, nom: texte(t.data().name) ?? "Équipe" })),
    competitions: comps.docs
      .filter((c) => !c.data().is_sandbox)
      .map((c) => ({
        id: c.id,
        nom: texte(c.data().name) ?? "Compétition",
        lien: c.data().slug ? `/c/${c.data().slug}` : null,
        publique: c.data().status !== "draft" && c.data().is_validated !== false,
      })),
    candidatures,
    activite: {
      matchsCrees: crees,
      matchsArbitres: arbitres.docs.filter((x) => x.data().status === "completed").length,
      designationsEnAttente: arbitres.docs.filter((x) => ["pending", "invited"].includes(String(x.data().referee_status))).length,
      noteMoyenne: scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
      publications,
    },
  };
}
