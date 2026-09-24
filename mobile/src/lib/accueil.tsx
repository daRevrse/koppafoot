import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Href } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const CLE = "kf:accueil:vu";

/** Une lecture qui échoue remontre l'accueil : trois écrans de trop valent mieux qu'un plantage. */
export async function accueilDejaVu(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CLE)) === "1";
  } catch {
    return false;
  }
}

export async function marquerAccueilVu(): Promise<void> {
  try {
    await AsyncStorage.setItem(CLE, "1");
  } catch {
    // Au pire, l'accueil se remontrera au prochain lancement.
  }
}

interface EtatAccueil {
  pret: boolean;
  vu: boolean;
  /** Où aller juste après l'accueil (« J'ai déjà un compte » → /connexion). */
  suite: Href | null;
  terminer: (suite?: Href) => void;
  oublierSuite: () => void;
}

const Contexte = createContext<EtatAccueil | null>(null);

export function AccueilProvider({ children }: { children: ReactNode }) {
  const [pret, setPret] = useState(false);
  const [vu, setVu] = useState(false);
  const [suite, setSuite] = useState<Href | null>(null);

  useEffect(() => {
    accueilDejaVu().then((v) => {
      setVu(v);
      setPret(true);
    });
  }, []);

  const terminer = useCallback((s?: Href) => {
    setSuite(s ?? null);
    setVu(true);
    void marquerAccueilVu();
  }, []);
  const oublierSuite = useCallback(() => setSuite(null), []);

  const valeur = useMemo(() => ({ pret, vu, suite, terminer, oublierSuite }), [pret, vu, suite, terminer, oublierSuite]);
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useAccueil(): EtatAccueil {
  const etat = useContext(Contexte);
  if (!etat) throw new Error("useAccueil hors d'AccueilProvider");
  return etat;
}
