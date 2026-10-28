import { destinationDuLien, ecranDeLaDestination } from "~/lib/lien-notification";

describe("destinationDuLien", () => {
  it("lit un match de compétition, une compétition, une équipe", () => {
    expect(destinationDuLien("/c/g2-2026/matches/m1")).toEqual({ genre: "match", slug: "g2-2026", mid: "m1" });
    expect(destinationDuLien("/c/g2-2026")).toEqual({ genre: "competition", slug: "g2-2026" });
    expect(destinationDuLien("/c/g2-2026/teams/t1")).toEqual({ genre: "equipe", slug: "g2-2026", tid: "t1" });
  });

  it("lit un club et un joueur", () => {
    expect(destinationDuLien("/teams/club1")).toEqual({ genre: "club", id: "club1" });
    expect(destinationDuLien("/profile/u1")).toEqual({ genre: "joueur", uid: "u1" });
    expect(destinationDuLien("/teams")).toEqual({ genre: "site", lien: "/teams" });
  });

  it("lit le classement des joueurs", () => {
    expect(destinationDuLien("/top-players")).toEqual({ genre: "classement" });
    expect(destinationDuLien("/top-players/")).toEqual({ genre: "classement" });
    expect(destinationDuLien("/top-players/x")).toEqual({ genre: "site", lien: "/top-players/x" });
  });

  it("lit un amical", () => {
    expect(destinationDuLien("/matches/abc")).toEqual({ genre: "amical", id: "abc" });
  });

  it("ignore la requête, l'ancre et la barre finale", () => {
    expect(destinationDuLien("/c/g2-2026/matches/m1?via=push#fil")).toEqual({ genre: "match", slug: "g2-2026", mid: "m1" });
    expect(destinationDuLien("/c/g2-2026/")).toEqual({ genre: "competition", slug: "g2-2026" });
  });

  it("laisse au site ce que l'application ne sait pas montrer", () => {
    for (const lien of ["/matches", "/mes-reservations", "/c/g2-2026/rejoindre", "/organizer/competitions/c1/teams", "/c/g2-2026/matches/m1/affiche"]) {
      expect(destinationDuLien(lien)).toEqual({ genre: "site", lien });
    }
  });

  it("laisse au site une adresse mal encodée, sans planter", () => {
    expect(destinationDuLien("/c/%E9/matches/m1")).toEqual({ genre: "site", lien: "/c/%E9/matches/m1" });
  });
});

describe("ecranDeLaDestination", () => {
  it("ouvre l'écran natif une fois le slug lu", () => {
    expect(ecranDeLaDestination({ genre: "match", slug: "g2", mid: "m1" }, "c1"))
      .toEqual({ pathname: "/match/[cid]/[mid]", params: { cid: "c1", mid: "m1" } });
    expect(ecranDeLaDestination({ genre: "equipe", slug: "g2", tid: "t1" }, "c1"))
      .toEqual({ pathname: "/equipe/[cid]/[tid]", params: { cid: "c1", tid: "t1" } });
    expect(ecranDeLaDestination({ genre: "competition", slug: "g2" }, "c1"))
      .toEqual({ pathname: "/competition/[cid]", params: { cid: "c1" } });
    expect(ecranDeLaDestination({ genre: "amical", id: "a1" }, null)).toEqual({ pathname: "/amical/[id]", params: { id: "a1" } });
  });

  it("ouvre la fiche d'un club ou d'un joueur, sans slug à lire", () => {
    expect(ecranDeLaDestination({ genre: "club", id: "club1" }, null)).toEqual({ pathname: "/club/[id]", params: { id: "club1" } });
    expect(ecranDeLaDestination({ genre: "joueur", uid: "u1" }, null)).toEqual({ pathname: "/joueur/[uid]", params: { uid: "u1" } });
  });

  it("ouvre le classement des joueurs", () => {
    expect(ecranDeLaDestination({ genre: "classement" }, null)).toBe("/classement");
  });

  it("rend la main au site quand le slug ne mène à aucune compétition", () => {
    expect(ecranDeLaDestination({ genre: "match", slug: "inconnue", mid: "m1" }, null)).toBeNull();
    expect(ecranDeLaDestination({ genre: "site", lien: "/mes-reservations" }, null)).toBeNull();
  });
});
