import { act, create } from "react-test-renderer";
import { ContexteCouleurs, creerStyles, palettes, type Couleurs } from "~/theme";

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

const TEXTES = ["texte", "texteSecondaire", "texteDiscret", "primaire", "direct", "accent", "argent", "bronze", "erreur", "info"] as const;
const FONDS = ["fond", "surface", "surfaceHaute"] as const;
const SCHEMAS = Object.keys(palettes) as (keyof typeof palettes)[];

describe("les palettes", () => {
  it("le sombre prend le noir du site, le clair le fond de ses pages", () => {
    expect(palettes.sombre.fond.toLowerCase()).toBe("#080d0b");
    expect(palettes.clair.fond.toLowerCase()).toBe("#f4f6fa");
  });

  it("l'écran de lancement peint déjà le sombre", () => {
    expect(lancement?.toLowerCase()).toBe(palettes.sombre.fond.toLowerCase());
  });

  it("ont les mêmes rôles", () => {
    expect(Object.keys(palettes.clair).sort()).toEqual(Object.keys(palettes.sombre).sort());
  });

  // Toute couleur de texte sur tout fond : un composant n'a pas à savoir
  // sur quelle surface il sera posé, ni dans quel thème.
  it.each(SCHEMAS.flatMap((s) => TEXTES.flatMap((t) => FONDS.map((f) => [s, t, f] as const))))(
    "%s : %s sur %s, 4,5 au moins",
    (s, t, f) => {
      expect(contraste(palettes[s][t], palettes[s][f])).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(SCHEMAS)("%s : le libellé d'un bouton plein se lit sur sa couleur, et sur le rouge d'un geste qui détruit", (s) => {
    expect(contraste(palettes[s].surBouton, palettes[s].bouton)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(palettes[s].surBouton, palettes[s].boutonDanger)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(SCHEMAS)("%s : le N d'un match nul se lit sur sa pastille", (s) => {
    expect(contraste(palettes[s].texteSecondaire, palettes[s].pastilleNeutre)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("creerStyles", () => {
  const useStyles = creerStyles((couleurs) => ({ titre: { color: couleurs.texte } }));

  function stylesSous(palette: Couleurs) {
    let lus: ReturnType<typeof useStyles> | undefined;
    function Sonde() {
      lus = useStyles();
      return null;
    }
    act(() => {
      create(
        <ContexteCouleurs.Provider value={palette}>
          <Sonde />
        </ContexteCouleurs.Provider>,
      );
    });
    return lus!;
  }

  it("donne les styles de la palette en cours", () => {
    expect(stylesSous(palettes.sombre).titre.color).toBe(palettes.sombre.texte);
    expect(stylesSous(palettes.clair).titre.color).toBe(palettes.clair.texte);
  });

  it("ne les crée qu'une fois par palette", () => {
    expect(stylesSous(palettes.clair)).toBe(stylesSous(palettes.clair));
  });
});
