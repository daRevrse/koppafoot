import { TYPES_ECRITS_PAR_LE_CLIENT } from "@/lib/notification-client";
import { categorieDuType, lienInterne, pushAutorise } from "@/lib/push-categories";
import { annonceDuRetrait, planDuRetrait, DETAIL_SECOND_JAUNE, type Evenement } from "@/lib/retrait-evenement";

// Les modules vivent côté site (src/lib) ; ils sont purs, et c'est ici que la
// suite de tests des modules partagés tourne.

// Jest tourne sous Node, mais l'application ne déclare pas les types de Node :
// les deux fonctions dont ce fichier a besoin, pour relire firestore.rules.
declare const require: (module: string) => unknown;
declare const __dirname: string;
const { readFileSync } = require("fs") as { readFileSync: (chemin: string, encodage: "utf8") => string };
const { join } = require("path") as { join: (...morceaux: string[]) => string };

describe("lienInterne", () => {
  it("garde un chemin du produit", () => {
    expect(lienInterne("/matches/abc")).toBe("/matches/abc");
    expect(lienInterne("/")).toBe("/");
  });

  it("remplace tout ce qui sortirait du produit par la cloche", () => {
    expect(lienInterne("https://evil.example/login")).toBe("/notifications");
    expect(lienInterne("//evil.example")).toBe("/notifications");
    expect(lienInterne("/\\evil.example")).toBe("/notifications");
    expect(lienInterne("javascript:alert(1)")).toBe("/notifications");
    expect(lienInterne(undefined)).toBe("/notifications");
    expect(lienInterne(42)).toBe("/notifications");
  });
});

describe("pushAutorise", () => {
  it("laisse passer ce qui n'a pas été décoché", () => {
    expect(pushAutorise(undefined, "competitions")).toBe(true);
    expect(pushAutorise({ perso: false }, "competitions")).toBe(true);
    expect(pushAutorise({}, undefined)).toBe(true);
  });

  it("coupe une catégorie décochée", () => {
    expect(pushAutorise({ competitions: false }, "competitions")).toBe(false);
  });
});

describe("les notifications écrites par le navigateur", () => {
  it("sont toutes des notifications personnelles", () => {
    for (const t of TYPES_ECRITS_PAR_LE_CLIENT) expect(categorieDuType(t)).toBe("perso");
  });

  it("sont exactement les types que les règles Firestore acceptent", () => {
    const regles = readFileSync(join(__dirname, "../../../firestore.rules"), "utf8");
    const bloc = regles.slice(regles.indexOf("match /notifications/{notificationId}"));
    const liste = bloc.slice(bloc.indexOf("type in ["), bloc.indexOf("]", bloc.indexOf("type in [")));
    const types = [...liste.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(types).toEqual([...TYPES_ECRITS_PAR_LE_CLIENT].sort());
  });
});

describe("annonceDuRetrait", () => {
  const match = {
    homeTeamId: "h",
    homeTeamName: "Avenir",
    awayTeamName: "Espoir",
    score: { home: 2, away: 1 },
  };
  const contexte = { homeTeamId: "h", surLeTerrain: { home: ["k", "d"], away: ["s"] } };
  const ev = (e: Partial<Evenement> & { id: string; type: Evenement["type"] }) =>
    ({ period: 1, minute: 10, teamId: "h", playerId: "k", playerName: "Kossi", ...e }) as Evenement;

  it("dément un but retiré, avec le score corrigé", () => {
    const events = [ev({ id: "b1", type: "goal" })];
    const r = planDuRetrait(events, "b1", contexte);
    if (!r.ok) throw new Error(r.raison);
    expect(annonceDuRetrait(r.plan, events, match)).toEqual({
      title: "↩️ But annulé",
      body: "Le but de Kossi ne compte pas. Avenir 1 – 1 Espoir",
    });
  });

  it("ne redit rien d'un but déjà refusé par la VAR", () => {
    const events = [ev({ id: "b1", type: "goal", varStatus: "cancelled" })];
    const r = planDuRetrait(events, "b1", contexte);
    if (!r.ok) throw new Error(r.raison);
    expect(annonceDuRetrait(r.plan, events, match)).toBeNull();
  });

  it("dément une exclusion, y compris celle d'un second jaune retiré", () => {
    const events = [
      ev({ id: "j1", type: "yellow_card" }),
      ev({ id: "j2", type: "yellow_card" }),
      ev({ id: "r1", type: "red_card", detail: DETAIL_SECOND_JAUNE }),
    ];
    const r = planDuRetrait(events, "j2", { ...contexte, surLeTerrain: { home: ["d"], away: ["s"] } });
    if (!r.ok) throw new Error(r.raison);
    expect(annonceDuRetrait(r.plan, events, match)).toEqual({
      title: "↩️ Exclusion annulée",
      body: "Kossi n'est pas exclu.",
    });
  });

  it("se tait pour un simple jaune, qui n'a pas sonné", () => {
    const events = [ev({ id: "j1", type: "yellow_card" })];
    const r = planDuRetrait(events, "j1", contexte);
    if (!r.ok) throw new Error(r.raison);
    expect(annonceDuRetrait(r.plan, events, match)).toBeNull();
  });
});
