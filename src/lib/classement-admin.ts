// ============================================
// Server-only. Le classement des joueurs : on le calcule, on le range, on le
// relit.
//
// POURQUOI UN DOCUMENT PLUTOT QU'UN CALCUL A LA LECTURE : le classement lit
// TOUS les matchs terminés de la plateforme et toutes leurs feuilles. Le
// refaire à chaque affichage de l'accueil coûterait cette lecture par
// visiteur, pour un résultat qui ne bouge qu'à la fin d'un match. On le
// calcule donc quand un match se termine, et on le sert tout fait.
//
// C'est aussi ce qui rend la FLÈCHE possible. « Mouvement dans le classement »
// suppose qu'on se souvienne du classement d'avant : sans document, il n'y a
// pas d'avant. Les clés du calcul précédent restent donc à côté du résultat.
// ============================================

import { adminDb } from "@/lib/firebase-admin";
import { estExhibition } from "@/lib/exhibition";
import { getPublicCompetitions } from "@/lib/competition-admin";
import { toCompMatch } from "@/lib/competition-mappers";
import { matchDuration } from "@/lib/competition-format";
import { calculerClassements, fusionnerClassements } from "@/lib/classement";
import type { MatchPourForme } from "@/lib/etat-de-forme";
import type {
  ClassementsPublies, ContributionDirecte, LigneJoueurPubliee, LigneSansCompte, MatchAClasser,
} from "@/lib/classement";
import { normaliserPoste } from "@/lib/postes";
import { lireButeursRenseignes } from "@/lib/buteurs";
import { cleDeLaLigne, cleSansCompte } from "@/lib/photos-sans-compte";
import type { FirestoreCompMatch, FirestoreCompTeam, FirestoreMatch, LineupEntry } from "@/types";

const DOC = "rankings/top_players";

/** La « compétition » sous laquelle un amical passe au calcul (voir `amicalEnCompMatch`). */
const AMICAL = "friendly";

const VIDE: ClassementsPublies = {
  joueurs: [], matchsRetenus: 0, calculeLe: null,
};

/** Un match de la plateforme : de quoi le classer, et de quoi en tirer une forme. */
export type MatchDeLaPlateforme = MatchAClasser & MatchPourForme;

/**
 * Tous les matchs qui comptent : les compétitions de la plateforme, et les
 * amicaux.
 *
 * Pas le football mondial : le fournisseur externe ne donne pas le détail par
 * joueur, et ses matchs n'ont pas de feuille chez nous. Un classement de
 * joueurs togolais n'a de toute façon rien à voir avec la Ligue 1.
 *
 * Chaque match porte aussi sa DURÉE et son LIEN, que le classement ignore et
 * dont l'état de forme a besoin (voir lib/etat-de-forme) : les deux calculs
 * partagent cette lecture, qui est de loin ce qu'ils coûtent de plus cher.
 */
export async function matchsDeLaPlateforme(): Promise<MatchDeLaPlateforme[]> {
  const matchs: MatchDeLaPlateforme[] = [];

  // PAS LES COMPETITIONS D'ENTRAINEMENT. La console leur affiche un bandeau
  // qui promet « aucune statistique n'est comptée », et cette promesse doit
  // tenir ici. `getPublicCompetitions` ne les écarte qu'incidemment, parce
  // qu'elles sont en brouillon : le jour où l'une sort du brouillon, ses buts
  // fictifs entreraient dans un classement public.
  const comps = (await getPublicCompetitions()).filter((c) => !c.isSandbox);
  const parCompetition = await Promise.all(
    comps.map(async (c) => {
      const snap = await adminDb
        .collection("competitions").doc(c.id)
        .collection("comp_matches").where("status", "==", "completed").get();
      const dureeMatchMin = matchDuration(c.format);
      // Un match d'exhibition ne classe personne (voir lib/exhibition).
      const docs = snap.docs.filter((d) => !estExhibition(d.data() as FirestoreCompMatch));
      const comptesDesLignes = await comptesDesEffectifs(c.id, docs.map((d) => d.data() as FirestoreCompMatch));
      return docs.map((d) => ({
        ...toCompMatch(d.id, d.data() as FirestoreCompMatch),
        dureeMatchMin,
        comptesDesLignes,
        lien: `/c/${c.slug}/matches/${d.id}`,
      }));
    }),
  );
  for (const lot of parCompetition) matchs.push(...lot);

  // Les amicaux vivent dans `matches`, à plat, et portent depuis peu la même
  // feuille de match (voir lib/console-pilote).
  //
  // Convertis ICI, et pas par `toMatch` : ce mappeur-là vit dans lib/firestore,
  // qui importe le SDK CLIENT. L'appeler depuis une route serveur tirerait tout
  // le client Firebase avec lui. Le classement ne lit de toute façon qu'une
  // poignée de champs.
  const amicaux = await adminDb
    .collection("matches").where("status", "==", "completed").get();
  for (const d of amicaux.docs) {
    // Un amical ne stocke pas sa durée : la mi-temps réglementaire fait foi,
    // comme dans la console (voir lib/console-pilote).
    matchs.push({ ...amicalEnCompMatch(d.id, d.data() as FirestoreMatch), lien: `/matches/${d.id}`, amical: true });
  }

  return matchs;
}

