import { aRecharger, heureDeLArticle, nombreDArticles, titreDeLaJournee } from "~/lib/actus";

const MAINTENANT = new Date(2026, 9, 27, 18, 0);

describe("titreDeLaJournee", () => {
  it("écrit aujourd'hui et hier en toutes lettres, sinon le jour et la date", () => {
    expect(titreDeLaJournee("2026-10-27", MAINTENANT)).toBe("Aujourd'hui");
    expect(titreDeLaJournee("2026-10-26", MAINTENANT)).toBe("Hier");
    expect(titreDeLaJournee("2026-10-25", MAINTENANT)).toBe("Dimanche 25 octobre");
  });

  it("range les articles sans date sous « Plus tôt »", () => {
    expect(titreDeLaJournee(null, MAINTENANT)).toBe("Plus tôt");
  });
});

describe("heureDeLArticle", () => {
  it("donne l'heure locale, rien pour une date illisible", () => {
    expect(heureDeLArticle(new Date(2026, 9, 27, 14, 5).toISOString())).toBe("14:05");
    expect(heureDeLArticle("")).toBe("");
  });
});

describe("nombreDArticles", () => {
  it("accorde", () => {
    expect(nombreDArticles(1)).toBe("1 article");
    expect(nombreDArticles(3)).toBe("3 articles");
  });
});

describe("aRecharger", () => {
  it("recharge au retour dans l'application quand le fil a plus d'un quart d'heure", () => {
    expect(aRecharger(null, MAINTENANT)).toBe(true);
    expect(aRecharger(new Date(2026, 9, 27, 17, 50), MAINTENANT)).toBe(false);
    expect(aRecharger(new Date(2026, 9, 27, 17, 44), MAINTENANT)).toBe(true);
  });
});
