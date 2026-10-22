import type { Entry } from "@/lib/direct-shared";
import { FRIENDLY_COMP_ID } from "@/lib/friendlies-shared";
import type { Competition, CompMatch } from "@/types";
import { routeDuMatch } from "~/lib/routes";

const entree = (cid: string, mid: string): Entry => ({
  competition: { id: cid, slug: cid, name: cid } as Competition,
  match: { id: mid } as CompMatch,
});

describe("routeDuMatch", () => {
  it("un match de compétition ouvre sa fiche native", () => {
    expect(routeDuMatch(entree("c1", "m1"))).toEqual({ pathname: "/match/[cid]/[mid]", params: { cid: "c1", mid: "m1" } });
  });

  it("un amical ouvre la fiche amicale", () => {
    expect(routeDuMatch(entree(FRIENDLY_COMP_ID, "f1"))).toEqual({ pathname: "/amical/[id]", params: { id: "f1" } });
  });

  it("un match du monde n'a pas de fiche", () => {
    expect(routeDuMatch(entree("__monde__PL", "w1"))).toBeNull();
  });
});