/**
 * Le compte derrière chaque ligne d'effectif d'une compétition (voir
 * `MatchAClasser.comptesDesLignes`).
 *
 * LUS SEULEMENT S'IL LE FAUT : un camp sans feuille, celui d'un résultat saisi
 * après coup. Les autres matchs portent déjà les comptes sur leur feuille, et
 * ce serait une lecture des équipes par compétition et par recalcul pour rien.
 *
 * Un échec rend un effectif vide : les joueurs nommés sont alors classés à
 * leur nom, ce qui vaut mieux que de ne pas les classer du tout.
 */
async function comptesDesEffectifs(
  cid: string,
  matchs: FirestoreCompMatch[],
): Promise<Record<string, string | null>> {
  const comptes: Record<string, string | null> = {};
  const sansFeuille = matchs.some((m) => !m.home_lineup?.length || !m.away_lineup?.length);
  if (!sansFeuille) return comptes;
  try {
    const equipes = await adminDb.collection("competitions").doc(cid).collection("comp_teams").get();
    for (const e of equipes.docs) {
      for (const p of (e.data() as FirestoreCompTeam).players ?? []) comptes[p.id] = p.user_id ?? null;
    }
  } catch (err) {
    console.error("comptesDesEffectifs failed:", err);
  }
  return comptes;
}

/** La feuille d'un camp, ou son héritage. Voir `FirestoreMatch.home_lineup`. */
function feuille(
  d: FirestoreMatch,
  cote: "home" | "away",
): LineupEntry[] {
  const lignes = cote === "home"
    ? (d.home_lineup ?? d.home_ghost_lineup ?? [])
    : (d.away_lineup ?? d.away_ghost_lineup ?? []);
  return lignes.map((e) => ({
    playerId: e.player_id,
    name: e.name,
    number: e.number,
    role: e.role,
    userId: e.user_id ?? null,
    position: normaliserPoste(e.position),
  }));
}

/**
 * Les buteurs d'un match renseigné après coup.
 *
 * Vide sur un match tenu à la console : celui-là a une feuille et des
 * événements, qui valent mieux.
 */
function contributionsDirectes(d: FirestoreMatch): ContributionDirecte[] {
  return lireButeursRenseignes(d.recorded_scorers).map((b) => ({
    playerId: b.playerId,
    nom: b.nom,
    // `sansCompte` dit exactement ce qu'il dit : l'identifiant n'est alors pas
    // un compte, et le classement retombera sur le nom.
    userId: b.sansCompte ? null : b.playerId,
    buts: b.buts,
    passes: b.passes,
  }));
}

/** Un amical réduit à ce que le calcul du classement lit. */
function amicalEnCompMatch(id: string, d: FirestoreMatch): MatchAClasser {
  return {
    id,
    competitionId: AMICAL,
    status: "completed",
    date: d.date ?? null,
    time: d.time ?? null,
    homeTeamId: d.home_team_id ?? null,
    awayTeamId: d.away_team_id ?? null,
    homeTeamName: d.home_team_name ?? "",
    awayTeamName: d.away_team_name ?? "",
    scoreHome: d.score_home ?? 0,
    scoreAway: d.score_away ?? 0,
    homeLineup: feuille(d, "home"),
    awayLineup: feuille(d, "away"),
    homeOnPitch: d.home_on_pitch ?? [],
    awayOnPitch: d.away_on_pitch ?? [],
    liveState: d.live_state
      ? {
          currentPeriod: d.live_state.current_period,
          timerStartAt: d.live_state.timer_start_at,
          timerOffset: d.live_state.timer_offset,
          isTimerRunning: d.live_state.is_timer_running,
          events: (d.live_state.events ?? []).map((e) => ({
            id: e.id,
            type: e.type,
            period: e.period,
            minute: e.minute,
            teamId: e.team_id,
            playerId: e.player_id,
            playerName: e.player_name,
            detail: e.detail,
            assistPlayerId: e.assist_player_id ?? null,
            assistPlayerName: e.assist_player_name ?? null,
            victimPlayerId: e.victim_player_id ?? null,
            victimPlayerName: e.victim_player_name ?? null,
            outPlayerId: e.out_player_id ?? null,
            outPlayerName: e.out_player_name ?? null,
            varStatus: e.var_status ?? null,
            createdAt: e.created_at,
          })),
        }
      : null,
    contributionsDirectes: contributionsDirectes(d),
  } as unknown as MatchAClasser;
}

