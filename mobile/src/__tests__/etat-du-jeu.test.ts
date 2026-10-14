import {
  JEU_AVANT, apresBut, apresIssuePenalty, apresPenaltyAccorde, apresRetraitDuBut,
  arretDeJeu, balleApres, champsDeTransition, interrompre, lireJeu, miTemps,
  relancer, reprendreLeMatch, verrou, type Jeu,
} from "@/lib/etat-du-jeu";

const EN_JEU: Jeu = { balle: "en_jeu", raison: null, engage: null, premier: "home" };

describe("lireJeu", () => {
  const live = (ls: Record<string, unknown>) =>
    ({ status: "live", liveState: { currentPeriod: 1, isTimerRunning: false, timerOffset: 0, ...ls } });

  it("lit l'état enregistré quand il y en a un", () => {
    const jeu: Jeu = { balle: "morte", raison: "but", engage: "away", premier: "home" };
    expect(lireJeu(live({ jeu, isTimerRunning: true }))).toEqual(jeu);
  });

  // Un match lancé avant l'état du jeu n'en a pas : on le déduit, pour qu'une
  // console rouverte en cours de match reste utilisable.
  it("déduit l'avant-match d'un chrono qui n'a jamais tourné", () => {
    expect(lireJeu(live({}))).toEqual(JEU_AVANT);
  });

  it("déduit le jeu d'un chrono qui tourne", () => {
    expect(lireJeu(live({ isTimerRunning: true, timerOffset: 600_000 }))).toMatchObject({ balle: "en_jeu" });
  });

  it("déduit la mi-temps de la période 2", () => {
    expect(lireJeu(live({ currentPeriod: 2, timerOffset: 2_700_000 }))).toMatchObject({ balle: "morte", raison: "mi_temps" });
  });

  it("déduit un arrêt de jeu d'un chrono arrêté en cours de période", () => {
    expect(lireJeu(live({ currentPeriod: 3, timerOffset: 3_000_000 }))).toMatchObject({ balle: "morte", raison: "arret" });
  });
});

describe("le but", () => {
  it("met le ballon mort, l'engagement revient à l'équipe qui a encaissé", () => {
    expect(apresBut(EN_JEU, "home")).toEqual({ balle: "morte", raison: "but", engage: "away", premier: "home" });
  });

  it("se relance sur l'engagement, et le jeu reprend", () => {
    expect(relancer(apresBut(EN_JEU, "home"), "away")).toEqual(EN_JEU);
  });

  it("retiré, laisse le scoreur relancer : la console ne devine pas", () => {
    expect(apresRetraitDuBut(apresBut(EN_JEU, "home"))).toMatchObject({ balle: "morte", raison: "arret", engage: null });
  });

  it("retiré alors que le jeu a repris, ne change rien", () => {
    expect(apresRetraitDuBut(EN_JEU)).toEqual(EN_JEU);
  });
});

describe("le penalty", () => {
  const accorde = apresPenaltyAccorde(EN_JEU);

  it("met le ballon mort jusqu'à son issue", () => {
    expect(accorde).toMatchObject({ balle: "morte", raison: "penalty" });
  });

  it("marqué, attend l'engagement de l'adversaire", () => {
    expect(apresIssuePenalty(accorde, "marque", "home")).toMatchObject({ balle: "morte", raison: "but", engage: "away" });
  });

  it("raté, arrêté ou retiré, rend le jeu", () => {
    expect(apresIssuePenalty(accorde, "rate", "home")).toEqual(EN_JEU);
    expect(apresIssuePenalty(accorde, "arrete", "home")).toEqual(EN_JEU);
    expect(apresIssuePenalty(accorde, "retire", "home")).toEqual(EN_JEU);
  });

  it("marqué alors que le jeu avait déjà repris, reste un but", () => {
    expect(apresIssuePenalty(EN_JEU, "marque", "away")).toMatchObject({ raison: "but", engage: "home" });
  });

  it("raté alors que le jeu avait déjà repris, ne change rien", () => {
    expect(apresIssuePenalty(EN_JEU, "rate", "away")).toEqual(EN_JEU);
  });
});

