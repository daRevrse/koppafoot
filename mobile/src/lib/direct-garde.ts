import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CompetitionFeed } from "@/lib/direct-shared";

// Le dernier tableau reçu, gardé sur le téléphone. Le Direct s'ouvre dessus sans
// attendre le réseau, et reste lisible sans connexion : pour ce public, le réseau
// manque souvent, et le forfait compte. Firestore n'aide pas ici : en React Native,
// son cache ne vit qu'en mémoire.

const CLE = "koppafoot:direct";

/** Au-delà, ce tableau ne raconte plus aujourd'hui : mieux vaut dire qu'on n'a rien. */
export const VALIDITE_DU_DIRECT_GARDE = 3 * 24 * 60 * 60 * 1000;

export interface DirectGarde {
  board: CompetitionFeed[];
  /** Quand le réseau l'a donné, en millisecondes. */
  majA: number;
}

/** Ne lève pas : un tableau illisible ou trop vieux, c'est comme pas de tableau. */
export async function lireDirectGarde(maintenant = Date.now()): Promise<DirectGarde | null> {
  try {
    const brut = await AsyncStorage.getItem(CLE);
    if (!brut) return null;
    const { board, majA } = JSON.parse(brut) as Partial<DirectGarde>;
    if (!Array.isArray(board) || typeof majA !== "number") return null;
    return maintenant - majA > VALIDITE_DU_DIRECT_GARDE ? null : { board, majA };
  } catch {
    return null;
  }
}

/** Ne lève pas non plus : un tableau pas gardé n'empêche rien. */
export async function garderDirect(board: CompetitionFeed[], majA: number): Promise<void> {
  await AsyncStorage.setItem(CLE, JSON.stringify({ board, majA })).catch(() => {});
}