/**
 * Les photos de profil des joueurs classés qui ont un compte.
 *
 * RELEVÉES AU CALCUL, PAS À L'AFFICHAGE. Les lire à chaque rendu coûterait
 * jusqu'à cent lectures par minute et par page ; ici, c'est une lecture
 * groupée par match terminé. Une photo changée entre deux matchs attend le
 * suivant : l'ancienne reste valable, chaque envoi ayant son propre fichier
 * (voir lib/storage).
 *
 * Un échec laisse simplement les initiales : le classement se publie quand
 * même.
 */
async function photosDesJoueurs(uids: string[]): Promise<Map<string, string>> {
  const photos = new Map<string, string>();
  if (uids.length === 0) return photos;
  try {
    const docs = await adminDb.getAll(...uids.map((uid) => adminDb.doc(`users/${uid}`)));
    for (const d of docs) {
      const url = d.get("profile_picture_url");
      if (typeof url === "string" && url) photos.set(d.id, url);
    }
  } catch (err) {
    console.error("photosDesJoueurs failed:", err);
  }
  return photos;
}

/**
 * Les photos des joueurs classés SANS COMPTE, par clé de classement.
 *
 * Leur visage n'est pas sur un profil. La ligne de leur feuille la plus
 * récente dit où le chercher (voir `LigneSansCompte`), dans le même ordre que
 * les fiches de match (voir `photoDeLaLigne`) :
 *
 *   - en COMPÉTITION, la photo posée sur la ligne d'effectif, sinon celle de
 *     la fiche du club que l'équipe représente ;
 *   - sur un AMICAL, la ligne est la fiche du club elle-même.
 *
 * Un buteur sans compte d'un match renseigné après coup n'a pas de ligne de
 * feuille : il garde ses initiales jusqu'à son premier match tenu à la console.
 *
 * Même régime que les comptes : relevées au calcul, et un échec laisse les
 * initiales sans empêcher la publication.
 */
async function photosSansCompte(lignes: [string, LigneSansCompte][]): Promise<Map<string, string>> {
  const photos = new Map<string, string>();
  if (lignes.length === 0) return photos;
  try {
    // Les effectifs de compétition d'abord : ils portent la photo de ligne, et
    // le club dont il faudra peut-être lire la fiche.
    const chemin = (l: LigneSansCompte) => `competitions/${l.competitionId}/comp_teams/${l.teamId}`;
    const chemins = [...new Set(
      lignes.filter(([, l]) => l.competitionId !== AMICAL && l.teamId).map(([, l]) => chemin(l)),
    )];
    const equipes = new Map(
      (chemins.length ? await adminDb.getAll(...chemins.map((c) => adminDb.doc(c))) : [])
        .map((d) => [d.ref.path, d.data() as FirestoreCompTeam | undefined]),
    );

    // Pour chacun : la photo déjà posée sur sa ligne, ou la fiche de club
    // (`<club>:<fiche>`, voir lib/photos-sans-compte) où la lire.
    const fiches = new Map<string, string>();
    for (const [cle, l] of lignes) {
      if (l.competitionId === AMICAL) {
        const fiche = cleSansCompte(l.teamId, l.playerId);
        if (fiche) fiches.set(cle, fiche);
        continue;
      }
      const equipe = equipes.get(chemin(l));
      const ligne = equipe?.players?.find((p) => p.id === l.playerId);
      // Une ligne revendiquée depuis le match montre le profil de son compte,
      // que la feuille ne connaît pas : elle garde ses initiales.
      if (!ligne || ligne.user_id) continue;
      if (ligne.photo_url) {
        photos.set(cle, ligne.photo_url);
        continue;
      }
      const fiche = cleDeLaLigne(equipe?.claimed_by_team_id, ligne);
      if (fiche) fiches.set(cle, fiche);
    }

    const aLire = [...new Set(fiches.values())];
    if (aLire.length) {
      // Les deux identifiants d'une clé ont été vérifiés à sa fabrication.
      const docs = await adminDb.getAll(...aLire.map((f) => {
        const [clubId, ghostId] = f.split(":");
        return adminDb.doc(`teams/${clubId}/ghost_players/${ghostId}`);
      }));
      const parFiche = new Map(docs.map((d, i) => [aLire[i], d.get("photo_url") as unknown]));
      for (const [cle, fiche] of fiches) {
        const url = parFiche.get(fiche);
        if (typeof url === "string" && url) photos.set(cle, url);
      }
    }
  } catch (err) {
    console.error("photosSansCompte failed:", err);
  }
  return photos;
}

