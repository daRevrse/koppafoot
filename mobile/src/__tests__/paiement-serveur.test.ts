import { jourDeLome, type DroitAccorde } from "@/lib/offre";
import { ajouterMois, type Collecte, type FirestorePaiement } from "@/lib/paiement";

// Le serveur des paiements (src/lib/paiement-serveur), joué contre un faux
// Firestore en mémoire et un faux FedaPay.
//
// C'est la fonction qui accorde le Pro contre de l'argent : ce qu'elle écrit,
// et surtout ce qu'elle n'écrit pas deux fois, se vérifie ici. Le faux
// Firestore tient ses transactions à la file, comme le vrai les isole : deux
// transactions ne s'entrelacent jamais, mais tout ce qui s'écrit HORS
// transaction peut passer entre deux — c'est exactement la course que la
// dernière suite reproduit.

type Doc = Record<string, unknown>;
interface FauxRef { id: string; path: string }

const mockBase = new Map<string, Doc>();
const mockFedapay = {
  environnement: "sandbox",
  lireCollecte: jest.fn(),
  lireCollecteParReference: jest.fn(),
};
const mockNotifier = jest.fn(async (_uid: string, _n: unknown) => {});
let mockFile: Promise<unknown> = Promise.resolve();

function mockSnap(chemin: string) {
  const data = mockBase.get(chemin);
  return {
    exists: data !== undefined,
    id: chemin.split("/")[1],
    data: () => (data ? { ...data } : undefined),
    get: (champ: string) => data?.[champ],
  };
}

function mockRef(chemin: string) {
  return {
    id: chemin.split("/")[1],
    path: chemin,
    get: async () => mockSnap(chemin),
    set: async (data: Doc, options?: { merge?: boolean }) => {
      mockBase.set(chemin, options?.merge ? { ...(mockBase.get(chemin) ?? {}), ...data } : { ...data });
    },
    update: async (data: Doc) => {
      if (!mockBase.has(chemin)) throw new Error(`document absent : ${chemin}`);
      mockBase.set(chemin, { ...mockBase.get(chemin), ...data });
    },
    delete: async () => { mockBase.delete(chemin); },
  };
}

jest.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "maintenant" } }));
jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: (nom: string) => ({
      doc: (id: string) => mockRef(`${nom}/${id}`),
      where: () => ({ limit: () => ({ get: async () => ({ empty: true, docs: [] }) }), get: async () => ({ docs: [] }) }),
    }),
    runTransaction: (fn: (tx: unknown) => Promise<unknown>) => {
      const suite = mockFile.then(async () => {
        const ecritures: (() => void)[] = [];
        const resultat = await fn({
          get: async (ref: FauxRef) => mockSnap(ref.path),
          set: (ref: FauxRef, data: Doc, options?: { merge?: boolean }) => {
            ecritures.push(() => mockBase.set(ref.path, options?.merge ? { ...(mockBase.get(ref.path) ?? {}), ...data } : { ...data }));
          },
          update: (ref: FauxRef, data: Doc) => {
            ecritures.push(() => mockBase.set(ref.path, { ...mockBase.get(ref.path), ...data }));
          },
        });
        ecritures.forEach((ecrire) => ecrire());
        return resultat;
      });
      mockFile = suite.catch(() => {});
      return suite;
    },
  },
}));
jest.mock("@/lib/admin-api-auth", () => ({ estSuperadmin: (d?: Doc) => d?.is_superadmin === true }));
jest.mock("@/lib/email", () => ({ recuPaiementHtml: () => "<p>reçu</p>", sendNotificationEmail: jest.fn(async () => {}) }));
jest.mock("@/lib/notifier-serveur", () => ({ notifierCompte: (uid: string, n: unknown) => mockNotifier(uid, n) }));
jest.mock("@/lib/partage", () => ({ APP_URL: "https://www.koppafoot.com" }));
jest.mock("@/lib/fedapay", () => ({
  environnementFedapay: () => mockFedapay.environnement,
  fedapayConfigure: () => true,
  creerCollecte: jest.fn(),
  lienDePaiement: jest.fn(),
  lireCollecte: (id: number) => mockFedapay.lireCollecte(id),
  lireCollecteParReference: (reference: string) => mockFedapay.lireCollecteParReference(reference),
}));

// `require`, et non `import` : le module tire firebase-admin et next/server,
// dont la vérification de types de l'application mobile n'a pas les types.
const { reglerPaiement } = require("@/lib/paiement-serveur") as {
  reglerPaiement: (id: string) => Promise<{ statut: string; jusquAu: string | null; aVerifier: boolean } | null>;
};

