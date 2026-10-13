import { adminDb, base, vider } from "../test-aides/faux-firestore";

// Les sommes dues (src/lib/versements-serveur), jouées contre le faux
// Firestore. C'est ici qu'on tient qu'une somme due ne se règle qu'une fois.

type Doc = Record<string, unknown>;

const mockNotifier = jest.fn(async (_uid: string, _n: unknown) => {});
const mockEmail = jest.fn(async (_a: string, _sujet: string, _html: string) => {});

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => ({ toMillis: () => Date.now() }) },
}));
jest.mock("@/lib/firebase-admin", () => ({ adminDb: require("../test-aides/faux-firestore").adminDb }));
jest.mock("@/lib/notifier-serveur", () => ({ notifierCompte: (uid: string, n: unknown) => mockNotifier(uid, n) }));
jest.mock("@/lib/email", () => ({
  adminMessageEmailHtml: (titre: string, corps: string) => `<p>${titre} ${corps}</p>`,
  sendNotificationEmail: (a: string, sujet: string, html: string) => mockEmail(a, sujet, html),
}));

// `require`, et non `import` : le module tire firebase-admin, dont la
// vérification de types de l'application mobile n'a pas les types.
const {
  idDu, preparerDu, lireCompteVersement, ecrireCompteVersement, reglerALaMain, sommesDues,
} = require("@/lib/versements-serveur") as {
  preparerDu: (tx: unknown, id: string, du: Doc) => Promise<() => void>;
  idDu: (reservationId: string, motif: "acompte" | "remboursement", paiementId?: string | null) => string;
  lireCompteVersement: (uid: string) => Promise<{ numero: string; pays: string; modifie_le: number } | null>;
  ecrireCompteVersement: (uid: string, brut: unknown, maintenant?: number) => Promise<{ numero: string }>;
  reglerALaMain: (ids: string[], adminUid: string) => Promise<{ regles: number; montant: number }>;
  sommesDues: () => Promise<{ beneficiaire: string; nom: string; numero: string | null; total: number; lignes: Doc[] }[]>;
};

const du = (p: Doc = {}): Doc => ({
  beneficiaire: "gerant", role: "proprietaire", montant: 500, motif: "acompte", reservation_id: "resa1",
  libelle: "Terrain des Cocotiers · 17 octobre 18:00", telephone: null, disponible_le: null, depot_id: null, regle_le: null,
  created_at: "t0", ...p,
});

beforeEach(() => {
  vider();
  mockNotifier.mockClear();
  mockEmail.mockClear();
});

describe("idDu", () => {
  it("une réservation n'a qu'un acompte dû", () => {
    expect(idDu("resa1", "acompte")).toBe("resa1_acompte");
  });

  it("un remboursement est celui d'un paiement précis", () => {
    expect(idDu("resa1", "remboursement", "paie1")).toBe("resa1_remb_paie1");
  });
});

describe("preparerDu", () => {
  const poser = (id: string, p: Doc = {}) => adminDb.runTransaction(async (tx) => {
    const ecrire = await preparerDu(tx, id, {
      beneficiaire: "gerant", role: "proprietaire", montant: 500, motif: "acompte", reservation_id: "resa1",
      libelle: "Terrain des Cocotiers · 17 octobre 18:00", telephone: null, disponible_le: null, ...p,
    });
    ecrire();
  });

  it("écrit une somme à verser, que la liste des sommes dues retrouve", async () => {
    await poser("resa1_acompte");

    expect(base.get("dus/resa1_acompte")).toMatchObject({ beneficiaire: "gerant", montant: 500, depot_id: null, regle_le: null });
    expect(await sommesDues()).toHaveLength(1);
  });

  it("ne remet pas à verser une somme déjà versée", async () => {
    await poser("resa1_acompte");
    await reglerALaMain(["resa1_acompte"], "admin1");

    await poser("resa1_acompte", { montant: 900 });

    expect(base.get("dus/resa1_acompte")).toMatchObject({ montant: 500 });
    expect(base.get("dus/resa1_acompte")?.regle_le).toBeTruthy();
    expect(await sommesDues()).toHaveLength(0);
  });
});

