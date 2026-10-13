import type { FirestoreReglement } from "@/lib/reglement";
import type { Collecte, FirestorePaiement } from "@/lib/paiement";
import { base, vider } from "../test-aides/faux-firestore";

// Le serveur des règlements (src/lib/reglement-serveur) et l'effet d'un
// acompte dans reglerPaiement, joués contre le faux Firestore et un faux
// FedaPay. C'est le circuit d'argent des terrains : qui doit quoi à qui, et
// jamais deux fois.

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
const mockSurMatch = jest.fn(async (_ref: unknown, _valeur: unknown) => {});

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => ({ toMillis: () => Date.now() }) },
}));
jest.mock("@/lib/firebase-admin", () => ({ adminDb: require("../test-aides/faux-firestore").adminDb }));
jest.mock("@/lib/admin-api-auth", () => ({ estSuperadmin: (d?: Doc) => d?.is_superadmin === true }));
jest.mock("@/lib/email", () => ({ recuPaiementHtml: () => "<p>reçu</p>", sendNotificationEmail: jest.fn(async () => {}) }));
jest.mock("@/lib/notifier-serveur", () => ({ notifierCompte: (uid: string, n: unknown) => mockNotifier(uid, n) }));
jest.mock("@/lib/partage", () => ({ APP_URL: "https://www.koppafoot.com" }));
jest.mock("@/lib/reservations-server", () => ({
  recopierSurLeMatch: (ref: unknown, valeur: unknown) => mockSurMatch(ref, valeur),
  surLeMatch: (id: string, b: Doc, status: string) => ({ booking_id: id, venue_id: b.venue_id, venue_name: b.venue_name, status, proposition: null }),
}));
jest.mock("@/lib/fedapay", () => ({
  environnementFedapay: () => mockFedapay.environnement,
  fedapayConfigure: () => mockFedapay.configure,
  creerCollecte: (demande: unknown) => mockFedapay.creerCollecte(demande),
  lienDePaiement: (id: number) => mockFedapay.lienDePaiement(id),
  lireCollecte: (id: number) => mockFedapay.lireCollecte(id),
  lireCollecteParReference: (reference: string) => mockFedapay.lireCollecteParReference(reference),
}));

// `require`, et non `import` : ces modules tirent firebase-admin et
// next/server, dont la vérification de types de l'application mobile n'a pas
// les types.
type Reglement = FirestoreReglement & { id: string };
const { suivreReservation, lireTicket, validerTicket, vuePour, suivreReglementsOuverts } = require("@/lib/reglement-serveur") as {
  suivreReservation: (id: string, options?: { maintenant?: number; annoncer?: boolean }) => Promise<Reglement | null>;
  lireTicket: (uid: string, brut: unknown, maintenant?: number) => Promise<Doc>;
  validerTicket: (uid: string, brut: unknown, maintenant?: number) => Promise<Doc>;
  vuePour: (uid: string, id: string) => Promise<Doc | null>;
  suivreReglementsOuverts: (maintenant?: number) => Promise<{ suivis: number; clos: number }>;
};
const { reglerPaiement, demarrerAcompte } = require("@/lib/paiement-serveur") as {
  reglerPaiement: (id: string) => Promise<{ statut: string } | null>;
  demarrerAcompte: (uid: string, reservation: unknown, origine: string, telephone?: unknown) => Promise<{ id: string; url: string }>;
};

const H = 3_600_000;
const RESA = "ResaAbCdEfGhIjKlMnOp";
const PAIE = "PaieAbCdEfGhIjKlMnOp";
/**
 * Un créneau dans dix jours, à 18 h. Jamais une date écrite en dur : les
 * fonctions qui lisent l'heure réelle (demarrerAcompte, vuePour) doivent
 * toujours le trouver à venir, le jour où cette suite tourne.
 */
const DEBUT = (Math.floor(Date.now() / (24 * H)) + 10) * 24 * H + 18 * H;
const DATE = new Date(DEBUT).toISOString().slice(0, 10);
/** Deux jours avant le match : la confirmation. */
const J2 = DEBUT - 48 * H;

