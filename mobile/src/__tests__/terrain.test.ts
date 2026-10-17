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

describe("disposerSurTerrain, une feuille où seuls quelques-uns ont un poste", () => {
  // Le gardien déclaré, les dix autres sans poste : c'est la feuille ordinaire
  // en production, où deux lignes sur trois n'ont pas de poste.
  const sansPoste = (n: number, depuis = 2) =>
    Array.from({ length: n }, (_, i) => ligne(`j${depuis + i}`, null));
  // Le rang se lit sur l'axe du jeu : terrain couché vers la droite, x = 180 - 40 i.
  const RANG: Record<number, string> = { 180: "A", 140: "?", 100: "M", 60: "D", 20: "G" };
  const parRang = (titulaires: LineupEntry[]) => {
    const { places } = disposerSurTerrain(titulaires, titulaires.length, "droite");
    const out: Record<string, string[]> = {};
    for (const p of places) (out[RANG[p.x]] ??= []).push(p.entry?.playerId ?? "-");
    return out;
  };

  it("répartit ceux sans poste sur le dispositif, et non sur un seul rang", () => {
    const rangs = parRang([ligne("g", "goalkeeper"), ...sansPoste(10)]);
    expect(rangs).toEqual({
      G: ["g"],
      D: ["j2", "j3", "j4", "j5"],
      M: ["j6", "j7", "j8"],
      A: ["j9", "j10", "j11"],
    });
  });

  it("laisse aux pastilles de la console couchée une taille qu'on touche", () => {
    const { ecart, rayonMax } = disposerSurTerrain(
      [ligne("g", "goalkeeper"), ...sansPoste(10)], 11, "droite",
    );
    // Un rang de quatre au plus : 24 unités d'écart, comme une feuille complète.
    expect(ecart).toBeGreaterThanOrEqual(24);
    expect(rayonMax).toBeGreaterThan(5);
  });

  it("leur laisse leur « ? », sans leur inventer de poste", () => {
    const { places } = disposerSurTerrain([ligne("g", "goalkeeper"), ...sansPoste(10)], 11, "droite");
    expect(places.find((p) => p.entry?.playerId === "g")?.etiquette).toBe("G");
    expect(places.filter((p) => p.etiquette === "?")).toHaveLength(10);
  });

  it("ne déplace pas ceux qui ont dit où ils jouent", () => {
    const rangs = parRang([
      ligne("g", "goalkeeper"), ligne("x1", null), ligne("d1", "defender"),
      ligne("x2", null), ligne("a1", "forward"), ...sansPoste(6, 3),
    ]);
    expect(rangs.D).toEqual(["x1", "d1", "x2", "j3"]);
    expect(rangs.A).toEqual(["a1", "j7", "j8"]);
    expect(rangs.G).toEqual(["g"]);
  });

  it("garde un rang trop chargé plutôt que de déplacer un poste déclaré", () => {
    const milieux = Array.from({ length: 5 }, (_, i) => ligne(`m${i}`, "midfielder"));
    const rangs = parRang([ligne("g", "goalkeeper"), ...milieux, ...sansPoste(5)]);
    expect(rangs.M).toEqual(["m0", "m1", "m2", "m3", "m4"]);
    expect(rangs.D).toEqual(["j2", "j3", "j4", "j5"]);
    expect(rangs.A).toEqual(["j6"]);
  });

  it("ne met personne au but d'office", () => {
    const rangs = parRang([ligne("d1", "defender"), ...sansPoste(4)]);
    expect(rangs.G).toBeUndefined();
    expect(rangs.D).toEqual(["d1", "j2"]);
  });

  it("garde la ligne « ? » tant qu'elle reste une ligne", () => {
    const rangs = parRang([
      ligne("g", "goalkeeper"),
      ...["d1", "d2", "d3", "d4"].map((id) => ligne(id, "defender")),
      ...["m1", "m2", "m3"].map((id) => ligne(id, "midfielder")),
      ...["a1", "a2"].map((id) => ligne(id, "forward")),
      ligne("x", null),
    ]);
    expect(rangs["?"]).toEqual(["x"]);
    expect(rangs.A).toEqual(["a1", "a2"]);
  });
});
