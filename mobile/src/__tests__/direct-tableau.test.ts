import type { CompetitionFeed } from "@/lib/direct-shared";
import { FRIENDLY_COMP_ID, FRIENDLY_COMPETITION } from "@/lib/friendlies-shared";
import type { Competition, CompMatch } from "@/types";
import {
  appliquerEcoutes, compterEnDirect, fusionnerAmicaux, groupesDuTableau, jourLePlusProche, remplacerMatchs,
} from "~/lib/direct-tableau";

const comp = (id: string): Competition => ({ id, slug: id, name: id } as Competition);
const match = (id: string, p: Partial<CompMatch> = {}): CompMatch =>
  ({ id, date: "2026-09-24", time: "15:00", status: "scheduled", ...p } as CompMatch);

const JOUR = "2026-09-24";

const flux: CompetitionFeed[] = [
  { competition: comp("coupe"), matches: [
    match("c1", { time: "18:00" }),
    match("c2", { date: "2026-09-20", status: "live" }),
    match("c3", { date: "2026-09-27" }),
  ] },
  { competition: comp("__monde__PL"), matches: [match("w1", { time: "12:00" })] },
  { competition: comp("ligue"), matches: [match("l1", { date: "2026-09-10", status: "completed" })] },
];

describe("groupesDuTableau", () => {
  it("Tous : les matchs du jour, plus ceux en cours quelle que soit leur date", () => {
    const g = groupesDuTableau(flux, { jour: JOUR, filtre: "tous", suivies: new Set() });
    expect(g.map((x) => x.competition.id)).toEqual(["coupe", "__monde__PL"]);
    expect(g[0].entries.map((e) => e.match.id)).toEqual(["c2", "c1"]);
  });

  it("En direct : seulement les matchs en cours", () => {
    const g = groupesDuTableau(flux, { jour: JOUR, filtre: "direct", suivies: new Set() });
    expect(g.flatMap((x) => x.entries.map((e) => e.match.id))).toEqual(["c2"]);
  });

  it("Favoris : tous les matchs des compétitions suivies, sans filtre de jour", () => {
    const g = groupesDuTableau(flux, { jour: JOUR, filtre: "favoris", suivies: new Set(["ligue", "coupe"]) });
    expect(g.map((x) => x.competition.id)).toEqual(["coupe", "ligue"]);
    expect(g[0].entries.map((e) => e.match.id)).toEqual(["c2", "c1", "c3"]);
  });

  it("Favoris sans suivi : rien", () => {
    expect(groupesDuTableau(flux, { jour: JOUR, filtre: "favoris", suivies: new Set() })).toEqual([]);
  });
});

describe("jourLePlusProche", () => {
  it("préfère le prochain jour joué", () => {
    expect(jourLePlusProche(flux, "2026-09-25")).toBe("2026-09-27");
  });
  it("sinon le dernier jour joué", () => {
    expect(jourLePlusProche(flux, "2026-09-30")).toBe("2026-09-27");
    expect(jourLePlusProche(flux, "2026-10-01")).toBe("2026-09-27");
  });
  it("null sans aucune date", () => {
    expect(jourLePlusProche([], JOUR)).toBeNull();
  });
});

describe("temps réel", () => {
  it("remplacerMatchs ne touche que la compétition visée", () => {
    const suivant = remplacerMatchs(flux, "coupe", [match("c9")]);
    expect(suivant[0].matches.map((m) => m.id)).toEqual(["c9"]);
    expect(suivant[1]).toBe(flux[1]);
  });

  it("fusionnerAmicaux remplace les amicaux frais et garde les autres", () => {
    const avec: CompetitionFeed[] = [
      ...flux,
      { competition: FRIENDLY_COMPETITION, matches: [match("a1"), match("a2")] },
    ];
    const suivant = fusionnerAmicaux(avec, [match("a1", { status: "live" })]);
    const amicaux = suivant.find((f) => f.competition.id === FRIENDLY_COMP_ID)!;
    expect(amicaux.matches.map((m) => `${m.id}:${m.status}`)).toEqual(["a1:live", "a2:scheduled"]);
  });

  it("fusionnerAmicaux crée le groupe s'il n'existait pas", () => {
    const suivant = fusionnerAmicaux(flux, [match("a1", { status: "live" })]);
    expect(suivant.at(-1)?.competition.id).toBe(FRIENDLY_COMP_ID);
  });

  it("fusionnerAmicaux sans rien de neuf rend le même flux", () => {
    expect(fusionnerAmicaux(flux, [])).toBe(flux);
  });

  it("appliquerEcoutes préfère ce que les écouteurs ont dit à la réponse de l'API", () => {
    const ecoutes = new Map([["coupe", [match("c1", { status: "live", scoreHome: 1, scoreAway: 0 })]]]);
    const suivant = appliquerEcoutes(flux, ecoutes, null);
    expect(suivant[0].matches[0].scoreHome).toBe(1);
    expect(suivant[1]).toBe(flux[1]);
  });

  it("compterEnDirect", () => {
    expect(compterEnDirect(flux)).toBe(1);
  });
});
