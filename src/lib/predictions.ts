import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ============================================
// Pronostics « qui va gagner ? ».
//
// Un compte, un match, un pronostic, et c'est l'identifiant du document qui
// le garantit : `${matchId}__${uid}`. Pas de requête de vérification, pas de
// course entre deux onglets ouverts, et la règle Firestore n'a qu'une égalité
// à contrôler.
//
// Le vote s'écrit depuis le navigateur (comme les shortlists ou les notes de
// joueur), mais les TOTAUX se lisent par /api/matches/[mid]/predictions : les
// règles ferment la collection à son auteur, donc personne ne peut parcourir
// les votes des autres. On publie un résultat, pas un dépouillement nominatif.
// ============================================

export type Pick = "home" | "draw" | "away";

export interface PredictionCounts {
  home: number;
  draw: number;
  away: number;
  total: number;
}

export const EMPTY_COUNTS: PredictionCounts = { home: 0, draw: 0, away: 0, total: 0 };

/**
 * Les pourcentages affiches, avec une voix d'office par issue.
 *
 * Sans elle, le premier votant envoie son camp a 100% et les deux autres a
 * 0%. Un match nul « impossible » parce qu'une personne a clique, ce n'est
 * pas un pronostic, c'est un artefact d'arrondi. Les trois voix de base
 * amortissent les tout premiers votes et disparaissent dans le bruit des
 * suivants.
 *
 * Elles ne comptent QUE pour les pourcentages : le nombre de pronostics
 * annonce reste le vrai, sans quoi on afficherait trois votes fantomes sur
 * un match que personne n'a encore joue.
 */
export const VOIX_DE_BASE = 1;

export function pourcentages(counts: PredictionCounts): { home: number; draw: number; away: number } {
  const h = counts.home + VOIX_DE_BASE;
  const n = counts.draw + VOIX_DE_BASE;
  const a = counts.away + VOIX_DE_BASE;
  const total = h + n + a;
  return {
    home: Math.round((h / total) * 100),
    draw: Math.round((n / total) * 100),
    away: Math.round((a / total) * 100),
  };
}

const predictionId = (matchId: string, uid: string) => `${matchId}__${uid}`;

/** Le pronostic de ce compte sur ce match, ou null s'il n'a pas voté. */
export async function getMyPrediction(matchId: string, uid: string): Promise<Pick | null> {
  try {
    const snap = await getDoc(doc(db, "match_predictions", predictionId(matchId, uid)));
    if (!snap.exists()) return null;
    const pick = (snap.data() as { pick?: string }).pick;
    return pick === "home" || pick === "draw" || pick === "away" ? pick : null;
  } catch {
    return null;
  }
}

/**
 * Dépose ou change le pronostic. `merge` plutôt qu'un update : le premier vote
 * crée le document, les suivants le remplacent, sans que l'appelant ait à
 * savoir lequel des deux cas il est en train de vivre.
 */
export async function castPrediction(matchId: string, uid: string, pick: Pick): Promise<void> {
  await setDoc(
    doc(db, "match_predictions", predictionId(matchId, uid)),
    {
      match_id: matchId,
      uid,
      pick,
      updated_at: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Les totaux publics, comptés côté serveur. */
export async function fetchCounts(matchId: string): Promise<PredictionCounts> {
  try {
    // `no-store` : la route pose un cache de dix secondes pour absorber les
    // rafales de rechargement. Utile pour un visiteur, néfaste juste après un
    // vote — on relirait le total d'avant, et l'auteur du vote croirait que
    // rien n'a été pris en compte.
    const res = await fetch(`/api/matches/${encodeURIComponent(matchId)}/predictions`, {
      cache: "no-store",
    });
    if (!res.ok) return EMPTY_COUNTS;
    const d = (await res.json()) as Partial<PredictionCounts>;
    return {
      home: d.home ?? 0,
      draw: d.draw ?? 0,
      away: d.away ?? 0,
      total: d.total ?? 0,
    };
  } catch {
    return EMPTY_COUNTS;
  }
}
