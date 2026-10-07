import {
  cleDeLigneDeCompetition, cleSansCompte, ligneDuClub, lireCleSansCompte,
} from "@/lib/photos-sans-compte";

// Le module vit côté site (src/lib/photos-sans-compte) ; il est pur, et c'est
// ici que la suite de tests des modules partagés tourne.

describe("cleSansCompte", () => {
  it("désigne la fiche d'un joueur sans compte sous son club", () => {
    expect(cleSansCompte("clubA1", "g7Xk2")).toBe("clubA1:g7Xk2");
  });

  it("refuse ce qui pourrait sortir du chemin de la fiche", () => {
    expect(cleSansCompte("club/../users", "g1")).toBeNull();
    expect(cleSansCompte("club", "g1:autre")).toBeNull();
    expect(cleSansCompte(null, "g1")).toBeNull();
    expect(cleSansCompte("club", "")).toBeNull();
  });
});

describe("cleDeLigneDeCompetition", () => {
  it("retrouve la fiche d'une ligne copiée de l'effectif du club", () => {
    expect(cleDeLigneDeCompetition("clubA1", ligneDuClub("g7Xk2"))).toBe("clubA1:g7Xk2");
  });

  it("ignore une ligne tapée par l'organisateur, ou celle d'un compte", () => {
    expect(cleDeLigneDeCompetition("clubA1", "p_17")).toBeNull();
    expect(cleDeLigneDeCompetition("clubA1", "u_uid42")).toBeNull();
  });

  it("ne devine rien d'une équipe qui ne représente aucun club", () => {
    expect(cleDeLigneDeCompetition(null, ligneDuClub("g7Xk2"))).toBeNull();
  });
});

describe("lireCleSansCompte", () => {
  it("relit une clé bien formée", () => {
    expect(lireCleSansCompte("clubA1:g7Xk2")).toEqual({ clubId: "clubA1", ghostId: "g7Xk2" });
  });

  it("écarte le reste", () => {
    for (const cle of ["", "clubA1", "a:b:c", "a/b:c", ":g1", "club:"]) {
      expect(lireCleSansCompte(cle)).toBeNull();
    }
  });
});
