import {
  championDe, meilleurButeur, ordonnerTableau, placeAttendue, type MatchDuTableau,
} from "@/lib/phase-finale";

// Le module vit côté site (src/lib/phase-finale) ; il est pur, et c'est ici
// que la suite de tests des modules partagés tourne.

const camp = (nom: string) => ({ nom, logo: null, aDeterminer: false });
const m = (p: Partial<MatchDuTableau>): MatchDuTableau => ({
  id: "x", tour: "quarter", position: 0, home: camp("A"), away: camp("B"),
  scoreHome: null, scoreAway: null, tirsAuButHome: null, tirsAuButAway: null,
  termine: false, vainqueur: null, date: "", ...p,
});

describe("ordonnerTableau", () => {
  it("range les tours dans l'ordre et les matchs par position", () => {
    const tours = ordonnerTableau([
      m({ id: "f", tour: "final" }),
      m({ id: "q2", tour: "quarter", position: 2 }),
      m({ id: "q1", tour: "quarter", position: 1 }),
      m({ id: "p", tour: "third_place" }),
    ]);
    expect(tours.map((t) => t.tour)).toEqual(["quarter", "final"]);
    expect(tours[0].matchs.map((x) => x.id)).toEqual(["q1", "q2"]);
    expect(tours[0].libelle).toBe("Quarts");
  });
});

describe("championDe", () => {
  it("donne le vainqueur de la finale jouée", () => {
    expect(championDe([m({ tour: "final", termine: true, vainqueur: "away", away: camp("Bè FC") })])?.nom).toBe("Bè FC");
  });

  it("ne couronne personne avant la fin", () => {
    expect(championDe([m({ tour: "final" })])).toBeNull();
    expect(championDe([m({ tour: "semi", termine: true, vainqueur: "home" })])).toBeNull();
  });
});

describe("placeAttendue", () => {
  it("dit d'où viendra l'équipe", () => {
    expect(placeAttendue({ kind: "group_rank", group: "A", rank: 1 })).toBe("1er poule A");
    expect(placeAttendue({ kind: "best_rank", rank: 3, index: 2 })).toBe("2e meilleur 3e");
    expect(placeAttendue(null)).toBeNull();
  });
});

describe("meilleurButeur", () => {
  const but = (team: string, id: string, nom: string, extra = {}) => ({ type: "goal", team_id: team, player_id: id, player_name: nom, ...extra });
  const match = (events: object[], p = {}) => ({
    home_team_id: "t1", home_team_name: "Alpha", away_team_id: "t2", away_team_name: "Beta",
    live_state: { events: events as never[] }, ...p,
  });

  it("compte les buts de toute la compétition", () => {
    expect(meilleurButeur([
      match([but("t1", "k", "Kossi"), but("t2", "y", "Yao")]),
      match([but("t1", "k", "Kossi")]),
    ])).toEqual({ nom: "Kossi", equipe: "Alpha", buts: 2 });
  });

  it("écarte csc, VAR, exhibition et dossards anonymes", () => {
    expect(meilleurButeur([
      match([but("t1", "k", "Kossi", { detail: "csc" })]),
      match([but("t1", "k", "Kossi", { var_status: "cancelled" })]),
      match([but("t1", "k", "Kossi")], { stage: "exhibition" }),
      match([but("t2", "dos-t2-9", "N°9"), but("t2", "dos-t2-9", "N°9")]),
      match([but("t2", "y", "Yao")]),
    ])).toEqual({ nom: "Yao", equipe: "Beta", buts: 1 });
  });

  it("à égalité, garde celui qui a marqué le premier", () => {
    expect(meilleurButeur([match([but("t2", "y", "Yao"), but("t1", "k", "Kossi")])])?.nom).toBe("Yao");
  });

  it("rend null sans aucun but nommé", () => {
    expect(meilleurButeur([match([])])).toBeNull();
  });
});
