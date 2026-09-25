import { cache } from "react";
import { adminDb } from "@/lib/firebase-admin";
import { buteursDuMatch, buteursRenseignes, type ButeursDuMatch } from "@/lib/buteurs";
import type { CompMatchRound, FirestoreMatch, FirestoreRecordedScorer } from "@/types";

// ============================================
// Ce qu'un match montre AVANT que le navigateur exécute quoi que ce soit.
//
// POURQUOI PAS `toMatch` DE lib/firestore. Ce mapper-là vit dans un module
// qui importe le SDK web de Firebase ; s'en servir depuis le serveur ferait
// entrer tout le SDK client dans le rendu d'un titre et d'une image. On lit
// donc directement, avec le SDK admin, et on ne prend que ce qui se voit
// dans un aperçu de lien — pas la feuille de match, pas les événements.
//
// MÊME RAISON QUE getCompetitionLanding : un lien collé dans WhatsApp
// n'obtient un titre, une phrase et une vignette que si le HTML les porte
// avant tout JavaScript. La fiche du match, elle, reste un composant client.
// ============================================

export interface MatchPublic {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  status: string;
  scoreHome: number | null;
  scoreAway: number | null;
  date: string;
  time: string;
  venueName: string;
  venueCity: string;
  format: string;
  /** L'écusson des deux camps, recopié sur le match (voir FirestoreMatch). */
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  /**
   * LA BANNIÈRE, QUAND L'ORGANISATEUR EN A POSÉ UNE.
   *
   * C'est elle qu'on partage quand elle existe : quelqu'un l'a choisie pour
   * CETTE affiche, et une image choisie bat une image calculée. L'affiche
   * dessinée reste le repli, pour les matchs — la grande majorité — qui n'en
   * ont pas.
   *
   * Seuls les matchs de compétition en portent une aujourd'hui : le champ est
   * lu des deux côtés pour que la règle n'ait qu'une écriture, et le jour où
   * un amical peut recevoir une bannière, il n'y a rien à rebrancher.
   */
  bannerUrl: string | null;
  /**
   * Les buteurs de chaque camp, pour le flyer SCORE FINAL. Même calcul que
   * sous le tableau d'affichage de la fiche, pour que l'image et la page
   * disent la même chose.
   */
  buteurs: ButeursDuMatch;
  /** Les tirs au but, quand le match s'y est joué. */
  penaltyHome: number | null;
  penaltyAway: number | null;
}

/** Ce qu'un match de compétition ajoute : de quoi en habiller l'affiche. */
export interface CompMatchPublic extends MatchPublic {
  competition: string;
  /** Le logo de la compétition, filtré comme la bannière. */
  competitionLogo: string | null;
  /** « Groupe A », « Quart de finale » ; vide quand le match n'a ni l'un ni l'autre. */
  etape: string;
}

type EvenementBrut = NonNullable<FirestoreMatch["live_state"]>["events"][number];

/**
 * Les buteurs, depuis les événements bruts du document.
 *
 * Seuls les champs que lit `buteursDuMatch` sont convertis : le convertisseur
 * complet vit dans lib/firestore, qui tire le SDK web.
 */
function buteursDesEvenements(
  evenements: EvenementBrut[] | undefined,
  homeTeamId: string | null,
  nomDe?: (e: { teamId: string; playerName?: string }) => string,
): ButeursDuMatch {
  const evts = (evenements ?? []).map((e) => ({
    type: e.type,
    minute: e.minute,
    teamId: e.team_id,
    playerName: e.player_name,
    detail: e.detail,
    varStatus: e.var_status ?? null,
  }));
  return buteursDuMatch(evts, homeTeamId, nomDe);
}

/**
 * Les buteurs d'un amical, avec les deux règles de sa fiche.
 *
 * UN MATCH RENSEIGNÉ n'a pas de direct : ses buteurs sont ceux que la saisie a
 * nommés, tous du camp qui l'a saisie.
 *
 * FACE À UNE ÉQUIPE HORS PLATEFORME, ses « Joueur 9 » ne nomment personne :
 * c'est le nom du club qui marque, comme sur la fiche (voir matches/[id]).
 */
