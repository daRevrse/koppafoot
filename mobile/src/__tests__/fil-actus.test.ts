import { filParJour, jourDeLArticle, type Article } from "@/lib/fil-actus";

// Heures locales : le fil se découpe à l'heure de celui qui le lit.
const le = (jour: number, heure: number) => new Date(2026, 9, jour, heure, 0).toISOString();
const MAINTENANT = new Date(2026, 9, 27, 18, 0);

const article = (id: string, at: string, image: string | null = null): Article =>
  ({ id, title: `Titre ${id}`, source: "Source", url: `https://x/${id}`, at, image });

describe("jourDeLArticle", () => {
  it("donne le jour local de l'article", () => {
    expect(jourDeLArticle(le(26, 23), MAINTENANT)).toBe("2026-10-26");
  });

  it("compte pour aujourd'hui un article daté plus tard que maintenant", () => {
    expect(jourDeLArticle(le(28, 1), MAINTENANT)).toBe("2026-10-27");
  });

  it("ne date pas un article sans date lisible", () => {
    expect(jourDeLArticle("", MAINTENANT)).toBeNull();
    expect(jourDeLArticle("pas une date", MAINTENANT)).toBeNull();
  });
});

describe("filParJour", () => {
  it("met à la une les cinq premiers du jour, ceux qui ont une photo d'abord, et les retire de leur journée", () => {
    const fil = filParJour([
      article("a", le(27, 17)),
      article("b", le(27, 16), "https://x/b.jpg"),
      article("c", le(27, 15)),
      article("d", le(27, 14)),
      article("e", le(27, 13), "https://x/e.jpg"),
      article("f", le(27, 12)),
      article("g", le(27, 11)),
      article("h", le(26, 20)),
    ], MAINTENANT);
    expect(fil.une.map((a) => a.id)).toEqual(["b", "e", "a", "c", "d"]);
    expect(fil.journees.map((j) => [j.cle, j.articles.map((a) => a.id)])).toEqual([
      ["2026-10-27", ["f", "g"]],
      ["2026-10-26", ["h"]],
    ]);
  });

  it("n'affiche pas la journée du jour quand la une l'a toute prise", () => {
    const fil = filParJour([article("a", le(27, 9)), article("h", le(25, 9))], MAINTENANT);
    expect(fil.une.map((a) => a.id)).toEqual(["a"]);
    expect(fil.journees.map((j) => j.cle)).toEqual(["2026-10-25"]);
  });

  it("n'a pas de une sans article du jour", () => {
    const fil = filParJour([article("h", le(26, 9)), article("i", le(25, 9))], MAINTENANT);
    expect(fil.une).toEqual([]);
    expect(fil.journees.map((j) => j.cle)).toEqual(["2026-10-26", "2026-10-25"]);
  });

  it("range les articles sans date à la fin", () => {
    const fil = filParJour([article("h", le(26, 9)), article("x", "")], MAINTENANT);
    expect(fil.journees.map((j) => [j.cle, j.articles.map((a) => a.id)])).toEqual([
      ["2026-10-26", ["h"]],
      [null, ["x"]],
    ]);
  });

  it("ne rend rien d'un fil vide", () => {
    expect(filParJour([], MAINTENANT)).toEqual({ une: [], journees: [] });
  });
});
