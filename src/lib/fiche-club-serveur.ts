import { adminDb } from "@/lib/firebase-admin";
import { bilanDuClub, type BilanClub } from "@/lib/bilan-club";
import { auNomDuClub, formeDuClub, type MatchDate, type Resultat } from "@/lib/bilan-club-serveur";
import { amicalVersCompMatch } from "@/lib/friendlies-shared";
import { toCompetition, toCompMatch, toCompTeam } from "@/lib/competition-mappers";
import { computeStandings } from "@/lib/poules";
import { normaliserPoste } from "@/lib/postes";
import { lireButeursRenseignes } from "@/lib/buteurs";
import {
  meneursDuClub, statutPublicAmical, statutPublicCompetition,
  type CompetitionDuClub, type JoueurDuClub, type MatchDuClub, type MatchPourMeneurs,
  type MembreDuStaff, type Meneur,
} from "@/lib/fiche-club";
import type {
  CompMatch, CompMatchRound, FirestoreCompetition, FirestoreCompMatch, FirestoreCompTeam,
} from "@/types";

// ============================================
// LA FICHE PUBLIQUE D'UN CLUB, lue d'un coup côté serveur.
//
// Elle réunit ce que la page lisait en morceaux, et seulement pour un compte
// connecté : l'effectif, les matchs, et ce qui s'en déduit. Un visiteur ne
// lisait rien de tout ça — `teams` et `matches` lui sont fermés —, et la page
// annonçait « Effectif 14 » au-dessus de « Aucun joueur dans l'équipe ».
//
// LES AMICAUX ET LES COMPÉTITIONS ENSEMBLE, comme le bilan (voir
// lib/bilan-club-serveur, dont on reprend la réécriture au nom du club). Le
// bilan et la forme se calculent ici sur les MÊMES matchs que la liste : ce
// que la fiche compte, elle le montre.
//
// Pas de bac à sable, pas de brouillon : une compétition d'essai n'est pas un
// palmarès, et une compétition que l'organisateur prépare n'est pas publique.
// ============================================

/** Le manager, tel que sa fiche le montre déjà à tout visiteur. */
export interface ManagerPublic {
  uid: string;
  nom: string;
  photo: string | null;
}

export interface FicheDuClub {
  bilan: BilanClub;
  /** Les cinq derniers résultats, du plus récent au plus ancien. */
  forme: Resultat[];
  effectif: JoueurDuClub[];
  manager: ManagerPublic | null;
  staff: MembreDuStaff[];
  matchs: MatchDuClub[];
  competitions: CompetitionDuClub[];
  meneurs: { buteurs: Meneur[]; passeurs: Meneur[] };
}

const TOURS: Record<CompMatchRound, string> = {
  round_of_16: "8es de finale",
  quarter: "Quart de finale",
  semi: "Demi-finale",
  final: "Finale",
  third_place: "Petite finale",
};

type Doc = FirebaseFirestore.DocumentData;

const nomComplet = (d: Doc | undefined) =>
  [d?.first_name, d?.last_name].filter((x): x is string => typeof x === "string" && x.trim() !== "").join(" ").trim();
const texte = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

/** Un match pour le bilan : ce qu'en lit lib/bilan-club, et de quoi le dater. */
function pourLeBilan(m: Pick<CompMatch, "date" | "time" | "status" | "homeTeamId" | "awayTeamId" | "scoreHome" | "scoreAway">): MatchDate {
  return {
    quand: `${m.date ?? ""}${m.time ?? ""}`,
    status: m.status,
    homeTeamId: m.homeTeamId,
    awayTeamId: m.awayTeamId,
    scoreHome: m.scoreHome,
    scoreAway: m.scoreAway,
  };
}

/** Un match, vu depuis le club qui joue sous l'un des identifiants de `nous`. */
function vuDuClub(
  m: CompMatch,
  nous: Set<string>,
  statut: MatchDuClub["statut"],
  lien: string,
  competition: MatchDuClub["competition"],
): MatchDuClub {
  const domicile = !!m.homeTeamId && nous.has(m.homeTeamId);
  return {
    id: m.id,
    lien,
    competition,
    etape: competition ? (m.group ? `Groupe ${m.group}` : m.round ? TOURS[m.round] : null) : null,
    groupe: competition ? (m.group ?? null) : null,
    tour: competition && !m.group ? (m.round ?? null) : null,
    date: m.date,
    heure: m.time,
    statut,
    domicile,
    adversaire: domicile
      ? { nom: m.awayTeamName, logo: m.awayTeamLogo }
      : { nom: m.homeTeamName, logo: m.homeTeamLogo },
    pour: domicile ? m.scoreHome : m.scoreAway,
    contre: domicile ? m.scoreAway : m.scoreHome,
    lieu: m.venueName,
  };
}

