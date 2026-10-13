import type { DroitAccorde } from "@/lib/offre";
import {
  ID_FORMULES, NOM_OFFRE, ajouterJours, ajouterMois, deciderReglement, estFormule, etatDepuisFedapay, formulesEnVente,
  idPaiementDuRetour, joursDeRappel, libelleFormule, lirePrix, motifAchat, nouvelleEcheance, objetDe, paiementOuvert,
  prixValide, trierLignesOuvertes,
} from "@/lib/paiement";

// Le module vit côté site (src/lib/paiement) ; il est pur, et c'est ici que
// la suite de tests des modules partagés tourne.

describe("paiementOuvert", () => {
  const e = { configure: true, environnement: "live" as const, superadmin: false };

  it("en réel, tout compte peut payer", () => {
    expect(paiementOuvert(e)).toBe(true);
  });

  it("sans clé FedaPay, personne", () => {
    expect(paiementOuvert({ ...e, configure: false })).toBe(false);
    expect(paiementOuvert({ ...e, configure: false, superadmin: true })).toBe(false);
  });

  it("en bac à sable, les superadmins seuls", () => {
    expect(paiementOuvert({ ...e, environnement: "sandbox" })).toBe(false);
    expect(paiementOuvert({ ...e, environnement: "sandbox", superadmin: true })).toBe(true);
  });
});

describe("objetDe", () => {
  it("une ligne d'avant les acomptes est un achat du Pro", () => {
    expect(objetDe({})).toBe("pro");
    expect(objetDe({ objet: null })).toBe("pro");
    expect(objetDe({ objet: "pro" })).toBe("pro");
  });

  it("reconnaît un acompte", () => {
    expect(objetDe({ objet: "acompte" })).toBe("acompte");
  });
});

const droit = (p: Partial<DroitAccorde> = {}): DroitAccorde => ({
  depuis: "2026-09-01", jusqu_au: null, source: "admin", accorde_par: "admin1", motif: null, ...p,
});

describe("estFormule", () => {
  it("reconnaît les quatre formules", () => {
    expect(estFormule("pro_mois")).toBe(true);
    expect(estFormule("pro_an")).toBe(true);
    expect(estFormule("sans_pub_mois")).toBe(true);
    expect(estFormule("sans_pub_an")).toBe(true);
  });

  it("refuse le reste, y compris les propriétés héritées d'un objet", () => {
    expect(estFormule("sans_pub")).toBe(false);
    expect(estFormule("toString")).toBe(false);
    expect(estFormule(null)).toBe(false);
    expect(estFormule(12)).toBe(false);
  });
});

describe("prixValide et lirePrix", () => {
  it("accepte un entier d'au moins 100", () => {
    expect(prixValide(100)).toBe(true);
    expect(prixValide(2500)).toBe(true);
  });

  it("refuse sous le plancher, non entier, ou pas un nombre", () => {
    expect(prixValide(99)).toBe(false);
    expect(prixValide(1500.5)).toBe(false);
    expect(prixValide("1500")).toBe(false);
    expect(prixValide(NaN)).toBe(false);
    expect(prixValide(null)).toBe(false);
  });

  it("assainit ce qui est rangé : tout ce qui n'est pas un prix vaut null", () => {
    expect(lirePrix({ pro_mois: 1500, pro_an: "15000", sans_pub_mois: 300 }))
      .toEqual({ pro_mois: 1500, pro_an: null, sans_pub_mois: 300, sans_pub_an: null });
    const vide = { pro_mois: null, pro_an: null, sans_pub_mois: null, sans_pub_an: null };
    expect(lirePrix(undefined)).toEqual(vide);
    expect(lirePrix("n'importe quoi")).toEqual(vide);
  });
});

