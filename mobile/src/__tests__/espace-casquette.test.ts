import {
  amicauxACouvrir, competitionsSansDoublon, confiePar, conflitDe, demandeur, matchsConfiesATenir, matchsDuJour,
  reservationsATraiter, sectionsDeLEspace,
} from "~/lib/espace-casquette";
import type { Booking, CompMatch, Competition, Match } from "@/types";

const amical = (id: string, p: Partial<Match> = {}): Match =>
  ({ id, status: "upcoming", date: "2026-10-27", time: "16:00", moderatorIds: [], ...p } as unknown as Match);

describe("matchsConfiesATenir", () => {
  it("garde les matchs qui ont encore une console à tenir, par date et heure", () => {
    const ids = matchsConfiesATenir([
      amical("fini", { status: "completed" }),
      amical("demain", { date: "2026-10-28", time: "09:00" }),
      amical("annule", { status: "cancelled" }),
      amical("matin", { time: "10:00" }),
      amical("live", { status: "live", time: "15:00" }),
    ]).map((m) => m.id);
    expect(ids).toEqual(["matin", "live", "demain"]);
  });
});

describe("confiePar", () => {
  it("dit pour quel arbitre on tient la console quand c'est lui qui l'a confiée", () => {
    const m = amical("a", {
      refereeName: "Koffi",
      equipeArbitrale: { scoreur: { uid: "moi" }, corpsNom: "Les Sifflets" },
    } as unknown as Partial<Match>);
    expect(confiePar(m, "moi")).toBe("Scoreur de Koffi · « Les Sifflets »");
    expect(confiePar(m, "autre")).toBeNull();
    expect(confiePar(amical("b"), "moi")).toBeNull();
  });
});

describe("amicauxACouvrir", () => {
  it("garde les amicaux que personne ne couvre, le plus proche d'abord", () => {
    const ids = amicauxACouvrir([
      amical("tard", { date: "2026-10-29" }),
      amical("couvert", { moderatorIds: ["u1"] }),
      amical("tot", { time: "09:00" }),
    ]).map((m) => m.id);
    expect(ids).toEqual(["tot", "tard"]);
  });
});

const comp = (id: string, p: Partial<Competition> = {}): Competition =>
  ({ id, name: id, isSandbox: false, ...p } as unknown as Competition);

describe("competitionsSansDoublon", () => {
  it("garde chaque compétition une fois, dans l'ordre des listes, sans les bacs à sable", () => {
    const ids = competitionsSansDoublon([
      [comp("a"), comp("bac", { isSandbox: true })],
      [comp("b"), comp("a")],
    ]).map((c) => c.id);
    expect(ids).toEqual(["a", "b"]);
  });
});

const cm = (id: string, p: Partial<CompMatch> = {}): CompMatch =>
  ({ id, status: "scheduled", date: "2026-10-27", time: "16:00", ...p } as unknown as CompMatch);

describe("matchsDuJour", () => {
  it("donne les matchs du jour par heure, terminés compris, sans les annulés ; sans heure à la fin", () => {
    const ids = matchsDuJour([
      cm("soir", { time: "18:00" }),
      cm("hier", { date: "2026-10-26" }),
      cm("matin", { time: "09:00", status: "completed" }),
      cm("annule", { status: "cancelled" }),
      cm("sans-heure", { time: null }),
    ], "2026-10-27").map((m) => m.id);
    expect(ids).toEqual(["matin", "soir", "sans-heure"]);
  });
});

const resa = (id: string, p: Partial<Booking> = {}): Booking =>
  ({
    id, status: "pending", date: "2026-10-27", time: "18:00", createdAt: "2026-10-20T10:00:00.000Z",
    userName: "Kossi", teamName: null, ...p,
  } as unknown as Booking);

