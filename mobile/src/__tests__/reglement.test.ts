import {
  ALPHABET_CODE, acompteDe, battementLu, codeSaisi, debutDuCreneau, echeanceAcompte, etatDuReglement,
  fenetreDeValidation, fraisDePaiement, nouveauCode, numeroTogolais, planReglement, prixDuCreneau,
  type EntreePlan,
} from "@/lib/reglement";

// Le module vit côté site (src/lib/reglement) ; il est pur, et c'est ici que
// la suite de tests des modules partagés tourne.

const H = 3_600_000;

describe("prixDuCreneau", () => {
  it("multiplie le tarif horaire par la durée", () => {
    expect(prixDuCreneau(10_000, 1)).toBe(10_000);
    expect(prixDuCreneau(5_000, 1.5)).toBe(7_500);
  });

  it("vaut 0 sans tarif ou sans durée lisibles", () => {
    expect(prixDuCreneau(0, 1)).toBe(0);
    expect(prixDuCreneau(-5, 1)).toBe(0);
    expect(prixDuCreneau("10000", 1)).toBe(0);
    expect(prixDuCreneau(10_000, 0)).toBe(0);
    expect(prixDuCreneau(undefined, undefined)).toBe(0);
  });
});

describe("acompteDe", () => {
  it("prend 5 % du prix", () => {
    expect(acompteDe(10_000)).toBe(500);
    expect(acompteDe(25_000)).toBe(1_250);
  });

  it("arrondit aux 50 FCFA supérieurs", () => {
    expect(acompteDe(7_500)).toBe(400);
    expect(acompteDe(3_100)).toBe(200);
  });

  it("ne descend pas sous 100, le plancher de FedaPay", () => {
    expect(acompteDe(1_500)).toBe(100);
    expect(acompteDe(200)).toBe(100);
  });

  it("vaut 0 quand il n'y a pas de prix : pas de règlement", () => {
    expect(acompteDe(0)).toBe(0);
    expect(acompteDe(-100)).toBe(0);
    expect(acompteDe(Number.NaN)).toBe(0);
  });
});

describe("fraisDePaiement", () => {
  it("applique le taux et arrondit à l'entier supérieur", () => {
    expect(fraisDePaiement(500, 4)).toBe(20);
    expect(fraisDePaiement(400, 4)).toBe(16);
    expect(fraisDePaiement(150, 3.5)).toBe(6);
  });

  it("vaut 0 sans taux réglé ou avec un taux absurde", () => {
    expect(fraisDePaiement(500, 0)).toBe(0);
    expect(fraisDePaiement(500, null)).toBe(0);
    expect(fraisDePaiement(500, -2)).toBe(0);
    expect(fraisDePaiement(500, "4")).toBe(0);
    expect(fraisDePaiement(500, 50)).toBe(0);
  });
});

describe("le temps d'un créneau", () => {
  const debut = Date.parse("2026-10-17T18:00:00Z");

  it("lit le début à l'heure de Lomé, qui est UTC", () => {
    expect(debutDuCreneau("2026-10-17", "18:00")).toBe(debut);
    expect(Number.isNaN(debutDuCreneau("pas une date", "18:00"))).toBe(true);
  });

  it("l'acompte se paie dans les 24 h", () => {
    expect(echeanceAcompte(debut - 72 * H, debut)).toBe(debut - 48 * H);
  });

  it("et au plus tard au début du créneau", () => {
    expect(echeanceAcompte(debut - 3 * H, debut)).toBe(debut);
  });

  it("le ticket se valide d'une heure avant le début à la fin du créneau", () => {
    expect(fenetreDeValidation({ date: "2026-10-17", time: "18:00", duration: 1.5 }, 0))
      .toEqual({ ouvre: debut - H, ferme: debut + 1.5 * H });
  });

  it("le battement prolonge la fenêtre", () => {
    expect(fenetreDeValidation({ date: "2026-10-17", time: "18:00", duration: 1 }, 15).ferme).toBe(debut + H + 15 * 60_000);
  });
});