function buteursDUnAmical(d: Partial<FirestoreMatch>): ButeursDuMatch {
  if (d.recorded_at) {
    const saisis = (d.recorded_scorers ?? []).map((r: FirestoreRecordedScorer) => ({
      playerId: r.player_id,
      sansCompte: r.sansCompte,
      nom: r.nom,
      buts: r.buts,
      passes: r.passes,
    }));
    return buteursRenseignes(saisis, d.is_home ? "home" : "away");
  }

  const horsPlateforme = !d.away_manager_id;
  const fantomeADomicile = horsPlateforme && !d.is_home;
  const idFantome = horsPlateforme ? (fantomeADomicile ? d.home_team_id : d.away_team_id) : null;
  const nomDuFantome = (fantomeADomicile ? d.home_team_name : d.away_team_name) ?? "";

  return buteursDesEvenements(d.live_state?.events, d.home_team_id ?? null, (e) =>
    idFantome && e.teamId === idFantome ? nomDuFantome : e.playerName ?? "");
}

/** Les tours d'une phase finale, dits comme dans le calendrier. */
const TOURS: Record<CompMatchRound, string> = {
  round_of_16: "8es de finale",
  quarter: "Quart de finale",
  semi: "Demi-finale",
  final: "Finale",
  third_place: "Petite finale",
};

/**
 * Le match, par son id, ou null s'il n'existe pas.
 *
 * `cache` parce que le même document sert deux fois dans le même rendu — le
 * titre puis la description — et qu'une lecture Firestore par balise serait
 * payée sur chaque partage.
 */
/**
 * Les seuls hôtes d'où l'on accepte une bannière.
 *
 * MÊME RAISON QUE LE JOKER RETIRÉ DE next.config.ts. `banner_url` est un
 * champ de document, et deux surfaces du serveur vont le CHERCHER : Satori,
 * qui télécharge le `<img src>` de l'affiche d'aperçu, et la route qui sert
 * l'image à partager. Une adresse arbitraire dans ce champ ferait donc
 * émettre à notre serveur une requête vers où l'on veut — un service interne,
 * une adresse de métadonnées d'instance — et nous rendrait le corps de la
 * réponse. Les deux hôtes ci-dessous sont ceux du Storage du projet, les
 * seuls que `uploadMatchBanner` puisse produire.
 *
 * Filtré ICI, à la lecture, et pas chez chaque appelant : c'est le seul
 * endroit par où le champ entre dans le produit.
 */
const HOTES_BANNIERE = new Set([
  "firebasestorage.googleapis.com",
  "koppafoot.firebasestorage.app",
]);

function banniereSure(valeur: unknown): string | null {
  if (typeof valeur !== "string" || !valeur) return null;
  try {
    const u = new URL(valeur);
    return u.protocol === "https:" && HOTES_BANNIERE.has(u.hostname) ? valeur : null;
  } catch {
    return null;
  }
}

export const getMatchPublic = cache(async (id: string): Promise<MatchPublic | null> => {
  try {
    const snap = await adminDb.collection("matches").doc(id).get();
    if (!snap.exists) return null;
    const d = snap.data() ?? {};
    return {
      id: snap.id,
      homeTeamName: d.home_team_name ?? "",
      awayTeamName: d.away_team_name ?? "",
      status: d.status ?? "upcoming",
      scoreHome: d.score_home ?? null,
      scoreAway: d.score_away ?? null,
      date: d.date ?? "",
      time: d.time ?? "",
      venueName: d.venue_name ?? "",
      venueCity: d.venue_city ?? "",
      format: d.format ?? "",
      homeTeamLogo: d.home_team_logo ?? null,
      awayTeamLogo: d.away_team_logo ?? null,
      bannerUrl: banniereSure(d.banner_url),
      buteurs: buteursDUnAmical(d as Partial<FirestoreMatch>),
      penaltyHome: d.penalty_home ?? null,
      penaltyAway: d.penalty_away ?? null,
    };
  } catch (err) {
    // Un aperçu manquant vaut mieux qu'une page en 500 : l'appelant retombe
    // sur le titre et l'image par défaut du produit.
    console.error("getMatchPublic failed:", err);
    return null;
  }
});

