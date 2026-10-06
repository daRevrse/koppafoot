import { avisBanniere, formatDe } from "@/lib/partenaires";

// Le module vit côté site (src/lib/partenaires) ; il est pur, et c'est ici
// que la suite de tests des modules partagés tourne.

describe("formatDe", () => {
  it("garde le logo aux partenariats d'avant les bannières", () => {
    expect(formatDe({ image_url: "https://x/logo.png" })).toBe("logo");
  });

  it("affiche la bannière qui a son image", () => {
    expect(formatDe({ format: "banniere", image_url: "https://x/b.jpg" })).toBe("banniere");
  });

  it("retombe sur l'encadré quand la bannière n'a pas d'image", () => {
    expect(formatDe({ format: "banniere", image_url: null })).toBe("logo");
  });
});

describe("avisBanniere", () => {
  it("se tait sur une image au bon format", () => {
    expect(avisBanniere(1200, 300)).toBeNull();
    expect(avisBanniere(1456, 340)).toBeNull(); // 4,3:1, dans la tolérance
  });

  it("annonce le recadrage d'un logo carré ou d'un format web classique", () => {
    expect(avisBanniere(800, 800)).toMatch(/800 × 800 px : elle sera recadrée/);
    expect(avisBanniere(728, 90)).toMatch(/recadrée/); // 8:1, deux fois trop large
  });

  it("prévient d'une image trop petite pour un grand écran", () => {
    expect(avisBanniere(600, 150)).toMatch(/floue/);
  });

  it("ne dit rien tant que l'image n'est pas mesurée", () => {
    expect(avisBanniere(0, 0)).toBeNull();
  });
});