describe("battementLu", () => {
  it("garde 0, 15 et 30, et ramène le reste à 0", () => {
    expect(battementLu(15)).toBe(15);
    expect(battementLu(30)).toBe(30);
    expect(battementLu(0)).toBe(0);
    expect(battementLu(20)).toBe(0);
    expect(battementLu("15")).toBe(0);
    expect(battementLu(undefined)).toBe(0);
  });
});

describe("le code du ticket", () => {
  it("fait six caractères de l'alphabet sans caractères ambigus", () => {
    const code = nouveauCode();
    expect(code).toHaveLength(6);
    expect([...code].every((ch) => ALPHABET_CODE.includes(ch))).toBe(true);
    expect(ALPHABET_CODE).not.toMatch(/[01OIL]/);
  });

  it("suit le hasard qu'on lui donne", () => {
    expect(nouveauCode(() => 0)).toBe("AAAAAA");
    expect(nouveauCode(() => 0.999999)).toBe("999999");
  });

  it("accepte une saisie en minuscules, avec des espaces ou des tirets", () => {
    expect(codeSaisi("k7m-2qz")).toBe("K7M2QZ");
    expect(codeSaisi("  K7M 2QZ ")).toBe("K7M2QZ");
  });

  it("refuse ce qui n'est pas un code", () => {
    expect(codeSaisi("K7M2Q")).toBeNull();
    expect(codeSaisi("K7M2QZZ")).toBeNull();
    expect(codeSaisi("K7M2Q0")).toBeNull();
    expect(codeSaisi("../../x")).toBeNull();
    expect(codeSaisi(null)).toBeNull();
    expect(codeSaisi(123456)).toBeNull();
  });
});

describe("numeroTogolais", () => {
  it("garde huit chiffres commençant par 7 ou 9", () => {
    expect(numeroTogolais("90 12 34 56")).toBe("90123456");
    expect(numeroTogolais("+228 70 12 34 56")).toBe("70123456");
    expect(numeroTogolais("0022899123456")).toBe("99123456");
  });

  it("refuse le reste", () => {
    expect(numeroTogolais("22123456")).toBeNull();
    expect(numeroTogolais("9012345")).toBeNull();
    expect(numeroTogolais("0164000001")).toBeNull();
    expect(numeroTogolais("")).toBeNull();
    expect(numeroTogolais(null)).toBeNull();
  });
});

describe("etatDuReglement", () => {
  it("suit l'acompte, puis la clôture", () => {
    expect(etatDuReglement({ paye_le: null, cloture: null })).toBe("acompte_attendu");
    expect(etatDuReglement({ paye_le: "x", cloture: null })).toBe("acompte_paye");
    expect(etatDuReglement({ paye_le: "x", cloture: "joue" })).toBe("joue");
    expect(etatDuReglement({ paye_le: null, cloture: "libere" })).toBe("libere");
  });
});

