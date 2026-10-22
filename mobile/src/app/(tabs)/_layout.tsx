import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { couleurs, polices } from "~/theme";

// Un seul onglet aujourd'hui, le Direct : la barre du bas se cache, elle ne
// servirait qu'à montrer où l'on est déjà. Le compte et la cloche sont dans
// l'en-tête (EnTeteOnglet), les compétitions au bout des filtres du Direct.
// La barre reviendra avec un deuxième onglet (Actus, Tribune).
export default function OngletsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: couleurs.primaire,
        tabBarInactiveTintColor: couleurs.texteDiscret,
        // La barre du bas du site : text-[10px] font-semibold leading-tight.
        tabBarLabelStyle: { fontFamily: polices.texteDemi, fontSize: 10, lineHeight: 13 },
        tabBarStyle: { display: "none", backgroundColor: couleurs.fond, borderTopColor: couleurs.bordure },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Direct", tabBarIcon: ({ color, size }) => <Ionicons name="football" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
