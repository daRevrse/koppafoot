import {
  disposerSurTerrain, lireEmplacement, placerSurTerrain, type Emplacement,
} from "@/lib/terrain";
import type { LineupEntry } from "@/types";

// Le module vit côté site (src/lib/terrain) ; il est pur, et c'est ici que la
// suite de tests des modules partagés tourne.

const ligne = (id: string, position: LineupEntry["position"], emplacement?: Emplacement): LineupEntry => ({
  playerId: id, name: id, number: "", role: "starter", position, emplacement,
});

/** Qui est où, ligne par ligne, de gauche à droite (« - » pour une case vide). */
const lignes = (titulaires: LineupEntry[], formation: number[]) => {
  const { places } = disposerSurTerrain(titulaires, 11, "haut", formation);
  const out: string[][] = [];
  for (const p of places) {
    const { ligne: l, colonne } = p.emplacement!;
    (out[l] ??= [])[colonne] = p.entry?.playerId ?? "-";
  }
  return out.map((l) => l.join(" "));
};

describe("disposerSurTerrain, avec des cases choisies", () => {
  it("met le joueur dans la case choisie, pas tout à gauche", () => {
    expect(lignes([ligne("G", "goalkeeper"), ligne("AD", "defender", { ligne: 1, colonne: 3 })], [4, 4, 2])[1])
      .toBe("- - - AD");
  });

  it("range les autres dans les cases qui restent, sans toucher aux choisies", () => {
    const l = lignes([
      ligne("G", "goalkeeper"),
      ligne("D1", "defender"),
      ligne("AD", "defender", { ligne: 1, colonne: 0 }),
      ligne("D2", "defender"),
    ], [4, 4, 2]);
    expect(l[1]).toBe("AD D1 D2 -");
  });

  it("ignore une case prise deux fois ou hors de la formation", () => {
    const l = lignes([
      ligne("G", "goalkeeper"),
      ligne("A", "defender", { ligne: 1, colonne: 1 }),
      ligne("B", "defender", { ligne: 1, colonne: 1 }),
      ligne("C", "forward", { ligne: 3, colonne: 5 }),
    ], [4, 4, 2]);
    expect(l[1]).toBe("B A - -");
    expect(l[3]).toBe("C -");
  });

  it("met au but celui qu'on y a placé, même déclaré ailleurs", () => {
    const l = lignes([ligne("Buteur", "forward", { ligne: 0, colonne: 0 }), ligne("Gardien", "goalkeeper")], [4, 4, 2]);
    expect(l[0]).toBe("Buteur");
  });

  it("met l'aile gauche en bas quand l'équipe attaque vers la gauche", () => {
    const titulaires = [ligne("AG", "defender", { ligne: 1, colonne: 0 }), ligne("AD", "defender", { ligne: 1, colonne: 3 })];
    const y = (sens: "droite" | "gauche", id: string) =>
      disposerSurTerrain(titulaires, 11, sens, [4, 4, 2]).places.find((p) => p.entry?.playerId === id)!.y;
    expect(y("droite", "AG")).toBeLessThan(y("droite", "AD"));
    expect(y("gauche", "AG")).toBeGreaterThan(y("gauche", "AD"));
  });
});

describe("placerSurTerrain", () => {
  const titulaires = [
    ligne("G", "goalkeeper"),
    ligne("D1", "defender"),
    ligne("D2", "defender"),
    ligne("M1", "midfielder"),
  ];
  const places = disposerSurTerrain(titulaires, 11, "haut", [4, 4, 2]).places;

  it("échange avec l'occupant de la case visée", () => {
    const { placements, deloge } = placerSurTerrain(places, [4, 4, 2], "D1", { ligne: 1, colonne: 1 });
    expect(placements.D1.emplacement).toEqual({ ligne: 1, colonne: 1 });
    expect(placements.D2.emplacement).toEqual({ ligne: 1, colonne: 0 });
    expect(deloge).toBeNull();
  });

  it("fige tout le monde là où il est dessiné, et donne le poste de la case", () => {
    const { placements } = placerSurTerrain(places, [4, 4, 2], "M1", { ligne: 1, colonne: 3 });
    expect(placements.G.emplacement).toEqual({ ligne: 0, colonne: 0 });
    expect(placements.D2.emplacement).toEqual({ ligne: 1, colonne: 1 });
    expect(placements.M1).toEqual({ emplacement: { ligne: 1, colonne: 3 }, poste: "defender" });
  });

  it("déloge l'occupant quand le joueur arrive du banc", () => {
    const { placements, deloge } = placerSurTerrain(places, [4, 4, 2], "Remplacant", { ligne: 1, colonne: 0 });
    expect(deloge).toBe("D1");
    expect(placements.D1).toBeUndefined();
    expect(placements.Remplacant.poste).toBe("defender");
  });
});

describe("lireEmplacement", () => {
  it("n'accepte que deux entiers positifs", () => {
    expect(lireEmplacement({ ligne: 1, colonne: 2 })).toEqual({ ligne: 1, colonne: 2 });
    expect(lireEmplacement({ ligne: -1, colonne: 2 })).toBeNull();
    expect(lireEmplacement({ ligne: "1", colonne: 2 })).toBeNull();
    expect(lireEmplacement(null)).toBeNull();
  });
});
