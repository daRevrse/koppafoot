import { buteursRenseignes, lireButeursRenseignes } from "@/lib/buteurs";

// Le module vit côté site (src/lib/buteurs) ; il est pur, et c'est ici que la
// suite de tests des modules partagés tourne.

// Exactement ce qu'écrit api/matches/record : les objets `Buteur` tels quels.
const ECRIT_PAR_LA_ROUTE = [
  { playerId: "u1", sansCompte: false, nom: "Komla Dossou", buts: 2, passes: 1 },
  { playerId: "g1", sansCompte: true, nom: "Kodjo Agbo", buts: 0, passes: 1 },
];

describe("lireButeursRenseignes", () => {
  it("lit le format qu'écrit la route, identifiant compris", () => {
    expect(lireButeursRenseignes(ECRIT_PAR_LA_ROUTE)).toEqual(ECRIT_PAR_LA_ROUTE);
  });

  it("accepte l'ancienne casse player_id, sans en dépendre", () => {
    expect(lireButeursRenseignes([{ player_id: "u2", nom: "Yawa", buts: 1, passes: 0 }])[0]).toEqual({
      playerId: "u2", sansCompte: false, nom: "Yawa", buts: 1, passes: 0,
    });
  });

  it("écarte ce qui ne dit pas à qui rendre les buts", () => {
    expect(lireButeursRenseignes([{ nom: "Sans id", buts: 3 }, null, "x", { playerId: "" }])).toEqual([]);
    expect(lireButeursRenseignes(undefined)).toEqual([]);
    expect(lireButeursRenseignes({ playerId: "u1" })).toEqual([]);
  });

  it("ramène les nombres absurdes à zéro", () => {
    expect(lireButeursRenseignes([{ playerId: "u1", nom: "A", buts: -2, passes: "3" }])[0])
      .toMatchObject({ buts: 0, passes: 0 });
  });

  it("nourrit le tableau d'affichage du camp qui a saisi", () => {
    const camps = buteursRenseignes(lireButeursRenseignes(ECRIT_PAR_LA_ROUTE), "away");
    expect(camps.home).toEqual([]);
    expect(camps.away.map((b) => [b.nom, b.nombre])).toEqual([["Komla Dossou", 2]]);
  });
});
