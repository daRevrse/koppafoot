import type { Competition, CompMatch, CompTeam, Match } from "@/types";
import {
  additionnelEnCours, chronoAffiche, ficheDepuisAmical, ficheDepuisCompetition, formatCompteARebours, libellePeriode,
  ongletAffiche, ongletParDefaut, ongletsDeLaFiche, resteAvantCoupDEnvoi, texteDePartage, type Fiche,
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

const SANS = { tchatVisible: false };

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
    expect(ongletParDefaut(avant)).toBe("infos");
    expect(ongletParDefaut(direct)).toBe("feed");
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

describe("le partage et le compte à rebours", () => {
  it("dit le rendez-vous avant, le score pendant et après", () => {
    const avant = ficheDepuisCompetition(rencontre(), competition, []);
    expect(texteDePartage(avant)).toBe("Alpha — Beta, le 2026-10-21 à 16:00 — Miabé CAN");
    const direct = ficheDepuisCompetition(rencontre({ status: "live", scoreHome: 1, scoreAway: 0, liveState: enDirect() }), competition, []);
    expect(texteDePartage(direct)).toBe("Alpha — Beta, 1-0 en direct — Miabé CAN");
    const fini = ficheDepuisAmical(amical({ status: "completed", scoreHome: 2, scoreAway: 2 }));
    expect(texteDePartage(fini)).toBe("Alpha — Beta, score final 2-2");
  });

  it("compte les dernières vingt-quatre heures, et rien au-delà", () => {
    const f = ficheDepuisCompetition(rencontre({ date: "2026-10-21", time: "18:00" }), competition, []);
    const coupDEnvoi = new Date("2026-10-21T18:00:00").getTime();
    expect(resteAvantCoupDEnvoi(f, coupDEnvoi - 90 * 60_000)).toBe(90 * 60_000);
    expect(resteAvantCoupDEnvoi(f, coupDEnvoi - 25 * 3_600_000)).toBeNull();
    expect(resteAvantCoupDEnvoi(f, coupDEnvoi + 1000)).toBeNull();
    expect(formatCompteARebours(90 * 60_000 + 5_000)).toBe("01:30:05");
  });
});

describe("le contexte d'une rencontre de compétition", () => {
  const joue = (id: string, dom: string, ext: string, sh: number, sa: number, date: string, stage = "group") =>
    rencontre({
      id, homeTeamId: dom, awayTeamId: ext, homeTeamName: dom, awayTeamName: ext, scoreHome: sh, scoreAway: sa,
      status: "completed", date, time: "10:00", stage: stage as CompMatch["stage"],
    });
  const matchs = [
    joue("h1", "A", "B", 3, 1, "2026-09-20"),
    joue("p1", "A", "C", 2, 0, "2026-10-01"),
    joue("h2", "B", "A", 1, 1, "2026-10-05"),
    joue("p3", "A", "D", 0, 3, "2026-10-10"),
    joue("x1", "A", "E", 5, 0, "2026-10-12", "exhibition"),
    joue("f1", "A", "F", 1, 0, "2026-11-01"),
  ];
  const ce = rencontre({ id: "m1", homeTeamId: "A", awayTeamId: "B", date: "2026-10-21", time: "16:00" });
  const f = ficheDepuisCompetition(ce, competition, [], matchs);

  it("donne la forme officielle de chaque camp, avant ce match, du plus ancien au plus récent", () => {
    expect(f.domicile.forme).toEqual(["V", "V", "N", "D"]);
    expect(f.contexte.formes.exterieur.map((r) => r.resultat)).toEqual(["D", "N"]);
  });

  it("trouve le face-à-face, et son bilan du point de vue du domicile de ce match", () => {
    expect(f.contexte.faceAFace.map((m) => m.id).sort()).toEqual(["h1", "h2"]);
    expect(f.contexte.bilanFaceAFace).toEqual({ home: 1, draw: 1, away: 0 });
  });

  it("ouvre Classement en phase de groupes, H2H avec un face-à-face", () => {
    const equipes = ["A", "B", "C"].map((id) => ({ ...equipe(id, null), name: id, group: "A" } as CompTeam));
    const avecPoule = ficheDepuisCompetition(ce, { ...competition, format: { points: { win: 3, draw: 1, loss: 0 } } } as unknown as Competition, equipes, matchs);
    expect(avecPoule.contexte.poule?.group).toBe("A");
    expect(ongletsDeLaFiche(avecPoule, { tchatVisible: false })).toEqual(["infos", "lineups", "standings", "h2h"]);
    const enFinale = ficheDepuisCompetition({ ...ce, stage: "knockout" } as CompMatch, competition, equipes, matchs);
    expect(enFinale.contexte.poule).toBeNull();
  });

  it("ouvre les Stats d'un match joué avec ses faits", () => {
    const avecFaits = ficheDepuisCompetition(rencontre({
      status: "completed", scoreHome: 1, scoreAway: 0,
      liveState: enDirect({ isTimerRunning: false, timerOffset: 90 * 60_000, events: [
        { id: "e1", type: "goal", period: 1, minute: 10, teamId: "A", playerId: "p", playerName: "P", createdAt: "" },
      ] } as Partial<LiveState>),
    }), competition, []);
    expect(avecFaits.contexte.aDesStats).toBe(true);
    expect(ongletsDeLaFiche(avecFaits, { tchatVisible: false })).toContain("stats");
  });

  it("un amical n'a jamais ni classement ni face-à-face", () => {
    const a = ficheDepuisAmical(amical({ status: "completed", scoreHome: 1, scoreAway: 0 }));
    expect(a.contexte.poule).toBeNull();
    expect(a.contexte.faceAFace).toEqual([]);
    expect(ongletsDeLaFiche(a, { tchatVisible: false })).not.toContain("standings");
  });
});

describe("qui modère le tchat", () => {
  it("le staff de la compétition", () => {
    const comp = { ...competition, organizerIds: ["o1"], moderatorIds: ["m1"] } as Competition;
    expect(ficheDepuisCompetition(rencontre(), comp, []).moderateurs).toEqual(["o1", "m1"]);
  });

  it("les deux managers et les modérateurs d'un amical", () => {
    const a = ficheDepuisAmical(amical({ managerId: "g1", awayManagerId: "g2", moderatorIds: ["m1"] } as Partial<Match>));
    expect(a.moderateurs).toEqual(["g1", "g2", "m1"]);
  });
});
