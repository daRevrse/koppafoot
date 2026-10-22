import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { couleurs, polices } from "~/theme";

// La barre du bas : Direct, Actus, Évolution, Espace casquette. Seul le
// Direct a son contenu ; les trois autres n'ont encore que leur en-tête. Le
// compte et la cloche sont dans l'en-tête (EnTeteOnglet), les compétitions au
// bout des filtres du Direct.
export default function OngletsLayout() {
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
        options={{ title: "Évolution", tabBarIcon: ({ color, size }) => <Ionicons name="trending-up-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="espace"
        options={{ title: "Espace casquette", tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
