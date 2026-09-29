import { dateAvecJour, dateAvecJourLong, libelleDuJour, cleDuJour, decalerDeJours } from "@/lib/dates";
import { formaterNote } from "@/lib/notes";

// Le module vit côté site (src/lib/dates) ; il est pur, et c'est ici que la
// suite de tests des modules partagés tourne.

// Tous les jours d'une année : chaque jour de la semaine, chaque mois.
const ANNEE = Array.from({ length: 365 }, (_, i) => new Date(2026, 0, 1 + i));

describe("une date avec son jour, écrite à la main", () => {
  it("écrit le français comme Unicode, jour pour jour", () => {
    for (const d of ANNEE) {
      expect(dateAvecJour(d, "fr")).toBe(
        d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }),
      );
      expect(dateAvecJourLong(d, "fr", { annee: true })).toBe(
        d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      );
    }
  });

  it("écrit l'anglais britannique sans virgule, au court comme au long", () => {
    const d = new Date(2026, 9, 3);
    expect(dateAvecJour(d, "en")).toBe("Sat 3 Oct");
    expect(dateAvecJourLong(d, "en")).toBe("Saturday 3 October");
    expect(dateAvecJourLong(d, "en", { annee: true })).toBe("Saturday 3 October 2026");
    expect(dateAvecJour(new Date(2026, 8, 5), "en")).toBe("Sat 5 Sept");
  });

  it("garde les jours proches en toutes lettres", () => {
    const aujourdhui = cleDuJour(new Date());
    expect(libelleDuJour(aujourdhui, "en")).toBe("Today");
    expect(libelleDuJour(decalerDeJours(aujourdhui, 1), "fr")).toBe("Demain");
    // Loin d'aujourd'hui, quel que soit le jour où le test tourne.
    expect(libelleDuJour("2001-03-17", "fr")).toBe("sam. 17 mars");
    expect(libelleDuJour("2001-03-17", "en")).toBe("Sat 17 Mar");
    expect(libelleDuJour("pas-une-date", "en")).toBe("pas-une-date");
  });
});

describe("la note", () => {
  it("prend la virgule en français, le point en anglais", () => {
    expect(formaterNote(6.66)).toBe("6,7");
    expect(formaterNote(6.66, "en")).toBe("6.7");
    expect(formaterNote(null, "en")).toBe("–");
  });
});
