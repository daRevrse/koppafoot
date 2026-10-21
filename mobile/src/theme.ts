/**
 * La palette de l'application : le thème sombre du site, tel quel
 * (src/styles/dark.css). Un noir à peine teinté de vert, et l'écran de
 * lancement le peint déjà (app.json).
 *
 * DES NOMS DE RÔLE, PAS DE TEINTE. Toute couleur de texte doit se lire sur
 * chacun des trois fonds : __tests__/theme.test.ts l'exige (4,5 au moins).
 */
export const couleurs = {
  /** --k-bg */
  fond: "#080d0b",
  /** --k-surface : les lignes de match, les champs, les cartes. */
  surface: "#101714",
  /** --k-surface-2 : l'en-tête d'une compétition, les pastilles au repos. */
  surfaceHaute: "#16201c",
  /** --k-border */
  bordure: "#26322e",
  /** --k-border-fort : le champ au focus, comme sur le site (pas de vert). */
  bordureForte: "#3b4a45",
  /** --k-ink-900 */
  texte: "#eef3f0",
  /** --k-ink-600 */
  texteSecondaire: "#b7c1bc",
  /** --k-ink-400 */
  texteDiscret: "#7f8a85",
  /** text-emerald-600 en sombre : liens, onglet actif, souligné du jour. */
  primaire: "#34d399",
  /** Le fond vert pâle d'une pastille active, d'un avatar (bg-emerald-50 en sombre). */
  primaireVoile: "rgba(16,185,129,0.12)",
  /** Le bouton qui engage : bg-gray-900 en sombre. */
  bouton: "#047857",
  surBouton: "#ffffff",
  /** Le bouton d'un geste qui détruit (supprimer son compte), le rouge du site. */
  boutonDanger: "#b91c1c",
  /** red-400 : le red-500 du site ne fait que 4,4 sur surfaceHaute. */
  direct: "#f87171",
  directVoile: "rgba(239,68,68,0.12)",
  accent: "#FBBF24",
  erreur: "#FCA5A5",
  /** Le disque clair sous un blason : un logo noir (Ligue des champions) disparaît sinon sur le fond. */
  fondEcusson: "#eef3f0",
} as const;

/** Les noms exportés par @expo-google-fonts, chargés dans le layout racine. */
export const polices = {
  /** Les titres du site : font-display font-black, en capitales. */
  titre: "Outfit_900Black",
  titreMoyen: "Outfit_700Bold",
  texte: "DMSans_400Regular",
  texteMoyen: "DMSans_500Medium",
  /** font-semibold : le texte saisi dans un champ. */
  texteDemi: "DMSans_600SemiBold",
  texteGras: "DMSans_700Bold",
  /** font-black : étiquettes, boutons, scores, noms de compétition. */
  texteNoir: "DMSans_900Black",
} as const;

/** tracking-[0.15em] et tracking-[0.12em] du site, en points pour une taille donnée. */
export const espacement = (taille: number, em = 0.15) => Math.round(taille * em * 10) / 10;
