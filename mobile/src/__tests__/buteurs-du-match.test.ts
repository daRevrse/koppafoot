import { buteursDuMatch } from "@/lib/buteurs";

type Evt = Parameters<typeof buteursDuMatch>[0][number];

const but = (id: string, period: number, minute: number, playerName: string): Evt =>
  ({ id, type: "goal", period, minute, teamId: "h", playerName, createdAt: "" }) as Evt;

describe("buteursDuMatch, les minutes", () => {
  it("écrit le temps additionnel en 45+N", () => {
    const { home } = buteursDuMatch([but("a", 1, 47, "Koffi")], "h");
    expect(home[0].minutes).toEqual(["45+2'"]);
  });

  it("suit la durée du format", () => {
    const { home } = buteursDuMatch([but("a", 3, 42, "Koffi")], "h", undefined, 20);
    expect(home[0].minutes).toEqual(["40+2'"]);
  });

  it("range le but du temps additionnel avant ceux de la seconde mi-temps", () => {
    // 46e de la seconde mi-temps, puis 45+2 de la première : stockées « 46 »
    // et « 47 », elles s'inversaient au tri par minute seule.
    const { home } = buteursDuMatch(
      [but("a", 3, 46, "Koffi"), but("b", 1, 47, "Koffi")],
      "h",
    );
    expect(home[0].minutes).toEqual(["45+2'", "46'"]);
  });
});
