import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { couleurs, polices } from "~/theme";

// Deux onglets aujourd'hui : on ne montre que ce qui existe. Compétitions et
// Tribune viendront avec leurs lots.
export default function OngletsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: couleurs.primaire,
        tabBarInactiveTintColor: couleurs.texteDiscret,
        tabBarLabelStyle: { fontFamily: polices.texteMoyen, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Direct", tabBarIcon: ({ color, size }) => <Ionicons name="football" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="compte"
        options={{ title: "Compte", tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
