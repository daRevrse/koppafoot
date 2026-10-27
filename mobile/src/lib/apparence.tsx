import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Appearance } from "react-native";
import { ContexteCouleurs, palettes, type Couleurs, type Schema } from "~/theme";

// ============================================
// Le thème, clair, sombre, ou comme le téléphone.
//
// Le choix se garde sur l'appareil, comme sur le site (localStorage
// « koppafoot:theme ») : un visiteur sans compte y a droit, et l'on ne lit pas
// de la même façon un téléphone dehors et un écran le soir. Sans choix, on suit
// le téléphone, en direct : il passe en sombre à la tombée du jour, l'app aussi.
//
// Le choix est aussi dit au système (Appearance.setColorScheme) : les fenêtres
// de confirmation et le clavier, qui ne nous appartiennent pas, le suivent.
// ============================================

/** Ce que la personne a choisi dans Paramètres. */
export type Preference = "systeme" | Schema;

const CLE = "kf:theme";

/** Ce qui est gardé : seulement un choix explicite ; tout le reste vaut « comme le téléphone ». */
export function preferenceLue(valeur: string | null): Preference {
  return valeur === "clair" || valeur === "sombre" ? valeur : "systeme";
}

/**
 * Le thème affiché. Un téléphone qui ne dit rien (ou une app construite avant
 * que app.json ne laisse passer son réglage) garde le sombre, l'allure de
 * toujours de l'application.
 */
export function schemaAffiche(preference: Preference, systeme: string | null | undefined): Schema {
  if (preference !== "systeme") return preference;
  return systeme === "light" ? "clair" : "sombre";
}

const VERS_LE_SYSTEME = { systeme: "unspecified", clair: "light", sombre: "dark" } as const;

/**
 * Le dit au système AVANT de changer d'état : revenu à « unspecified »,
 * Appearance rend tout de suite le réglage du téléphone, et le rendu qui
 * suit ne passe pas une image par l'ancien thème. Le web n'a pas cette fonction.
 */
function direAuSysteme(p: Preference) {
  Appearance.setColorScheme?.(VERS_LE_SYSTEME[p]);
}

/**
 * La palette en cours hors de React, pour ce qui s'ouvre d'un geste (le
 * navigateur intégré) : Appearance porte le choix depuis direAuSysteme.
 */
export function paletteEnCours(): Couleurs {
  return palettes[schemaAffiche("systeme", Appearance.getColorScheme())];
}

const ecouterLeTelephone = (prevenir: () => void) => {
  const abonnement = Appearance.addChangeListener(prevenir);
  return () => abonnement.remove();
};
const reglageDuTelephone = () => Appearance.getColorScheme();

/**
 * Le réglage du téléphone, en direct : ce que fait useColorScheme de React
 * Native, écrit ici parce que celui de react-native-web garde l'ancienne
 * valeur quand le navigateur bascule (vu dans l'aperçu web).
 */
const useTelephone = () => useSyncExternalStore(ecouterLeTelephone, reglageDuTelephone);

interface EtatApparence {
  /** Le choix a été lu : l'écran de lancement peut se retirer. */
  pret: boolean;
  preference: Preference;
  schema: Schema;
  choisir: (p: Preference) => void;
}

const Contexte = createContext<EtatApparence | null>(null);

export function ApparenceProvider({ children }: { children: ReactNode }) {
  const systeme = useTelephone();
  const [preference, setPreference] = useState<Preference>("systeme");
  const [pret, setPret] = useState(false);

  useEffect(() => {
    // Une lecture qui échoue suit le téléphone : ce n'est pas une raison de rester sur l'écran de lancement.
    AsyncStorage.getItem(CLE)
      .catch(() => null)
      .then((v) => {
        const p = preferenceLue(v);
        direAuSysteme(p);
        setPreference(p);
        setPret(true);
      });
  }, []);

  const choisir = useCallback((p: Preference) => {
    direAuSysteme(p);
    setPreference(p);
    (p === "systeme" ? AsyncStorage.removeItem(CLE) : AsyncStorage.setItem(CLE, p)).catch(() => {
      // Le thème vaut pour cette fois : ce n'est pas une raison de refuser la bascule.
    });
  }, []);

  const schema = schemaAffiche(preference, systeme);
  const valeur = useMemo(() => ({ pret, preference, schema, choisir }), [pret, preference, schema, choisir]);
  return (
    <Contexte.Provider value={valeur}>
      <ContexteCouleurs.Provider value={palettes[schema]}>{children}</ContexteCouleurs.Provider>
    </Contexte.Provider>
  );
}

export function useApparence(): EtatApparence {
  const etat = useContext(Contexte);
  if (!etat) throw new Error("useApparence hors d'ApparenceProvider");
  return etat;
}
