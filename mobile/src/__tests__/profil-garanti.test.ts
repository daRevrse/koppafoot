import { garantirProfil } from "@/lib/profil";

// Le module vit côté site (src/lib/profil) ; `garantirProfil` ne touche à
// rien par lui-même, on lui passe la lecture et l'écriture.
//
// Le cas qui a motivé cette suite : un compte dont le profil existe arrive sur
// /get-started parce que sa lecture a échoué (réseau, cache local, SDK planté).
// Le formulaire réécrivait alors le profil entier, ce que les règles refusent
// (« permission-denied ») : le compte restait bloqué devant un formulaire
// qu'il ne pouvait pas valider.

type Profil = { prenom: string };

describe("garantirProfil", () => {
  it("ne réécrit jamais un profil que le serveur connaît déjà", async () => {
    const creer = jest.fn(async () => {});

    const issue = await garantirProfil<Profil>({ lireAuServeur: async () => ({ prenom: "Gilles" }), creer });

    expect(issue).toEqual({ profil: { prenom: "Gilles" }, cree: false });
    expect(creer).not.toHaveBeenCalled();
  });

  it("crée le profil quand le serveur dit qu'il n'existe pas, puis le relit", async () => {
    let enBase: Profil | null = null;
    const creer = jest.fn(async () => { enBase = { prenom: "Ama" }; });

    const issue = await garantirProfil<Profil>({ lireAuServeur: async () => enBase, creer });

    expect(issue).toEqual({ profil: { prenom: "Ama" }, cree: true });
    expect(creer).toHaveBeenCalledTimes(1);
  });

  it("ne crée rien à l'aveugle quand le serveur ne répond pas", async () => {
    const creer = jest.fn(async () => {});
    const horsLigne = new Error("Failed to get document because the client is offline.");

    await expect(garantirProfil<Profil>({ lireAuServeur: async () => { throw horsLigne; }, creer })).rejects.toBe(horsLigne);
    expect(creer).not.toHaveBeenCalled();
  });

  it("laisse remonter le refus de l'écriture", async () => {
    const refus = new Error("permission-denied");

    await expect(garantirProfil<Profil>({ lireAuServeur: async () => null, creer: async () => { throw refus; } })).rejects.toBe(refus);
  });

  it("le dit quand le profil reste introuvable après la création", async () => {
    await expect(garantirProfil<Profil>({ lireAuServeur: async () => null, creer: async () => {} })).rejects.toThrow(/profil/i);
  });
});
