/** Les couleurs du site (src/app/globals.css), sous les noms de l'application. */
export const couleurs = {
  primaire: "#059669",
  primaireFonce: "#047857",
  primaireClair: "#10b981",
  accent: "#F59E0B",
  erreur: "#C62828",
  direct: "#EF4444",
  texte: "#111827",
  texteSecondaire: "#4B5563",
  texteDiscret: "#9CA3AF",
  fond: "#FFFFFF",
  fondSecondaire: "#F9FAFB",
  fondTertiaire: "#F3F4F6",
  bordure: "#E5E7EB",
  sombre: "#0B1210",
} as const;

/** Les noms exportés par @expo-google-fonts, chargés dans le layout racine. */
export const polices = {
  titre: "Outfit_800ExtraBold",
  titreMoyen: "Outfit_700Bold",
  texte: "DMSans_400Regular",
  texteMoyen: "DMSans_500Medium",
  texteGras: "DMSans_700Bold",
} as const;
