import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  EMPTY_COUNTS, VOIX_DE_BASE, pourcentages, type Pick, type PredictionCounts,
} from "@/lib/pronostics-shared";

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

// Les issues, les comptes et leur part vivent dans lib/pronostics-shared,
// partagé avec l'application mobile.
export { EMPTY_COUNTS, VOIX_DE_BASE, pourcentages, type Pick, type PredictionCounts };


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
