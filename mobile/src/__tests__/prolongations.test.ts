import { champsDeTransition, lireJeu, pause, relancer, seanceDeTirs, verrou, type Jeu } from "@/lib/etat-du-jeu";
import { libelleMinute, minuteEnDirect, texteMinute } from "@/lib/minute-du-match";

const EN_JEU: Jeu = { balle: "en_jeu", raison: null, engage: null, premier: "home" };

describe("les pauses des prolongations", () => {
  it("avant les prolongations, un nouveau tirage décide qui engage", () => {
    const avant = pause(EN_JEU, null);
    expect(avant).toMatchObject({ balle: "morte", raison: "pause", engage: null });
    expect(relancer(avant, "away")).toEqual({ balle: "en_jeu", raison: null, engage: null, premier: "away" });
  });

  it("entre les deux prolongations, l'autre équipe engage", () => {
    const entre = pause({ ...EN_JEU, premier: "away" }, "home");
    expect(entre.engage).toBe("home");
    expect(relancer(entre, "home")).toMatchObject({ balle: "en_jeu", premier: "away" });
  });

  it("verrouille le jeu pendant la pause et pendant la séance", () => {
    expect(verrou(pause(EN_JEU, null))).toBe("Pause");
    expect(verrou(seanceDeTirs(EN_JEU))).toBe("Tirs au but");
  });

  it("déduit la pause et la séance d'un match sans état enregistré", () => {
    const live = (p: number) => ({ status: "live", liveState: { currentPeriod: p, isTimerRunning: false, timerOffset: 5_400_000 } });
    expect(lireJeu(live(5))).toMatchObject({ raison: "pause" });
    expect(lireJeu(live(7))).toMatchObject({ raison: "pause" });
    expect(lireJeu(live(9))).toMatchObject({ raison: "tirs_au_but" });
  });

  it("écrit la séance avec la transition", () => {
    const seance = { premier: "home" as const, tirs: [] };
    expect(champsDeTransition({ tirsAuBut: seance }, 0)).toEqual({ "live_state.tirs_au_but": seance });
  });
});

describe("les minutes des prolongations", () => {
  it("écrivent le temps additionnel des prolongations en 105+N et 120+N", () => {
    expect(libelleMinute(6, 100, 45)).toBe("100'");
    expect(libelleMinute(6, 106, 45)).toBe("105+1'");
    expect(libelleMinute(8, 122, 45)).toBe("120+2'");
  });

  it("suivent la durée de prolongation du format", () => {
    expect(libelleMinute(6, 48, 20, "'", 7)).toBe("47+1'");
  });

  it("disent la pause des prolongations, et la séance", () => {
    const enDirect = (p: number) => ({ status: "live", liveState: { currentPeriod: p, isTimerRunning: false, timerOffset: 5_400_000 } });
    expect(minuteEnDirect(enDirect(5), 45)).toEqual({ genre: "pause" });
    expect(minuteEnDirect(enDirect(7), 45)).toEqual({ genre: "pause" });
    expect(minuteEnDirect(enDirect(9), 45)).toEqual({ genre: "tirs" });
    expect(texteMinute({ genre: "tirs" }, { avant: "", pause: "", interrompu: "", tirs: "TAB" })).toBe("TAB");
  });
});
