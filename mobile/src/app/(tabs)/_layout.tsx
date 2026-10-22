import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { useAuth } from "~/lib/auth";
import { titreDeLOnglet } from "~/lib/roles";
import { couleurs, polices } from "~/theme";

// La barre du bas : Direct, Actus, Évolution, Espace casquette. Seul le
// Direct a son contenu ; les trois autres n'ont encore que leur en-tête. Le
// compte et la cloche sont dans l'en-tête (EnTeteOnglet), les compétitions au
// bout des filtres du Direct.
/** L'icône de l'onglet Évolution : la courbe sans rôle, puis celle du rôle. */
const ICONE_DU_ROLE: Record<string, ComponentProps<typeof Ionicons>["name"]> = {
  player: "person-outline", manager: "briefcase-outline", referee: "flag-outline",
};

export default function OngletsLayout() {
  // L'onglet Évolution prend le nom du rôle une fois choisi (lib/roles).
  const { profil } = useAuth();
  const iconeEvolution = ICONE_DU_ROLE[profil?.evolutionRole ?? ""] ?? "trending-up-outline";
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: couleurs.primaire,
        tabBarInactiveTintColor: couleurs.texteDiscret,
        // La barre du bas du site : text-[10px] font-semibold leading-tight.
        tabBarLabelStyle: { fontFamily: polices.texteDemi, fontSize: 10, lineHeight: 13 },
        tabBarStyle: { backgroundColor: couleurs.fond, borderTopColor: couleurs.bordure },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Direct", tabBarIcon: ({ color, size }) => <Ionicons name="football" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="actus"
        options={{ title: "Actus", tabBarIcon: ({ color, size }) => <Ionicons name="newspaper-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="evolution"
        options={{ title: titreDeLOnglet(profil), tabBarIcon: ({ color, size }) => <Ionicons name={iconeEvolution} color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="espace"
        options={{ title: "Espace casquette", tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
