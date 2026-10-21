/**
 * La palette de l'application, sombre, partie du fond de l'écran de lancement
 * (SPLASH_FOND, src/config/ios-launch) : on passe du lancement à l'application
 * sans à-coup.
 *
 * DES NOMS DE RÔLE, PAS DE TEINTE. Toute couleur de texte doit se lire sur
 * chacun des trois fonds : __tests__/theme.test.ts l'exige (4,5 au moins).
 */
export const couleurs = {
  fond: "#0d291b",
  surface: "#12352a",
  surfaceHaute: "#184233",
  bordure: "#1f4a38",
  texte: "#F2F7F4",
  texteSecondaire: "#A9C2B4",
  texteDiscret: "#8FB09E",
  primaire: "#34D399",
  /** Le libellé posé sur `primaire` : bouton plein, jour choisi, avatar. */
  surPrimaire: "#0d291b",
  direct: "#FC8181",
  accent: "#FBBF24",
  erreur: "#FCA5A5",
  /** Le disque clair sous un blason : un logo noir (Ligue des champions) disparaît sinon sur le fond. */
  fondEcusson: "#F2F7F4",
} as const;

/** Champs et boutons ; cartes. */
export const rayons = { champ: 10, carte: 14 } as const;

/** Les noms exportés par @expo-google-fonts, chargés dans le layout racine. */
export const polices = {
  titre: "Outfit_800ExtraBold",
  titreMoyen: "Outfit_700Bold",
  texte: "DMSans_400Regular",
  texteMoyen: "DMSans_500Medium",
  texteGras: "DMSans_700Bold",
} as const;
