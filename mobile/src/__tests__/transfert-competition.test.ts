import { apresTransfert, refusDeTransfert } from "@/lib/transfert-competition";

// Le module vit côté site (src/lib/transfert-competition) ; il est pur, et
// c'est ici que la suite de tests des modules partagés tourne.

describe("apresTransfert", () => {
  it("le modérateur devient propriétaire, l'ancien reste modérateur", () => {
    expect(
      apresTransfert({ organizer_ids: ["ancien"], moderator_ids: ["nouveau", "autre"] }, "nouveau"),
    ).toEqual({
      organizer_ids: ["nouveau"],
      moderator_ids: ["autre", "ancien"],
      created_by: "nouveau",
    });
  });

  it("n'écrit pas deux fois le même compte", () => {
    expect(
      apresTransfert({ organizer_ids: ["ancien"], moderator_ids: ["nouveau", "ancien"] }, "nouveau")
        .moderator_ids,
    ).toEqual(["ancien"]);
  });

  it("lit une compétition sans liste de modérateurs", () => {
    expect(apresTransfert({ organizer_ids: ["ancien"] }, "nouveau").moderator_ids).toEqual(["ancien"]);
  });
});

describe("refusDeTransfert", () => {
  const competition = {
    organizer_ids: ["ancien"],
    moderator_ids: ["nouveau"],
    transfert: { vers_uid: "nouveau", par_uid: "ancien", le: "2026-10-16T10:00:00.000Z" },
  };

  it("laisse passer le modérateur à qui on l'a proposé", () => {
    expect(refusDeTransfert(competition, "nouveau")).toBeNull();
  });

  it("refuse quand rien n'est proposé", () => {
    expect(refusDeTransfert({ ...competition, transfert: null }, "nouveau")).toMatch(/Aucun transfert/);
  });

  it("refuse à quelqu'un d'autre que le destinataire", () => {
    expect(refusDeTransfert(competition, "autre")).toMatch(/pas à toi/);
  });

  it("refuse un destinataire retiré du staff entre-temps", () => {
    expect(refusDeTransfert({ ...competition, moderator_ids: [] }, "nouveau")).toMatch(/plus modérateur/);
  });

  it("refuse un destinataire déjà propriétaire", () => {
    expect(
      refusDeTransfert({ ...competition, organizer_ids: ["ancien", "nouveau"] }, "nouveau"),
    ).toMatch(/déjà/);
  });
});
