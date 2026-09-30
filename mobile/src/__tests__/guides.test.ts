import {
  organizerOnboarding, playerOnboarding, profilsDuCompte, scorerOnboarding, spectatorOnboarding,
  venueOwnerOnboarding, managerOnboarding, refereeOnboarding,
} from "@/lib/onboarding";
import { TUTORIELS, tutoriel } from "@/lib/tutoriels";
import type { Competition, UserProfile, Venue } from "@/types";

// Même convention que notifications.test : l'appli n'embarque pas les types de Node.
declare const __dirname: string;
const { existsSync } = require("fs") as { existsSync: (chemin: string) => boolean };
const { join } = require("path") as { join: (...morceaux: string[]) => string };

// Les modules vivent côté site (src/lib) ; ils sont purs, et c'est ici que la
// suite de tests des modules partagés tourne.

const compte = (extra: Partial<UserProfile> = {}): UserProfile => ({
  uid: "u1", email: "a@b.c", phone: null, firstName: "Afi", lastName: "Lawson", userType: "user",
  locationCity: "Lomé", bio: null, profilePictureUrl: null, coverPhotoUrl: null, companyName: null,
  isActive: true, emailVerified: true, authProviders: ["email"], createdAt: "", updatedAt: "",
  ...extra,
} as UserProfile);

describe("les profils d'un compte", () => {
  it("guide un nouveau compte en spectateur", () => {
    expect(profilsDuCompte(compte())).toEqual(["spectator"]);
  });

  it("met le rôle d'abord, puis les casquettes, et plus de spectateur", () => {
    expect(profilsDuCompte(compte({ evolutionRole: "referee", isOrganizer: true, isScorer: true })))
      .toEqual(["referee", "organizer", "scorer"]);
    expect(profilsDuCompte(compte({ isVenueOwner: true }))).toEqual(["venue_owner"]);
  });
});

describe("le guide du spectateur", () => {
  it("compte trois gestes et montre la porte des rôles sans en faire une étape", () => {
    const g = spectatorOnboarding(compte(), { installe: false, notifications: false });
    expect(g.steps.map((s) => s.key)).toEqual(["follow", "install", "notifications"]);
    expect(g.suggestion?.href).toBe("/roles#choisir");
    expect(g.complete).toBe(false);
  });

  it("se termine quand il suit, a installé et reçoit", () => {
    const g = spectatorOnboarding(
      compte({ followedCompetitionIds: ["c1"] }),
      { installe: true, notifications: true },
    );
    expect(g.complete).toBe(true);
  });

  it("parle anglais", () => {
    const g = spectatorOnboarding(compte(), { installe: false, notifications: false }, "en");
    expect(g.steps[0].label).toBe("Follow a competition");
  });
});

describe("le guide de l'organisateur", () => {
  const competition = { id: "c1", status: "draft" } as Competition;

  it("commence par créer la compétition, étape bloquante", () => {
    const g = organizerOnboarding(compte(), { competition: null, equipes: 0, matchsDates: 0, matchsJoues: 0 });
    expect(g.current?.key).toBe("create");
    expect(g.current?.blocking).toBe(true);
  });

  it("mène aux pages de SA compétition", () => {
    const g = organizerOnboarding(compte(), { competition, equipes: 1, matchsDates: 0, matchsJoues: 0 });
    expect(g.current?.key).toBe("teams");
    expect(g.current?.href).toBe("/organizer/competitions/c1/teams");
  });

  it("ne tient pas un brouillon pour publié", () => {
    const g = organizerOnboarding(compte(), { competition, equipes: 4, matchsDates: 6, matchsJoues: 0 });
    expect(g.current?.key).toBe("publish");
    const publiee = organizerOnboarding(compte(), {
      competition: { ...competition, status: "registration" } as Competition,
      equipes: 4, matchsDates: 6, matchsJoues: 1,
    });
    expect(publiee.complete).toBe(true);
  });

  it("s'accorde au genre", () => {
    const g = organizerOnboarding(compte({ gender: "female" }), { competition: null, equipes: 0, matchsDates: 0, matchsJoues: 0 });
    expect(g.titre).toBe("Organisatrice");
  });
});

describe("le guide du propriétaire de terrain", () => {
  it("compte la photo, les horaires et une demande traitée", () => {
    const terrain = { id: "v1", photoUrl: "x", openingHours: null, galleryUrls: [] } as unknown as Venue;
    const g = venueOwnerOnboarding(compte(), { terrains: [terrain], demandesTraitees: 0 });
    expect(g.steps.filter((s) => s.done).map((s) => s.key)).toEqual(["venue", "photo"]);
    expect(g.current?.key).toBe("hours");
  });
});

describe("chaque guide mène à un tutoriel qui existe", () => {
  const u = compte();
  const guides = [
    spectatorOnboarding(u, { installe: false, notifications: false }),
    playerOnboarding(u, { linkedCount: 0 }),
    managerOnboarding(u, { teams: [], compTeams: [], rosterCount: 0 }),
    refereeOnboarding(u, { designationCount: 0, corpsCount: 0 }),
    organizerOnboarding(u, { competition: null, equipes: 0, matchsDates: 0, matchsJoues: 0 }),
    venueOwnerOnboarding(u, { terrains: [], demandesTraitees: 0 }),
    scorerOnboarding(u, { corps: 0, matchs: 0 }),
  ];

  it.each(guides.map((g) => [g.profil, g.tutoriel]))("%s → %s", (_profil, slug) => {
    expect(tutoriel(slug)).not.toBeNull();
  });
});

describe("les tutoriels", () => {
  it("ont des slugs uniques et des liens internes", () => {
    const slugs = TUTORIELS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const t of TUTORIELS) {
      for (const e of [...t.etapes.fr, ...(t.etapes.en ?? [])]) {
        if (e.lien) expect(e.lien.href.startsWith("/")).toBe(true);
      }
      // Une fiche anglaise, quand il y en a une, a autant d'étapes que la française.
      if (t.etapes.en) expect(t.etapes.en.length).toBe(t.etapes.fr.length);
    }
  });

  it("proposent des PDF qui existent dans docs/ (copiés par scripts/tutoriels.mjs)", () => {
    for (const t of TUTORIELS.filter((x) => x.pdf)) {
      expect(t.pdf).toBe(`/tutoriels/${t.slug}.pdf`);
      const source = join(__dirname, "../../../docs", `tutoriel-${t.slug}`, `Tutoriel-${t.slug}-KoppaFoot.pdf`);
      expect(existsSync(source)).toBe(true);
    }
  });
});
