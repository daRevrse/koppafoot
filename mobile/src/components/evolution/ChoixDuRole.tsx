import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, type ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { EvolutionRole } from "@/types";
import { DosDeLaCarte } from "~/components/evolution/DosDeLaCarte";
import { useAuth } from "~/lib/auth";
import { nomDuRole, ROLES } from "~/lib/roles";
import { creerStyles, espacement, polices, useCouleurs } from "~/theme";

const ICONE: Record<EvolutionRole, ComponentProps<typeof Ionicons>["name"]> = {
  player: "person-outline",
  manager: "briefcase-outline",
  referee: "flag-outline",
};

/**
 * Le choix du rôle (ChoixDuRole du site) : trois cartes — joueur, manager,
 * arbitre —, puis le formulaire du rôle choisi (DosDeLaCarte). Sans compte,
 * une carte mène à l'inscription.
 */
export function ChoixDuRole() {
  const styles = useStyles();
  const couleurs = useCouleurs();
  const router = useRouter();
  const { utilisateur, profil } = useAuth();
  const [choisi, setChoisi] = useState<EvolutionRole | null>(null);

  if (choisi) return <DosDeLaCarte role={choisi} onRetour={() => setChoisi(null)} />;

  return (
    <View style={styles.colonne}>
      <Text style={styles.intro}>
        {utilisateur ? "Choisis ton rôle sur KoppaFoot." : "Joueur, manager, arbitre : crée ton compte pour choisir ton rôle."}
      </Text>
      {ROLES.map((r) => (
        <Pressable
          key={r.role}
          accessibilityRole="button"
          onPress={() => {
            if (!utilisateur) {
              router.push({ pathname: "/connexion", params: { raison: "role" } });
              return;
            }
            setChoisi(r.role);
          }}
          style={({ pressed }) => [styles.carte, pressed && styles.presse]}
        >
          <View style={styles.icone}>
            <Ionicons name={ICONE[r.role]} size={22} color={couleurs.primaire} />
          </View>
          <View style={styles.textes}>
            <Text style={styles.titre}>{nomDuRole(r.titre, profil?.gender).toUpperCase()}</Text>
            <Text style={styles.phrase}>{r.phrase}</Text>
          </View>
          <Text style={styles.choisir}>CHOISIR</Text>
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = creerStyles((couleurs) => ({
  colonne: { gap: 14, padding: 16 },
  intro: { fontFamily: polices.texte, fontSize: 14, color: couleurs.texteSecondaire },
  carte: {
    flexDirection: "row", alignItems: "center", gap: 14, padding: 16,
    backgroundColor: couleurs.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure,
  },
  presse: { backgroundColor: couleurs.surfaceHaute },
  icone: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: couleurs.primaireVoile },
  textes: { flex: 1, minWidth: 0, gap: 3 },
  titre: { fontFamily: polices.titre, fontSize: 18, color: couleurs.texte },
  phrase: { fontFamily: polices.texte, fontSize: 13, color: couleurs.texteSecondaire },
  choisir: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12), color: couleurs.primaire },
}));
