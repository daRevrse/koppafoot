import {
  appuyer, basculer, ECART_MIN_PASSE_MS, POSSESSION_VIDE, suspendre, versPossession, versStockage,
  type Possession,
} from "@/lib/possession";

const T0 = Date.parse("2026-10-17T15:00:00Z");
const aDomicile: Possession = { ...POSSESSION_VIDE, side: "home", since: new Date(T0).toISOString() };

describe("appuyer, les passes", () => {
  // Un appui sur l'herbe du camp qui a déjà le ballon : une passe de plus.
  it("compte une passe pour le camp qui a le ballon", () => {
    const p = appuyer(aDomicile, "home", true, T0 + 2_000);
    expect(p).toMatchObject({ homePasses: 1, awayPasses: 0, side: "home" });
  });

  it("ne touche ni la possession ni son segment en cours", () => {
    const p = appuyer(aDomicile, "home", true, T0 + 2_000);
    expect(p).toMatchObject({ homeMs: 0, awayMs: 0, since: aDomicile.since });
  });

  it("donne le ballon à l'autre camp sans compter de passe", () => {
    const p = appuyer(aDomicile, "away", true, T0 + 4_000);
    expect(p).toMatchObject({ side: "away", homeMs: 4_000, homePasses: 0, awayPasses: 0 });
  });

  // Après un but, à la mi-temps, sur un arrêt de jeu : l'appui ne compte rien.
  it("ne compte rien ballon mort", () => {
    expect(appuyer(aDomicile, "home", false, T0 + 2_000)).toBe(aDomicile);
  });

  it("ignore un second appui trop rapproché", () => {
    const une = appuyer(aDomicile, "home", true, T0 + 2_000);
    const deux = appuyer(une, "home", true, T0 + 2_000 + ECART_MIN_PASSE_MS - 1, T0 + 2_000);
    expect(deux).toBe(une);
  });

  it("compte le suivant dès que l'écart est passé", () => {
    const une = appuyer(aDomicile, "home", true, T0 + 2_000);
    const deux = appuyer(une, "home", true, T0 + 2_000 + ECART_MIN_PASSE_MS, T0 + 2_000);
    expect(deux.homePasses).toBe(2);
  });
});

describe("les passes traversent le reste du modèle", () => {
  const avecPasses: Possession = { ...aDomicile, homePasses: 12, awayPasses: 7 };

  it("survivent à un changement de camp", () => {
    expect(basculer(avecPasses, "away", true, T0 + 1_000)).toMatchObject({ homePasses: 12, awayPasses: 7 });
  });

  it("survivent à un arrêt de l'horloge", () => {
    expect(suspendre(avecPasses, T0 + 1_000)).toMatchObject({ homePasses: 12, awayPasses: 7 });
  });

  it("s'écrivent et se relisent", () => {
    expect(versPossession(versStockage(avecPasses))).toEqual(avecPasses);
  });

  it("valent zéro sur un match d'avant leur comptage", () => {
    const ancien = versPossession({ home_ms: 60_000, away_ms: 0, side: null, since: null });
    expect(ancien).toMatchObject({ homePasses: 0, awayPasses: 0 });
  });
});
