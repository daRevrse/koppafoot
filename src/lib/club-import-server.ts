import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { photoDeLaCompetition } from "@/lib/photos-sans-compte";
import { effacerVisuelParAdresse } from "@/lib/visuel-serveur";
import { toCompMatch } from "@/lib/competition-mappers";
import { matchDuration } from "@/lib/competition-format";
import { computeSquadStats } from "@/lib/player-stats";
import {
  lignesActives, planifierImport, proposerImport, recopierLesComptes, sansLeLien,
  type ApercuImport, type Correspondances, type JoueurDuClub, type LigneChiffree, type MatchStocke,
} from "@/lib/fusion-import";
import type {
  CompPlayer, FirestoreCompMatch, FirestoreCompetition, LinkedCompPlayer,
} from "@/types";

// ============================================
// Server-only: copy a manager's club squad onto a competition team.
//
// Shared by the manual import (/api/competitions/club-import) and by the
// acceptance of a registration (/api/competitions/registrations), which must
// land a squad in exactly the same state.
//
// It writes BOTH sides of the link, `user_id` on the roster line AND a
// `linked_comp_players` row on the player's own user doc. The second write
// is why this cannot live on the client: the rules only ever let a user
// write their own document, and without it /stats has nothing to read.
//
// UN JOUEUR DU CLUB PEUT REPRENDRE UNE LIGNE DÉJÀ LÀ, celle que
// l'organisateur avait tapée à la main, au lieu d'en créer une seconde : le
// manager confirme chaque rapprochement, et la ligne garde ses matchs. Les
// règles sont dans lib/fusion-import, qui est pur ; ce fichier lit et écrit.
// ============================================

interface Entree {
  cid: string;
  teamId: string;
  clubId: string;
  competition: FirestoreCompetition;
}

/** Tout ce que l'aperçu et l'import ont besoin de lire, une seule fois. */
async function lire({ cid, teamId, clubId }: Omit<Entree, "competition">) {
  const comp = adminDb.collection("competitions").doc(cid);
  const teamRef = comp.collection("comp_teams").doc(teamId);
  const clubRef = adminDb.collection("teams").doc(clubId);

  // Les matchs de cette équipe : c'est par eux qu'on sait quelles lignes ont
  // joué. Deux requêtes, un match nomme ses équipes dans deux champs.
  const [teamSnap, clubSnap, chezElle, enFace] = await Promise.all([
    teamRef.get(),
    clubRef.get(),
    comp.collection("comp_matches").where("home_team_id", "==", teamId).get(),
    comp.collection("comp_matches").where("away_team_id", "==", teamId).get(),
  ]);
  if (!teamSnap.exists) throw new Error("TEAM_NOT_FOUND");
  if (!clubSnap.exists) throw new Error("CLUB_NOT_FOUND");

  const club = clubSnap.data()!;
  const memberIds = (club.member_ids ?? []) as string[];
  const squadNumbers = (club.squad_numbers ?? {}) as Record<string, string>;

  // A club roster is small, so plain gets beat an `in` query: no 30-id
  // chunking, no documentId() quirks.
  const [memberDocs, ghostSnap] = await Promise.all([
    Promise.all(memberIds.map((id) => adminDb.collection("users").doc(id).get())),
    clubRef.collection("ghost_players").get().catch(() => null),
  ]);

  const joueurs: JoueurDuClub[] = [];
  for (const doc of memberDocs) {
    if (!doc.exists) continue;
    const u = doc.data()!;
    joueurs.push({
      genre: "compte",
      id: doc.id,
      nom: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "Joueur",
      numero: squadNumbers[doc.id] ?? "",
      poste: (u.position as string) || null,
    });
  }
  for (const doc of ghostSnap?.docs ?? []) {
    const g = doc.data();
    joueurs.push({
      genre: "sans_compte",
      id: doc.id,
      nom: `${g.first_name ?? ""} ${g.last_name ?? ""}`.trim() || "Joueur",
      numero: (g.squad_number as string) ?? "",
      poste: (g.position as string) || null,
    });
  }

  const matchs = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const d of [...chezElle.docs, ...enFace.docs]) matchs.set(d.id, d);

  return {
    teamRef,
    compTeam: teamSnap.data()!,
    effectif: (teamSnap.data()!.players ?? []) as CompPlayer[],
    joueurs,
    matchs: [...matchs.values()],
    actives: lignesActives([...matchs.values()].map((d) => d.data() as MatchStocke)),
  };
}

/**
 * Ce que le manager confirme avant d'importer : qui reprend quelle ligne
 * saisie à la main, et qui retrouve la ligne dont on l'avait délié. Ne change
 * rien en base.
 */