/**
 * Recalcule et publie. Rendu : ce qui vient d'être écrit.
 *
 * Idempotent : deux appels de suite donnent le même classement. Le second
 * remet en revanche toutes les flèches à zéro, puisqu'il compare le résultat
 * à lui-même — c'est voulu, une flèche dit « depuis la dernière fois », pas
 * « depuis un moment ».
 */
export async function recalculerClassements(
  /** Les matchs déjà lus, quand l'appelant s'en sert aussi (voir lib/formes-admin). */
  dejaLus?: MatchDeLaPlateforme[],
): Promise<ClassementsPublies> {
  const matchs = dejaLus ?? await matchsDeLaPlateforme();
  const { parNote, parContribution, matchsRetenus, lignesSansCompte } = calculerClassements(matchs);

  const ref = adminDb.doc(DOC);
  const avant = (await ref.get()).data() as
    | { cles_note?: string[]; cles_contribution?: string[] }
    | undefined;

  const joueurs = fusionnerClassements(
    { parNote, parContribution },
    { note: avant?.cles_note ?? [], contribution: avant?.cles_contribution ?? [] },
  );
  const [photos, photosDesSansCompte] = await Promise.all([
    photosDesJoueurs(joueurs.flatMap((l) => (l.uid ? [l.uid] : []))),
    photosSansCompte(joueurs.flatMap((l) => {
      const ligne = l.uid ? undefined : lignesSansCompte.get(l.cle);
      return ligne ? [[l.cle, ligne] as [string, LigneSansCompte]] : [];
    })),
  ]);

  const publie: ClassementsPublies = {
    joueurs: joueurs.map((l) => ({
      ...l,
      photo: (l.uid ? photos.get(l.uid) : photosDesSansCompte.get(l.cle)) || null,
    })),
    matchsRetenus,
    calculeLe: new Date().toISOString(),
  };

  // `set` et non `update` : le document est réécrit en entier, et les champs
  // de l'ancien format (deux listes, performances et gardiens) disparaissent
  // avec lui.
  await ref.set({
    joueurs: publie.joueurs,
    matchs_retenus: matchsRetenus,
    // Les clés du calcul qu'on vient de faire, dans l'ordre de chaque tri :
    // ce sont elles qui serviront de « avant » au suivant.
    cles_note: parNote.map((l) => l.cle),
    cles_contribution: parContribution.map((l) => l.cle),
    calcule_le: publie.calculeLe,
  });

  return publie;
}

/** Une tentative d'amorçage par instance et par quart d'heure, au plus. */
let derniereTentative = 0;

/**
 * Le classement publié, pour l'affichage.
 *
 * Dégrade en classement vide plutôt que de lever : une page d'accueil ne doit
 * pas tomber parce qu'un classement manque. Le composant montre alors son
 * message d'attente.
 *
 * L'ANCIEN FORMAT SE RECALCULE UNE FOIS. Le document ne se réécrit qu'à la
 * fin d'un match : sans ce rattrapage, le classement resterait vide entre la
 * mise en service et le prochain coup de sifflet final. La tentative est
 * bornée — une par instance et par quart d'heure —, pour qu'un échec ne se
 * paie pas à chaque visite.
 */
export async function lireClassements(): Promise<ClassementsPublies> {
  try {
    const snap = await adminDb.doc(DOC).get();
    const d = snap.exists ? snap.data() ?? {} : null;
    if (!d || !Array.isArray(d.joueurs)) {
      if (Date.now() - derniereTentative < 15 * 60_000) return VIDE;
      derniereTentative = Date.now();
      return await recalculerClassements();
    }
    return {
      joueurs: d.joueurs as LigneJoueurPubliee[],
      matchsRetenus: (d.matchs_retenus ?? 0) as number,
      calculeLe: (d.calcule_le ?? null) as string | null,
    };
  } catch (err) {
    console.error("lireClassements failed:", err);
    return VIDE;
  }
}
