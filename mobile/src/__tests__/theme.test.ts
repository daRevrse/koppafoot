import { couleurs } from "~/theme";

// La couleur de l'écran de lancement, celle que le téléphone peint avant le
// premier rendu (app.json, plugin expo-splash-screen).
const appJson = require("../../app.json") as { expo: { plugins: unknown[] } };
const lancement = appJson.expo.plugins
  .filter((p): p is [string, { backgroundColor: string }] => Array.isArray(p) && p[0] === "expo-splash-screen")
  .map(([, options]) => options.backgroundColor)[0];

/** Le contraste WCAG 2 entre deux couleurs « #rrggbb ». */
function contraste(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bleu] = [1, 3, 5].map((i) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bleu;
  };
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (clair + 0.05) / (sombre + 0.05);
}

const TEXTES = ["texte", "texteSecondaire", "texteDiscret", "primaire", "direct", "accent", "erreur"] as const;
const FONDS = ["fond", "surface", "surfaceHaute"] as const;

describe("la palette", () => {
  it("prend le noir du thème sombre du site", () => {
    expect(couleurs.fond.toLowerCase()).toBe("#080d0b");
  });

  it("et l'écran de lancement le peint déjà : pas d'éclair d'une autre couleur", () => {
    expect(lancement?.toLowerCase()).toBe(couleurs.fond.toLowerCase());
  });

  // Toute couleur de texte sur tout fond : un composant n'a pas à savoir
  // sur quelle surface il sera posé.
  it.each(TEXTES.flatMap((t) => FONDS.map((f) => [t, f] as const)))("%s sur %s : 4,5 au moins", (t, f) => {
    expect(contraste(couleurs[t], couleurs[f])).toBeGreaterThanOrEqual(4.5);
  });

  it("le libellé d'un bouton plein se lit sur son vert", () => {
    expect(contraste(couleurs.surBouton, couleurs.bouton)).toBeGreaterThanOrEqual(4.5);
  });

  it("et celui d'un bouton qui détruit, sur son rouge", () => {
    expect(contraste(couleurs.surBouton, couleurs.boutonDanger)).toBeGreaterThanOrEqual(4.5);
  });
});
