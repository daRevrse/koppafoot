import { createContext, useContext } from "react";
import { StyleSheet } from "react-native";

/**
 * Les deux palettes de l'application, celles du site : le thème sombre
 * (src/styles/dark.css) et le clair (globals.css, le fond #F4F6FA de ScoreShell).
 * Le sombre est un noir à peine teinté de vert, et l'écran de lancement le
 * peint déjà (app.json) : son logo est blanc, il reste sombre dans les deux thèmes.
 *
 * DES NOMS DE RÔLE, PAS DE TEINTE. Toute couleur de texte doit se lire sur
 * chacun des trois fonds, dans les deux palettes : __tests__/theme.test.ts
 * l'exige (4,5 au moins).
 *
 * CE QUI NE CHANGE PAS, comme sur le site : les en-têtes noirs (club, équipe,
 * joueur, match, compétition) et leur texte blanc. Ils sont sombres dans les
 * deux thèmes, et leurs couleurs restent écrites en dur dans leurs composants.
 */
const sombre = {
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
  /** Le podium (ScorersTab du site) : l'or est l'accent, voici l'argent et le bronze. */
  argent: "#CBD5E1",
  bronze: "#FB923C",
  /** Le fond ambré d'un encart (le joueur du tournoi, la VAR en attente). */
  accentVoile: "rgba(251,191,36,0.08)",
  erreur: "#FCA5A5",
  /** Le bleu d'une équipe invitée, d'une compétition aux inscriptions ouvertes. */
  info: "#7dd3fc",
  infoVoile: "rgba(56,189,248,0.12)",
  /** La pastille d'un match nul, dans une forme « V N D ». */
  pastilleNeutre: "#16201c",
  /** Le disque clair sous un blason : un logo noir (Ligue des champions) disparaît sinon sur le fond. */
  fondEcusson: "#eef3f0",
};

/** Ce qu'est une palette : les rôles du sombre, chacun une couleur. */
export type Couleurs = { readonly [R in keyof typeof sombre]: string };

const clair: Couleurs = {
  /** bg-[#F4F6FA], le fond des pages du site. */
  fond: "#f4f6fa",
  /** bg-white */
  surface: "#ffffff",
  /** bg-gray-50 */
  surfaceHaute: "#f9fafb",
  /** border-gray-200 */
  bordure: "#e5e7eb",
  /** border-gray-300 */
  bordureForte: "#d1d5db",
  /** text-gray-900 */
  texte: "#111827",
  /** text-gray-600 */
  texteSecondaire: "#4b5563",
  /** Un cran sous text-gray-500, qui ne fait que 4,47 sur le fond. */
  texteDiscret: "#687080",
  /** emerald-700 : l'emerald-600 du site ne fait que 3,5 sur le fond. */
  primaire: "#047857",
  primaireVoile: "#ecfdf5",
  /** Le bouton plein du site en clair : bg-gray-900. */
  bouton: "#111827",
  surBouton: "#ffffff",
  boutonDanger: "#b91c1c",
  /** Entre red-600 (4,46 sur le fond) et red-700. */
  direct: "#c81e1e",
  directVoile: "#fef2f2",
  /** amber-700 */
  accent: "#b45309",
  /** slate-600, orange-700 */
  argent: "#475569",
  bronze: "#c2410c",
  accentVoile: "#fffbeb",
  erreur: "#b91c1c",
  /** sky-700 */
  info: "#0369a1",
  infoVoile: "#f0f9ff",
  /** gray-200 : la surface même ne se distinguerait pas de la carte. */
  pastilleNeutre: "#e5e7eb",
  fondEcusson: "#eef3f0",
};

export const palettes = { sombre: sombre as Couleurs, clair } as const;

/** Le thème affiché : celui que la personne a choisi, ou celui du téléphone. */
export type Schema = keyof typeof palettes;

/**
 * La palette en cours, posée par ApparenceProvider (lib/apparence). Sans
 * fournisseur (un test qui rend un composant seul), le sombre.
 */
export const ContexteCouleurs = createContext<Couleurs>(palettes.sombre);

export const useCouleurs = (): Couleurs => useContext(ContexteCouleurs);

/**
 * Les styles d'un composant, pour la palette en cours. S'écrit comme
 * StyleSheet.create, la palette en paramètre :
 *
 *   const useStyles = creerStyles((couleurs) => ({ titre: { color: couleurs.texte } }));
 *   // dans le composant
 *   const styles = useStyles();
 *
 * Chaque palette n'est créée qu'une fois, au premier rendu qui la demande.
 */
export function creerStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  fabrique: (couleurs: Couleurs) => T & StyleSheet.NamedStyles<any>,
): () => T {
  const parPalette = new Map<Couleurs, T>();
  return function useStyles() {
    const couleurs = useCouleurs();
    let styles = parPalette.get(couleurs);
    if (!styles) {
      styles = StyleSheet.create(fabrique(couleurs));
      parPalette.set(couleurs, styles);
    }
    return styles;
  };
}

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
