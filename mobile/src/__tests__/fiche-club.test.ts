import {
  cleJoueur, effectifParPoste, meneursDuClub, rangerLesMatchs, resultatDuMatch,
  statutPublicAmical, statutPublicCompetition, type MatchDuClub, type MatchPourMeneurs,
} from "@/lib/fiche-club";

// Le module vit côté site (src/lib/fiche-club) ; il est pur, et c'est ici
// que la suite de tests des modules partagés tourne.

describe("cleJoueur", () => {
  it("reconnaît le même compte en amical et en compétition", () => {
    expect(cleJoueur("abc", "abc", "Kafui")).toBe("uid:abc");
    expect(cleJoueur("u_abc", "abc", "Kafui")).toBe("uid:abc");
    expect(cleJoueur("u_abc", null, "Kafui")).toBe("uid:abc");
  });

  it("reconnaît le même joueur sans compte en amical et en compétition", () => {
    expect(cleJoueur("g1", null, "Ekoué")).toBe("ligne:g1");
    expect(cleJoueur("ghost_g1", null, "Ekoué")).toBe("ligne:g1");
  });

  it("retombe sur le nom quand il n'y a rien d'autre", () => {
    expect(cleJoueur(null, null, " Ekoué Bawa ")).toBe("nom:ekoué bawa");
  });
});

const amical = (p: Partial<MatchPourMeneurs>): MatchPourMeneurs => ({
  nous: ["club"], status: "completed", feuilles: [], evenements: [], ...p,
});

describe("meneursDuClub", () => {
  it("compte les buts et les passes du club, pas ceux de l'adversaire", () => {
    const { buteurs, passeurs } = meneursDuClub([
      amical({
        feuilles: [
          { playerId: "kafui", userId: "kafui", name: "Kafui Mensah" },
          { playerId: "selom", userId: "selom", name: "Selom Adjo" },
        ],
        evenements: [
          { type: "goal", teamId: "club", playerId: "kafui", playerName: "Kafui Mensah", assistPlayerId: "selom", assistPlayerName: "Selom Adjo" },
          { type: "goal", teamId: "eux", playerId: "x", playerName: "Tchao" },
        ],
      }),
    ]);
    expect(buteurs).toEqual([{ cle: "uid:kafui", nom: "Kafui Mensah", uid: "kafui", valeur: 1 }]);
    expect(passeurs).toEqual([{ cle: "uid:selom", nom: "Selom Adjo", uid: "selom", valeur: 1 }]);
  });

  it("additionne un joueur entre un amical et un tournoi", () => {
    const { buteurs } = meneursDuClub([
      amical({
        feuilles: [{ playerId: "kafui", userId: "kafui", name: "Kafui Mensah" }],
        evenements: [{ type: "goal", teamId: "club", playerId: "kafui" }],
      }),
      amical({
        nous: ["inscription"],
        feuilles: [{ playerId: "u_kafui", userId: "kafui", name: "Kafui Mensah" }],
        evenements: [{ type: "goal", teamId: "inscription", playerId: "u_kafui" }],
      }),
    ]);
    expect(buteurs[0]).toMatchObject({ cle: "uid:kafui", valeur: 2, uid: "kafui" });
  });

  it("ignore les buts contre son camp, refusés, et les matchs pas terminés", () => {
    const { buteurs } = meneursDuClub([
      amical({ evenements: [{ type: "goal", teamId: "club", playerId: "a", playerName: "A", detail: "csc" }] }),
      amical({ evenements: [{ type: "goal", teamId: "club", playerId: "b", playerName: "B", varStatus: "cancelled" }] }),
      amical({ status: "live", evenements: [{ type: "goal", teamId: "club", playerId: "c", playerName: "C" }] }),
    ]);
    expect(buteurs).toEqual([]);
  });

  it("lit un match renseigné après coup", () => {
    const { buteurs, passeurs } = meneursDuClub([
      amical({ renseignes: [
        { playerId: "kafui", nom: "Kafui Mensah", sansCompte: false, buts: 2, passes: 0 },
        { playerId: "g1", nom: "Ekoué Bawa", sansCompte: true, buts: 1, passes: 1 },
      ] }),
    ]);
    expect(buteurs.map((b) => [b.cle, b.valeur])).toEqual([["uid:kafui", 2], ["ligne:g1", 1]]);
    expect(passeurs.map((p) => p.cle)).toEqual(["ligne:g1"]);
  });

  it("départage à égalité par le nom, et garde les trois premiers", () => {
    const but = (id: string, nom: string) => ({ type: "goal", teamId: "club", playerId: id, playerName: nom });
    const { buteurs } = meneursDuClub([
      amical({ evenements: [but("d", "Dela"), but("b", "Bawa"), but("c", "Codjo"), but("a", "Afi"), but("a", "Afi")] }),
    ]);
    expect(buteurs.map((b) => b.nom)).toEqual(["Afi", "Bawa", "Codjo"]);
  });
});