const reservation = (p: Doc = {}): Doc => ({
  venue_id: "terrain1", venue_name: "Terrain des Cocotiers", owner_id: "gerant", user_id: "equipe",
  user_name: "Ama Koffi", team_name: "Étoile de Bè", date: DATE, time: "18:00", duration: 1,
  total_price: 0, status: "confirmed", kind: "demande", match_id: null, competition_id: null,
  cancelled_by: null, contact: { telephone: "90112233", email: null },
  // Demandée après l'activation des frais sur le terrain (1 000 < 2 000).
  created_at: { toMillis: () => 2_000 }, ...p,
});
const terrain = (p: Doc = {}): Doc => ({
  name: "Terrain des Cocotiers", owner_id: "gerant", price_per_hour: 10_000, paiement_app: true,
  paiement_app_depuis: 1_000, battement_min: 15, ...p,
});
const collecte = (statut: string, p: Partial<Collecte> = {}): Collecte => ({
  id: 258, statut, montant: 520, reference: PAIE, mode: "momo_test", frais: 20, recuUrl: null,
  disponibleLe: "2026-10-18T10:00:00.000Z", ...p,
});
const ligneAcompte = (p: Partial<FirestorePaiement> = {}): Doc => ({
  uid: "equipe", objet: "acompte", formule: null, droit: null, reservation_id: RESA, frais_client: 20,
  montant: 520, devise: "XOF", statut: "en_attente", environnement: "sandbox", fedapay_id: 258,
  fedapay_statut: "pending", mode: null, frais: null, recu_url: null, echeance_avant: null,
  echeance_apres: null, applique_le: null, anomalie: null, created_at: "t0", updated_at: "t0", ...p,
});

const reglement = () => base.get(`reglements/${RESA}`) as unknown as FirestoreReglement | undefined;
const resa = () => base.get(`bookings/${RESA}`) as Doc;
const dus = () => [...base.entries()].filter(([chemin]) => chemin.startsWith("dus/"));
const titres = (uid: string) => mockNotifier.mock.calls.filter(([u]) => u === uid).map(([, n]) => (n as { title: string }).title);

/** Un terrain payant, une réservation confirmée, le règlement ouvert deux jours avant. */
async function ouvrir(): Promise<Reglement> {
  const r = await suivreReservation(RESA, { maintenant: J2 });
  if (!r) throw new Error("le règlement ne s'est pas ouvert");
  mockNotifier.mockClear();
  return r;
}

/** L'acompte payé chez FedaPay, puis réglé chez nous. */
async function payer(): Promise<void> {
  base.set(`paiements/${PAIE}`, ligneAcompte());
  mockFedapay.lireCollecte.mockResolvedValue(collecte("approved"));
  await reglerPaiement(PAIE);
  mockNotifier.mockClear();
}

beforeEach(() => {
  vider();
  mockFedapay.environnement = "sandbox";
  mockFedapay.configure = true;
  mockFedapay.creerCollecte.mockReset();
  mockFedapay.lienDePaiement.mockReset();
  mockFedapay.lireCollecte.mockReset();
  mockFedapay.lireCollecteParReference.mockReset();
  mockNotifier.mockClear();
  mockSurMatch.mockClear();
  base.set("venues/terrain1", terrain());
  base.set("comptes_versement/gerant", { numero: "90123456", pays: "tg", modifie_le: 1 });
  base.set("settings/paiement", { taux_frais: 4 });
  base.set(`bookings/${RESA}`, reservation());
  // En bac à sable, seul un superadmin peut payer : le demandeur en est un.
  base.set("users/equipe", { first_name: "Ama", last_name: "Koffi", is_superadmin: true });
});

