import {
  calculerClassements, classementPar, fusionnerClassements, type MatchAClasser,
} from "@/lib/classement";
import type { LineupEntry } from "@/types";

// Le module vit côté site (src/lib/classement) ; il est pur, et c'est ici que
// la suite de tests des modules partagés tourne.

type Evenement = NonNullable<MatchAClasser["liveState"]>["events"][number];

const ev = (p: Partial<Evenement>): Evenement =>
  ({ id: `${Math.random()}`, period: 1, minute: 10, createdAt: "", teamId: "A", type: "goal", ...p } as Evenement);

const ligne = (playerId: string, userId: string | null, position: LineupEntry["position"], name = playerId): LineupEntry => ({
  playerId, name, number: "", role: "starter", userId, position,
});

/** Alpha (A) contre Beta (B), le jour `i` de septembre. */
const match = (i: number, p: Partial<MatchAClasser> = {}): MatchAClasser => ({
  id: `m${i}`, competitionId: "c", status: "completed",
  date: `2026-09-${String(10 + i).padStart(2, "0")}`, time: "15:00",
  homeTeamId: "A", awayTeamId: "B", homeTeamName: "Alpha", awayTeamName: "Beta",
  scoreHome: 1, scoreAway: 0,
  homeLineup: [
    ligne("L1", "U1", "forward", "Buteur"),
    ligne("G1", "U2", "goalkeeper", "Gardien"),
    ligne("D1", "U3", "defender", "Défenseur"),
  ],
  awayLineup: [ligne("X1", "U4", "forward", "Adversaire")],
  homeOnPitch: [], awayOnPitch: [],
  liveState: {
    currentPeriod: 2, timerStartAt: null, timerOffset: 0, isTimerRunning: false,
    events: [
      ev({ type: "goal", teamId: "A", playerId: "L1", minute: 20 }),
      ev({ type: "save", teamId: "A", playerId: "G1", minute: 30 }),
      ev({ type: "save", teamId: "A", playerId: "G1", minute: 60 }),
    ],
  },
  ...p,
} as MatchAClasser);

