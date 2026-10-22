import type { Competition } from "@/types";
import { clubsTrouves, competitionsTrouvees, rechercheLancee, type ClubTrouve } from "~/lib/recherche";

const comp = (id: string, p: Partial<Competition> = {}): Competition =>
  ({ id, name: id, status: "group_stage", isValidated: true, venueCity: null, category: null, startDate: null, createdAt: "", ...p } as Competition);

const club = (id: string, p: Partial<ClubTrouve> = {}): ClubTrouve =>
  ({ id, nom: id, ville: null, logo: null, fantome: false, recrute: false, ...p });

describe("rechercheLancee", () => {
  it("attend deux lettres, comme le site", () => {
    expect(rechercheLancee("a")).toBe(false);
    expect(rechercheLancee(" ab ")).toBe(true);
  });
});

describe("competitionsTrouvees", () => {
  it("cherche dans les compétitions publiques, huit au plus", () => {
    const liste = Array.from({ length: 10 }, (_, i) => comp(`Coupe ${i}`, { venueCity: "Lomé" }));
    expect(competitionsTrouvees([...liste, comp("Brouillon", { status: "draft" })], "lome")).toHaveLength(8);
    expect(competitionsTrouvees([comp("Brouillon de Lomé", { status: "draft" })], "lome")).toEqual([]);
  });
});

describe("clubsTrouves", () => {
  it("cherche dans le nom et la ville, sans les clubs fantômes, ceux qui recrutent d'abord", () => {
    const trouves = clubsTrouves([
      club("Zébus de Lomé", { ville: "Lomé" }),
      club("Fantôme FC", { ville: "Lomé", fantome: true }),
      club("Aigles", { ville: "Lomé", recrute: true }),
      club("Kara United", { ville: "Kara" }),
    ], "lome");
    expect(trouves.map((c) => c.id)).toEqual(["Aigles", "Zébus de Lomé"]);
  });
});
