import { SPLASH_FOND } from "@/config/ios-launch";
import { couleurs } from "~/theme";

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
  it("part du fond de l'écran de lancement", () => {
    expect(couleurs.fond.toLowerCase()).toBe(SPLASH_FOND.toLowerCase());
  });

  // Toute couleur de texte sur tout fond : un composant n'a pas à savoir
  // sur quelle surface il sera posé.
  it.each(TEXTES.flatMap((t) => FONDS.map((f) => [t, f] as const)))("%s sur %s : 4,5 au moins", (t, f) => {
    expect(contraste(couleurs[t], couleurs[f])).toBeGreaterThanOrEqual(4.5);
  });

  it("le libellé d'un bouton plein se lit sur primaire", () => {
    expect(contraste(couleurs.surPrimaire, couleurs.primaire)).toBeGreaterThanOrEqual(4.5);
  });
});