describe("calculerClassements", () => {
  const cinq = [1, 2, 3, 4, 5].map((i) => match(i));

  it("classe gardiens et joueurs de champ dans la même liste, à la note", () => {
    const { parNote } = calculerClassements(cinq);
    const cles = parNote.map((l) => l.cle);
    expect(cles).toContain("uid:U1");
    expect(cles).toContain("uid:U2");
    // Deux arrêts et un but inviolé (6 + 0,7 + 0,5 = 7,2) valent un but (7,2) ;
    // à égalité, celui qui a contribué passe devant.
    const gardien = parNote.find((l) => l.cle === "uid:U2")!;
    const buteur = parNote.find((l) => l.cle === "uid:U1")!;
    expect(gardien.note).toBe(7.2);
    expect(buteur.note).toBe(7.2);
    expect(cles.indexOf("uid:U1")).toBeLessThan(cles.indexOf("uid:U2"));
  });

  it("distingue le gardien, et montre ce qui a fait sa note", () => {
    const { parNote } = calculerClassements(cinq);
    const gardien = parNote.find((l) => l.cle === "uid:U2")!;
    expect(gardien.gardien).toBe(true);
    expect(gardien.arrets).toBe(10);
    expect(gardien.cleanSheets).toBe(5);
    expect(parNote.find((l) => l.cle === "uid:U1")!.gardien).toBe(false);
    expect(gardien.equipe).toBe("Alpha");
    expect(gardien.notes).toHaveLength(5);
  });

  it("ne classe pas à la note sous trois matchs notés, mais garde ses buts", () => {
    const { parNote, parContribution } = calculerClassements([match(1), match(2)]);
    expect(parNote).toHaveLength(0);
    expect(parContribution.map((l) => l.cle)).toEqual(["uid:U1"]);
  });

  it("n'accorde ni but ni note au but annulé par la VAR", () => {
    const annule = [1, 2, 3].map((i) => match(i, {
      liveState: {
        currentPeriod: 2, timerStartAt: null, timerOffset: 0, isTimerRunning: false,
        events: [ev({ type: "goal", teamId: "A", playerId: "L1", minute: 20, varStatus: "cancelled" })],
      },
    }));
    const { parNote, parContribution } = calculerClassements(annule);
    expect(parContribution).toHaveLength(0);
    expect(parNote.find((l) => l.cle === "uid:U1")!.note).toBe(6);
  });

  it("compte les buts d'un match renseigné après coup, sans le noter", () => {
    const renseigne = match(9, {
      homeLineup: [], awayLineup: [], liveState: null,
      contributionsDirectes: [{ playerId: "U1", nom: "Buteur", userId: "U1", buts: 2, passes: 0 }],
    });
    const { parContribution } = calculerClassements([renseigne, ...cinq.slice(0, 3)]);
    const buteur = parContribution.find((l) => l.cle === "uid:U1")!;
    expect(buteur.buts).toBe(5);
    expect(buteur.notes).toHaveLength(3);
  });

  it("reconnaît un gardien sans poste déclaré à ses arrêts", () => {
    const sansPoste = [1, 2, 3].map((i) => match(i, {
      homeLineup: [ligne("G1", "U2", null, "Gardien")],
    }));
    const { parNote } = calculerClassements(sansPoste);
    expect(parNote.find((l) => l.cle === "uid:U2")!.gardien).toBe(true);
  });

  it("n'invente personne avec l'adversaire hors plateforme d'un amical", () => {
    // Chaque amical contre un adversaire hors plateforme lui génère son onze,
    // « Joueur 1 » à « Joueur N », sous des identifiants neufs (voir
    // ghostOpponentLineup). Classés au nom, tous les « Joueur 9 » de la
    // plateforme n'en feraient qu'un.
    const amicaux = [1, 2, 3].map((i) => match(i, {
      awayTeamId: "", awayTeamName: "Les Inconnus",
      awayLineup: [ligne(`ext-a${i}-9`, null, null, "Joueur 9")],
      liveState: {
        currentPeriod: 2, timerStartAt: null, timerOffset: 0, isTimerRunning: false,
        events: [
          ev({ type: "goal", teamId: "A", playerId: "L1", minute: 20 }),
          ev({ type: "goal", teamId: "", playerId: `ext-a${i}-9`, minute: 70 }),
        ],
      },
    }));
    const { parNote, parContribution } = calculerClassements(amicaux);
    expect([...parNote, ...parContribution].map((l) => l.cle)).not.toContain("nom:joueur 9");
    // Le camp qui a un vrai effectif, lui, est classé comme d'habitude.
    expect(parContribution.map((l) => l.cle)).toEqual(["uid:U1"]);
    expect(parNote.map((l) => l.cle)).toContain("uid:U1");
  });

  it("classe un joueur sans compte à son nom, et dit où retrouver sa ligne", () => {
    // Une compétition entièrement composée de joueurs sans compte doit remplir
    // le classement comme une autre. Leur photo, posée sur la ligne d'effectif
    // ou sur la fiche du club, se retrouve par la ligne de la feuille.
    const sansCompte = [1, 2, 3].map((i) => {
      const id = i === 3 ? "ghost_k" : "S1";
      return match(i, {
        competitionId: i === 3 ? "c2" : "c",
        homeTeamId: i === 3 ? "A2" : "A",
        homeLineup: [ligne("L1", "U1", "forward", "Buteur"), ligne(id, null, "forward", "Kossi Owens ")],
        liveState: {
          currentPeriod: 2, timerStartAt: null, timerOffset: 0, isTimerRunning: false,
          events: [ev({ type: "goal", teamId: i === 3 ? "A2" : "A", playerId: id, minute: 20 })],
        },
      });
    });
    const { parContribution, lignesSansCompte } = calculerClassements(sansCompte);
    const kossi = parContribution.find((l) => l.cle === "nom:kossi owens")!;
    expect(kossi.uid).toBeNull();
    expect(kossi.buts).toBe(3);
    // La plus récente, celle du club qu'on affiche sous son nom.
    expect(lignesSansCompte.get("nom:kossi owens")).toEqual({ competitionId: "c2", teamId: "A2", playerId: "ghost_k" });
    // Un compte n'en a pas besoin : sa photo est celle de son profil.
    expect(lignesSansCompte.has("uid:U1")).toBe(false);
  });
});

describe("fusionnerClassements et classementPar", () => {
  const { parNote, parContribution } = calculerClassements([1, 2, 3].map((i) => match(i)));

  it("publie chacun une fois, avec ses deux rangs et ses flèches", () => {
    const joueurs = fusionnerClassements({ parNote, parContribution }, { note: ["uid:U2", "uid:U1"], contribution: [] });
    expect(new Set(joueurs.map((l) => l.cle)).size).toBe(joueurs.length);
    const buteur = joueurs.find((l) => l.cle === "uid:U1")!;
    expect(buteur.rangNote).toBe(1);
    expect(buteur.rangContribution).toBe(1);
    expect(buteur.mouvementNote).toBe(1);
    expect(buteur.mouvementContribution).toBeNull();
    expect(joueurs.find((l) => l.cle === "uid:U2")!.rangContribution).toBeNull();
  });

  it("rend chaque tri dans son ordre", () => {
    const joueurs = fusionnerClassements({ parNote, parContribution }, { note: [], contribution: [] });
    expect(classementPar(joueurs, "note").map((l) => l.rangNote)).toEqual(parNote.map((_, i) => i + 1));
    expect(classementPar(joueurs, "contribution").map((l) => l.cle)).toEqual(["uid:U1"]);
  });
});
