import { confirmationValide, issueDeLaSuppression } from "~/lib/suppression-compte";

describe("confirmationValide", () => {
  it("demande le mot du site, sans tenir compte de la casse ni des espaces", () => {
    expect(confirmationValide(" supprimer ")).toBe(true);
    expect(confirmationValide("SUPPRIMER")).toBe(true);
    expect(confirmationValide("SUPPRIME")).toBe(false);
    expect(confirmationValide("")).toBe(false);
  });
});

describe("issueDeLaSuppression", () => {
  it("lit un compte supprimé", () => {
    expect(issueDeLaSuppression(200, { ok: true })).toEqual({ genre: "faite" });
  });

  it("lit ce qu'il faut faire avant de partir", () => {
    expect(issueDeLaSuppression(409, { error: "obstacles", obstacles: ["Tu gères l'équipe Alpha."] }))
      .toEqual({ genre: "obstacles", obstacles: ["Tu gères l'équipe Alpha."] });
  });

  it("demande une connexion récente", () => {
    expect(issueDeLaSuppression(401, { error: "reauth", message: "…" })).toEqual({ genre: "reconnexion" });
  });

  it("rend le message du serveur, ou un message à soi", () => {
    expect(issueDeLaSuppression(500, { error: "La suppression a échoué, ton compte est intact." }))
      .toEqual({ genre: "erreur", message: "La suppression a échoué, ton compte est intact." });
    expect(issueDeLaSuppression(502, null)).toEqual({ genre: "erreur", message: "La suppression a échoué" });
  });
});