describe("formulesEnVente", () => {
  const AUCUN_PRIX = { pro_mois: null, pro_an: null, sans_pub_mois: null, sans_pub_an: null };

  it("ne garde que les formules qui ont un prix, avec leur droit", () => {
    expect(formulesEnVente({ ...AUCUN_PRIX, pro_mois: 1500 })).toEqual([{ id: "pro_mois", droit: "pro", mois: 1, prix: 1500 }]);
    expect(formulesEnVente({ ...AUCUN_PRIX, sans_pub_an: 3000 }))
      .toEqual([{ id: "sans_pub_an", droit: "sans_pub", mois: 12, prix: 3000 }]);
  });

  it("les rend dans l'ordre : KoppaFoot+ d'abord, le mois avant l'année", () => {
    expect(formulesEnVente({ pro_mois: 1500, pro_an: 15000, sans_pub_mois: 300, sans_pub_an: 3000 }).map((f) => f.id))
      .toEqual(["pro_mois", "pro_an", "sans_pub_mois", "sans_pub_an"]);
    expect(ID_FORMULES).toEqual(["pro_mois", "pro_an", "sans_pub_mois", "sans_pub_an"]);
  });

  it("ne rend rien quand rien n'a de prix", () => {
    expect(formulesEnVente(AUCUN_PRIX)).toEqual([]);
  });
});

describe("ajouterMois", () => {
  it("garde le quantième", () => {
    expect(ajouterMois("2026-10-12", 1)).toBe("2026-11-12");
    expect(ajouterMois("2026-10-12", 12)).toBe("2027-10-12");
  });

  it("passe l'année", () => {
    expect(ajouterMois("2026-12-15", 1)).toBe("2027-01-15");
  });

  it("s'arrête au dernier jour quand le quantième n'existe pas", () => {
    expect(ajouterMois("2026-01-31", 1)).toBe("2026-02-28");
    expect(ajouterMois("2028-01-31", 1)).toBe("2028-02-29");
    expect(ajouterMois("2028-02-29", 12)).toBe("2029-02-28");
  });
});

describe("ajouterJours", () => {
  it("avance en passant le mois", () => {
    expect(ajouterJours("2026-10-31", 1)).toBe("2026-11-01");
    expect(ajouterJours("2026-10-12", 7)).toBe("2026-10-19");
  });
});

describe("nouvelleEcheance", () => {
  const jour = "2026-10-12";

  it("premier achat : du jour au même quantième, inclus", () => {
    expect(nouvelleEcheance(null, jour, 1)).toEqual({ depuis: jour, jusqu_au: "2026-11-12" });
    expect(nouvelleEcheance(undefined, jour, 12)).toEqual({ depuis: jour, jusqu_au: "2027-10-12" });
  });

  it("prolongation : la période s'ajoute à la fin en cours, depuis ne bouge pas", () => {
    const actuel = droit({ depuis: "2026-09-20", jusqu_au: "2026-10-20", source: "paiement" });
    expect(nouvelleEcheance(actuel, jour, 1)).toEqual({ depuis: "2026-09-20", jusqu_au: "2026-11-20" });
  });

  it("le dernier jour d'un Pro compte encore comme en cours", () => {
    const actuel = droit({ depuis: "2026-09-12", jusqu_au: jour });
    expect(nouvelleEcheance(actuel, jour, 1)).toEqual({ depuis: "2026-09-12", jusqu_au: "2026-11-12" });
  });

  it("un Pro expiré repart du jour de l'achat", () => {
    const actuel = droit({ depuis: "2026-08-01", jusqu_au: "2026-09-01" });
    expect(nouvelleEcheance(actuel, jour, 1)).toEqual({ depuis: jour, jusqu_au: "2026-11-12" });
  });

  it("un Pro accordé par l'admin avec une échéance se prolonge pareil", () => {
    const actuel = droit({ depuis: "2026-10-01", jusqu_au: "2026-12-31", source: "admin" });
    expect(nouvelleEcheance(actuel, jour, 12)).toEqual({ depuis: "2026-10-01", jusqu_au: "2027-12-31" });
  });

  it("un Pro en cours sans échéance : rien à prolonger", () => {
    expect(nouvelleEcheance(droit({ jusqu_au: null }), jour, 1)).toBeNull();
  });
});

describe("etatDepuisFedapay", () => {
  it("paie sur approved et transferred, et sur rien d'autre", () => {
    expect(etatDepuisFedapay("approved")).toBe("paye");
    expect(etatDepuisFedapay("transferred")).toBe("paye");
  });

  it("traduit les états qui n'aboutissent pas", () => {
    expect(etatDepuisFedapay("pending")).toBe("en_attente");
    expect(etatDepuisFedapay("declined")).toBe("echoue");
    expect(etatDepuisFedapay("canceled")).toBe("annule");
    expect(etatDepuisFedapay("expired")).toBe("expire");
  });

  it("un remboursement n'ouvre aucun droit", () => {
    expect(etatDepuisFedapay("refunded")).toBe("annule");
    expect(etatDepuisFedapay("approved_partially_refunded")).toBe("annule");
    expect(etatDepuisFedapay("transferred_partially_refunded")).toBe("annule");
  });

  it("un état inconnu ou absent attend, il n'accorde jamais", () => {
    expect(etatDepuisFedapay("quelque_chose_de_nouveau")).toBe("en_attente");
    expect(etatDepuisFedapay(null)).toBe("en_attente");
    expect(etatDepuisFedapay(undefined)).toBe("en_attente");
  });
});