const ID = "AbCdEfGhIjKlMnOpQrSt";
const UID = "compte1";
const JOUR = jourDeLome();

const collecte = (statut: string, p: Partial<Collecte> = {}): Collecte => ({
  id: 258, statut, montant: 1500, reference: ID, mode: "momo_test", frais: 26, recuUrl: null, ...p,
});

function poserLigne(p: Partial<FirestorePaiement> = {}) {
  const ligne: FirestorePaiement = {
    uid: UID, formule: "pro_mois", droit: "pro", montant: 1500, devise: "XOF", statut: "en_attente",
    environnement: "sandbox", fedapay_id: 258, fedapay_statut: "pending", mode: null, frais: null, recu_url: null,
    echeance_avant: null, echeance_apres: null, applique_le: null, anomalie: null, created_at: "t0", updated_at: "t0",
    ...p,
  };
  mockBase.set(`paiements/${ID}`, { ...ligne });
}

const ligne = () => mockBase.get(`paiements/${ID}`) as unknown as FirestorePaiement;
const pro = () => (mockBase.get(`droits/${UID}`) as { pro?: DroitAccorde } | undefined)?.pro ?? null;
const unTour = () => new Promise<void>((resoudre) => setTimeout(resoudre, 0));

beforeEach(() => {
  mockBase.clear();
  mockFedapay.environnement = "sandbox";
  mockFedapay.lireCollecte.mockReset();
  mockFedapay.lireCollecteParReference.mockReset();
  mockNotifier.mockClear();
  mockFile = Promise.resolve();
});

