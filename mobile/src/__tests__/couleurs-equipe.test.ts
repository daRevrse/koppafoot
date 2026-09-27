import { couleursDuMaillot, seFondDansLaPelouse } from "@/lib/couleurs-equipe";

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
