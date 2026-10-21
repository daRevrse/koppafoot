import type { Competition, CompMatch, CompTeam, Match } from "@/types";
import {
  additionnelEnCours, chronoAffiche, ficheDepuisAmical, ficheDepuisCompetition, libellePeriode, ongletAffiche,
  ongletParDefaut, ongletsDeLaFiche, type Fiche,
} from "~/lib/fiche-match";

type LiveState = NonNullable<CompMatch["liveState"]>;
const T0 = Date.parse("2026-10-21T16:00:00Z");
const enDirect = (p: Partial<LiveState> = {}): LiveState => ({
  currentPeriod: 1, timerStartAt: new Date(T0).toISOString(), timerOffset: 0, isTimerRunning: true, events: [], ...p,
} as LiveState);

const competition = {
  id: "c1", name: "Miabé CAN", slug: "miabe-can", logoUrl: "https://x/c.png",
  format: { half_duration: 40 } as unknown as Competition["format"],
} as Competition;

const equipe = (id: string, logoUrl: string | null) => ({ id, logoUrl, color: "#fff", shortName: id } as CompTeam);

const rencontre = (p: Partial<CompMatch> = {}): CompMatch => ({
  id: "m1", status: "scheduled", stage: "group", group: "A", round: null,
  homeTeamId: "A", awayTeamId: "B", homeTeamName: "Alpha", awayTeamName: "Beta",
  homeTeamLogo: "https://x/copie-a.png", awayTeamLogo: null,
  scoreHome: null, scoreAway: null, date: "2026-10-21", time: "16:00",
  venueName: "Stade de Kégué", venueCity: "Lomé", penaltyHome: null, penaltyAway: null,
  homeLineup: [], awayLineup: [], liveState: null,
  ...p,
} as CompMatch);

const amical = (p: Partial<Match> = {}): Match => ({
  id: "f1", status: "upcoming", homeTeamId: "A", awayTeamId: "B", homeTeamName: "Alpha", awayTeamName: "Beta",
  homeTeamLogo: null, awayTeamLogo: null, scoreHome: null, scoreAway: null, date: "2026-10-22", time: "17:00",
  venueName: "Terrain", venueCity: "Lomé", penaltyHome: null, penaltyAway: null,
  homeLineup: [], awayLineup: [], liveState: null, recordedAt: null, recordedScorers: [], isHome: true,
  ...p,
} as Match);

const SANS = { tchatVisible: false, hasStats: false, hasStandings: false, hasH2H: false };

describe("ficheDepuisCompetition", () => {
  const f = ficheDepuisCompetition(rencontre(), competition, [equipe("A", "https://x/fiche-a.png")]);

  it("prend l'écusson de la fiche d'équipe avant la copie du match", () => {
    expect(f.domicile.logo).toBe("https://x/fiche-a.png");
    expect(f.exterieur.logo).toBeNull();
  });

  it("dit la poule, la durée du format et le lien du site", () => {
    expect(f.competition).toMatchObject({ id: "c1", nom: "Miabé CAN", sousTitre: "Poule A" });
    expect(f.dureeMiTemps).toBe(40);
    expect(f.lienSite).toBe("/c/miabe-can/matches/m1");
  });
});

describe("ficheDepuisAmical", () => {
  it("lit un amical à venir comme un match programmé, sans compétition", () => {
    const f = ficheDepuisAmical(amical());
    expect(f).toMatchObject({ genre: "amical", statut: "scheduled", competition: null, dureeMiTemps: 45, lienSite: "/matches/f1" });
  });

  it("garde le direct et le terminé", () => {
    expect(ficheDepuisAmical(amical({ status: "live" })).statut).toBe("live");
    expect(ficheDepuisAmical(amical({ status: "completed" })).statut).toBe("completed");
  });
});

describe("les onglets", () => {
  const avant = ficheDepuisCompetition(rencontre(), competition, []);
  const direct = ficheDepuisCompetition(rencontre({ status: "live", liveState: enDirect() }), competition, []);

  it("un match de compétition à venir n'a que Infos et Compos", () => {
    expect(ongletsDeLaFiche(avant, SANS)).toEqual(["infos", "lineups"]);
  });

  it("le même, en direct, gagne le fil", () => {
    expect(ongletsDeLaFiche(direct, SANS)).toEqual(["feed", "infos", "lineups"]);
  });

  it("un amical a toujours son fil, et ses compos en dernier", () => {
    expect(ongletsDeLaFiche(ficheDepuisAmical(amical()), SANS)).toEqual(["feed", "infos", "lineups"]);
  });

  it("s'ouvre sur Infos avant le coup d'envoi, sur le fil en direct", () => {
    expect(ongletParDefaut(avant, false)).toBe("infos");
    expect(ongletParDefaut(direct, false)).toBe("feed");
  });

  it("un choix devenu invisible retombe sur l'onglet par défaut", () => {
    expect(ongletAffiche("stats", ["feed", "infos", "lineups"], "feed")).toBe("feed");
    expect(ongletAffiche("lineups", ["feed", "infos", "lineups"], "feed")).toBe("lineups");
  });
});

describe("la période et le chrono", () => {
  const fiche = (p: Partial<CompMatch>): Fiche => ficheDepuisCompetition(rencontre(p), competition, []);

  it("dit Terminé, l'avant-match, l'interruption, la séance et la période", () => {
    expect(libellePeriode(fiche({ status: "completed" }), T0)).toBe("Terminé");
    expect(libellePeriode(fiche({ status: "live", liveState: enDirect({ isTimerRunning: false, timerStartAt: null }) }), T0))
      .toBe("Coup d'envoi imminent");
    expect(libellePeriode(fiche({ status: "live", liveState: enDirect({ jeu: { raison: "interruption" } } as Partial<LiveState>) }), T0))
      .toBe("Match interrompu");
    expect(libellePeriode(fiche({ status: "live", liveState: enDirect({ currentPeriod: 3 }) }), T0)).toBe("2ème Mi-temps");
  });

  it("donne le chrono qui tourne, puis le chrono figé", () => {
    expect(chronoAffiche(fiche({ status: "live", liveState: enDirect() }), T0 + 12 * 60_000 + 5_000)).toBe("12:05");
    expect(chronoAffiche(
      fiche({ status: "live", liveState: enDirect({ isTimerRunning: false, timerStartAt: null, timerOffset: 47 * 60_000 }) }),
      T0,
    )).toBe("47:00");
    expect(chronoAffiche(fiche({ status: "scheduled" }), T0)).toBeNull();
  });

  it("annonce le temps additionnel de la mi-temps en cours", () => {
    expect(additionnelEnCours(fiche({ status: "live", liveState: enDirect({ addedTime: { first: 3 } } as Partial<LiveState>) }))).toBe(3);
    expect(additionnelEnCours(fiche({ status: "live", liveState: enDirect({ currentPeriod: 3, addedTime: { first: 3 } } as Partial<LiveState>) })))
      .toBeNull();
  });
});
