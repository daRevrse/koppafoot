import { couleursDesBarres, couleursDuMaillot, seFondDansLaPelouse } from "@/lib/couleurs-equipe";

// Le module vit côté site (src/lib/couleurs-equipe) ; il est pur, et c'est
// ici que la suite de tests des modules partagés tourne.

// Les deux verts de la pelouse de la console (voir TerrainConsole).
const PELOUSES = ["#15803d", "#14532d"] as const;

describe("seFondDansLaPelouse", () => {
  it("repère un maillot vert sur la pelouse verte", () => {
    expect(seFondDansLaPelouse(couleursDuMaillot("emerald").maillot, PELOUSES)).toBe(true);
    expect(seFondDansLaPelouse("#22c55e", PELOUSES)).toBe(true);
    expect(seFondDansLaPelouse("#166534", PELOUSES)).toBe(true);
  });

  it("laisse tranquilles les maillots qui s'en détachent", () => {
    for (const nom of ["blue", "red", "amber", "purple", "orange"]) {
      expect(seFondDansLaPelouse(couleursDuMaillot(nom).maillot, PELOUSES)).toBe(false);
    }
    expect(seFondDansLaPelouse(couleursDuMaillot(null).maillot, PELOUSES)).toBe(false);
  });
});

describe("couleursDesBarres", () => {
  it("peint chaque équipe dans sa couleur", () => {
    expect(couleursDesBarres("red", "#f59e0b")).toEqual({ home: "#ef4444", away: "#f59e0b" });
  });

  it("garde le vert et le gris d'avant quand rien n'est déclaré", () => {
    expect(couleursDesBarres(null, undefined)).toEqual({ home: "#10b981", away: "#9ca3af" });
  });

  it("fonce une couleur qui disparaîtrait sur la piste", () => {
    const { home, away } = couleursDesBarres("#ffffff", "blue");
    expect(home).toBe("#374151");
    expect(away).toBe("#3b82f6");
  });

  it("sépare deux équipes du même ton", () => {
    expect(couleursDesBarres("red", "#dc2626").away).toBe("#9ca3af");
    // Et si le domicile est déjà gris, l'extérieur passe au sombre.
    expect(couleursDesBarres("#9ca3af", "#a1a1aa").away).toBe("#111827");
  });

  it("suit une piste sombre", () => {
    expect(couleursDesBarres("#111827", "blue", "#1f2937").home).toBe("#e5e7eb");
  });
});
