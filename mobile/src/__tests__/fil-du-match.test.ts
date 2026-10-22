import { composerFil, TEXTES_FIL, type Deroule } from "@/lib/fil-du-match";
import type { Match } from "@/types";

// Le module vit côté site (src/lib/fil-du-match) ; il est pur, et c'est ici
// que la suite de tests des modules partagés tourne.

type Evt = NonNullable<Match["liveState"]>["events"][number];
const ev = (p: Partial<Evt>): Evt =>
  ({ id: `${Math.random()}`, type: "goal", period: 1, minute: 10, teamId: "A", createdAt: "", ...p } as Evt);
const t = TEXTES_FIL.fr;
const fini: Deroule = {
  commence: true, termine: true, periode: 4, heure: "16:00", score: { home: 1, away: 1 }, tab: { home: 4, away: 3 },
};

describe("composerFil", () => {
  it("pose le coup d'envoi, la mi-temps avec son score, et la fin avec les tirs au but", () => {
    const fil = composerFil([ev({ teamId: "A", period: 1 }), ev({ teamId: "B", period: 3, minute: 60 })], "A", fini, undefined, t);
    expect(fil.map((e) => (e.genre === "fait" ? "fait" : e.genre === "repere" ? e.cle : e.genre))).toEqual([
      "coup-d-envoi", "fait", "mi-temps", "fait", "fin",
    ]);
  });

  it("dit le fil vide d'un match commencé sans fait de jeu", () => {
    const fil = composerFil([], "A", { ...fini, termine: false, periode: 1, score: null, tab: null }, "Rien encore", t);
    expect(fil[fil.length - 1]).toEqual({ genre: "note", texte: "Rien encore" });
  });
});