/** Les feuilles d'un match brut : c'est là qu'une ligne dit quel compte elle porte. */
function feuillesBrutes(d: Doc): MatchPourMeneurs["feuilles"] {
  const lignes = [
    ...((d.home_lineup ?? []) as Doc[]),
    ...((d.away_lineup ?? []) as Doc[]),
    ...((d.home_ghost_lineup ?? []) as Doc[]),
    ...((d.away_ghost_lineup ?? []) as Doc[]),
  ];
  return lignes
    .filter((e) => typeof e.player_id === "string")
    .map((e) => ({ playerId: e.player_id as string, userId: texte(e.user_id), name: String(e.name ?? "") }));
}

export async function ficheDuClub(teamId: string, club: Doc): Promise<FicheDuClub> {
  const memberIds = (Array.isArray(club.member_ids) ? club.member_ids : []) as string[];
  const numeros = (club.squad_numbers ?? {}) as Record<string, string>;
  const managerId = texte(club.manager_id);

  const [comptes, fantomes, chezNous, chezEux, competitions, compteDuManager] = await Promise.all([
    Promise.all(memberIds.map((uid) => adminDb.collection("users").doc(uid).get())),
    adminDb.collection("teams").doc(teamId).collection("ghost_players").get(),
    adminDb.collection("matches").where("home_team_id", "==", teamId).get(),
    adminDb.collection("matches").where("away_team_id", "==", teamId).get(),
    adminDb.collection("competitions").get(),
    managerId ? adminDb.collection("users").doc(managerId).get() : Promise.resolve(null),
  ]);

  // ---- L'effectif ------------------------------------------------------------
  // Les dossards des comptes l'emportent : un numéro qu'un compte porte déjà
  // s'efface d'une ligne sans compte, comme sur la page du manager.
  const dossardsDesComptes = new Set(
    memberIds.map((uid) => numeros[uid]?.trim()).filter((n): n is string => !!n),
  );
  const effectif: JoueurDuClub[] = [
    ...comptes.filter((c) => c.exists).map((c) => {
      const u = c.data() ?? {};
      return {
        id: c.id,
        nom: nomComplet(u) || "Joueur",
        numero: numeros[c.id]?.trim() || null,
        poste: normaliserPoste(u.position),
        photo: texte(u.profile_picture_url),
        uid: c.id,
      };
    }),
    ...fantomes.docs.map((g) => {
      const d = g.data();
      const numero = texte(d.squad_number)?.trim() ?? null;
      return {
        id: g.id,
        nom: nomComplet(d) || "Joueur",
        numero: numero && !dossardsDesComptes.has(numero) ? numero : null,
        poste: normaliserPoste(d.position),
        // Posée par le club, avec l'accord du joueur (voir
        // `FirestoreGhostPlayer.photo_url`).
        photo: texte(d.photo_url),
        uid: null,
      };
    }),
  ];
  const lignesDuClub = new Set(effectif.map((j) => j.id));

  const manager: ManagerPublic | null = compteDuManager?.exists
    ? { uid: compteDuManager.id, nom: nomComplet(compteDuManager.data()) || "Manager", photo: texte(compteDuManager.data()?.profile_picture_url) }
    : null;
  const staff: MembreDuStaff[] = ((club.staff ?? []) as Doc[])
    .filter((m) => texte(m.name))
    .map((m) => ({ nom: String(m.name), titre: String(m.title ?? "") }));

  // ---- Les amicaux -------------------------------------------------------------
  const brutsAmicaux = new Map<string, Doc>();
  for (const d of [...chezNous.docs, ...chezEux.docs]) brutsAmicaux.set(d.id, d.data());

  const nousEnAmical = new Set([teamId]);
  const matchs: MatchDuClub[] = [];
  const pourMeneurs: MatchPourMeneurs[] = [];
  const pourBilan: MatchDate[] = [];

  for (const [id, d] of brutsAmicaux) {
    // Le bilan lit tous les matchs, et ne garde que les terminés (voir
    // lib/bilan-club) : comme bilanCompletDuClub, au caractère près.
    pourBilan.push({
      quand: `${d.date ?? ""}${d.time ?? ""}`,
      status: String(d.status ?? ""),
      homeTeamId: texte(d.home_team_id),
      awayTeamId: texte(d.away_team_id),
      scoreHome: typeof d.score_home === "number" ? d.score_home : null,
      scoreAway: typeof d.score_away === "number" ? d.score_away : null,
    });
    const statut = statutPublicAmical(String(d.status ?? ""));
    const m = statut ? amicalVersCompMatch(id, d) : null;
    if (!statut || !m) continue;
    matchs.push(vuDuClub(m, nousEnAmical, statut, `/matches/${id}`, null));
    pourMeneurs.push({
      nous: [teamId],
      status: String(d.status ?? ""),
      feuilles: feuillesBrutes(d),
      evenements: m.liveState?.events ?? [],
      // Les buteurs d'un match renseigné sont ceux du camp qui l'a saisi : on
      // ne garde que les lignes de CE club.
      renseignes: lireButeursRenseignes(d.recorded_scorers)
        .filter((r) => lignesDuClub.has(r.playerId)),
    });
  }

  // ---- Les compétitions --------------------------------------------------------
  const inscriptions: CompetitionDuClub[] = [];
  await Promise.all(
    competitions.docs
      .filter((c) => !c.data().is_sandbox && c.data().status !== "draft")
      .map(async (c) => {
        const nosEquipes = await c.ref.collection("comp_teams").where("claimed_by_team_id", "==", teamId).get();
        if (nosEquipes.empty) return;
        const competition = toCompetition(c.id, c.data() as FirestoreCompetition);
        const [equipesSnap, matchsSnap] = await Promise.all([
          c.ref.collection("comp_teams").get(),
          c.ref.collection("comp_matches").get(),
        ]);
        const equipes = equipesSnap.docs.map((t) => toCompTeam(t.id, c.id, t.data() as FirestoreCompTeam));
        const tous = matchsSnap.docs.map((m) => toCompMatch(m.id, m.data() as FirestoreCompMatch));
        const nous = new Set(nosEquipes.docs.map((t) => t.id));
        const lienCompetition = `/c/${competition.slug}`;

        pourBilan.push(...auNomDuClub(tous.map(pourLeBilan), nous, teamId));
        for (const m of tous) {
          const estANous = (!!m.homeTeamId && nous.has(m.homeTeamId)) || (!!m.awayTeamId && nous.has(m.awayTeamId));
          const statut = statutPublicCompetition(m.status);
          if (!estANous || !statut) continue;
          matchs.push(vuDuClub(m, nous, statut, `${lienCompetition}/matches/${m.id}`, {
            nom: competition.name,
            lien: lienCompetition,
          }));
          pourMeneurs.push({
            nous: [...nous],
            status: m.status,
            feuilles: [...m.homeLineup, ...m.awayLineup].map((e) => ({
              playerId: e.playerId, userId: e.userId ?? null, name: e.name,
            })),
            evenements: m.liveState?.events ?? [],
          });
        }

        // Son rang, dans sa poule. Une inscription par compétition, en
        // pratique ; s'il y en avait deux, chacune dirait le sien.
        const poules = computeStandings(tous, equipes, competition.format);
        for (const t of nosEquipes.docs) {
          const equipe = equipes.find((e) => e.id === t.id);
          const poule = equipe?.group ? poules.find((p) => p.group === equipe.group) : undefined;
          const i = poule ? poule.rows.findIndex((r) => r.team.id === t.id) : -1;
          inscriptions.push({
            nom: competition.name,
            lien: lienCompetition,
            lienEquipe: `${lienCompetition}/teams/${t.id}`,
            groupe: equipe?.group ?? null,
            rang: poule && i >= 0 ? i + 1 : null,
            points: poule && i >= 0 ? poule.rows[i].points : null,
          });
        }
      })
      .map((p) => p.catch((err) => {
        // Une compétition illisible ne coûte que sa part : le reste de la fiche tient.
        console.error(`ficheDuClub(${teamId}) : une compétition illisible`, err);
      })),
  );

  return {
    bilan: bilanDuClub(pourBilan, teamId),
    forme: formeDuClub(pourBilan, teamId),
    effectif,
    manager,
    staff,
    matchs,
    competitions: inscriptions.sort((a, b) => a.nom.localeCompare(b.nom)),
    meneurs: meneursDuClub(pourMeneurs),
  };
}
