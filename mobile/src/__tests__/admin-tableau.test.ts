import { ciblesDeCampagne, dansLeSegment, roleEffectifBrut } from "@/lib/admin-segments";
import { compterLesComptes, compterLesMatchs, dateLue, totalATraiter, A_TRAITER_VIDE } from "@/lib/admin-tableau";

// Les modules vivent côté site (src/lib/admin-*) ; ils sont purs, et c'est ici
// que la suite de tests des modules partagés tourne.

const maintenant = new Date("2026-09-28T12:00:00Z");

describe("roleEffectifBrut", () => {
  it("lit le rôle activé avant le rôle déclaré", () => {
    expect(roleEffectifBrut({ user_type: "user", evolution_role: "manager" })).toBe("manager");
    expect(roleEffectifBrut({ user_type: "player", evolution_role: "referee" })).toBe("referee");
  });

  it("retombe sur le rôle déclaré d'un compte d'avant Évolution", () => {
    expect(roleEffectifBrut({ user_type: "player" })).toBe("player");
  });

  it("ne prend jamais une casquette pour un rôle", () => {
    expect(roleEffectifBrut({ user_type: "superadmin" })).toBeNull();
    expect(roleEffectifBrut({ user_type: "user", is_organizer: true })).toBeNull();
  });
});

describe("dansLeSegment", () => {
  it("trouve un joueur au drapeau Évolution, que user_type ne dit plus", () => {
    expect(dansLeSegment({ user_type: "user", evolution_role: "player" }, "joueurs")).toBe(true);
    expect(dansLeSegment({ user_type: "user", evolution_role: "player" }, "managers")).toBe(false);
  });

  it("trouve les casquettes par leur drapeau", () => {
    expect(dansLeSegment({ user_type: "user", is_venue_owner: true }, "proprietaires")).toBe(true);
    expect(dansLeSegment({ user_type: "user", is_scorer: true }, "scoreurs")).toBe(true);
    expect(dansLeSegment({ user_type: "user", is_organizer: true }, "organisateurs")).toBe(true);
  });

  it("n'écrit jamais à un compte suspendu", () => {
    expect(dansLeSegment({ user_type: "user", is_active: false }, "tous")).toBe(false);
    expect(dansLeSegment({ evolution_role: "player", is_active: false }, "joueurs")).toBe(false);
  });

  it("range sans rôle un compte qui ne voit que les scores", () => {
    expect(dansLeSegment({ user_type: "user" }, "sans_role")).toBe(true);
    expect(dansLeSegment({ user_type: "user", evolution_role: "player" }, "sans_role")).toBe(false);
  });
});

describe("dateLue", () => {
  it("lit un Timestamp, une chaîne et des secondes", () => {
    const d = new Date("2026-09-20T10:00:00Z");
    expect(dateLue({ toDate: () => d })?.toISOString()).toBe(d.toISOString());
    expect(dateLue("2026-09-20T10:00:00Z")?.toISOString()).toBe(d.toISOString());
    expect(dateLue({ _seconds: d.getTime() / 1000 })?.toISOString()).toBe(d.toISOString());
    expect(dateLue(null)).toBeNull();
    expect(dateLue("pas une date")).toBeNull();
  });
});

