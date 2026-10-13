import { libreA, seChevauchent } from "@/lib/terrains";

// Le module vit côté site (src/lib/terrains) ; il est pur, et c'est ici que
// la suite de tests des modules partagés tourne.

const c = (time: string, duration: number, date = "2026-10-17") => ({ date, time, duration });

describe("seChevauchent", () => {
  it("sans battement, deux créneaux qui se suivent ne se chevauchent pas", () => {
    expect(seChevauchent(c("18:00", 1), c("19:00", 1))).toBe(false);
    expect(seChevauchent(c("18:00", 1), c("18:30", 1))).toBe(true);
  });

  it("avec un battement, le créneau garde le terrain après sa fin", () => {
    expect(seChevauchent(c("18:00", 1), c("19:00", 1), 15)).toBe(true);
    expect(seChevauchent(c("18:00", 1), c("19:10", 1), 15)).toBe(true);
    expect(seChevauchent(c("18:00", 1), c("19:15", 1), 15)).toBe(false);
    expect(seChevauchent(c("18:00", 1), c("19:30", 1), 30)).toBe(false);
  });

  it("le battement vaut dans les deux sens : le créneau d'avant garde aussi le sien", () => {
    expect(seChevauchent(c("19:00", 1), c("18:00", 1), 15)).toBe(true);
    expect(seChevauchent(c("19:15", 1), c("18:00", 1), 15)).toBe(false);
  });

  it("deux jours différents ne se chevauchent jamais", () => {
    expect(seChevauchent(c("18:00", 1), c("18:00", 1, "2026-10-18"), 30)).toBe(false);
  });
});

describe("libreA", () => {
  it("tient compte du battement du terrain", () => {
    const occupations = [c("18:00", 1)];
    expect(libreA(null, occupations, c("19:00", 1)).libre).toBe(true);
    expect(libreA(null, occupations, c("19:00", 1), 15).libre).toBe(false);
  });
});