describe("suivreReservation : l'ouverture", () => {
  it("ouvre le règlement d'une réservation confirmée sur un terrain payant", async () => {
    const r = await suivreReservation(RESA, { maintenant: J2 });

    expect(r).toMatchObject({
      id: RESA, owner_id: "gerant", user_id: "equipe", venue_name: "Terrain des Cocotiers", demandeur: "Étoile de Bè",
      telephone: "90112233",
      date: DATE, time: "18:00", duration: 1, prix: 10_000, acompte: 500, taux_frais: 4,
      echeance: J2 + 24 * H, ouvre_validation: DEBUT - H, fin_fenetre: DEBUT + H + 15 * 60_000,
      paye_le: null, paiement_id: null, code: null, valide_le: null, cloture: null,
    });
    expect(resa().reglement_vu).toBe("acompte_attendu");
    expect(titres("equipe")).toHaveLength(1);
  });

  it("l'échéance ne dépasse jamais le début du créneau", async () => {
    const r = await suivreReservation(RESA, { maintenant: DEBUT - 3 * H });
    expect(r?.echeance).toBe(DEBUT);
  });

  it("ne prévient pas quand l'appelant s'en charge", async () => {
    await suivreReservation(RESA, { maintenant: J2, annoncer: false });
    expect(mockNotifier).not.toHaveBeenCalled();
    expect(reglement()).toBeDefined();
  });

  it.each([
    ["le terrain n'a pas activé le paiement", () => base.set("venues/terrain1", terrain({ paiement_app: false }))],
    ["le terrain n'a pas de tarif", () => base.set("venues/terrain1", terrain({ price_per_hour: 0 }))],
    ["le propriétaire n'a pas donné de numéro de versement", () => base.delete("comptes_versement/gerant")],
    ["la demande date d'avant l'activation des frais", () => base.set("venues/terrain1", terrain({ paiement_app_depuis: 5_000 }))],
    ["le terrain n'a jamais daté l'activation de ses frais", () => base.set("venues/terrain1", terrain({ paiement_app_depuis: undefined }))],
    // On ne met personne en demeure de payer ce qu'il ne peut pas payer : le
    // créneau serait libéré au bout de vingt-quatre heures, sans issue.
    ["FedaPay n'est pas configuré : personne ne pourrait payer", () => { mockFedapay.configure = false; }],
    ["le paiement n'est ouvert qu'aux superadmins (bac à sable), et le demandeur n'en est pas un", () => base.set("users/equipe", { first_name: "Ama" })],
    ["la réservation attend encore la réponse", () => base.set(`bookings/${RESA}`, reservation({ status: "pending" }))],
    ["c'est un créneau bloqué", () => base.set(`bookings/${RESA}`, reservation({ kind: "blocage", user_id: "gerant" }))],
    ["le propriétaire joue sur son propre terrain", () => base.set(`bookings/${RESA}`, reservation({ user_id: "gerant" }))],
  ])("n'ouvre rien quand %s", async (_cas, preparer) => {
    preparer();
    expect(await suivreReservation(RESA, { maintenant: J2 })).toBeNull();
    expect(reglement()).toBeUndefined();
    expect(resa().reglement_vu).toBeUndefined();
  });

  it("en réel, s'ouvre pour un compte ordinaire", async () => {
    mockFedapay.environnement = "live";
    base.set("users/equipe", { first_name: "Ama" });

    expect(await suivreReservation(RESA, { maintenant: J2 })).toMatchObject({ acompte: 500, cloture: null });
  });

  it("fige le prix : un tarif changé après la confirmation ne touche pas l'acompte", async () => {
    await ouvrir();
    base.set("venues/terrain1", terrain({ price_per_hour: 40_000 }));

    const r = await suivreReservation(RESA, { maintenant: J2 + H });

    expect(r).toMatchObject({ prix: 10_000, acompte: 500 });
  });
});

