import {
  TOLERANCE_SIGNATURE_S, cibleDeLEvenement, corpsCollecte, deballer, normaliserCollecte, signatureValide,
} from "@/lib/fedapay";

// Le module vit côté site (src/lib/fedapay). Ses appels réseau ne se testent
// pas ici ; ce qui lit une réponse, construit une requête ou vérifie une
// signature est pur, et c'est ce que cette suite tient.

// `require`, comme les autres suites qui ont besoin d'un module Node : la
// vérification de types de l'application mobile n'a pas ceux de Node.
const { createHmac } = require("crypto") as {
  createHmac: (algo: "sha256", cle: string) => { update: (m: string, e: "utf8") => { digest: (f: "hex") => string } };
};

const SECRET = "wh_sandbox_secret";
const hmac = (secret: string) => (message: string) => createHmac("sha256", secret).update(message, "utf8").digest("hex");
const signer = (t: number, corps: string, secret = SECRET) => `t=${t},s=${hmac(secret)(`${t}.${corps}`)}`;

const ID = "AbCdEfGhIjKlMnOpQrSt";

describe("deballer", () => {
  const collecte = { id: 258, status: "pending" };

  it("ouvre l'enveloppe versionnée de l'API", () => {
    expect(deballer({ "v1/transaction": collecte }, "transaction")).toEqual(collecte);
  });

  it("ouvre l'enveloppe sans version", () => {
    expect(deballer({ transaction: collecte }, "transaction")).toEqual(collecte);
  });

  it("rend l'objet tel quel quand il arrive à plat", () => {
    expect(deballer(collecte, "transaction")).toEqual(collecte);
  });

  it("ne casse pas sur une réponse vide", () => {
    expect(deballer(null, "transaction")).toEqual({});
  });

  it("ne prend pas un champ du même nom pour une enveloppe : le lien de paiement a un champ token", () => {
    const lien = { token: "abc123", url: "https://exemple.test/payer/abc123" };
    expect(deballer(lien, "token")).toEqual(lien);
  });
});

describe("normaliserCollecte", () => {
  it("lit ce dont on a besoin", () => {
    expect(normaliserCollecte({
      id: 258, status: "approved", amount: 1500, merchant_reference: ID, mode: "togocel", fees: 26,
      receipt_url: "https://exemple.test/recu", custom_metadata: { paiement_id: ID },
      to_be_transferred_at: "2026-10-15T19:32:58.962Z",
    })).toEqual({
      id: 258, statut: "approved", montant: 1500, reference: ID, mode: "togocel", frais: 26,
      recuUrl: "https://exemple.test/recu", disponibleLe: "2026-10-15T19:32:58.962Z",
    });
  });

  it("retrouve la référence dans les métadonnées si merchant_reference manque", () => {
    expect(normaliserCollecte({ id: 258, status: "pending", amount: 1500, custom_metadata: { paiement_id: ID } })?.reference).toBe(ID);
  });

  it("laisse la référence vide quand rien ne la donne", () => {
    expect(normaliserCollecte({ id: 258, status: "pending", amount: 1500 })?.reference).toBeNull();
  });

  it("rend les champs absents à null", () => {
    expect(normaliserCollecte({ id: 258, status: "pending", amount: 1500 }))
      .toEqual({
        id: 258, statut: "pending", montant: 1500, reference: null, mode: null, frais: null, recuUrl: null, disponibleLe: null,
      });
  });

  it("refuse ce qui n'est pas une collecte", () => {
    expect(normaliserCollecte({})).toBeNull();
    expect(normaliserCollecte({ id: "abc", status: "pending" })).toBeNull();
    expect(normaliserCollecte({ id: 258 })).toBeNull();
  });

  it("un montant illisible ne vaut jamais le montant demandé", () => {
    expect(Number.isNaN(normaliserCollecte({ id: 258, status: "approved" })?.montant)).toBe(true);
  });
});

describe("corpsCollecte", () => {
  const demande = {
    reference: ID, description: "KoppaFoot Pro, 1 mois", montant: 1500, retour: `https://www.koppafoot.com/offre?paiement=${ID}`,
    client: { prenom: "Ama", nom: "Koffi", email: "ama@exemple.test" },
  };

  it("demande le montant en XOF, sous notre référence", () => {
    expect(corpsCollecte(demande)).toEqual({
      description: "KoppaFoot Pro, 1 mois",
      amount: 1500,
      currency: { iso: "XOF" },
      callback_url: `https://www.koppafoot.com/offre?paiement=${ID}`,
      merchant_reference: ID,
      custom_metadata: { paiement_id: ID },
      customer: { firstname: "Ama", lastname: "Koffi", email: "ama@exemple.test" },
    });
  });

  it("n'envoie pas de client incomplet : un compte créé par SMS n'a pas d'e-mail", () => {
    expect(corpsCollecte({ ...demande, client: { prenom: "Ama", nom: "Koffi", email: null } })).not.toHaveProperty("customer");
    expect(corpsCollecte({ ...demande, client: { prenom: "", nom: "Koffi", email: "ama@exemple.test" } })).not.toHaveProperty("customer");
    expect(corpsCollecte({ ...demande, client: { prenom: "Ama", nom: "  ", email: "ama@exemple.test" } })).not.toHaveProperty("customer");
    expect(corpsCollecte({ ...demande, client: { prenom: "Ama", nom: "Koffi", email: "pas-un-email" } })).not.toHaveProperty("customer");
  });

  it("n'envoie jamais de téléphone", () => {
    expect(JSON.stringify(corpsCollecte(demande))).not.toContain("phone");
  });
});

