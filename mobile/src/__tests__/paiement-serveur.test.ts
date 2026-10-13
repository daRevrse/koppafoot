import { jourDeLome, type DroitAccorde } from "@/lib/offre";
import { ajouterMois, type Collecte, type FirestorePaiement } from "@/lib/paiement";
import { base as mockBase, vider } from "../test-aides/faux-firestore";

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

const mockFedapay = {
  environnement: "sandbox",
  configure: true,
  creerCollecte: jest.fn(),
  lienDePaiement: jest.fn(),
  lireCollecte: jest.fn(),
  lireCollecteParReference: jest.fn(),
};
const mockNotifier = jest.fn(async (_uid: string, _n: unknown) => {});

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => ({ toMillis: () => Date.now() }) },
}));
jest.mock("@/lib/firebase-admin", () => ({ adminDb: require("../test-aides/faux-firestore").adminDb }));
jest.mock("@/lib/admin-api-auth", () => ({ estSuperadmin: (d?: Doc) => d?.is_superadmin === true }));
jest.mock("@/lib/email", () => ({ recuPaiementHtml: () => "<p>reçu</p>", sendNotificationEmail: jest.fn(async () => {}) }));
jest.mock("@/lib/notifier-serveur", () => ({ notifierCompte: (uid: string, n: unknown) => mockNotifier(uid, n) }));
jest.mock("@/lib/partage", () => ({ APP_URL: "https://www.koppafoot.com" }));
jest.mock("@/lib/reservations-server", () => ({ recopierSurLeMatch: jest.fn(async () => {}), surLeMatch: jest.fn() }));
jest.mock("@/lib/fedapay", () => ({
  environnementFedapay: () => mockFedapay.environnement,
  fedapayConfigure: () => mockFedapay.configure,
  creerCollecte: (demande: unknown) => mockFedapay.creerCollecte(demande),
  lienDePaiement: (id: number) => mockFedapay.lienDePaiement(id),
  lireCollecte: (id: number) => mockFedapay.lireCollecte(id),
  lireCollecteParReference: (reference: string) => mockFedapay.lireCollecteParReference(reference),
}));

// `require`, et non `import` : le module tire firebase-admin et next/server,
// dont la vérification de types de l'application mobile n'a pas les types.
const {
  reglerPaiement, demarrerPaiement, formulesPour, paiementParCollecte, reverifierPaiementsOuverts, rappelerEcheancesPro,
} = require("@/lib/paiement-serveur") as {
  reverifierPaiementsOuverts: (maintenantMs?: number) => Promise<{ revus: number; payes: number; fermes: number }>;
  rappelerEcheancesPro: (jour?: string) => Promise<number>;
  reglerPaiement: (id: string) => Promise<{ statut: string; jusquAu: string | null; aVerifier: boolean } | null>;
  demarrerPaiement: (uid: string, formule: unknown, origine: string) => Promise<{ id: string; url: string }>;
  formulesPour: (profil: Doc | undefined) => Promise<{ id: string; mois: number; prix: number }[]>;
  paiementParCollecte: (idCollecte: number) => Promise<string | null>;
};

const ID = "AbCdEfGhIjKlMnOpQrSt";
const UID = "compte1";
const JOUR = jourDeLome();

const collecte = (statut: string, p: Partial<Collecte> = {}): Collecte => ({
  id: 258, statut, montant: 1500, reference: ID, mode: "momo_test", frais: 26, recuUrl: null, disponibleLe: null, ...p,
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
  vider();
  mockFedapay.environnement = "sandbox";
  mockFedapay.configure = true;
  mockFedapay.creerCollecte.mockReset();
  mockFedapay.lienDePaiement.mockReset();
  mockFedapay.lireCollecte.mockReset();
  mockFedapay.lireCollecteParReference.mockReset();
  mockNotifier.mockClear();
});