describe("reservationsATraiter", () => {
  it("à répondre : les demandes pour aujourd'hui ou plus tard, la plus ancienne d'abord", () => {
    const { aRepondre } = reservationsATraiter([
      resa("recente", { createdAt: "2026-10-26T10:00:00.000Z", date: "2026-10-30" }),
      resa("passee", { date: "2026-10-25" }),
      resa("ancienne", { createdAt: "2026-10-18T10:00:00.000Z" }),
      resa("confirmee", { status: "confirmed" }),
    ], "2026-10-27");
    expect(aRepondre.map((b) => b.id)).toEqual(["ancienne", "recente"]);
  });

  it("du jour : les réservations confirmées d'aujourd'hui, par heure", () => {
    const { duJour } = reservationsATraiter([
      resa("soir", { status: "confirmed", time: "20:00" }),
      resa("demain", { status: "confirmed", date: "2026-10-28" }),
      resa("matin", { status: "confirmed", time: "08:00" }),
      resa("attente", { status: "pending" }),
      resa("annulee", { status: "cancelled" }),
      resa("bloque", { status: "confirmed", kind: "blocage", time: "12:00" }),
    ], "2026-10-27");
    expect(duJour.map((b) => b.id)).toEqual(["matin", "soir"]);
  });
});

describe("conflitDe", () => {
  const demande = resa("d", { venueId: "v1", time: "18:00", duration: 1 });

  it("trouve le créneau déjà pris que la demande recouvre, sur le même terrain", () => {
    const pris = resa("p", { status: "confirmed", venueId: "v1", time: "18:30", duration: 1 });
    expect(conflitDe(demande, [pris, demande], {})?.id).toBe("p");
  });

  it("compte un créneau bloqué, mais pas un autre terrain ni une autre demande en attente", () => {
    const bloque = resa("b", { status: "confirmed", kind: "blocage", venueId: "v1", time: "17:30", duration: 1 });
    expect(conflitDe(demande, [bloque], {})?.id).toBe("b");
    expect(conflitDe(demande, [resa("x", { status: "confirmed", venueId: "v2" })], {})).toBeNull();
    expect(conflitDe(demande, [resa("y", { venueId: "v1" })], {})).toBeNull();
  });

  it("tient compte du battement du terrain entre deux créneaux", () => {
    const apres = resa("a", { status: "confirmed", venueId: "v1", time: "19:10", duration: 1 });
    expect(conflitDe(demande, [apres], {})).toBeNull();
    expect(conflitDe(demande, [apres], { v1: 15 })?.id).toBe("a");
  });
});

describe("demandeur", () => {
  it("nomme l'équipe quand la demande en porte une, sinon le compte", () => {
    expect(demandeur(resa("a", { teamName: "FC Koppa" }))).toBe("FC Koppa");
    expect(demandeur(resa("b"))).toBe("Kossi");
  });
});

describe("sectionsDeLEspace", () => {
  const rien = { scoreur: false, organisateur: false, proprietaire: false, aTenir: 0, competitions: 0 };

  it("sans casquette ni rien à tenir : la présentation des casquettes seulement", () => {
    expect(sectionsDeLEspace(rien)).toEqual({ aTenir: false, competitions: false, terrains: false, sansCasquette: true });
  });

  it("montre les matchs à tenir dès qu'il y en a, et toujours à un scoreur", () => {
    expect(sectionsDeLEspace({ ...rien, aTenir: 2 }).aTenir).toBe(true);
    expect(sectionsDeLEspace({ ...rien, scoreur: true })).toEqual({
      aTenir: true, competitions: false, terrains: false, sansCasquette: false,
    });
  });

  it("montre les compétitions à un organisateur, même sans compétition, et à qui en modère une", () => {
    expect(sectionsDeLEspace({ ...rien, organisateur: true }).competitions).toBe(true);
    expect(sectionsDeLEspace({ ...rien, competitions: 1 }).competitions).toBe(true);
  });

  it("montre les terrains au propriétaire seulement", () => {
    expect(sectionsDeLEspace({ ...rien, proprietaire: true })).toEqual({
      aTenir: false, competitions: false, terrains: true, sansCasquette: false,
    });
  });
});