describe("signatureValide", () => {
  const corps = JSON.stringify({ name: "transaction.approved", entity: { id: 258 } });
  const t = 1_800_000_000;

  it("accepte la signature de FedaPay", () => {
    expect(signatureValide(corps, signer(t, corps), hmac(SECRET), t)).toBe(true);
  });

  it("refuse un autre secret", () => {
    expect(signatureValide(corps, signer(t, corps, "autre_secret"), hmac(SECRET), t)).toBe(false);
  });

  it("refuse un corps altéré", () => {
    expect(signatureValide(corps.replace("258", "259"), signer(t, corps), hmac(SECRET), t)).toBe(false);
  });

  it("refuse un horodatage trop vieux, accepte la limite", () => {
    expect(signatureValide(corps, signer(t, corps), hmac(SECRET), t + TOLERANCE_SIGNATURE_S)).toBe(true);
    expect(signatureValide(corps, signer(t, corps), hmac(SECRET), t + TOLERANCE_SIGNATURE_S + 1)).toBe(false);
  });

  it("refuse un en-tête absent ou illisible", () => {
    expect(signatureValide(corps, null, hmac(SECRET), t)).toBe(false);
    expect(signatureValide(corps, "", hmac(SECRET), t)).toBe(false);
    expect(signatureValide(corps, "n'importe quoi", hmac(SECRET), t)).toBe(false);
    expect(signatureValide(corps, `s=${hmac(SECRET)(`${t}.${corps}`)}`, hmac(SECRET), t)).toBe(false);
    expect(signatureValide(corps, `t=${t}`, hmac(SECRET), t)).toBe(false);
    expect(signatureValide(corps, `t=${t},s=zz`, hmac(SECRET), t)).toBe(false);
  });

  it("accepte si l'une des signatures présentes est la bonne", () => {
    const bonne = hmac(SECRET)(`${t}.${corps}`);
    const fausse = "0".repeat(64);
    expect(signatureValide(corps, `t=${t},s=${fausse},s=${bonne}`, hmac(SECRET), t)).toBe(true);
  });

  it("ne tient pas compte de la casse de l'hexadécimal", () => {
    const bonne = hmac(SECRET)(`${t}.${corps}`).toUpperCase();
    expect(signatureValide(corps, `t=${t},s=${bonne}`, hmac(SECRET), t)).toBe(true);
  });
});

describe("cibleDeLEvenement", () => {
  it("lit notre référence sur la collecte de l'événement", () => {
    expect(cibleDeLEvenement({ name: "transaction.approved", entity: { id: 258, merchant_reference: ID } }))
      .toEqual({ reference: ID, idCollecte: 258 });
  });

  it("se replie sur les métadonnées, puis sur l'identifiant FedaPay seul", () => {
    expect(cibleDeLEvenement({ name: "transaction.approved", entity: { id: 258, custom_metadata: { paiement_id: ID } } }))
      .toEqual({ reference: ID, idCollecte: 258 });
    expect(cibleDeLEvenement({ name: "transaction.canceled", entity: { id: 258 } }))
      .toEqual({ reference: null, idCollecte: 258 });
  });

  it("n'accepte comme référence qu'un identifiant de ligne", () => {
    expect(cibleDeLEvenement({ name: "transaction.approved", entity: { id: 258, merchant_reference: "../droits/x" } }))
      .toEqual({ reference: null, idCollecte: 258 });
  });

  it("ignore ce qui ne concerne pas une collecte", () => {
    expect(cibleDeLEvenement({ name: "customer.created", entity: { id: 4 } })).toBeNull();
    expect(cibleDeLEvenement({ name: "transaction.approved" })).toBeNull();
    expect(cibleDeLEvenement({ name: "transaction.approved", entity: {} })).toBeNull();
    expect(cibleDeLEvenement(null)).toBeNull();
    expect(cibleDeLEvenement("texte")).toBeNull();
  });
});
