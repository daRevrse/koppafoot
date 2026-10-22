import type { Competition } from "@/types";
import { competitionsPubliques, periodeCourte, rechercher, sectionsDeLAnnuaire } from "~/lib/annuaire";

const comp = (id: string, p: Partial<Competition> = {}): Competition =>
  ({
    id, name: id, slug: id, status: "group_stage", isValidated: true, venueCity: null, category: null,
    startDate: null, endDate: null, createdAt: "2026-01-01", ...p,
  } as Competition);

describe("competitionsPubliques", () => {
  it("écarte les brouillons et ce que l'administration n'a pas validé, comme le site", () => {
    const liste = competitionsPubliques([
      comp("brouillon", { status: "draft" }),
      comp("non-validee", { isValidated: false }),
      comp("ok"),
    ]);
    expect(liste.map((c) => c.id)).toEqual(["ok"]);
  });

  it("met d'abord ce qui se joue, puis ce qui vient, puis ce qui est fini ; le plus récent d'abord", () => {
    const liste = competitionsPubliques([
      comp("finie", { status: "completed", startDate: "2026-09-01" }),
      comp("inscriptions", { status: "registration", startDate: "2026-11-01" }),
      comp("ancienne", { status: "group_stage", startDate: "2026-08-01" }),
      comp("recente", { status: "knockout", startDate: "2026-10-01" }),
    ]);
    expect(liste.map((c) => c.id)).toEqual(["recente", "ancienne", "inscriptions", "finie"]);
  });
});

describe("rechercher", () => {
  const liste = [
    comp("Coupe de Lomé", { venueCity: "Lomé" }),
    comp("Tournoi des Dames", { category: "women" }),
    comp("Ligue de Kara", { venueCity: "Kara" }),
  ];

  it("cherche dans le nom et la ville, sans tenir compte des accents ni de la casse", () => {
    expect(rechercher(liste, "lome").map((c) => c.id)).toEqual(["Coupe de Lomé"]);
    expect(rechercher(liste, "KARA").map((c) => c.id)).toEqual(["Ligue de Kara"]);
  });

  it("et dans la catégorie, en français comme en anglais", () => {
    expect(rechercher(liste, "féminin").map((c) => c.id)).toEqual(["Tournoi des Dames"]);
    expect(rechercher(liste, "women").map((c) => c.id)).toEqual(["Tournoi des Dames"]);
  });

  it("rend tout sans recherche", () => {
    expect(rechercher(liste, "  ")).toHaveLength(3);
  });
});

describe("sectionsDeLAnnuaire", () => {
  it("range en cours, à venir, terminées, sans section vide", () => {
    const sections = sectionsDeLAnnuaire([
      comp("a", { status: "knockout" }),
      comp("b", { status: "completed" }),
      comp("c", { status: "registration_closed" }),
    ]);
    expect(sections.map((s) => [s.titre, s.competitions.map((c) => c.id)])).toEqual([
      ["En cours", ["a"]],
      ["À venir", ["c"]],
      ["Terminées", ["b"]],
    ]);
    expect(sectionsDeLAnnuaire([comp("a")]).map((s) => s.titre)).toEqual(["En cours"]);
  });
});

describe("periodeCourte", () => {
  it("garde l'année pour la fin seulement quand elle est la même", () => {
    expect(periodeCourte("2026-10-18", "2026-12-27")).toBe("Du 18 oct. au 27 déc. 2026");
    expect(periodeCourte("2026-12-20", "2027-01-10")).toBe("Du 20 déc. 2026 au 10 janv. 2027");
  });

  it("dit la borne qu'on connaît", () => {
    expect(periodeCourte("2026-10-18", null)).toBe("À partir du 18 oct. 2026");
    expect(periodeCourte(null, "2026-12-27")).toBe("Jusqu'au 27 déc. 2026");
    expect(periodeCourte(null, null)).toBeNull();
  });
});
