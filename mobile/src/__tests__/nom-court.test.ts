import { nomCourt } from "@/lib/terrain";

describe("nomCourt", () => {
  it("garde l'initiale du prénom et le nom de famille", () => {
    expect(nomCourt("Jean-Baptiste Mensah")).toBe("J. Mensah");
  });

  it("laisse un nom seul tel quel", () => {
    expect(nomCourt("Kossi")).toBe("Kossi");
  });

  it("coupe ce qui reste trop long", () => {
    expect(nomCourt("Ama Agbodjinou-Amedjonekou", 12)).toBe("A. Agbodjin…");
  });
});
