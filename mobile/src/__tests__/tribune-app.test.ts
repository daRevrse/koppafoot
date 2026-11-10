import type { Post, UserProfile } from "@/types";
import {
  apresJaime, couleurDAvatar, etiquetteDuType, ilYA, initialesDAuteur, lienDeLaPublication, photoRefusee,
  publicationVisee, roleAffiche, signature, trierLeFil,
} from "~/lib/tribune";

// La Tribune de l'application : la même que le site (/feed). Ici ce qui ne
// touche ni l'écran ni la base : l'ordre du fil, le « j'aime » posé d'avance,
// la signature d'une publication, les mots du temps.

const post = (id: string, p: Partial<Post> = {}): Post => ({
  id, authorId: "a1", authorName: "Ama A.", authorRole: "Joueuse", authorAvatar: "",
  type: "text", content: "Bonjour", metadata: null, likes: [], commentCount: 0, isLiked: false,
  mediaUrls: [], pinned: false, link: null, createdAt: "2026-11-10T10:00:00.000Z", updatedAt: "2026-11-10T10:00:00.000Z",
  ...p,
});

const profil = (p: Partial<UserProfile> = {}): UserProfile =>
  ({ uid: "u1", firstName: "Sacha", lastName: "Sansrôle", gender: "female", profilePictureUrl: null, ...p }) as UserProfile;

describe("trierLeFil", () => {
  it("met les publications épinglées en tête, sans toucher à l'ordre des autres", () => {
    const fil = [post("a"), post("b", { pinned: true }), post("c"), post("d", { pinned: true })];
    expect(trierLeFil(fil).map((p) => p.id)).toEqual(["b", "d", "a", "c"]);
  });
});

describe("apresJaime", () => {
  it("pose le j'aime tout de suite, et le retire de même", () => {
    const fil = [post("a"), post("b", { likes: ["x"] })];
    const aime = apresJaime(fil, "b", "u1", false);
    expect(aime[1]).toMatchObject({ isLiked: true, likes: ["x", "u1"] });
    expect(aime[0]).toBe(fil[0]);
    const retire = apresJaime(aime, "b", "u1", true);
    expect(retire[1]).toMatchObject({ isLiked: false, likes: ["x"] });
  });
});

describe("signature", () => {
  it("signe du prénom et de l'initiale, avec le rôle accordé", () => {
    expect(signature(profil())).toEqual({ authorName: "Sacha S.", authorRole: "Joueuse", authorAvatar: "" });
    expect(signature(profil({ gender: "male" })).authorRole).toBe("Joueur");
    expect(signature(profil({ evolutionRole: "manager" })).authorRole).toBe("Manager");
    expect(signature(profil({ evolutionRole: "referee" })).authorRole).toBe("Arbitre");
  });

  it("tient debout sur un profil incomplet, et prend la photo du profil", () => {
    expect(signature(profil({ lastName: "", profilePictureUrl: "https://x/p.jpg" }))).toEqual({
      authorName: "Sacha", authorRole: "Joueuse", authorAvatar: "https://x/p.jpg",
    });
  });

  it("signe du nom de l'établissement pour un propriétaire de terrain", () => {
    expect(signature(profil({ isVenueOwner: true, companyName: "Stade du Port" })).authorName)
      .toBe("Stade du Port");
  });
});

describe("ilYA", () => {
  const maintenant = new Date("2026-11-10T12:00:00.000Z");
  const il = (minutes: number) => ilYA(new Date(maintenant.getTime() - minutes * 60_000).toISOString(), maintenant);

  it("parle comme le site", () => {
    expect(il(0)).toBe("À l'instant");
    expect(il(3)).toBe("Il y a 3min");
    expect(il(59)).toBe("Il y a 59min");
    expect(il(60)).toBe("Il y a 1h");
    expect(il(23 * 60)).toBe("Il y a 23h");
    expect(il(24 * 60)).toBe("Hier");
    expect(il(3 * 24 * 60)).toBe("Il y a 3j");
    expect(il(8 * 24 * 60)).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
  });

  it("ne dit rien d'une date illisible", () => {
    expect(ilYA("", maintenant)).toBe("");
    expect(ilYA("pas une date", maintenant)).toBe("");
  });
});

describe("ce que la carte affiche", () => {
  it("ne peint en pastille que les rôles, pas les casquettes d'avant", () => {
    expect(roleAffiche("Joueuse")).toBe("Joueuse");
    expect(roleAffiche("Manager")).toBe("Manager");
    expect(roleAffiche("Partenaire")).toBeNull();
    expect(roleAffiche("Organisateur")).toBeNull();
  });

  it("nomme le type d'une publication, rien pour un simple texte", () => {
    expect(etiquetteDuType("text")).toBeNull();
    expect(etiquetteDuType("match_result")).toBe("Résultat");
    expect(etiquetteDuType("team_announcement")).toBe("Recrutement");
    expect(etiquetteDuType("highlight")).toBe("Performance");
    expect(etiquetteDuType("competition_announcement")).toBe("Compétition");
  });

  it("donne à un auteur sans photo ses initiales et toujours la même couleur", () => {
    expect(initialesDAuteur(post("a", { authorAvatar: "", authorName: "Ama A." }))).toBe("AM");
    expect(initialesDAuteur(post("a", { authorAvatar: "KF" }))).toBe("KF");
    expect(couleurDAvatar("Ama A.")).toBe(couleurDAvatar("Ama A."));
    expect(couleurDAvatar("Ama A.")).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("le lien d'une publication", () => {
  it("est celui du site", () => {
    expect(lienDeLaPublication("p1")).toBe("/feed?post=p1");
  });

  it("se relit : la publication visée, et ses commentaires à ouvrir", () => {
    expect(publicationVisee("/feed?post=p1&commentaires=1")).toEqual({ post: "p1", commentaires: true });
    expect(publicationVisee("/feed?post=p1")).toEqual({ post: "p1", commentaires: false });
    expect(publicationVisee("/feed")).toEqual({ post: null, commentaires: false });
    expect(publicationVisee("/feed?commentaires=1")).toEqual({ post: null, commentaires: false });
  });
});

describe("photoRefusee", () => {
  it("accepte une image de 5 Mo au plus, et dit pourquoi elle refuse le reste", () => {
    expect(photoRefusee({ mimeType: "image/jpeg", fileSize: 1_000_000 })).toBeNull();
    expect(photoRefusee({ mimeType: "image/png", fileSize: undefined })).toBeNull();
    expect(photoRefusee({ mimeType: "video/mp4", fileSize: 1000 })).toBe("Seules les images sont acceptées.");
    expect(photoRefusee({ mimeType: "image/jpeg", fileSize: 6 * 1024 * 1024 })).toBe("Image trop lourde (5 Mo au plus).");
  });
});