describe("planReglement", () => {
  const maintenant = Date.parse("2026-10-15T10:00:00Z");
  const reservation = { status: "confirmed" as const, kind: "demande", owner_id: "gerant", user_id: "equipe", cancelled_by: null };
  const ouvert = { echeance: maintenant + 24 * H, fin_fenetre: maintenant + 60 * H, paye: false, valide: false, cloture: null };
  const plan = (e: Partial<EntreePlan>) => planReglement({ reservation, reglement: null, payant: true, maintenant, ...e });

  it("ouvre un règlement quand une réservation est confirmée sur un terrain payant", () => {
    expect(plan({})).toEqual({ action: "ouvrir" });
  });

  it("n'ouvre rien tant que le propriétaire n'a pas dit oui", () => {
    expect(plan({ reservation: { ...reservation, status: "pending" } })).toEqual({ action: "rien" });
  });

  it("n'ouvre rien sur un terrain qui n'a pas activé le paiement", () => {
    expect(plan({ payant: false })).toEqual({ action: "rien" });
  });

  it("n'ouvre rien pour un créneau bloqué, ni quand le propriétaire joue chez lui", () => {
    expect(plan({ reservation: { ...reservation, kind: "blocage" } })).toEqual({ action: "rien" });
    expect(plan({ reservation: { ...reservation, user_id: "gerant" } })).toEqual({ action: "rien" });
  });

  it("attend l'acompte tant que l'échéance n'est pas passée", () => {
    expect(plan({ reglement: ouvert })).toEqual({ action: "rien" });
  });

  it("libère le créneau quand l'acompte n'est pas venu à temps", () => {
    expect(plan({ reglement: { ...ouvert, echeance: maintenant - 1 } }))
      .toEqual({ action: "clore", cloture: "libere", du: null, annulerReservation: true });
  });

  it("une fois payé, attend le match", () => {
    expect(plan({ reglement: { ...ouvert, paye: true, echeance: maintenant - 1 } })).toEqual({ action: "rien" });
  });

  it("clôt « joué » dès que le ticket est validé : l'acompte est dû au propriétaire", () => {
    expect(plan({ reglement: { ...ouvert, paye: true, valide: true } }))
      .toEqual({ action: "clore", cloture: "joue", du: "proprietaire", annulerReservation: false });
  });

  it("clôt « absent » quand la fenêtre passe sans validation : l'acompte est dû au propriétaire", () => {
    expect(plan({ reglement: { ...ouvert, paye: true, fin_fenetre: maintenant - 1 } }))
      .toEqual({ action: "clore", cloture: "absent", du: "proprietaire", annulerReservation: false });
  });

  it("l'équipe annule après avoir payé : l'acompte reste au propriétaire", () => {
    const annulee = { ...reservation, status: "cancelled" as const, cancelled_by: "demandeur" };
    expect(plan({ reservation: annulee, reglement: { ...ouvert, paye: true } }))
      .toEqual({ action: "clore", cloture: "annule_equipe", du: "proprietaire", annulerReservation: false });
  });

  it("le match est déplacé ou annulé (le système libère) : c'est l'équipe qui s'en va", () => {
    const liberee = { ...reservation, status: "cancelled" as const, cancelled_by: "systeme" };
    expect(plan({ reservation: liberee, reglement: { ...ouvert, paye: true } }))
      .toEqual({ action: "clore", cloture: "annule_equipe", du: "proprietaire", annulerReservation: false });
  });

  it("le propriétaire annule après le paiement : l'acompte est rendu à l'équipe", () => {
    const annulee = { ...reservation, status: "cancelled" as const, cancelled_by: "proprietaire" };
    expect(plan({ reservation: annulee, reglement: { ...ouvert, paye: true } }))
      .toEqual({ action: "clore", cloture: "annule_proprietaire", du: "equipe", annulerReservation: false });
  });

  it("une annulation avant tout paiement ne doit rien à personne", () => {
    const parLeGerant = { ...reservation, status: "cancelled" as const, cancelled_by: "proprietaire" };
    const parLEquipe = { ...reservation, status: "cancelled" as const, cancelled_by: "demandeur" };
    expect(plan({ reservation: parLeGerant, reglement: ouvert }))
      .toEqual({ action: "clore", cloture: "annule_proprietaire", du: null, annulerReservation: false });
    expect(plan({ reservation: parLEquipe, reglement: ouvert }))
      .toEqual({ action: "clore", cloture: "annule_equipe", du: null, annulerReservation: false });
  });

  it("une réservation disparue vaut une annulation par l'équipe", () => {
    expect(plan({ reservation: null, reglement: { ...ouvert, paye: true } }))
      .toEqual({ action: "clore", cloture: "annule_equipe", du: "proprietaire", annulerReservation: false });
  });

  it("un règlement clos ne se rouvre ni ne se reclôt", () => {
    expect(plan({ reglement: { ...ouvert, paye: true, valide: true, cloture: "joue" } })).toEqual({ action: "rien" });
    const annulee = { ...reservation, status: "cancelled" as const, cancelled_by: "proprietaire" };
    expect(plan({ reservation: annulee, reglement: { ...ouvert, paye: true, cloture: "joue" } })).toEqual({ action: "rien" });
  });
});
