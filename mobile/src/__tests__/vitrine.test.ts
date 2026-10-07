import { versTerrainDeVitrine, vitrineDesTerrains } from "@/lib/vitrine";

// Le module vit côté site (src/lib/vitrine) ; il est pur, et c'est ici que la
// suite de tests des modules partagés tourne.

const terrain = (id: string, extra: Record<string, unknown> = {}) => ({
  id, name: `Terrain ${id}`, city: "Lomé", photo_url: `https://x/${id}.jpg`, available: true,
  rating: 4, review_count: 3, price_per_hour: 15000, field_size: "7v7", field_surface: "synthetic", ...extra,
});

describe("versTerrainDeVitrine", () => {
  it("garde ce que la carte montre", () => {
    expect(versTerrainDeVitrine(terrain("a"))).toEqual({
      id: "a", nom: "Terrain a", ville: "Lomé", photo: "https://x/a.jpg", format: "7v7",
      surface: "synthetic", prix: 15000, note: 4, avis: 3,
    });
  });

  it("écarte un terrain fermé ou sans nom", () => {
    expect(versTerrainDeVitrine(terrain("a", { available: false }))).toBeNull();
    expect(versTerrainDeVitrine(terrain("a", { name: "  " }))).toBeNull();
  });

  it("ne montre pas un prix nul", () => {
    expect(versTerrainDeVitrine(terrain("a", { price_per_hour: 0 }))?.prix).toBeNull();
  });
});

describe("vitrineDesTerrains", () => {
  it("montre ceux à la une, dans l'ordre choisi, même sans photo", () => {
    const r = vitrineDesTerrains([terrain("b", { photo_url: null }), terrain("a")], [terrain("z", { rating: 5 })]);
    expect(r.aLaUne).toBe(true);
    expect(r.terrains.map((t) => t.id)).toEqual(["b", "a"]);
  });

  it("à défaut, les mieux présentés : avec photo, puis la note et les avis", () => {
    const r = vitrineDesTerrains([terrain("fermé", { available: false })], [
      terrain("c", { rating: 3 }),
      terrain("d", { rating: 5, photo_url: null }),
      terrain("e", { rating: 4.5, review_count: 1 }),
      terrain("f", { rating: 4.5, review_count: 9 }),
    ]);
    expect(r.aLaUne).toBe(false);
    expect(r.terrains.map((t) => t.id)).toEqual(["f", "e", "c"]);
  });

  it("s'arrête à trois", () => {
    const r = vitrineDesTerrains([], ["a", "b", "c", "d"].map((id) => terrain(id)));
    expect(r.terrains).toHaveLength(3);
  });
});
