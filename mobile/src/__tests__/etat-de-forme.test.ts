import {
  calculerFormes, cleFormeCompte, cleFormeLigne, conditionASignaler, conditionEnVigueur,
  formeDepuisMatchs, joursDepuis, lireCondition, niveauDeForme, versFirestoreCondition,
  type MatchDeForme, type MatchPourForme,
} from "@/lib/etat-de-forme";

// Le module vit côté site (src/lib/etat-de-forme) ; il est pur, et c'est ici
// que la suite de tests des modules partagés tourne.

type Evenement = NonNullable<MatchPourForme["liveState"]>["events"][number];

const evenement = (p: Partial<Evenement>): Evenement =>
  ({ id: `${Math.random()}`, period: 1, minute: 10, createdAt: "", teamId: "A", type: "goal", ...p } as Evenement);

/** Alpha (A) bat Beta (B) 1-0 : L1 marque, le gardien sans compte G1 garde sa cage. */
const match = (i: number, p: Partial<MatchPourForme> = {}): MatchPourForme => ({
  id: `m${i}`,
  homeTeamId: "A", awayTeamId: "B", homeTeamName: "Alpha", awayTeamName: "Beta",
  date: `2026-09-${String(10 + i).padStart(2, "0")}`, time: "15:00",
  scoreHome: 1, scoreAway: 0, status: "completed",
  homeLineup: [
    { playerId: "L1", name: "Buteur", number: "9", role: "starter", userId: "U1" },
    { playerId: "G1", name: "Gardien", number: "1", role: "starter", userId: null, position: "goalkeeper" },
    { playerId: "S1", name: "Remplaçant", number: "12", role: "substitute", userId: "U3" },
  ],
  awayLineup: [{ playerId: "X1", name: "Adversaire", number: "5", role: "starter", userId: "U2" }],
  homeOnPitch: [], awayOnPitch: [],
  liveState: {
    currentPeriod: 2, timerStartAt: null, timerOffset: 0, isTimerRunning: false,
    events: [
      evenement({ type: "goal", teamId: "A", playerId: "L1", minute: 20 }),
      evenement({ type: "yellow_card", teamId: "B", playerId: "X1", minute: 30 }),
    ],
  },
  lien: `/matches/m${i}`,
  amical: true,
  ...p,
});

const ligne = (note: number | null): MatchDeForme => ({
  matchId: "m", lien: null, date: null, adversaire: "", resultat: "N", score: "0-0",
  note, minutes: 90, faits: 1, buts: 0, passes: 0,
});

describe("calculerFormes", () => {
  const matchs = [1, 2, 3, 4, 5, 6, 7].map((i) => match(i));
  matchs[6].liveState!.events.push(
    evenement({ type: "goal", teamId: "A", playerId: "L1", minute: 50, varStatus: "cancelled" }),
  );
  matchs.push(match(8, { status: "live" }));
  const formes = calculerFormes(matchs);

  it("garde les cinq derniers matchs terminés, le plus récent d'abord", () => {
    const f = formes.get(cleFormeCompte("U1"))!;
    expect(f.matchs.map((m) => m.matchId)).toEqual(["m7", "m6", "m5", "m4", "m3"]);
    expect(f.dernierMatch).toBe("2026-09-17");
    expect(f.matchs[0]).toMatchObject({ resultat: "V", score: "1-0", lien: "/matches/m7" });
  });

  it("ne compte pas le but annulé par la VAR", () => {
    const f = formes.get(cleFormeCompte("U1"))!;
    expect(f.matchs[0].buts).toBe(1);
    expect(f.matchs[0].note).toBe(7.2);
    expect(f.niveau).toBe("excellente");
  });

  it("range un joueur sans compte sous sa ligne dans son équipe", () => {
    const f = formes.get(cleFormeLigne("A", "G1"))!;
    expect(f.matchs[0].note).toBe(6.5);
  });

  it("ne suit une ligne sans compte que sur un amical, et jamais un adversaire hors plateforme", () => {
    const enCompetition = calculerFormes([match(1, { amical: false })]);
    expect(enCompetition.get(cleFormeLigne("A", "G1"))).toBeUndefined();
    expect(enCompetition.get(cleFormeCompte("U1"))).toBeDefined();

    const horsPlateforme = calculerFormes([match(1, {
      awayLineup: [{ playerId: "ext-ab12cd-1", name: "Joueur 1", number: "1", role: "starter" }],
    })]);
    expect(horsPlateforme.get(cleFormeLigne("B", "ext-ab12cd-1"))).toBeUndefined();
  });

  it("ne note pas le remplaçant resté sur le banc", () => {
    const f = formes.get(cleFormeCompte("U3"))!;
    expect(f.matchs).toHaveLength(5);
    expect(f.matchs[0].note).toBeNull();
    expect(f.niveau).toBeNull();
  });

  it("lit le match du point de vue de l'adversaire", () => {
    const f = formes.get(cleFormeCompte("U2"))!;
    expect(f.matchs[0]).toMatchObject({ resultat: "D", score: "0-1", note: 5.5 });
    expect(f.niveau).toBe("faible");
  });
});

describe("formeDepuisMatchs", () => {
  it("pondère vers le récent et donne la pente", () => {
    const f = formeDepuisMatchs([ligne(8), ligne(8), ligne(6), ligne(6), ligne(6)]);
    expect(f.indice).toBe(7.2);
    expect(f.tendance).toBe("hausse");
  });

  it("se tait sous deux matchs notés", () => {
    expect(formeDepuisMatchs([ligne(5), ligne(null), ligne(null)]).niveau).toBeNull();
  });

  it("place les seuils", () => {
    expect(niveauDeForme(7.2)).toBe("excellente");
    expect(niveauDeForme(7.19)).toBe("bonne");
    expect(niveauDeForme(5.59)).toBe("faible");
  });
});

describe("la condition", () => {
  const blesse = lireCondition({
    statut: "blesse", retour_prevu: "2026-10-12", note: "  entorse  ", declaree_le: "2026-09-20T10:00:00Z",
  });

  it("se lit sans faire confiance à la base", () => {
    expect(blesse).toEqual({
      statut: "blesse", retourPrevu: "2026-10-12", note: "entorse", declareeLe: "2026-09-20T10:00:00Z",
    });
    expect(lireCondition({ statut: "zombie" })).toBeNull();
    expect(lireCondition({ statut: "incertain", retour_prevu: "12/10" })!.retourPrevu).toBeNull();
    expect(lireCondition({ statut: "apte", retour_prevu: "2026-10-12" })!.retourPrevu).toBeNull();
  });

  it("s'efface le jour du retour", () => {
    expect(conditionEnVigueur(blesse, "2026-10-11")?.statut).toBe("blesse");
    expect(conditionEnVigueur(blesse, "2026-10-12")).toBeNull();
  });

  it("ne signale pas un joueur apte", () => {
    expect(conditionASignaler(lireCondition({ statut: "apte" }), "2026-09-26")).toBeNull();
  });

  it("s'écrit sans date de retour quand on est apte", () => {
    expect(versFirestoreCondition(
      { statut: "apte", retourPrevu: "2026-10-12", note: " " },
      new Date("2026-09-26T00:00:00Z"),
    )).toEqual({ statut: "apte", retour_prevu: null, note: null, declaree_le: "2026-09-26T00:00:00.000Z" });
  });

  it("compte les jours", () => {
    expect(joursDepuis("2026-09-01", "2026-09-26")).toBe(25);
    expect(joursDepuis(null)).toBeNull();
  });
});