/**
 * Le match d'une compétition, par le slug de celle-ci et l'id du match.
 *
 * C'EST CELUI-LÀ QU'ON PARTAGE. La collection `matches` porte les amicaux ;
 * les rencontres qui existent vraiment aujourd'hui vivent dans
 * `competitions/<id>/comp_matches`, et c'est leur adresse — /c/<slug>/matches
 * /<mid> — qui circule. Même forme de retour que ci-dessus pour que le titre,
 * la phrase et l'affiche s'écrivent une seule fois.
 */
export const getCompMatchPublic = cache(
  async (slug: string, mid: string): Promise<CompMatchPublic | null> => {
    try {
      const comps = await adminDb
        .collection("competitions")
        .where("slug", "==", slug)
        .limit(1)
        .get();
      if (comps.empty) return null;

      const compDoc = comps.docs[0];
      // Une compétition en brouillon n'est pas publique : en annoncer les
      // affiches reviendrait à divulguer un événement non annoncé.
      if ((compDoc.data() as { status?: string }).status === "draft") return null;

      const snap = await compDoc.ref.collection("comp_matches").doc(mid).get();
      if (!snap.exists) return null;

      const d = snap.data() ?? {};
      const comp = compDoc.data() as { name?: string; logo_url?: string | null };
      return {
        id: snap.id,
        competition: comp.name ?? "",
        // MÊME FILTRE QUE LA BANNIÈRE, pour la même raison : le flyer pose ce
        // logo dans un `<img>` que Satori va télécharger depuis le serveur.
        competitionLogo: banniereSure(comp.logo_url),
        etape: d.group ? `Groupe ${d.group}` : d.round ? (TOURS[d.round as CompMatchRound] ?? "") : "",
        homeTeamName: d.home_team_name ?? "",
        awayTeamName: d.away_team_name ?? "",
        status: d.status ?? "scheduled",
        scoreHome: d.score_home ?? null,
        scoreAway: d.score_away ?? null,
        date: d.date ?? "",
        time: d.time ?? "",
        venueName: d.venue_name ?? "",
        venueCity: d.venue_city ?? "",
        // Une compétition dénormalise déjà l'écusson sur ses matchs, c'est
        // même ce que resynchronise scripts/backfill-match-logos.ts.
        homeTeamLogo: d.home_team_logo ?? null,
        awayTeamLogo: d.away_team_logo ?? null,
        bannerUrl: banniereSure(d.banner_url),
        format: "",
        buteurs: buteursDesEvenements(d.live_state?.events, d.home_team_id ?? null),
        penaltyHome: d.penalty_home ?? null,
        penaltyAway: d.penalty_away ?? null,
      };
    } catch (err) {
      console.error("getCompMatchPublic failed:", err);
      return null;
    }
  },
);

/** L'affiche, telle qu'on l'annonce. */
export function afficheDuMatch(m: MatchPublic): string {
  return `${m.homeTeamName} — ${m.awayTeamName}`;
}

/**
 * La phrase qui accompagne le lien.
 *
 * Elle suit l'état du match, comme le texte du bouton Partager : avant le
 * coup d'envoi on donne le rendez-vous, pendant on donne le score, après on
 * donne le résultat. Un texte unique obligerait à ouvrir le lien rien que
 * pour savoir s'il est encore temps de venir.
 */
export function phraseDuMatch(m: MatchPublic): string {
  const score = `${m.scoreHome ?? 0} - ${m.scoreAway ?? 0}`;
  const ou = [m.venueName, m.venueCity].filter(Boolean).join(", ");

  if (m.status === "live") return `En direct : ${score}. Suis la rencontre sur KoppaFoot.`;
  if (m.status === "completed") return `Score final : ${score}.${ou ? ` ${ou}.` : ""}`;
  if (m.status === "cancelled") return "Rencontre annulée.";

  const quand = [m.date, m.time].filter(Boolean).join(" à ");
  return `${quand ? `${quand}.` : ""}${ou ? ` ${ou}.` : ""} Suis le match en direct sur KoppaFoot.`.trim();
}
