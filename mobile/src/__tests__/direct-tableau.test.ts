import type { CompetitionFeed } from "@/lib/direct-shared";
import { FRIENDLY_COMP_ID, FRIENDLY_COMPETITION } from "@/lib/friendlies-shared";
import type { Competition, CompMatch } from "@/types";
import {
  appliquerEcoutes, compterEnDirect, fusionnerAmicaux, groupesDuTableau, jourLePlusProche, joursAvecMatchs,
  basculerRepli, joursDeLaFrise, libelleDeLaMiseAJour, remplacerMatchs, sectionsDuDirect,
} from "~/lib/direct-tableau";

describe("libelleDeLaMiseAJour", () => {
  const ilYA = (jours: number) => new Date(Date.now() - jours * 86_400_000);

  it("donne l'heure seule pour aujourd'hui", () => {
    expect(libelleDeLaMiseAJour(new Date())).toMatch(/^à \d\d:\d\d$/);
  });

  it("dit « hier » pour hier", () => {
    expect(libelleDeLaMiseAJour(ilYA(1))).toMatch(/^hier à \d\d:\d\d$/);
  });

  it("donne la date au-delà : l'heure seule ferait croire que c'est aujourd'hui", () => {
    expect(libelleDeLaMiseAJour(ilYA(3))).toMatch(/^le .+ à \d\d:\d\d$/);
  });
});

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

describe("joursDeLaFrise", () => {
  it("quinze jours autour d'aujourd'hui", () => {
    const j = joursDeLaFrise("2026-09-24", "2026-09-24");
    expect(j).toHaveLength(15);
    expect(j[0]).toBe("2026-09-17");
    expect(j[14]).toBe("2026-10-01");
  });

  it("s'étend jusqu'au jour choisi quand il sort de la fenêtre", () => {
    const apres = joursDeLaFrise("2026-09-24", "2026-10-05");
    expect(apres[0]).toBe("2026-09-17");
    expect(apres[apres.length - 1]).toBe("2026-10-05");
    const avant = joursDeLaFrise("2026-09-24", "2026-09-10");
    expect(avant[0]).toBe("2026-09-10");
    expect(avant[avant.length - 1]).toBe("2026-10-01");
  });
});

describe("joursAvecMatchs", () => {
  it("les dates des matchs, sans les dates absentes", () => {
    const f: CompetitionFeed[] = [
      { competition: comp("x"), matches: [match("a"), match("b", { date: null }), match("c", { date: "2026-09-27" })] },
    ];
    expect([...joursAvecMatchs(f)].sort()).toEqual(["2026-09-24", "2026-09-27"]);
  });
});

describe("le repli d'une compétition", () => {
  const groupes = groupesDuTableau(flux, { jour: JOUR, filtre: "tous", suivies: new Set() });

  it("une compétition repliée garde son nombre de matchs, sans ses lignes", () => {
    const sections = sectionsDuDirect(groupes, new Set(["coupe"]));
    const coupe = sections.find((s) => s.key === "coupe")!;
    expect(coupe).toMatchObject({ repliee: true, nombre: 2, data: [] });
    const monde = sections.find((s) => s.key === "__monde__PL")!;
    expect(monde).toMatchObject({ repliee: false, nombre: 1 });
    expect(monde.data).toHaveLength(1);
  });

  it("un toucher replie, le suivant déplie", () => {
    const une = basculerRepli(new Set(), "coupe");
    expect([...une]).toEqual(["coupe"]);
    expect([...basculerRepli(une, "coupe")]).toEqual([]);
  });
});
