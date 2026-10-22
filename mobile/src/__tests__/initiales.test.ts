import { initiales } from "~/lib/initiales";

describe("initiales", () => {
  it("les deux premiers mots", () => {
    expect(initiales("AS Douane Lomé")).toBe("AD");
  });

  it("en majuscules", () => {
    expect(initiales("kossi mensah")).toBe("KM");
  });

  it("un accent décomposé reste sur sa lettre", () => {
    expect(initiales("Élodie")).toBe("É");
  });

  it("rien pour un nom vide", () => {
    expect(initiales("   ")).toBe("");
  });
});
