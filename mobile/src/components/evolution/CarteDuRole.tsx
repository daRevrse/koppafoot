import { Image } from "expo-image";
import { useEffect, useState, type ReactNode } from "react";
import { Animated, Easing, Platform, StyleSheet, View } from "react-native";
import type { EvolutionRole } from "@/types";
import { AFFICHES } from "~/components/evolution/affiches";
import { PRESENTATION } from "~/lib/pile-des-roles";
import { ROLES } from "~/lib/roles";

/** Ce que la face cachée dit aux lecteurs d'écran : rien. */
const CACHEE = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants", "aria-hidden": true } as const;

/**
 * La carte d'un rôle : sa face porte l'affiche du rôle (celle du site), sur
 * le fond et dans le cadre de sa couleur ; son dos, le formulaire
 * d'activation. Elle se retourne d'un demi-tour (450 ms), d'un coup quand le
 * téléphone demande moins de mouvement. La face qu'on ne voit pas est retirée
 * de l'accessibilité.
 */
export function CarteDuRole({ role, retournee, mouvementReduit, dos }: {
  role: EvolutionRole;
  retournee: boolean;
  mouvementReduit: boolean;
  dos: ReactNode;
}) {
  const [rotation] = useState(() => new Animated.Value(retournee ? 1 : 0));
  const { carte, accentSombre } = PRESENTATION[role].couleurs;
  const nom = (ROLES.find((r) => r.role === role) ?? ROLES[0]).titre[0].toLowerCase();

  useEffect(() => {
    const cible = retournee ? 1 : 0;
    if (mouvementReduit) {
      rotation.setValue(cible);
      return;
    }
    const animation = Animated.timing(rotation, {
      toValue: cible,
      duration: 450,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [retournee, mouvementReduit, rotation]);

  const face = rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const arriere = rotation.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });

  return (
    <View style={styles.carte}>
      <Animated.View
        style={[styles.cote, { backgroundColor: carte, borderColor: accentSombre, transform: [{ perspective: 1200 }, { rotateY: face }] }]}
        pointerEvents={retournee ? "none" : "auto"}
        {...(retournee ? CACHEE : {})}
      >
        <Image
          source={AFFICHES[role]}
          style={styles.affiche}
          contentFit="cover"
          accessible
          accessibilityRole="image"
          accessibilityLabel={`Affiche du rôle ${nom}`}
        />
      </Animated.View>
      <Animated.View
        style={[styles.cote, { borderColor: accentSombre, transform: [{ perspective: 1200 }, { rotateY: arriere }] }]}
        pointerEvents={retournee ? "auto" : "none"}
        {...(retournee ? {} : CACHEE)}
      >
        {dos}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { flex: 1 },
  cote: {
    position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
    borderRadius: 12, borderWidth: 2, overflow: "hidden", backfaceVisibility: "hidden",
  },
  affiche: { flex: 1 },
});