describe("suivreReservation : la clôture", () => {
  it("libère le créneau quand l'acompte n'est pas venu à temps, et prévient les deux", async () => {
    await ouvrir();

    const r = await suivreReservation(RESA, { maintenant: J2 + 25 * H });

    expect(r?.cloture).toBe("libere");
    expect(resa()).toMatchObject({ status: "cancelled", cancelled_by: "systeme", reglement_vu: "libere" });
    expect(dus()).toHaveLength(0);
    expect(titres("equipe")).toHaveLength(1);
    expect(titres("gerant")).toHaveLength(1);
  });

  it("recopie la libération sur le match quand la réservation en a un", async () => {
    base.set(`bookings/${RESA}`, reservation({ kind: "match", match_id: "match1" }));
    await ouvrir();

    await suivreReservation(RESA, { maintenant: J2 + 25 * H });

    expect(mockSurMatch).toHaveBeenCalledWith({ mid: "match1", cid: null }, expect.objectContaining({ booking_id: RESA, status: "cancelled" }));
  });

  it("une fenêtre passée sans ticket validé est une absence : l'acompte est dû au propriétaire", async () => {
    await ouvrir();
    await payer();

    const r = await suivreReservation(RESA, { maintenant: DEBUT + 2 * H });

    expect(r?.cloture).toBe("absent");
    expect(resa()).toMatchObject({ status: "confirmed", reglement_vu: "absent" });
    expect(dus()).toHaveLength(1);
    expect(base.get(`dus/${RESA}_acompte`)).toMatchObject({
      beneficiaire: "gerant", role: "proprietaire", montant: 500, motif: "acompte", reservation_id: RESA,
      telephone: null, disponible_le: "2026-10-18T10:00:00.000Z", depot_id: null, regle_le: null,
    });
  });

  it("l'équipe annule après avoir payé : l'acompte reste dû au propriétaire", async () => {
    await ouvrir();
    await payer();
    base.set(`bookings/${RESA}`, { ...resa(), status: "cancelled", cancelled_by: "demandeur" });

    const r = await suivreReservation(RESA, { maintenant: J2 + 30 * H });

    expect(r?.cloture).toBe("annule_equipe");
    expect(base.get(`dus/${RESA}_acompte`)).toMatchObject({ beneficiaire: "gerant", montant: 500 });
  });

  it("le propriétaire annule après le paiement : l'acompte est dû à l'équipe, pas à lui", async () => {
    await ouvrir();
    await payer();
    base.set(`bookings/${RESA}`, { ...resa(), status: "cancelled", cancelled_by: "proprietaire" });

    const r = await suivreReservation(RESA, { maintenant: J2 + 30 * H });

    expect(r?.cloture).toBe("annule_proprietaire");
    expect(dus()).toHaveLength(1);
    expect(base.get(`dus/${RESA}_remb_${PAIE}`)).toMatchObject({
      beneficiaire: "equipe", role: "equipe", montant: 500, motif: "remboursement", telephone: "90112233",
      depot_id: null, regle_le: null,
    });
    expect(titres("equipe")).toHaveLength(1);
  });

  it("rejouer le geste ne doit rien de plus", async () => {
    await ouvrir();
    await payer();
    base.set(`bookings/${RESA}`, { ...resa(), status: "cancelled", cancelled_by: "proprietaire" });

    await suivreReservation(RESA, { maintenant: J2 + 30 * H });
    await suivreReservation(RESA, { maintenant: J2 + 31 * H });
    await suivreReservation(RESA, { maintenant: DEBUT + 5 * H });

    expect(dus()).toHaveLength(1);
    expect(titres("equipe")).toHaveLength(1);
  });

  it("une annulation avant tout paiement clôt sans rien devoir", async () => {
    await ouvrir();
    base.set(`bookings/${RESA}`, { ...resa(), status: "cancelled", cancelled_by: "proprietaire" });

    expect((await suivreReservation(RESA, { maintenant: J2 + H }))?.cloture).toBe("annule_proprietaire");
    expect(dus()).toHaveLength(0);
  });
});