describe("compterLesComptes", () => {
  it("compte les rôles effectifs, pas user_type", () => {
    const c = compterLesComptes([
      { user_type: "user", evolution_role: "player" },
      { user_type: "user", evolution_role: "player" },
      { user_type: "user", evolution_role: "manager" },
      { user_type: "referee" },
      { user_type: "user" },
      { user_type: "user", is_superadmin: true },
    ], maintenant);
    expect(c.total).toBe(6);
    expect(c.joueurs).toBe(2);
    expect(c.managers).toBe(1);
    expect(c.arbitres).toBe(1);
    expect(c.sansRole).toBe(2);
    expect(c.rolesHerites).toBe(1);
    expect(c.admins).toBe(1);
  });

  it("compte l'administrateur d'avant la bascule", () => {
    expect(compterLesComptes([{ user_type: "superadmin" }], maintenant).admins).toBe(1);
  });

  it("compte les nouveaux sur sept et trente jours", () => {
    const c = compterLesComptes([
      { created_at: "2026-09-27T10:00:00Z" },
      { created_at: "2026-09-10T10:00:00Z" },
      { created_at: "2026-06-01T10:00:00Z" },
      {},
    ], maintenant);
    expect(c.nouveaux7j).toBe(1);
    expect(c.nouveaux30j).toBe(2);
  });

  it("compte les suspendus et les casquettes", () => {
    const c = compterLesComptes([
      { is_active: false, is_scorer: true },
      { is_organizer: true, is_venue_owner: true },
    ], maintenant);
    expect(c.suspendus).toBe(1);
    expect(c.scoreurs).toBe(1);
    expect(c.organisateurs).toBe(1);
    expect(c.proprietaires).toBe(1);
  });
});

describe("compterLesMatchs", () => {
  it("ne compte comme joués que les matchs terminés, amicaux et compétitions ensemble", () => {
    const m = compterLesMatchs(
      [
        { status: "completed", date: "2026-09-27" },
        { status: "upcoming", date: "2026-10-04" },
        { status: "challenge", date: "2026-10-05" },
        { status: "cancelled", date: "2026-09-01" },
        { status: "live", date: "2026-09-28" },
      ],
      [
        { status: "completed", date: "2026-09-01" },
        { status: "scheduled", date: "2026-10-11" },
      ],
      maintenant,
    );
    expect(m.joues).toBe(2);
    expect(m.amicauxJoues).toBe(1);
    expect(m.competitionJoues).toBe(1);
    expect(m.aVenir).toBe(2);
    expect(m.enDirect).toBe(1);
    expect(m.joues7j).toBe(1);
  });
});

describe("totalATraiter", () => {
  it("additionne ce qui attend", () => {
    expect(totalATraiter(A_TRAITER_VIDE)).toBe(0);
    expect(totalATraiter({ ...A_TRAITER_VIDE, organisateurs: 1, retours: 2 })).toBe(3);
  });
});

describe("ciblesDeCampagne", () => {
  const comptes = [
    { uid: "m1", data: { user_type: "user", evolution_role: "manager", created_at: "2026-09-27T20:00:00Z" } },
    { uid: "m2", data: { user_type: "manager", created_at: "2026-01-01T00:00:00Z" } },
    { uid: "p1", data: { user_type: "user", evolution_role: "player" } },
    { uid: "p2", data: { user_type: "user", evolution_role: "player" } },
    { uid: "p3", data: { user_type: "user", evolution_role: "player" } },
    { uid: "u1", data: { user_type: "user" } },
    { uid: "u2", data: { user_type: "user", is_scorer: true } },
    { uid: "u3", data: { user_type: "user", is_active: false } },
  ];
  const equipes = [
    { manager_id: "m2", member_ids: ["p1"] },
    { manager_id: "m1", member_ids: ["p2"], is_ghost: true },
  ];

  it("vise les managers sans club, au rôle effectif", () => {
    expect(ciblesDeCampagne("manager_no_team", comptes, equipes, new Set(), maintenant)).toEqual(["m1"]);
  });

  it("vise les joueurs hors de tout effectif et sans candidature", () => {
    expect(ciblesDeCampagne("player_no_team", comptes, equipes, new Set(["p3"]), maintenant)).toEqual(["p2"]);
  });

  it("vise les managers inscrits depuis moins de 48 heures", () => {
    expect(ciblesDeCampagne("manager_welcome", comptes, equipes, new Set(), maintenant)).toEqual(["m1"]);
  });

  it("vise les comptes sans rôle ni casquette, actifs", () => {
    expect(ciblesDeCampagne("sans_espace", comptes, equipes, new Set(), maintenant)).toEqual(["u1"]);
  });
});