describe("arrêts, mi-temps, interruption", () => {
  it("l'arrêt de jeu se relance par le camp touché", () => {
    expect(relancer(arretDeJeu(EN_JEU), "away")).toEqual(EN_JEU);
  });

  it("le coup d'envoi retient qui a engagé", () => {
    expect(relancer(JEU_AVANT, "away")).toEqual({ balle: "en_jeu", raison: null, engage: null, premier: "away" });
  });

  it("la mi-temps donne l'engagement à l'équipe qui n'a pas engagé", () => {
    expect(miTemps(EN_JEU)).toEqual({ balle: "morte", raison: "mi_temps", engage: "away", premier: "home" });
  });

  it("la mi-temps sans coup d'envoi connu n'impose personne", () => {
    expect(miTemps({ ...EN_JEU, premier: null })).toMatchObject({ engage: null });
  });

  it("l'interruption ne se relance pas d'un appui sur la pelouse", () => {
    const arrete = interrompre(EN_JEU);
    expect(arrete).toMatchObject({ balle: "morte", raison: "interruption" });
    expect(relancer(arrete, "home")).toEqual(arrete);
    expect(reprendreLeMatch(arrete)).toEqual(EN_JEU);
  });
});

describe("verrou", () => {
  it("laisse jouer ballon en jeu", () => {
    expect(verrou(EN_JEU)).toBeNull();
  });

  it("dit pourquoi le jeu est arrêté", () => {
    expect(verrou(JEU_AVANT)).toBe("Avant-match");
    expect(verrou(apresBut(EN_JEU, "home"))).toBe("But · engagement");
    expect(verrou(apresPenaltyAccorde(EN_JEU))).toBe("Penalty");
    expect(verrou(arretDeJeu(EN_JEU))).toBe("Arrêt de jeu");
    expect(verrou(miTemps(EN_JEU))).toBe("Mi-temps");
    expect(verrou(interrompre(EN_JEU))).toBe("Match interrompu");
  });
});

describe("balleApres", () => {
  it("donne le ballon au camp qui obtient la remise en jeu", () => {
    expect(balleApres("corner", "home")).toBe("home");
    expect(balleApres("throw_in", "away")).toBe("away");
    expect(balleApres("free_kick", "home")).toBe("home");
    expect(balleApres("penalty", "away")).toBe("away");
  });

  it("donne le ballon à l'adversaire après une faute, un hors-jeu ou un tir", () => {
    expect(balleApres("foul", "home")).toBe("away");
    expect(balleApres("offside", "home")).toBe("away");
    expect(balleApres("shot", "away")).toBe("home");
    expect(balleApres("shot_on_target", "away")).toBe("home");
  });

  it("laisse le ballon au gardien qui vient d'arrêter", () => {
    expect(balleApres("save", "home")).toBe("home");
  });

  it("ne dit rien des cartons et des changements", () => {
    expect(balleApres("yellow_card", "home")).toBeNull();
    expect(balleApres("red_card", "home")).toBeNull();
    expect(balleApres("substitution", "home")).toBeNull();
  });
});

describe("champsDeTransition", () => {
  const MAINTENANT = Date.parse("2026-10-14T15:00:00.000Z");

  it("écrit l'état, la période et le départ du chrono en une fois", () => {
    expect(champsDeTransition({ jeu: EN_JEU, periode: 3, chrono: { demarrer: true } }, MAINTENANT)).toEqual({
      "live_state.jeu": EN_JEU,
      "live_state.current_period": 3,
      "live_state.is_timer_running": true,
      "live_state.timer_start_at": "2026-10-14T15:00:00.000Z",
    });
  });

  it("fait repartir le chrono d'une valeur donnée", () => {
    // Une mi-temps sifflée par erreur, puis annulée : le chrono reprend comme
    // s'il ne s'était jamais arrêté.
    expect(champsDeTransition({ chrono: { demarrer: true, depuis: 1_800_000 } }, MAINTENANT)).toEqual({
      "live_state.is_timer_running": true,
      "live_state.timer_start_at": "2026-10-14T15:00:00.000Z",
      "live_state.timer_offset": 1_800_000,
    });
  });

  it("arrête le chrono sur une valeur donnée", () => {
    expect(champsDeTransition({ chrono: { arreterA: 2_700_000 } }, MAINTENANT)).toEqual({
      "live_state.is_timer_running": false,
      "live_state.timer_start_at": null,
      "live_state.timer_offset": 2_700_000,
    });
  });

  it("recale le chrono sans l'arrêter", () => {
    expect(champsDeTransition({ chrono: { decalage: 640_000 } }, MAINTENANT)).toEqual({
      "live_state.timer_offset": 640_000,
    });
  });
});