describe("demarrerPaiement", () => {
  const ORIGINE = "http://localhost:3000";
  const URL_PAIEMENT = "https://sandbox-process.fedapay.com/jeton";
  const lignes = () => [...mockBase.entries()].filter(([chemin]) => chemin.startsWith("paiements/"));

  beforeEach(() => {
    mockBase.set("settings/offre", { prix: { pro_mois: 1500, pro_an: 15000 } });
    mockBase.set(`users/${UID}`, { first_name: "Ama", last_name: "Koffi", email: "ama@exemple.test", is_superadmin: true });
    mockFedapay.creerCollecte.mockResolvedValue(collecte("pending"));
    mockFedapay.lienDePaiement.mockResolvedValue(URL_PAIEMENT);
  });

  it("crée la ligne et la collecte au prix du réglage, et rend la page de paiement", async () => {
    const { id, url } = await demarrerPaiement(UID, "pro_mois", ORIGINE);

    expect(url).toBe(URL_PAIEMENT);
    expect(mockBase.get(`paiements/${id}`)).toMatchObject({
      uid: UID, formule: "pro_mois", droit: "pro", montant: 1500, devise: "XOF", statut: "en_attente",
      environnement: "sandbox", fedapay_id: 258, anomalie: null,
    });
    expect(mockFedapay.creerCollecte).toHaveBeenCalledWith({
      reference: id,
      description: "KoppaFoot Pro, 1 mois",
      montant: 1500,
      retour: `${ORIGINE}/offre?paiement=${id}`,
      client: { prenom: "Ama", nom: "Koffi", email: "ama@exemple.test" },
    });
  });

  it("prend le prix de l'année pour la formule d'un an", async () => {
    const { id } = await demarrerPaiement(UID, "pro_an", ORIGINE);
    expect(mockBase.get(`paiements/${id}`)).toMatchObject({ formule: "pro_an", montant: 15000 });
    expect(mockFedapay.creerCollecte).toHaveBeenCalledWith(expect.objectContaining({ description: "KoppaFoot Pro, 1 an", montant: 15000 }));
  });

  it("en bac à sable, refuse un compte qui n'est pas superadmin, sans rien écrire", async () => {
    mockBase.set(`users/${UID}`, { first_name: "Ama", last_name: "Koffi", email: "ama@exemple.test" });

    await expect(demarrerPaiement(UID, "pro_mois", ORIGINE)).rejects.toMatchObject({ code: "bac_a_sable" });

    expect(lignes()).toHaveLength(0);
    expect(mockFedapay.creerCollecte).not.toHaveBeenCalled();
  });

  it("en réel, vend à tout le monde et ramène toujours sur le site", async () => {
    mockFedapay.environnement = "live";
    mockBase.set(`users/${UID}`, { first_name: "Ama", last_name: "Koffi", email: "ama@exemple.test" });

    const { id } = await demarrerPaiement(UID, "pro_mois", "https://faux-site.exemple");

    expect(mockBase.get(`paiements/${id}`)).toMatchObject({ environnement: "live", montant: 1500 });
    expect(mockFedapay.creerCollecte).toHaveBeenCalledWith(
      expect.objectContaining({ retour: `https://www.koppafoot.com/offre?paiement=${id}` }),
    );
  });

  it("refuse une formule inconnue", async () => {
    await expect(demarrerPaiement(UID, "sans_pub", ORIGINE)).rejects.toMatchObject({ code: "formule" });
    await expect(demarrerPaiement(UID, { formule: "pro_mois", montant: 1 }, ORIGINE)).rejects.toMatchObject({ code: "formule" });
    expect(lignes()).toHaveLength(0);
  });

  it("refuse une formule sans prix : elle n'est pas en vente", async () => {
    mockBase.set("settings/offre", { prix: { pro_mois: null, pro_an: 15000 } });
    await expect(demarrerPaiement(UID, "pro_mois", ORIGINE)).rejects.toMatchObject({ code: "pas_en_vente" });
    expect(mockFedapay.creerCollecte).not.toHaveBeenCalled();
  });

  it("refuse sans clé FedaPay", async () => {
    mockFedapay.configure = false;
    await expect(demarrerPaiement(UID, "pro_mois", ORIGINE)).rejects.toMatchObject({ code: "non_configure" });
  });

  it("refuse de vendre à qui a déjà un Pro sans échéance", async () => {
    mockBase.set(`droits/${UID}`, { pro: { depuis: "2026-01-01", jusqu_au: null, source: "admin", accorde_par: "admin1", motif: null } });
    await expect(demarrerPaiement(UID, "pro_mois", ORIGINE)).rejects.toMatchObject({ code: "deja_illimite" });
    expect(lignes()).toHaveLength(0);
  });

  it("ne laisse aucune ligne quand FedaPay refuse la collecte", async () => {
    mockFedapay.creerCollecte.mockRejectedValue(new Error("FedaPay 500"));
    await expect(demarrerPaiement(UID, "pro_mois", ORIGINE)).rejects.toMatchObject({ code: "fedapay" });
    expect(lignes()).toHaveLength(0);
  });

  it("ne laisse aucune ligne quand le lien de paiement ne vient pas", async () => {
    mockFedapay.lienDePaiement.mockRejectedValue(new Error("FedaPay 500"));
    await expect(demarrerPaiement(UID, "pro_mois", ORIGINE)).rejects.toMatchObject({ code: "fedapay" });
    expect(lignes()).toHaveLength(0);
  });

  it("arrête à la sixième tentative dans l'heure", async () => {
    for (let i = 0; i < 5; i += 1) await demarrerPaiement(UID, "pro_mois", ORIGINE);
    await expect(demarrerPaiement(UID, "pro_mois", ORIGINE)).rejects.toMatchObject({ code: "trop_de_tentatives" });
    expect(lignes()).toHaveLength(5);
  });

  it("ne compte pas les tentatives d'un autre compte", async () => {
    mockBase.set("users/compte2", { is_superadmin: true });
    for (let i = 0; i < 5; i += 1) await demarrerPaiement("compte2", "pro_mois", ORIGINE);
    await expect(demarrerPaiement(UID, "pro_mois", ORIGINE)).resolves.toMatchObject({ url: URL_PAIEMENT });
  });
});

