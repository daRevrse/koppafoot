import {
  estLigneDossard,
  idDossard,
  libelleDossard,
  lignesDeSecours,
  lireNumeros,
  renommerDansLeMatch,
} from "@/lib/dossards";

// Le module vit côté site (src/lib/dossards) ; il est pur, et c'est ici que
// la suite de tests des modules partagés tourne.

describe("libelleDossard", () => {
  it("écrit le numéro, quelle que soit la catégorie", () => {
    expect(libelleDossard(9)).toBe("N°9");
    expect(libelleDossard("14")).toBe("N°14");
  });
});

describe("lignesDeSecours", () => {
  it("tire les 25 dossards d'une équipe vide", () => {
    const lignes = lignesDeSecours("t1", []);
    expect(lignes).toHaveLength(25);
    expect(lignes[0]).toEqual({ id: "dos-t1-1", name: "N°1", number: "1" });
    expect(lignes[24].number).toBe("25");
    expect(lignes.every((l) => estLigneDossard(l.id))).toBe(true);
  });

  it("ne double pas un numéro déjà porté par un vrai joueur", () => {
    const lignes = lignesDeSecours("t1", [{ id: "abc", number: "7" }, { id: "def", number: " 10 " }]);
    expect(lignes.map((l) => l.number)).not.toContain("7");
    expect(lignes.map((l) => l.number)).not.toContain("10");
    expect(lignes).toHaveLength(23);
  });

  it("ni un dossard déjà tiré à un match précédent", () => {
    const lignes = lignesDeSecours("t1", [{ id: idDossard("t1", 3), number: "3" }]);
    expect(lignes.find((l) => l.id === "dos-t1-3")).toBeUndefined();
  });
});

describe("estLigneDossard", () => {
  it("reconnaît un dossard, pas une ligne saisie ni un compte", () => {
    expect(estLigneDossard("dos-t1-9")).toBe(true);
    expect(estLigneDossard("k3j9x0p2a")).toBe(false);
    expect(estLigneDossard("u_uid")).toBe(false);
    expect(estLigneDossard(null)).toBe(false);
  });
});

describe("lireNumeros", () => {
  it("relit des numéros de 1 à 25, sans doublon, dans l'ordre", () => {
    expect(lireNumeros([9, "3", 9])).toEqual([3, 9]);
  });

  it("refuse le reste", () => {
    expect(lireNumeros([])).toBeNull();
    expect(lireNumeros([0])).toBeNull();
    expect(lireNumeros([26])).toBeNull();
    expect(lireNumeros(["neuf"])).toBeNull();
    expect(lireNumeros("9")).toBeNull();
  });
});

describe("renommerDansLeMatch", () => {
  const ancien = "dos-t1-9";
  const nouveau = { id: "k3j9x0p2a", nom: "Kossi" };
  const match = {
    home_lineup: [
      { player_id: ancien, name: "N°9", number: "9", role: "starter" as const },
      { player_id: "dos-t1-14", name: "N°14", number: "14", role: "substitute" as const },
    ],
    away_lineup: [{ player_id: "dos-t2-9", name: "N°9", number: "9", role: "starter" as const }],
    home_on_pitch: ["dos-t1-14"],
    away_on_pitch: ["dos-t2-9"],
    mvp_player_id: ancien,
    live_state: {
      events: [
        { id: "e1", type: "goal", player_id: ancien, player_name: "N°9", assist_player_id: "dos-t1-14", assist_player_name: "N°14" },
        { id: "e2", type: "goal", player_id: "dos-t1-14", player_name: "N°14", assist_player_id: ancien, assist_player_name: "N°9" },
        { id: "e3", type: "substitution", player_id: "dos-t1-14", player_name: "N°14", out_player_id: ancien, out_player_name: "N°9", detail: "N°9 → N°14" },
        { id: "e4", type: "goal", player_id: "dos-t2-9", player_name: "N°9" },
      ],
      tirs_au_but: { tirs: [{ cote: "home", issue: "marque", playerId: ancien, playerName: "N°9" }] },
    },
  };

  const patch = renommerDansLeMatch(match, ancien, nouveau, "N°9")!;

  it("renomme la ligne sur sa feuille, sans toucher au n°9 d'en face", () => {
    const feuille = patch.home_lineup as { player_id: string; name: string }[];
    expect(feuille[0]).toMatchObject({ player_id: "k3j9x0p2a", name: "Kossi", number: "9" });
    expect(feuille[1].player_id).toBe("dos-t1-14");
    expect(patch.away_lineup).toBeUndefined();
  });

  it("suit le joueur dans chaque événement : buteur, passeur, sortant", () => {
    const events = patch["live_state.events"] as Record<string, unknown>[];
    expect(events[0]).toMatchObject({ player_id: "k3j9x0p2a", player_name: "Kossi", assist_player_id: "dos-t1-14" });
    expect(events[1]).toMatchObject({ assist_player_id: "k3j9x0p2a", assist_player_name: "Kossi" });
    expect(events[2]).toMatchObject({ out_player_id: "k3j9x0p2a", out_player_name: "Kossi", detail: "Kossi → N°14" });
    expect(events[3]).toMatchObject({ player_id: "dos-t2-9", player_name: "N°9" });
  });

  it("et dans la séance de tirs au but, et comme homme du match", () => {
    expect(patch["live_state.tirs_au_but.tirs"]).toEqual([
      { cote: "home", issue: "marque", playerId: "k3j9x0p2a", playerName: "Kossi" },
    ]);
    expect(patch).toMatchObject({ mvp_player_id: "k3j9x0p2a", mvp_player_name: "Kossi" });
  });

  it("ne réécrit pas la pelouse quand il n'y est pas", () => {
    expect(patch.home_on_pitch).toBeUndefined();
  });

  it("ne prend pas le n°14 pour le n°1 dans le texte d'un remplacement", () => {
    const p = renommerDansLeMatch(
      {
        live_state: {
          events: [{ id: "s", type: "substitution", player_id: "dos-t1-14", player_name: "N°14", out_player_id: "dos-t1-1", out_player_name: "N°1", detail: "N°1 → N°14" }],
        },
      },
      "dos-t1-1",
      nouveau,
      "N°1",
    )!;
    expect((p["live_state.events"] as Record<string, unknown>[])[0].detail).toBe("Kossi → N°14");
  });

  it("rend null pour un match où il n'a pas joué", () => {
    expect(renommerDansLeMatch({ home_lineup: [], live_state: { events: [] } }, ancien, nouveau, "N°9")).toBeNull();
  });
});
