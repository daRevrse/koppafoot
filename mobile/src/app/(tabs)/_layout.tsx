import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { couleurs, polices } from "~/theme";

// Trois onglets : on ne montre que ce qui existe. La Tribune viendra avec son lot.
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
        name="competitions"
        options={{ title: "Compétitions", tabBarIcon: ({ color, size }) => <Ionicons name="trophy-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="compte"
        options={{ title: "Compte", tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