describe("formulesPour", () => {
  beforeEach(() => {
    mockBase.set("settings/offre", { prix: { pro_mois: 1500, pro_an: null } });
  });

  it("en bac à sable, ne montre rien à un compte ordinaire", async () => {
    expect(await formulesPour({ user_type: "manager" })).toEqual([]);
    expect(await formulesPour(undefined)).toEqual([]);
  });

  it("en bac à sable, montre les formules en vente à un superadmin", async () => {
    expect(await formulesPour({ is_superadmin: true })).toEqual([{ id: "pro_mois", mois: 1, prix: 1500 }]);
  });

  it("en réel, les montre à tout le monde", async () => {
    mockFedapay.environnement = "live";
    expect(await formulesPour({ user_type: "manager" })).toEqual([{ id: "pro_mois", mois: 1, prix: 1500 }]);
  });

  it("ne montre rien sans clé FedaPay", async () => {
    mockFedapay.configure = false;
    expect(await formulesPour({ is_superadmin: true })).toEqual([]);
  });
});

describe("reverifierPaiementsOuverts", () => {
  const MAINTENANT = Date.parse("2026-10-13T06:00:00Z");
  const ilYA = (heures: number) => ({ toMillis: () => MAINTENANT - heures * 3_600_000 });

  it("règle le paiement dont le webhook et le retour ont manqué", async () => {
    poserLigne({ created_at: ilYA(9) });
    mockFedapay.lireCollecte.mockResolvedValue(collecte("approved"));

    expect(await reverifierPaiementsOuverts(MAINTENANT)).toEqual({ revus: 1, payes: 1, fermes: 0 });
    expect(ligne().statut).toBe("paye");
    expect(pro()?.jusqu_au).toBe(ajouterMois(JOUR, 1));
  });

  it("laisse ouverte une ligne récente qui n'est pas encore payée", async () => {
    poserLigne({ created_at: ilYA(2) });
    mockFedapay.lireCollecte.mockResolvedValue(collecte("pending"));

    expect(await reverifierPaiementsOuverts(MAINTENANT)).toEqual({ revus: 1, payes: 0, fermes: 0 });
    expect(ligne().statut).toBe("en_attente");
  });

  it("ferme une ligne de plus de 48 h qui n'a jamais été payée", async () => {
    poserLigne({ created_at: ilYA(60), statut: "echoue" });
    mockFedapay.lireCollecte.mockResolvedValue(collecte("declined"));

    expect(await reverifierPaiementsOuverts(MAINTENANT)).toEqual({ revus: 1, payes: 0, fermes: 1 });
    expect(ligne().statut).toBe("expire");
    expect(pro()).toBeNull();
  });

  it("accorde une vieille ligne qui se révèle payée, au lieu de la fermer", async () => {
    poserLigne({ created_at: ilYA(60) });
    mockFedapay.lireCollecte.mockResolvedValue(collecte("approved"));

    expect(await reverifierPaiementsOuverts(MAINTENANT)).toEqual({ revus: 1, payes: 1, fermes: 0 });
    expect(ligne().statut).toBe("paye");
  });

  it("ne ferme pas une vieille ligne quand FedaPay ne répond pas ce matin-là", async () => {
    poserLigne({ created_at: ilYA(60) });
    mockFedapay.lireCollecte.mockRejectedValue(new Error("FedaPay injoignable"));
    const journal = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(await reverifierPaiementsOuverts(MAINTENANT)).toEqual({ revus: 1, payes: 0, fermes: 0 });
    expect(ligne().statut).toBe("en_attente");
    journal.mockRestore();
  });

  it("ne ferme pas une ligne qui porte un écart : l'administration doit la voir", async () => {
    poserLigne({ created_at: ilYA(60) });
    mockFedapay.lireCollecte.mockResolvedValue(collecte("approved", { montant: 100 }));
    const journal = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(await reverifierPaiementsOuverts(MAINTENANT)).toEqual({ revus: 1, payes: 0, fermes: 0 });
    expect(ligne()).toMatchObject({ statut: "en_attente", anomalie: "montant" });
    journal.mockRestore();
  });

  it("en réel, ne touche pas aux lignes du bac à sable, même vieilles", async () => {
    poserLigne({ created_at: ilYA(60), environnement: "sandbox" });
    mockFedapay.environnement = "live";

    expect(await reverifierPaiementsOuverts(MAINTENANT)).toEqual({ revus: 0, payes: 0, fermes: 0 });
    expect(mockFedapay.lireCollecte).not.toHaveBeenCalled();
    expect(ligne().statut).toBe("en_attente");
  });

  it("ne relit pas une ligne déjà payée", async () => {
    poserLigne({ created_at: ilYA(5), statut: "paye" });

    expect(await reverifierPaiementsOuverts(MAINTENANT)).toEqual({ revus: 0, payes: 0, fermes: 0 });
    expect(mockFedapay.lireCollecte).not.toHaveBeenCalled();
  });

  it("ne fait rien sans clé FedaPay", async () => {
    poserLigne({ created_at: ilYA(60) });
    mockFedapay.configure = false;

    expect(await reverifierPaiementsOuverts(MAINTENANT)).toEqual({ revus: 0, payes: 0, fermes: 0 });
    expect(ligne().statut).toBe("en_attente");
  });
});

