import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Platform, ScrollView, StyleSheet, TextInput, View, type ScrollViewProps } from "react-native";
import { margeSousLeClavier, remonteePourLeChamp } from "~/lib/clavier";

/**
 * Un ScrollView dont le contenu reste atteignable au-dessus du clavier.
 *
 * ANDROID NE FAIT PLUS RIEN TOUT SEUL. En affichage bord à bord, `adjustResize`
 * ne redimensionne plus l'écran : le champ qu'on remplit passait sous le clavier,
 * et le bouton du formulaire devenait inatteignable. L'écran se réduit donc ici
 * à l'ouverture du clavier, puis fait remonter le champ. D'un champ à l'autre,
 * clavier ouvert, Android l'amène de lui-même dans la partie visible.
 *
 * L'iPhone garde ce que l'écran lui demande : `KeyboardAvoidingView`,
 * `automaticallyAdjustKeyboardInsets`.
 */
export function DefilementClavier({
  onLayout, onScroll, scrollEventThrottle = 16, keyboardShouldPersistTaps = "handled", children, ...reste
}: ScrollViewProps) {
  const cadre = useRef<View>(null);
  const defilement = useRef<ScrollView>(null);
  const decalage = useRef(0);
  const margeActuelle = useRef(0);
  // Le haut du clavier, le temps que l'écran réduit soit en place : avant, il n'a pas de quoi défiler.
  const aRamener = useRef<number | null>(null);
  const [marge, setMarge] = useState(0);

  const ramenerLeChamp = useCallback((hautDuClavier: number) => {
    TextInput.State.currentlyFocusedInput()?.measureInWindow((_x, y, _largeur, hauteur) => {
      const remontee = remonteePourLeChamp(y + hauteur, hautDuClavier);
      if (remontee > 0) defilement.current?.scrollTo({ y: decalage.current + remontee });
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const ouverture = Keyboard.addListener("keyboardDidShow", (e) => {
      const hautDuClavier = e.endCoordinates.screenY;
      cadre.current?.measureInWindow((_x, y, _largeur, hauteur) => {
        const voulue = margeSousLeClavier(y + hauteur, hautDuClavier);
        if (voulue === margeActuelle.current) {
          ramenerLeChamp(hautDuClavier);
          return;
        }
        margeActuelle.current = voulue;
        aRamener.current = hautDuClavier;
        setMarge(voulue);
      });
    });
    const fermeture = Keyboard.addListener("keyboardDidHide", () => {
      margeActuelle.current = 0;
      aRamener.current = null;
      setMarge(0);
    });
    return () => {
      ouverture.remove();
      fermeture.remove();
    };
  }, [ramenerLeChamp]);

  return (
    <View ref={cadre} collapsable={false} style={[styles.cadre, { paddingBottom: marge }]}>
      <ScrollView
        {...reste}
        ref={defilement}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        scrollEventThrottle={scrollEventThrottle}
        onScroll={(e) => {
          decalage.current = e.nativeEvent.contentOffset.y;
          onScroll?.(e);
        }}
        onLayout={(e) => {
          onLayout?.(e);
          if (aRamener.current === null) return;
          ramenerLeChamp(aRamener.current);
          aRamener.current = null;
        }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: { flex: 1 },
});