describe("reglerPaiement", () => {
  it("accorde le Pro quand FedaPay dit que c'est payé", async () => {
    poserLigne();
    mockFedapay.lireCollecte.mockResolvedValue(collecte("approved"));

    const etat = await reglerPaiement(ID);

    const fin = ajouterMois(JOUR, 1);
    expect(etat).toMatchObject({ statut: "paye", jusquAu: fin, aVerifier: false });
    expect(pro()).toEqual({ depuis: JOUR, jusqu_au: fin, source: "paiement", accorde_par: null, motif: "Achat Pro 1 mois (bac à sable)" });
    expect(ligne()).toMatchObject({ statut: "paye", echeance_avant: null, echeance_apres: fin, fedapay_statut: "approved", mode: "momo_test", frais: 26 });
    expect(mockNotifier).toHaveBeenCalledTimes(1);
  });

  it("prolonge à partir de la fin en cours", async () => {
    poserLigne();
    mockBase.set(`droits/${UID}`, { pro: { depuis: "2026-01-01", jusqu_au: ajouterMois(JOUR, 2), source: "admin", accorde_par: "admin1", motif: "essai" } });
    mockFedapay.lireCollecte.mockResolvedValue(collecte("approved"));

    await reglerPaiement(ID);

    expect(pro()).toMatchObject({ depuis: "2026-01-01", jusqu_au: ajouterMois(ajouterMois(JOUR, 2), 1), source: "paiement" });
    expect(ligne().echeance_avant).toBe(ajouterMois(JOUR, 2));
  });

  it("ne prolonge qu'une fois quand le même paiement est réglé deux fois", async () => {
    poserLigne();
    mockFedapay.lireCollecte.mockResolvedValue(collecte("approved"));

    await reglerPaiement(ID);
    const apresUn = pro()?.jusqu_au;
    await reglerPaiement(ID);
    await reglerPaiement(ID);

    expect(pro()?.jusqu_au).toBe(apresUn);
    expect(mockNotifier).toHaveBeenCalledTimes(1);
  });

  it("ne prolonge qu'une fois quand deux règlements partent en même temps", async () => {
    poserLigne();
    mockFedapay.lireCollecte.mockResolvedValue(collecte("approved"));

    await Promise.all([reglerPaiement(ID), reglerPaiement(ID), reglerPaiement(ID)]);

    expect(pro()?.jusqu_au).toBe(ajouterMois(JOUR, 1));
    expect(mockNotifier).toHaveBeenCalledTimes(1);
  });

  it("suit un refus sans rien accorder, et l'approbation tardive s'applique", async () => {
    poserLigne();
    mockFedapay.lireCollecte.mockResolvedValueOnce(collecte("declined")).mockResolvedValue(collecte("approved"));

    expect(await reglerPaiement(ID)).toMatchObject({ statut: "echoue", jusquAu: null });
    expect(pro()).toBeNull();

    expect(await reglerPaiement(ID)).toMatchObject({ statut: "paye" });
    expect(pro()?.jusqu_au).toBe(ajouterMois(JOUR, 1));
  });

  it("n'accorde rien quand le montant payé n'est pas celui demandé", async () => {
    poserLigne();
    mockFedapay.lireCollecte.mockResolvedValue(collecte("approved", { montant: 100 }));

    const etat = await reglerPaiement(ID);

    expect(etat).toMatchObject({ statut: "en_attente", aVerifier: true });
    expect(pro()).toBeNull();
    expect(ligne()).toMatchObject({ statut: "en_attente", anomalie: "montant" });
    expect(mockNotifier).not.toHaveBeenCalled();
  });

  it("n'accorde rien quand la collecte n'est pas celle de la ligne", async () => {
    poserLigne();
    mockFedapay.lireCollecte.mockResolvedValue(collecte("approved", { reference: "ZZZZZZZZZZZZZZZZZZZZ" }));

    expect(await reglerPaiement(ID)).toMatchObject({ aVerifier: true });
    expect(pro()).toBeNull();
    expect(ligne().anomalie).toBe("reference");
  });

  it("n'écrase pas un Pro sans échéance accordé entre le clic et le paiement", async () => {
    poserLigne();
    const illimite = { depuis: "2026-01-01", jusqu_au: null, source: "admin", accorde_par: "admin1", motif: "partenaire" };
    mockBase.set(`droits/${UID}`, { pro: illimite });
    mockFedapay.lireCollecte.mockResolvedValue(collecte("approved"));

    const etat = await reglerPaiement(ID);

    expect(pro()).toEqual(illimite);
    expect(etat).toMatchObject({ statut: "paye", jusquAu: null });
    expect(ligne()).toMatchObject({ statut: "paye", echeance_apres: null });
    expect(mockNotifier).not.toHaveBeenCalled();
  });

  it("laisse une ligne du bac à sable quand le serveur est en réel", async () => {
    poserLigne({ environnement: "sandbox" });
    mockFedapay.environnement = "live";

    const etat = await reglerPaiement(ID);

    expect(etat).toMatchObject({ statut: "en_attente" });
    expect(mockFedapay.lireCollecte).not.toHaveBeenCalled();
    expect(ligne()).toMatchObject({ statut: "en_attente", anomalie: null });
    expect(pro()).toBeNull();
  });

  it("retrouve la collecte par la référence quand la ligne n'a pas son identifiant FedaPay", async () => {
    poserLigne({ fedapay_id: null });
    mockFedapay.lireCollecteParReference.mockResolvedValue(collecte("approved"));

    await reglerPaiement(ID);

    expect(mockFedapay.lireCollecteParReference).toHaveBeenCalledWith(ID);
    expect(mockFedapay.lireCollecte).not.toHaveBeenCalled();
    expect(ligne()).toMatchObject({ statut: "paye", fedapay_id: 258 });
  });

  it("rend null pour une ligne qui n'existe pas", async () => {
    expect(await reglerPaiement(ID)).toBeNull();
    expect(mockFedapay.lireCollecte).not.toHaveBeenCalled();
  });

  it("une relecture en retard ne défait pas un paiement réglé entre-temps", async () => {
    poserLigne();
    // La première relecture part quand la collecte est encore en attente, et
    // FedaPay lui répond après que le webhook a tout réglé.
    let repondre!: (c: Collecte) => void;
    const lente = new Promise<Collecte>((resoudre) => { repondre = resoudre; });
    mockFedapay.lireCollecte.mockReturnValueOnce(lente).mockResolvedValue(collecte("approved"));

    const enRetard = reglerPaiement(ID);
    await unTour();
    await reglerPaiement(ID);
    const apresUn = pro()?.jusqu_au;
    expect(apresUn).toBe(ajouterMois(JOUR, 1));

    repondre(collecte("pending"));
    await enRetard;

    expect(ligne().statut).toBe("paye");
    // Et la relecture suivante (la page qui redemande, la tâche du matin) ne
    // trouve pas une ligne « en attente » à accorder une seconde fois.
    await reglerPaiement(ID);
    expect(pro()?.jusqu_au).toBe(apresUn);
    expect(mockNotifier).toHaveBeenCalledTimes(1);
  });
});