describe("l'effet d'un acompte réglé", () => {
  it("pose le ticket et prévient les deux parties", async () => {
    await ouvrir();
    base.set(`paiements/${PAIE}`, ligneAcompte());
    mockFedapay.lireCollecte.mockResolvedValue(collecte("approved"));

    expect(await reglerPaiement(PAIE)).toMatchObject({ statut: "paye" });

    expect(reglement()).toMatchObject({ paiement_id: PAIE, disponible_le: "2026-10-18T10:00:00.000Z", cloture: null });
    expect(reglement()?.paye_le).toBeTruthy();
    expect(reglement()?.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    expect(resa().reglement_vu).toBe("acompte_paye");
    expect(titres("equipe")).toHaveLength(1);
    expect(titres("gerant")).toHaveLength(1);
  });

  it("réglé deux fois, ne crée qu'un ticket", async () => {
    await ouvrir();
    base.set(`paiements/${PAIE}`, ligneAcompte());
    mockFedapay.lireCollecte.mockResolvedValue(collecte("approved"));

    await Promise.all([reglerPaiement(PAIE), reglerPaiement(PAIE)]);
    const code = reglement()?.code;
    await reglerPaiement(PAIE);

    expect(reglement()?.code).toBe(code);
    expect(titres("equipe")).toHaveLength(1);
    expect(dus()).toHaveLength(0);
  });

  it("payé après la libération du créneau : pas de ticket, l'acompte est rendu une fois", async () => {
    await ouvrir();
    await suivreReservation(RESA, { maintenant: J2 + 25 * H });
    mockNotifier.mockClear();
    base.set(`paiements/${PAIE}`, ligneAcompte());
    mockFedapay.lireCollecte.mockResolvedValue(collecte("approved"));

    await reglerPaiement(PAIE);
    await reglerPaiement(PAIE);

    expect(reglement()).toMatchObject({ cloture: "libere", code: null, paye_le: null });
    expect(dus()).toHaveLength(1);
    expect(base.get(`dus/${RESA}_remb_${PAIE}`)).toMatchObject({ beneficiaire: "equipe", montant: 500, motif: "remboursement" });
    expect(titres("equipe")).toHaveLength(1);
  });

  it("un second paiement du même acompte est rendu, le premier garde son ticket", async () => {
    await ouvrir();
    await payer();
    const code = reglement()?.code;
    const AUTRE = "AutrAbCdEfGhIjKlMnOp";
    base.set(`paiements/${AUTRE}`, ligneAcompte({ fedapay_id: 259 }));
    mockFedapay.lireCollecte.mockResolvedValue(collecte("approved", { id: 259, reference: AUTRE }));

    await reglerPaiement(AUTRE);

    expect(reglement()).toMatchObject({ code, paiement_id: PAIE });
    expect(base.get(`dus/${RESA}_remb_${AUTRE}`)).toMatchObject({ beneficiaire: "equipe", montant: 500 });
  });
});

describe("demarrerAcompte", () => {
  const ORIGINE = "http://localhost:3000";

  beforeEach(() => {
    base.set("users/equipe", { first_name: "Ama", last_name: "Koffi", email: "ama@exemple.test", is_superadmin: true });
    mockFedapay.creerCollecte.mockResolvedValue(collecte("pending"));
    mockFedapay.lienDePaiement.mockResolvedValue("https://sandbox-process.fedapay.com/jeton");
  });

  it("demande l'acompte et les frais de paiement, au montant du règlement", async () => {
    await ouvrir();

    const { id, url } = await demarrerAcompte("equipe", RESA, ORIGINE);

    expect(url).toBe("https://sandbox-process.fedapay.com/jeton");
    expect(base.get(`paiements/${id}`)).toMatchObject({
      uid: "equipe", objet: "acompte", formule: null, droit: null, reservation_id: RESA,
      montant: 520, frais_client: 20, statut: "en_attente", environnement: "sandbox",
    });
    expect(mockFedapay.creerCollecte).toHaveBeenCalledWith(expect.objectContaining({
      reference: id, montant: 520, retour: `${ORIGINE}/mes-reservations?paiement=${id}`,
    }));
  });

  it("refuse la réservation de quelqu'un d'autre, ou un identifiant qui n'en est pas un", async () => {
    await ouvrir();
    base.set("users/intrus", { is_superadmin: true });
    await expect(demarrerAcompte("intrus", RESA, ORIGINE)).rejects.toMatchObject({ code: "reservation" });
    await expect(demarrerAcompte("equipe", "../paiements/x", ORIGINE)).rejects.toMatchObject({ code: "reservation" });
    await expect(demarrerAcompte("equipe", { id: RESA }, ORIGINE)).rejects.toMatchObject({ code: "reservation" });
    expect(mockFedapay.creerCollecte).not.toHaveBeenCalled();
  });

  it("refuse une réservation sans règlement", async () => {
    base.set("venues/terrain1", terrain({ paiement_app: false }));
    await expect(demarrerAcompte("equipe", RESA, ORIGINE)).rejects.toMatchObject({ code: "reservation" });
  });

  it("refuse un acompte déjà payé", async () => {
    await ouvrir();
    await payer();
    await expect(demarrerAcompte("equipe", RESA, ORIGINE)).rejects.toMatchObject({ code: "deja_paye" });
  });

  it("exige un numéro où rendre les frais quand la réservation n'en porte pas", async () => {
    // La réservation d'un match n'a pas le téléphone qu'une demande exige.
    base.set(`bookings/${RESA}`, reservation({ kind: "match", match_id: "match1", contact: null }));
    await ouvrir();
    expect(reglement()?.telephone).toBeNull();

    await expect(demarrerAcompte("equipe", RESA, ORIGINE)).rejects.toMatchObject({ code: "telephone" });
    await expect(demarrerAcompte("equipe", RESA, ORIGINE, "12345")).rejects.toMatchObject({ code: "telephone" });
    expect(mockFedapay.creerCollecte).not.toHaveBeenCalled();

    await demarrerAcompte("equipe", RESA, ORIGINE, "+228 91 22 33 44");

    expect(reglement()?.telephone).toBe("91223344");
    expect(mockFedapay.creerCollecte).toHaveBeenCalledTimes(1);
  });

  it("le numéro donné en payant remplace celui de la demande, un numéro illisible ne l'efface pas", async () => {
    await ouvrir();

    await demarrerAcompte("equipe", RESA, ORIGINE, "pas un numéro");
    expect(reglement()?.telephone).toBe("90112233");

    await demarrerAcompte("equipe", RESA, ORIGINE, "99 88 77 66");
    expect(reglement()?.telephone).toBe("99887766");
  });

  it("refuse en bac à sable un compte qui n'est pas superadmin", async () => {
    await ouvrir();
    base.set("users/equipe", { first_name: "Ama", last_name: "Koffi" });
    await expect(demarrerAcompte("equipe", RESA, ORIGINE)).rejects.toMatchObject({ code: "bac_a_sable" });
  });
});

describe("le ticket", () => {
  const DANS_LA_FENETRE = DEBUT - 10 * 60_000;

  it("se valide sur place : la réservation est jouée et l'acompte dû au propriétaire", async () => {
    await ouvrir();
    await payer();
    const code = reglement()?.code;

    const resume = await validerTicket("gerant", code?.toLowerCase(), DANS_LA_FENETRE);

    expect(resume).toMatchObject({ reservation: RESA, terrain: "Terrain des Cocotiers", equipe: "Étoile de Bè", acompte: 500, reste: 9_500, valide: true });
    expect(reglement()).toMatchObject({ cloture: "joue" });
    expect(reglement()?.valide_le).toBeTruthy();
    expect(resa().reglement_vu).toBe("joue");
    expect(base.get(`dus/${RESA}_acompte`)).toMatchObject({ beneficiaire: "gerant", montant: 500 });
  });

  it("validé deux fois, ne change rien", async () => {
    await ouvrir();
    await payer();
    const code = reglement()?.code;

    await validerTicket("gerant", code, DANS_LA_FENETRE);
    await expect(validerTicket("gerant", code, DANS_LA_FENETRE + 60_000)).resolves.toMatchObject({ valide: true });

    expect(dus()).toHaveLength(1);
  });

  it("répond pareil à un code inconnu et au ticket d'un autre terrain, sans rien valider", async () => {
    await ouvrir();
    await payer();
    const code = reglement()?.code;

    const inconnu = await validerTicket("gerant", "ZZZZZZ", DANS_LA_FENETRE).catch((e: Error & { status: number }) => e);
    const dUnAutre = await validerTicket("autre-gerant", code, DANS_LA_FENETRE).catch((e: Error & { status: number }) => e);

    expect(inconnu).toMatchObject({ status: 404 });
    expect(dUnAutre).toMatchObject({ status: 404 });
    expect((dUnAutre as Error).message).toBe((inconnu as Error).message);
    expect(reglement()?.valide_le).toBeNull();
    expect(reglement()?.cloture).toBeNull();
  });

  it("refuse ce qui n'a pas la forme d'un code", async () => {
    await expect(validerTicket("gerant", "pas un code", DANS_LA_FENETRE)).rejects.toMatchObject({ status: 400 });
  });

  it("refuse trop tôt, et après la fenêtre", async () => {
    await ouvrir();
    await payer();
    const code = reglement()?.code;

    await expect(validerTicket("gerant", code, DEBUT - 2 * H)).rejects.toMatchObject({ status: 409 });
    await expect(validerTicket("gerant", code, DEBUT + 2 * H)).rejects.toMatchObject({ status: 409 });
    expect(reglement()?.valide_le).toBeNull();
  });

  it("accepte le battement : un quart d'heure après la fin du créneau", async () => {
    await ouvrir();
    await payer();
    await expect(validerTicket("gerant", reglement()?.code, DEBUT + H + 10 * 60_000)).resolves.toMatchObject({ valide: true });
  });

  it("compte les essais : le sixième de la minute est refusé", async () => {
    for (let i = 0; i < 5; i += 1) {
      await validerTicket("gerant", "ZZZZZZ", DANS_LA_FENETRE).catch(() => {});
    }
    await expect(validerTicket("gerant", "ZZZZZZ", DANS_LA_FENETRE)).rejects.toMatchObject({ status: 429 });
    await expect(validerTicket("gerant", "ZZZZZZ", DANS_LA_FENETRE + 61_000)).rejects.toMatchObject({ status: 404 });
  });

  it("se lit sans se valider", async () => {
    await ouvrir();
    await payer();

    expect(await lireTicket("gerant", reglement()?.code, DANS_LA_FENETRE)).toMatchObject({ acompte: 500, reste: 9_500, valide: false });
    expect(reglement()?.valide_le).toBeNull();
  });
});

describe("vuePour", () => {
  it("montre le code à l'équipe qui a payé, jamais au propriétaire", async () => {
    await ouvrir();
    await payer();

    const equipe = await vuePour("equipe", RESA);
    const gerant = await vuePour("gerant", RESA);

    expect(equipe).toMatchObject({
      role: "equipe", etat: "acompte_paye", acompte: 500, frais: 20, total: 520, reste: 9_500, telephone: "90112233",
    });
    expect(equipe?.code).toBe(reglement()?.code);
    // Ni le code, ni le numéro de remboursement de l'équipe.
    expect(gerant).toMatchObject({ role: "proprietaire", etat: "acompte_paye", code: null, telephone: null });
  });

  it("dit au propriétaire ce qui lui est dû, puis quand cela a été versé", async () => {
    await ouvrir();
    await payer();
    await validerTicket("gerant", reglement()?.code, DEBUT - 10 * 60_000);

    expect(await vuePour("gerant", RESA)).toMatchObject({ etat: "joue", du: { montant: 500, verseLe: null } });

    base.set(`dus/${RESA}_acompte`, { ...base.get(`dus/${RESA}_acompte`), regle_le: { toMillis: () => 7_000 } });

    expect(await vuePour("gerant", RESA)).toMatchObject({ du: { montant: 500, verseLe: 7_000 } });
    expect((await vuePour("equipe", RESA))?.du).toBeNull();
  });

  it("ne dit rien à un tiers", async () => {
    await ouvrir();
    expect(await vuePour("curieux", RESA)).toBeNull();
  });
});

describe("suivreReglementsOuverts", () => {
  it("applique l'échéance et l'absence aux règlements ouverts, et laisse les autres", async () => {
    await ouvrir();
    expect(await suivreReglementsOuverts(J2 + H)).toEqual({ suivis: 1, clos: 0 });
    expect(await suivreReglementsOuverts(J2 + 25 * H)).toEqual({ suivis: 1, clos: 1 });
    expect(await suivreReglementsOuverts(J2 + 26 * H)).toEqual({ suivis: 0, clos: 0 });
  });
});