describe("effectifParPoste", () => {
  it("range du but vers l'attaque, comptes et sans compte mêlés, puis par numéro", () => {
    const groupes = effectifParPoste([
      { nom: "Kafui Mensah", numero: "9", poste: "forward" },
      { nom: "Mawuena Doe", numero: "16", poste: "goalkeeper" },
      { nom: "Dodzi Ahadji", numero: "1", poste: "Gardien" },
      { nom: "Folly Akue", numero: "12", poste: "attaquant" },
      { nom: "Sans poste", numero: null, poste: null },
      { nom: "Selom Adjo", numero: "10", poste: "midfielder" },
      { nom: "Etse", numero: "7", poste: "midfielder" },
    ]);
    expect(groupes.map((g) => g.titre)).toEqual(["Gardiens", "Milieux", "Attaquants", "Poste non renseigné"]);
    expect(groupes[0].joueurs.map((j) => j.nom)).toEqual(["Dodzi Ahadji", "Mawuena Doe"]);
    expect(groupes[1].joueurs.map((j) => j.numero)).toEqual(["7", "10"]);
    expect(groupes[2].joueurs.map((j) => j.nom)).toEqual(["Kafui Mensah", "Folly Akue"]);
  });
});

const match = (p: Partial<MatchDuClub>): MatchDuClub => ({
  id: "m", lien: "/matches/m", competition: null, etape: null, date: "2026-09-20", heure: "16:00",
  statut: "a_venir", domicile: true, adversaire: { nom: "Eux", logo: null }, pour: null, contre: null, lieu: null, ...p,
});

describe("rangerLesMatchs", () => {
  it("met le direct en tête des matchs à venir, puis le plus proche", () => {
    const { aVenir } = rangerLesMatchs([
      match({ id: "loin", date: "2026-10-20" }),
      match({ id: "direct", statut: "en_direct", date: "2026-09-27" }),
      match({ id: "proche", date: "2026-10-01" }),
      match({ id: "sans-date", date: null }),
    ]);
    expect(aVenir.map((m) => m.id)).toEqual(["direct", "proche", "loin", "sans-date"]);
  });

  it("range les matchs joués du plus récent au plus ancien", () => {
    const { joues } = rangerLesMatchs([
      match({ id: "vieux", statut: "termine", date: "2026-09-01" }),
      match({ id: "hier", statut: "termine", date: "2026-09-26" }),
    ]);
    expect(joues.map((m) => m.id)).toEqual(["hier", "vieux"]);
  });
});

describe("statuts et résultats", () => {
  it("ne montre au public ni un défi, ni un brouillon, ni un match annulé", () => {
    expect(["challenge", "pending", "draft", "cancelled"].map(statutPublicAmical)).toEqual([null, null, null, null]);
    expect(statutPublicAmical("delayed")).toBe("a_venir");
    expect(statutPublicCompetition("cancelled")).toBeNull();
    expect(statutPublicCompetition("scheduled")).toBe("a_venir");
  });

  it("lit le résultat du côté du club", () => {
    expect(resultatDuMatch({ statut: "termine", pour: 3, contre: 1 })).toBe("V");
    expect(resultatDuMatch({ statut: "termine", pour: 1, contre: 1 })).toBe("N");
    expect(resultatDuMatch({ statut: "termine", pour: 0, contre: 2 })).toBe("D");
    expect(resultatDuMatch({ statut: "a_venir", pour: null, contre: null })).toBeNull();
  });
});
