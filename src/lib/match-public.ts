import { cache } from "react";
import { adminDb } from "@/lib/firebase-admin";

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
}

/**
 * Le match, par son id, ou null s'il n'existe pas.
 *
 * `cache` parce que le même document sert deux fois dans le même rendu — le
 * titre puis la description — et qu'une lecture Firestore par balise serait
 * payée sur chaque partage.
 */
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
  async (slug: string, mid: string): Promise<(MatchPublic & { competition: string }) | null> => {
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
      return {
        id: snap.id,
        competition: (compDoc.data() as { name?: string }).name ?? "",
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
        format: "",
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