describe("le compte de versement", () => {
  it("s'enregistre avec un numéro togolais, réduit à ses huit chiffres", async () => {
    await ecrireCompteVersement("gerant", "+228 90 12 34 56", 1000);
    expect(await lireCompteVersement("gerant")).toEqual({ numero: "90123456", pays: "tg", modifie_le: 1000 });
  });

  it("refuse un numéro qui n'en est pas un", async () => {
    await expect(ecrireCompteVersement("gerant", "12345", 1000)).rejects.toMatchObject({ status: 400 });
    expect(await lireCompteVersement("gerant")).toBeNull();
  });

  it("ne prévient pas pour un premier numéro, ni pour le même numéro", async () => {
    await ecrireCompteVersement("gerant", "90123456", 1000);
    await ecrireCompteVersement("gerant", "90 12 34 56", 2000);
    expect(mockNotifier).not.toHaveBeenCalled();
    expect((await lireCompteVersement("gerant"))?.modifie_le).toBe(1000);
  });

  it("prévient le propriétaire quand le numéro change, cloche et e-mail, et date le changement", async () => {
    base.set("users/gerant", { first_name: "Kossi", email: "kossi@exemple.test" });
    await ecrireCompteVersement("gerant", "90123456", 1000);
    await ecrireCompteVersement("gerant", "99887766", 5000);
    expect(mockNotifier).toHaveBeenCalledTimes(1);
    expect(mockNotifier.mock.calls[0][0]).toBe("gerant");
    expect(mockEmail).toHaveBeenCalledTimes(1);
    expect(mockEmail.mock.calls[0][0]).toBe("kossi@exemple.test");
    expect(mockEmail.mock.calls[0][2]).toContain("99 88 77 66");
    expect(await lireCompteVersement("gerant")).toEqual({ numero: "99887766", pays: "tg", modifie_le: 5000 });
  });

  it("change le numéro même quand le compte n'a pas d'e-mail", async () => {
    await ecrireCompteVersement("gerant", "90123456", 1000);
    await ecrireCompteVersement("gerant", "99887766", 5000);
    expect(mockEmail).not.toHaveBeenCalled();
    expect(mockNotifier).toHaveBeenCalledTimes(1);
  });
});

describe("reglerALaMain", () => {
  it("marque les sommes versées et les rattache à un dépôt « manuel »", async () => {
    base.set("dus/a", du());
    base.set("dus/b", du({ montant: 400, reservation_id: "resa2" }));

    expect(await reglerALaMain(["a", "b"], "admin1")).toEqual({ regles: 2, montant: 900 });

    const depots = [...base.entries()].filter(([chemin]) => chemin.startsWith("depots/"));
    expect(depots).toHaveLength(1);
    expect(depots[0][1]).toMatchObject({ beneficiaire: "gerant", montant: 900, etat: "manuel", regle_par: "admin1", dus: ["a", "b"] });
    expect(base.get("dus/a")).toMatchObject({ depot_id: depots[0][0].split("/")[1] });
    expect(base.get("dus/a")?.regle_le).toBeTruthy();
  });

  it("ne règle pas deux fois la même somme", async () => {
    base.set("dus/a", du());
    await reglerALaMain(["a"], "admin1");
    expect(await reglerALaMain(["a"], "admin1")).toEqual({ regles: 0, montant: 0 });
    expect([...base.keys()].filter((chemin) => chemin.startsWith("depots/"))).toHaveLength(1);
  });

  it("ne règle pas deux fois quand deux administrateurs cliquent en même temps", async () => {
    base.set("dus/a", du());
    const [un, deux] = await Promise.all([reglerALaMain(["a"], "admin1"), reglerALaMain(["a"], "admin2")]);
    expect(un.regles + deux.regles).toBe(1);
    expect([...base.keys()].filter((chemin) => chemin.startsWith("depots/"))).toHaveLength(1);
  });

  it("refuse de mêler deux bénéficiaires dans un même versement", async () => {
    base.set("dus/a", du());
    base.set("dus/b", du({ beneficiaire: "autre" }));
    await expect(reglerALaMain(["a", "b"], "admin1")).rejects.toMatchObject({ status: 400 });
    expect(base.get("dus/a")?.regle_le).toBeNull();
  });

  it("ignore une ligne qui n'existe pas", async () => {
    base.set("dus/a", du());
    expect(await reglerALaMain(["a", "fantome"], "admin1")).toEqual({ regles: 1, montant: 500 });
  });
});

describe("sommesDues", () => {
  it("regroupe par bénéficiaire ce qui n'est pas encore versé, avec son numéro", async () => {
    base.set("dus/a", du());
    base.set("dus/b", du({ montant: 400, reservation_id: "resa2" }));
    base.set("dus/c", du({ beneficiaire: "equipe", role: "equipe", motif: "remboursement", montant: 500 }));
    base.set("dus/d", du({ regle_le: "hier", depot_id: "dep0" }));
    base.set("users/gerant", { first_name: "Kossi", last_name: "Mensah" });
    base.set("comptes_versement/gerant", { numero: "90123456", pays: "tg", modifie_le: 1 });

    const groupes = await sommesDues();

    expect(groupes).toHaveLength(2);
    const gerant = groupes.find((g) => g.beneficiaire === "gerant");
    expect(gerant).toMatchObject({ nom: "Kossi Mensah", numero: "90123456", total: 900 });
    expect(gerant?.lignes).toHaveLength(2);
    expect(groupes.find((g) => g.beneficiaire === "equipe")).toMatchObject({ numero: null, total: 500 });
  });
});