export async function apercuImport(input: Entree): Promise<ApercuImport> {
  const { effectif, joueurs, matchs, actives } = await lire(input);
  const { propositions, libres, aJour } = proposerImport(effectif, joueurs, actives);

  // Les lignes que le manager avait déliées, et qu'il peut rattacher de nouveau.
  const siennes = new Set(propositions.filter((p) => p.etat === "delie").map((p) => p.suggestion));
  const deliees = effectif.filter((l) => siennes.has(l.id));

  // Les mêmes chiffres que l'onglet « Stats » du manager : c'est ce qu'il a
  // sous les yeux pour reconnaître un joueur.
  const joues = matchs.map((d) => toCompMatch(d.id, d.data() as FirestoreCompMatch));
  const chiffrer = (lignes: CompPlayer[]): LigneChiffree[] =>
    computeSquadStats(joues, input.teamId, lignes, matchDuration(input.competition.format))
      .map(({ player, stats }) => ({
        id: player.id,
        nom: player.name,
        numero: player.number,
        matchs: stats.matchesPlayed,
        buts: stats.goals,
        passes: stats.assists,
      }));

  return { propositions, libres: chiffrer(libres), deliees: chiffrer(deliees), aJour };
}

/**
 * Importe le club. `correspondances` : ce que le manager a confirmé (voir
 * `apercuImport`) ; sans elles, chaque joueur absent de l'effectif arrive
 * comme une nouvelle ligne — le cas d'une inscription acceptée, où l'équipe
 * naît vide.
 *
 * Lève `ImportRefuse` (lib/fusion-import) si une correspondance ne tient plus.
 */
export async function importClubRoster(
  input: Entree & { correspondances?: Correspondances },
): Promise<{ added: number; linked: number; merged: number; relinked: number }> {
  const { cid, teamId, clubId, competition } = input;
  const { teamRef, compTeam, joueurs, matchs, actives } = await lire(input);
  const users = adminDb.collection("users");

  const link = (lien: { ligne: string; nom: string }): LinkedCompPlayer => ({
    competition_id: cid,
    competition_name: competition.name,
    competition_slug: competition.slug,
    team_id: teamId,
    team_name: (compTeam.name as string) ?? "",
    player_id: lien.ligne,
    player_name: lien.nom,
  });

  // The roster is a single array field, so read-modify-write in a
  // transaction: a manager editing a line while the import runs must not be
  // overwritten, and a link must not move halfway.
  const plan = await adminDb.runTransaction(async (tx) => {
    const teamSnap = await tx.get(teamRef);
    if (!teamSnap.exists) throw new Error("TEAM_NOT_FOUND");
    const effectif = (teamSnap.data()?.players ?? []) as CompPlayer[];
    const plan = planifierImport(effectif, joueurs, input.correspondances ?? {}, actives);

    // Un compte dont le lien change de ligne : son tableau est relu, parce
    // qu'on ne retire pas une entrée d'un tableau sans la connaître au
    // caractère près. Les autres n'ont qu'une ligne à ajouter.
    const ancienne = new Map(plan.liensRetires.map((l) => [l.uid, l.ligne]));
    const relus = new Map(
      (await Promise.all([...ancienne.keys()].map((uid) => tx.get(users.doc(uid))))).map((s) => [s.id, s]),
    );

    tx.update(teamRef, {
      players: plan.effectif,
      claimed_by_team_id: clubId,
      updated_at: FieldValue.serverTimestamp(),
    });
    for (const lien of plan.liens) {
      const relu = relus.get(lien.uid);
      if (!relu) {
        tx.update(users.doc(lien.uid), {
          linked_comp_players: FieldValue.arrayUnion(link(lien)),
          updated_at: FieldValue.serverTimestamp(),
        });
        continue;
      }
      if (!relu.exists) continue;
      // L'ancien lien s'en va, et le nouveau n'y figure pas deux fois.
      const gardes = [ancienne.get(lien.uid)!, lien.ligne].reduce(
        (liens, playerId) => sansLeLien(liens, { cid, teamId, playerId }),
        (relu.data()?.linked_comp_players ?? []) as LinkedCompPlayer[],
      );
      tx.update(relu.ref, {
        linked_comp_players: [...gardes, link(lien)],
        updated_at: FieldValue.serverTimestamp(),
      });
    }
    return plan;
  });

  // Ce qui suit accompagne l'import sans le conditionner : l'effectif et les
  // liens sont écrits, un échec ici ne les défait pas.
  await Promise.all(
    plan.photosRetirees
      .filter((url) => photoDeLaCompetition(cid, url))
      .map((url) => effacerVisuelParAdresse(url)),
  );

  // Les feuilles des matchs déjà joués reçoivent le compte (voir
  // `recopierLesComptes`). Une transaction par match, relu à l'instant : la
  // feuille est un tableau, et la console peut être en train de l'écrire.
  if (Object.keys(plan.comptesParLigne).length > 0) {
    const concernes = matchs.filter((d) => recopierLesComptes(d.data() as MatchStocke, plan.comptesParLigne));
    await Promise.all(concernes.map((d) =>
      adminDb.runTransaction(async (tx) => {
        const frais = await tx.get(d.ref);
        if (!frais.exists) return;
        const patch = recopierLesComptes(frais.data() as MatchStocke, plan.comptesParLigne);
        if (patch) tx.update(d.ref, patch);
      }).catch((e) => console.warn("[club-import] feuille non mise à jour", d.id, e)),
    ));
  }

  return {
    added: plan.ajoutes, linked: plan.liens.length, merged: plan.fusionnes, relinked: plan.rattaches,
  };
}