describe("rappelerEcheancesPro", () => {
  const AUJOURDHUI = "2026-11-05";
  const droit = (jusqu_au: string | null) => ({ pro: { depuis: "2026-10-01", jusqu_au, source: "paiement", accorde_par: null, motif: null } });
  const titres = () => mockNotifier.mock.calls.map(([uid, n]) => `${uid} : ${(n as { title: string }).title}`);

  beforeEach(() => {
    mockFedapay.environnement = "live";
    mockBase.set("settings/offre", { prix: { pro_mois: 1500, pro_an: null } });
    mockBase.set("droits/demain", droit("2026-11-06"));
    mockBase.set("droits/semaine", droit("2026-11-12"));
    mockBase.set("droits/plus-tard", droit("2026-11-20"));
    mockBase.set("droits/sans-fin", droit(null));
  });

  it("prévient la veille et sept jours avant, et personne d'autre", async () => {
    expect(await rappelerEcheancesPro(AUJOURDHUI)).toBe(2);
    expect(titres().sort()).toEqual(["demain : Ton Pro se termine demain", "semaine : Ton Pro se termine dans 7 jours"]);
    expect(mockNotifier.mock.calls[0][1]).toMatchObject({ type: "offre", link: "/offre" });
  });

  it("ne sonne pas deux fois le même jour quand la tâche est rejouée", async () => {
    await rappelerEcheancesPro(AUJOURDHUI);
    expect(await rappelerEcheancesPro(AUJOURDHUI)).toBe(0);
    expect(mockNotifier).toHaveBeenCalledTimes(2);
  });

  it("rappelle de nouveau la veille celui qu'on a prévenu sept jours avant", async () => {
    await rappelerEcheancesPro(AUJOURDHUI);
    mockNotifier.mockClear();

    expect(await rappelerEcheancesPro("2026-11-11")).toBe(1);
    expect(titres()).toEqual(["semaine : Ton Pro se termine demain"]);
  });

  it("ne rappelle rien en bac à sable", async () => {
    mockFedapay.environnement = "sandbox";
    expect(await rappelerEcheancesPro(AUJOURDHUI)).toBe(0);
    expect(mockNotifier).not.toHaveBeenCalled();
  });

  it("ne rappelle rien quand aucune formule n'est en vente : il n'y aurait rien à prolonger", async () => {
    mockBase.set("settings/offre", { prix: { pro_mois: null, pro_an: null } });
    expect(await rappelerEcheancesPro(AUJOURDHUI)).toBe(0);
    expect(mockNotifier).not.toHaveBeenCalled();
  });

  it("ne rappelle rien sans clé FedaPay", async () => {
    mockFedapay.configure = false;
    expect(await rappelerEcheancesPro(AUJOURDHUI)).toBe(0);
  });
});

describe("paiementParCollecte", () => {
  it("retrouve la ligne d'une collecte FedaPay, ou rien", async () => {
    poserLigne({ fedapay_id: 258 });
    expect(await paiementParCollecte(258)).toBe(ID);
    expect(await paiementParCollecte(999)).toBeNull();
  });
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