describe("deciderReglement", () => {
  const id = "AbCdEfGhIjKlMnOpQrSt";
  const ligne = { statut: "en_attente" as const, montant: 1500 };
  const collecte = { statut: "approved", montant: 1500, reference: id };

  it("accorde quand la collecte est la nôtre, au bon montant, approuvée", () => {
    expect(deciderReglement(ligne, id, collecte)).toEqual({ anomalie: null, statut: "paye", accorder: true });
  });

  it("n'accorde pas deux fois : une ligne déjà payée le reste, sans octroi", () => {
    expect(deciderReglement({ ...ligne, statut: "paye" }, id, collecte))
      .toEqual({ anomalie: null, statut: "paye", accorder: false });
  });

  it("signale un montant qui n'est pas celui demandé", () => {
    expect(deciderReglement(ligne, id, { ...collecte, montant: 100 })).toEqual({ anomalie: "montant" });
  });

  it("signale une collecte qui n'est pas celle de la ligne", () => {
    expect(deciderReglement(ligne, id, { ...collecte, reference: "ZZZZZZZZZZZZZZZZZZZZ" })).toEqual({ anomalie: "reference" });
    expect(deciderReglement(ligne, id, { ...collecte, reference: null })).toEqual({ anomalie: "reference" });
  });

  it("suit un refus sans accorder", () => {
    expect(deciderReglement(ligne, id, { ...collecte, statut: "declined" }))
      .toEqual({ anomalie: null, statut: "echoue", accorder: false });
  });

  it("une approbation tardive s'applique après un refus ou une expiration de notre côté", () => {
    expect(deciderReglement({ ...ligne, statut: "echoue" }, id, collecte))
      .toEqual({ anomalie: null, statut: "paye", accorder: true });
    expect(deciderReglement({ ...ligne, statut: "expire" }, id, collecte))
      .toEqual({ anomalie: null, statut: "paye", accorder: true });
  });
});

describe("idPaiementDuRetour", () => {
  const id = "AbCdEfGhIjKlMnOpQrSt";

  it("lit l'identifiant seul", () => {
    expect(idPaiementDuRetour(id)).toBe(id);
  });

  it("le retrouve quand FedaPay a collé ses propres paramètres derrière", () => {
    expect(idPaiementDuRetour(`${id}?id=258&status=approved`)).toBe(id);
    expect(idPaiementDuRetour(`${id}&id=258`)).toBe(id);
  });

  it("refuse ce qui n'est pas un identifiant", () => {
    expect(idPaiementDuRetour(`${id}X`)).toBeNull();
    expect(idPaiementDuRetour("court")).toBeNull();
    expect(idPaiementDuRetour("../../admin/offre?x=1234567")).toBeNull();
    expect(idPaiementDuRetour("")).toBeNull();
    expect(idPaiementDuRetour(null)).toBeNull();
  });
});

describe("joursDeRappel", () => {
  it("demain et dans sept jours", () => {
    expect(joursDeRappel("2026-10-30")).toEqual({ demain: "2026-10-31", dansSeptJours: "2026-11-06" });
  });
});

describe("trierLignesOuvertes", () => {
  const maintenant = Date.parse("2026-10-12T06:00:00Z");
  const heures = (h: number) => maintenant - h * 3_600_000;

  it("sépare les lignes de moins de 48 h des plus vieilles", () => {
    const lignes = [
      { id: "a", environnement: "live" as const, creeMs: heures(1) },
      { id: "b", environnement: "live" as const, creeMs: heures(47) },
      { id: "c", environnement: "live" as const, creeMs: heures(49) },
    ];
    const { recentes, perimees } = trierLignesOuvertes(lignes, "live", maintenant);
    expect(recentes.map((l) => l.id)).toEqual(["a", "b"]);
    expect(perimees.map((l) => l.id)).toEqual(["c"]);
  });

  it("ignore les lignes d'un autre environnement : la production ne touche pas au bac à sable", () => {
    const lignes = [
      { id: "essai", environnement: "sandbox" as const, creeMs: heures(1) },
      { id: "vieux", environnement: "sandbox" as const, creeMs: heures(100) },
    ];
    expect(trierLignesOuvertes(lignes, "live", maintenant)).toEqual({ recentes: [], perimees: [] });
  });
});

