import { etatDeLaSeance, type Seance, type Tir } from "@/lib/tirs-au-but";

const tir = (cote: Tir["cote"], issue: Tir["issue"]): Tir => ({ cote, issue, playerId: null, playerName: null });
/** Une séance où `home` tire en premier, écrite tir après tir : « M » marqué, « R » raté. */
const seance = (tirs: string): Seance => ({
  premier: "home",
  tirs: tirs.split("").map((c, i) => tir(i % 2 === 0 ? "home" : "away", c === "M" ? "marque" : "rate")),
});

describe("etatDeLaSeance", () => {
  it("attend de savoir qui tire en premier", () => {
    expect(etatDeLaSeance({ premier: null, tirs: [] })).toMatchObject({ prochain: null, terminee: false });
  });

  it("fait alterner les deux équipes, en commençant par la première", () => {
    expect(etatDeLaSeance(seance("")).prochain).toBe("home");
    expect(etatDeLaSeance(seance("M")).prochain).toBe("away");
    expect(etatDeLaSeance(seance("MR")).prochain).toBe("home");
  });

  it("compte les tirs marqués", () => {
    expect(etatDeLaSeance(seance("MRMM")).score).toEqual({ home: 2, away: 1 });
  });

  it("s'arrête dès qu'une équipe ne peut plus revenir", () => {
    // 3–0 après trois tirs chacun : l'extérieur n'a plus que deux tirs.
    const e = etatDeLaSeance(seance("MRMRMR"));
    expect(e).toMatchObject({ terminee: true, vainqueur: "home", score: { home: 3, away: 0 } });
  });

  it("ne s'arrête pas tant que le retard peut se combler", () => {
    expect(etatDeLaSeance(seance("MRMR")).terminee).toBe(false);
  });

  it("passe à la mort subite après cinq tirs chacun à égalité", () => {
    const e = etatDeLaSeance(seance("MMMMMMMMMM"));
    expect(e).toMatchObject({ terminee: false, mortSubite: true, prochain: "home" });
  });

  it("tranche la mort subite au premier tour où l'un rate et l'autre marque", () => {
    expect(etatDeLaSeance(seance("MMMMMMMMMMMR"))).toMatchObject({ terminee: true, vainqueur: "home" });
    expect(etatDeLaSeance(seance("MMMMMMMMMMRR")).terminee).toBe(false);
  });

  it("ne tranche pas la mort subite avant que le second ait tiré", () => {
    expect(etatDeLaSeance(seance("MMMMMMMMMMR")).terminee).toBe(false);
  });

  it("commence par l'extérieur quand il a gagné le tirage", () => {
    const s: Seance = { premier: "away", tirs: [tir("away", "marque")] };
    expect(etatDeLaSeance(s).prochain).toBe("home");
  });
});
