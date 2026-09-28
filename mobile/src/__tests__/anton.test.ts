import { chasseAnton, titreAnton } from "@/lib/anton";

// Le module vit côté site (src/lib/anton) ; il est pur, et c'est ici que la
// suite de tests des modules partagés tourne.

describe("chasseAnton", () => {
  it("retrouve les largeurs mesurées sur la police pour les titres des flyers", () => {
    expect(chasseAnton("MATCHDAY")).toBe(4.025);
    expect(chasseAnton("SCORE FINAL")).toBe(4.551);
    expect(chasseAnton("LE FOOTBALL D'ICI")).toBe(6.438);
  });

  it("mesure en capitales, accents compris", () => {
    expect(chasseAnton("lomé")).toBe(chasseAnton("LOMÉ"));
    expect(chasseAnton("É")).toBe(chasseAnton("E"));
  });

  it("compte un caractère inconnu pour un demi-em", () => {
    expect(chasseAnton("€")).toBe(0.5);
  });
});

describe("titreAnton", () => {
  const cadre = { largeur: 1000, max: 124, min: 56, seuil: 90 };

  it("garde un nom court sur une ligne, à la taille maximale", () => {
    expect(titreAnton("Coupe Miabé", cadre)).toEqual({ lignes: ["Coupe Miabé"], taille: 124 });
  });

  it("garde sur une ligne un nom qui y tient assez gros", () => {
    const { lignes, taille } = titreAnton("Coupe des quartiers", cadre);
    expect(lignes).toEqual(["Coupe des quartiers"]);
    expect(taille).toBeGreaterThanOrEqual(90);
    expect(taille * chasseAnton("Coupe des quartiers")).toBeLessThanOrEqual(1000);
  });

  it("passe sur deux lignes quand une seule le rapetisserait trop, sans mot orphelin", () => {
    // Sur une ligne : 87 px. Sur deux, coupé là où la plus longue est la plus courte : 124 px.
    expect(titreAnton("Coupe des quartiers de Lomé", cadre)).toEqual({
      lignes: ["Coupe des", "quartiers de Lomé"],
      taille: 124,
    });
  });

  it("coupe un nom long en deux lignes équilibrées, sans mot orphelin", () => {
    const nom = "Tournoi inter-quartiers de la jeunesse de Bè-Kpota";
    const { lignes, taille } = titreAnton(nom, cadre);
    expect(lignes).toHaveLength(2);
    expect(lignes.join(" ")).toBe(nom);
    const [a, b] = lignes.map(chasseAnton);
    expect(Math.abs(a - b)).toBeLessThan(2);
    expect(taille * Math.max(a, b)).toBeLessThanOrEqual(1000);
  });

  it("ne descend jamais sous la taille minimale", () => {
    const { taille } = titreAnton("Championnatdesquartiersdelagrandeagglomérationlomé", cadre);
    expect(taille).toBe(56);
  });
});