describe("motifAchat", () => {
  it("dit la durée, et le bac à sable quand c'en est un", () => {
    expect(motifAchat("pro", 1, "live")).toBe("Achat KoppaFoot+ 1 mois");
    expect(motifAchat("pro", 12, "sandbox")).toBe("Achat KoppaFoot+ 12 mois (bac à sable)");
    expect(motifAchat("sans_pub", 1, "live")).toBe("Achat Pas de pubs 1 mois");
  });
});

describe("libelleFormule", () => {
  it("dit l'offre et la durée, comme on les lit chez FedaPay et sur le reçu", () => {
    expect(libelleFormule("pro_mois")).toBe("KoppaFoot+, 1 mois");
    expect(libelleFormule("pro_an")).toBe("KoppaFoot+, 1 an");
    expect(libelleFormule("sans_pub_mois")).toBe("Pas de pubs, 1 mois");
    expect(libelleFormule("sans_pub_an")).toBe("Pas de pubs, 1 an");
    expect(NOM_OFFRE).toEqual({ pro: "KoppaFoot+", sans_pub: "Pas de pubs" });
  });
});

// `require`, comme les autres suites qui lisent firestore.rules : la
// vérification de types de l'application mobile n'a pas ceux de Node.
declare const __dirname: string;
const { readFileSync } = require("fs") as { readFileSync: (chemin: string, encodage: "utf8") => string };
const { join } = require("path") as { join: (...morceaux: string[]) => string };

describe("firestore.rules", () => {
  it("ferme la collection paiements aux navigateurs", () => {
    const regles = readFileSync(join(__dirname, "../../../firestore.rules"), "utf8");
    const bloc = /match \/paiements\/\{paiementId\} \{([^}]*)\}/.exec(regles)?.[1];
    expect(bloc).toBeDefined();
    expect(bloc).toContain("allow read, write: if false;");
    expect((bloc ?? "").match(/allow /g)).toHaveLength(1);
  });

  it.each(["reglements", "dus", "depots", "comptes_versement", "essais_ticket"])(
    "ferme la collection %s aux navigateurs",
    (collection) => {
      const regles = readFileSync(join(__dirname, "../../../firestore.rules"), "utf8");
      const bloc = new RegExp(`match /${collection}/\\{[a-zA-Z]+\\} \\{([^}]*)\\}`).exec(regles)?.[1];
      expect(bloc).toBeDefined();
      expect(bloc).toContain("allow read, write: if false;");
      expect((bloc ?? "").match(/allow /g)).toHaveLength(1);
    },
  );

  // Le statut d'une réservation et l'auteur de son annulation décident à qui
  // revient un acompte payé (lib/reglement, planReglement). Tant que ses deux
  // parties pouvaient les écrire depuis leur navigateur, l'une comme l'autre
  // pouvait dire que c'était l'autre qui avait annulé.
  it("ne laisse aucune des deux parties écrire une réservation depuis son navigateur", () => {
    // Sous Windows, git rend le fichier en fins de ligne CRLF : on lit en LF,
    // sinon la fin du bloc (« } » seul sur sa ligne) ne se reconnaît pas.
    const regles = readFileSync(join(__dirname, "../../../firestore.rules"), "utf8").replace(/\r\n/g, "\n");
    const bloc = /match \/bookings\/\{bookingId\} \{([\s\S]*?)\n    \}\n/.exec(regles)?.[1] ?? "";
    // Les commentaires racontent l'ancienne règle : on ne lit que les règles.
    const code = bloc.split("\n").filter((ligne) => !ligne.trim().startsWith("//")).join("\n");

    expect(code).toContain("allow read:");
    expect(code).toMatch(/allow create: if false;/);
    expect(code).toMatch(/allow update, delete: if isSuperAdmin\(\);/);
    expect(code.match(/allow /g)).toHaveLength(3);
  });
});
