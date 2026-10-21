import type { CompMatch, CompTeam } from "@/types";
import {
  colonnesDuTableau, equipesRangees, etiquetteDuMatch, filtresDuCalendrier, joursDuCalendrier, libellesDesOnglets,
  matchsDeLApercu, matchsDuFiltre, ongletsDeLaCompetition, periodeDeLaCompetition,
} from "~/lib/page-competition";

const match = (id: string, p: Partial<CompMatch> = {}): CompMatch =>
  ({ id, date: "2026-09-24", time: "15:00", status: "scheduled", group: null, round: null, stage: null, ...p } as CompMatch);

const equipe = (id: string, p: Partial<CompTeam> = {}): CompTeam =>
  ({ id, name: id, group: null, invitee: false, disqualified: false, players: [], ...p } as CompTeam);

describe("ongletsDeLaCompetition", () => {
  it("ouvre sur l'aperçu, puis les matchs, le classement et les stats ; les équipes à la fin", () => {
    expect(ongletsDeLaCompetition({ competitionType: "groups_knockout" }))
      .toEqual(["apercu", "matchs", "classement", "tableau", "stats", "equipes"]);
  });

  it("n'a pas de tableau sans phase finale, ni de classement sans poule", () => {
    expect(ongletsDeLaCompetition({ competitionType: "league" })).not.toContain("tableau");
    expect(ongletsDeLaCompetition({ competitionType: "cup" })).not.toContain("classement");
  });

  it("garde les deux quand le type n'est pas connu, comme le site", () => {
    const onglets = ongletsDeLaCompetition({ competitionType: null as never });
    expect(onglets).toContain("classement");
    expect(onglets).toContain("tableau");
  });

  it("appelle le tableau « Play-offs » pour un championnat suivi de play-offs", () => {
    expect(libellesDesOnglets("league_playoffs").tableau).toBe("Play-offs");
    expect(libellesDesOnglets("cup").tableau).toBe("Tableau");
  });
});

describe("periodeDeLaCompetition", () => {
  it("dit les deux bornes, ou celle qu'on a", () => {
    expect(periodeDeLaCompetition("2026-10-18", "2026-11-01")).toBe("18 octobre 2026 – 1 novembre 2026");
    expect(periodeDeLaCompetition("2026-10-18", null)).toBe("À partir du 18 octobre 2026");
    expect(periodeDeLaCompetition(null, "2026-11-01")).toBe("Jusqu'au 1 novembre 2026");
    expect(periodeDeLaCompetition(null, null)).toBeNull();
  });
});

describe("le calendrier", () => {
  const matchs = [
    match("b2", { group: "B", date: "2026-09-25", time: "18:00" }),
    match("a1", { group: "A", date: "2026-09-24", time: "17:00" }),
    match("a0", { group: "A", date: "2026-09-24", time: "15:00" }),
    match("f", { round: "final", stage: "knockout", date: null, time: null }),
    match("x", { stage: "exhibition", date: "2026-09-25", time: null }),
  ];

  it("propose une puce par poule, la phase finale et l'exhibition", () => {
    expect(filtresDuCalendrier(matchs).map((f) => f.libelle))
      .toEqual(["Tous", "Poule A", "Poule B", "Phase finale", "Exhibition"]);
  });

  it("filtre les matchs d'une poule, de la phase finale, de l'exhibition", () => {
    expect(matchsDuFiltre(matchs, "poule:A").map((m) => m.id)).toEqual(["a1", "a0"]);
    expect(matchsDuFiltre(matchs, "phase-finale").map((m) => m.id)).toEqual(["f"]);
    expect(matchsDuFiltre(matchs, "exhibition").map((m) => m.id)).toEqual(["x"]);
    expect(matchsDuFiltre(matchs, "tous")).toHaveLength(5);
  });

  it("range les matchs par jour et par heure, les jours sans date à la fin", () => {
    expect(joursDuCalendrier(matchs).map((j) => [j.date, j.matchs.map((m) => m.id)])).toEqual([
      ["2026-09-24", ["a0", "a1"]],
      ["2026-09-25", ["b2", "x"]],
      [null, ["f"]],
    ]);
  });

  it("étiquette un match de sa poule, de son tour, ou de l'exhibition", () => {
    expect(etiquetteDuMatch(matchs[0])).toBe("Groupe B");
    expect(etiquetteDuMatch(matchs[3])).toBe("Finale");
    expect(etiquetteDuMatch(matchs[4])).toBe("Exhibition");
    expect(etiquetteDuMatch(match("z"))).toBeNull();
  });
});

describe("matchsDeLApercu", () => {
  it("met en avant le direct, les trois prochains et les trois derniers joués", () => {
    const matchs = [
      match("j1", { status: "completed", date: "2026-09-20" }),
      match("j2", { status: "completed", date: "2026-09-21", time: "10:00" }),
      match("j3", { status: "completed", date: "2026-09-21", time: "16:00" }),
      match("j4", { status: "completed", date: "2026-09-22" }),
      match("l", { status: "live" }),
      match("v3", { date: "2026-09-27" }),
      match("v1", { date: "2026-09-25", time: "09:00" }),
      match("v2", { date: "2026-09-25", time: "11:00" }),
      match("v4", { date: null, time: null }),
      match("c", { status: "cancelled", date: "2026-09-25" }),
    ];
    const a = matchsDeLApercu(matchs);
    expect(a.enDirect.map((m) => m.id)).toEqual(["l"]);
    expect(a.aVenir.map((m) => m.id)).toEqual(["v1", "v2", "v3"]);
    expect(a.joues.map((m) => m.id)).toEqual(["j4", "j3", "j2"]);
  });
});

describe("colonnesDuTableau", () => {
  it("met les tours dans l'ordre, chaque tour dans l'ordre de ses places, la petite finale à part", () => {
    const { colonnes, petiteFinale } = colonnesDuTableau([
      match("f", { round: "final", bracketSlot: 0 }),
      match("d2", { round: "semi", bracketSlot: 1 }),
      match("d1", { round: "semi", bracketSlot: 0 }),
      match("p", { round: "third_place" }),
      match("a", { group: "A" }),
    ]);
    expect(colonnes.map((c) => [c.tour, c.matchs.map((m) => m.id)])).toEqual([
      ["semi", ["d1", "d2"]],
      ["final", ["f"]],
    ]);
    expect(petiteFinale?.id).toBe("p");
  });
});

describe("equipesRangees", () => {
  it("range par poule puis par nom, les équipes invitées à la fin", () => {
    const rangees = equipesRangees([
      equipe("Zèbres", { group: "A" }),
      equipe("Invitée", { group: "A", invitee: true }),
      equipe("Aigles", { group: "B" }),
      equipe("Lions", { group: "A" }),
    ]);
    expect(rangees.map((e) => e.id)).toEqual(["Lions", "Zèbres", "Aigles", "Invitée"]);
  });
});
