import { TextInput } from "react-native";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import type { Comment, Post } from "@/types";
import EcranTribune from "~/app/(tabs)/tribune";

// L'écran de la Tribune : le fil du site dans l'application. Il se lit sans
// compte ; les gestes qui écrivent demandent un compte, se voient tout de
// suite, et disent quand ils ont échoué.

const post = (id: string, p: Partial<Post> = {}): Post => ({
  id, authorId: "a1", authorName: "Ama A.", authorRole: "Joueuse", authorAvatar: "",
  type: "text", content: `Publication ${id}`, metadata: null, likes: [], commentCount: 0, isLiked: false,
  mediaUrls: [], pinned: false, link: null, createdAt: "2026-11-10T10:00:00.000Z", updatedAt: "2026-11-10T10:00:00.000Z",
  ...p,
});

let mockFil: Post[] = [];
let mockConnecte = true;
let mockParams: { post?: string; commentaires?: string } = {};
let mockPhotoChoisie: { uri: string; mimeType: string; fileSize: number } | null = null;
const mockPush = jest.fn();
const mockJaime = jest.fn(async (..._a: unknown[]) => {});
const mockPublier = jest.fn(async (..._a: unknown[]) => "nouveau");
const mockAttacher = jest.fn(async (..._a: unknown[]) => {});
const mockModifier = jest.fn(async (..._a: unknown[]) => {});
const mockSupprimer = jest.fn(async (..._a: unknown[]) => {});
const mockLireCommentaires = jest.fn(async (..._a: unknown[]) => [] as Comment[]);
const mockCommenter = jest.fn(async (..._a: unknown[]) => ({ id: "c9", authorName: "Sacha S." }));
const mockSignaler = jest.fn(async (..._a: unknown[]) => ({} as { duplicate?: boolean }));
const mockEnvoyerLaPhoto = jest.fn(async (..._a: unknown[]) => "https://stockage/photo.jpg");
const mockConfirmer = jest.fn(async (..._a: unknown[]) => true);
const mockPrevenir = jest.fn();

jest.mock("~/lib/tribune-firestore", () => ({
  ecouterLaTribune: (_u: unknown, surFil: (p: Post[]) => void) => {
    surFil(mockFil);
    return () => {};
  },
  basculerLeJaime: (...a: unknown[]) => mockJaime(...a),
  publier: (...a: unknown[]) => mockPublier(...a),
  attacherLaPhoto: (...a: unknown[]) => mockAttacher(...a),
  modifierLaPublication: (...a: unknown[]) => mockModifier(...a),
  supprimerLaPublication: (...a: unknown[]) => mockSupprimer(...a),
  lireLesCommentaires: (...a: unknown[]) => mockLireCommentaires(...a),
  demanderARejoindre: async () => ({ genre: "envoyee" }),
}));
jest.mock("~/lib/tribune-api", () => ({
  commenter: (...a: unknown[]) => mockCommenter(...a),
  signaler: (...a: unknown[]) => mockSignaler(...a),
  envoyerLaPhoto: (...a: unknown[]) => mockEnvoyerLaPhoto(...a),
}));
jest.mock("~/lib/confirmer", () => ({
  confirmer: (...a: unknown[]) => mockConfirmer(...a),
  prevenir: (...a: unknown[]) => mockPrevenir(...a),
}));
jest.mock("~/lib/retour", () => ({ retourImpact: () => {}, retourSelection: () => {} }));
jest.mock("~/lib/push", () => ({ ouvrirLeLien: async () => {} }));
jest.mock("~/hooks/usePhotos", () => ({ usePhotosDesComptes: () => ({}) }));
jest.mock("~/components/EnTeteOnglet", () => ({ EnTeteOnglet: () => null }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: ({ children }: { children: unknown }) => children }));
jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: async () => (mockPhotoChoisie ? { canceled: false, assets: [mockPhotoChoisie] } : { canceled: true, assets: null }),
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: (...a: unknown[]) => mockPush(...a) }),
  useLocalSearchParams: () => mockParams,
}));
// Le compte et son profil gardent la même identité d'un rendu à l'autre, comme
// dans l'application : l'écoute du fil se relance quand le compte change.
const mockCompte = { uid: "u1" };
const mockProfil = { uid: "u1", firstName: "Sacha", lastName: "Sansrôle", gender: "female", profilePictureUrl: null };
jest.mock("~/lib/auth", () => ({
  useAuth: () => ({ utilisateur: mockConnecte ? mockCompte : null, profil: mockConnecte ? mockProfil : null }),
}));

const texte = (n: ReactTestInstance | string): string =>
  typeof n === "string" ? n : n.children.map((c) => texte(c as ReactTestInstance | string)).join("");

/**
 * Les éléments touchables qui portent ce libellé d'accessibilité, ou dont le
 * texte finit par lui (une icône simulée s'écrit devant son libellé).
 */
const touchables = (r: ReactTestRenderer, libelle: string) =>
  r.root.findAll((n) => typeof n.props.onPress === "function" && typeof n.type !== "string"
    && (n.props.accessibilityLabel === libelle || (n.props.accessibilityLabel === undefined && texte(n).endsWith(libelle))));

async function toucher(r: ReactTestRenderer, libelle: string, rang = 0) {
  const cible = touchables(r, libelle)[rang];
  if (!cible) throw new Error(`rien à toucher : ${libelle}`);
  await act(async () => {
    cible.props.onPress();
  });
}

function saisir(r: ReactTestRenderer, etiquette: string, valeur: string) {
  const champ = r.root.find((n) => n.type === TextInput && n.props.accessibilityLabel === etiquette);
  act(() => champ.props.onChangeText(valeur));
}

const attendre = () => act(async () => {
  await new Promise((fin) => setTimeout(fin, 0));
});

async function monter() {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(<EcranTribune />);
  });
  return r;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFil = [post("p1"), post("p2", { pinned: true }), post("p3", { authorId: "u1", authorName: "Sacha S." })];
  mockConnecte = true;
  mockParams = {};
  mockPhotoChoisie = null;
  mockConfirmer.mockResolvedValue(true);
  mockLireCommentaires.mockResolvedValue([]);
});

describe("le fil", () => {
  it("met la publication épinglée en tête", async () => {
    const r = await monter();
    const page = texte(r.root);
    expect(page.indexOf("Publication p2")).toBeLessThan(page.indexOf("Publication p1"));
    expect(page).toContain("Épinglé");
  });

  it("remplit le cœur tout de suite, et enregistre le j'aime", async () => {
    const r = await monter();
    await toucher(r, "J'aime", 1);
    expect(mockJaime).toHaveBeenCalledWith("p1", "u1", false);
    expect(touchables(r, "J'aime")[1].props["aria-pressed"]).toBe(true);
  });

  it("vide le cœur et le dit quand le j'aime n'a pas été enregistré", async () => {
    mockJaime.mockRejectedValueOnce(new Error("refusé"));
    const r = await monter();
    await toucher(r, "J'aime", 1);
    await attendre();
    expect(touchables(r, "J'aime")[1].props["aria-pressed"]).toBe(false);
    expect(mockPrevenir).toHaveBeenCalledWith("J'aime non enregistré", expect.any(String));
  });

  it("ouvre d'emblée les commentaires de la publication qu'un lien vise", async () => {
    mockParams = { post: "p1", commentaires: "1" };
    await monter();
    expect(mockLireCommentaires).toHaveBeenCalledTimes(1);
    expect(mockLireCommentaires).toHaveBeenCalledWith("p1");
  });
});

describe("sans compte", () => {
  beforeEach(() => {
    mockConnecte = false;
  });

  it("se lit, et invite à se connecter pour publier", async () => {
    const r = await monter();
    expect(texte(r.root)).toContain("Publication p1");
    expect(texte(r.root)).toContain("Connecte-toi pour publier dans la Tribune");
  });

  it("mène à la connexion au lieu d'aimer", async () => {
    const r = await monter();
    await toucher(r, "J'aime", 0);
    expect(mockJaime).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/connexion", params: { raison: "tribune" } });
  });
});

describe("les gestes sur une publication", () => {
  it("laisse supprimer la sienne, après confirmation", async () => {
    const r = await monter();
    await toucher(r, "Options de la publication", 2);
    expect(touchables(r, "Signaler")).toHaveLength(0);
    await toucher(r, "Supprimer");
    expect(mockConfirmer).toHaveBeenCalled();
    expect(mockSupprimer).toHaveBeenCalledWith("p3");
  });

  it("ne supprime rien si l'on renonce", async () => {
    mockConfirmer.mockResolvedValue(false);
    const r = await monter();
    await toucher(r, "Options de la publication", 2);
    await toucher(r, "Supprimer");
    expect(mockSupprimer).not.toHaveBeenCalled();
  });

  it("laisse signaler celle d'un autre, et dit que c'est parti", async () => {
    const r = await monter();
    await toucher(r, "Options de la publication", 1);
    expect(touchables(r, "Supprimer")).toHaveLength(0);
    await toucher(r, "Signaler");
    expect(mockSignaler).toHaveBeenCalledWith({ uid: "u1" }, "p1");
    expect(mockPrevenir).toHaveBeenCalledWith("Signalement envoyé", expect.any(String));
  });

  it("repartage en citant la publication, signée du compte", async () => {
    const r = await monter();
    await toucher(r, "Repartager dans la Tribune", 1);
    saisir(r, "Ton commentaire sur ce repartage", "À lire");
    await toucher(r, "Repartager");
    expect(mockPublier).toHaveBeenCalledWith(
      "u1",
      { authorName: "Sacha S.", authorRole: "Joueuse", authorAvatar: "" },
      "À lire",
      { postId: "p1", authorName: "Ama A.", content: "Publication p1" },
    );
  });

  it("envoie un commentaire par le serveur et le montre en tête", async () => {
    mockLireCommentaires.mockResolvedValue([
      { id: "c1", authorId: "a2", authorName: "Bébé B.", content: "Premier", createdAt: "2026-11-10T09:00:00.000Z" },
    ]);
    const r = await monter();
    await toucher(r, "Commentaires", 1);
    await attendre();
    expect(texte(r.root)).toContain("Premier");
    saisir(r, "Écrire un commentaire", "Bien joué");
    await toucher(r, "Envoyer le commentaire");
    expect(mockCommenter).toHaveBeenCalledWith({ uid: "u1" }, "p1", "Bien joué");
    const page = texte(r.root);
    expect(page.indexOf("Bien joué")).toBeGreaterThan(-1);
    expect(page.indexOf("Bien joué")).toBeLessThan(page.indexOf("Premier"));
  });
});

describe("publier", () => {
  it("ne part pas sans texte", async () => {
    const r = await monter();
    saisir(r, "Quoi de neuf sur le terrain ?", "   ");
    expect(touchables(r, "Publier")[0].props.disabled).toBe(true);
  });

  it("publie le texte, signé du compte", async () => {
    const r = await monter();
    saisir(r, "Quoi de neuf sur le terrain ?", "Victoire 3-1 !");
    await toucher(r, "Publier");
    expect(mockPublier).toHaveBeenCalledWith("u1", { authorName: "Sacha S.", authorRole: "Joueuse", authorAvatar: "" }, "Victoire 3-1 !");
    expect(mockEnvoyerLaPhoto).not.toHaveBeenCalled();
  });

  it("joint la photo choisie à la publication", async () => {
    mockPhotoChoisie = { uri: "file:///photo.jpg", mimeType: "image/jpeg", fileSize: 900_000 };
    const r = await monter();
    saisir(r, "Quoi de neuf sur le terrain ?", "La photo d'équipe");
    await toucher(r, "Photo");
    await toucher(r, "Publier");
    expect(mockEnvoyerLaPhoto).toHaveBeenCalledWith("nouveau", { uri: "file:///photo.jpg", mimeType: "image/jpeg" });
    expect(mockAttacher).toHaveBeenCalledWith("nouveau", "https://stockage/photo.jpg");
  });

  it("refuse une photo trop lourde, avant tout envoi", async () => {
    mockPhotoChoisie = { uri: "file:///lourde.jpg", mimeType: "image/jpeg", fileSize: 9 * 1024 * 1024 };
    const r = await monter();
    saisir(r, "Quoi de neuf sur le terrain ?", "Trop lourde");
    await toucher(r, "Photo");
    expect(mockPrevenir).toHaveBeenCalledWith("Photo refusée", "Image trop lourde (5 Mo au plus).");
    await toucher(r, "Publier");
    expect(mockEnvoyerLaPhoto).not.toHaveBeenCalled();
  });

  it("garde le texte publié et le dit quand la photo ne part pas", async () => {
    mockPhotoChoisie = { uri: "file:///photo.jpg", mimeType: "image/jpeg", fileSize: 900_000 };
    mockEnvoyerLaPhoto.mockRejectedValueOnce(new Error("réseau"));
    const r = await monter();
    saisir(r, "Quoi de neuf sur le terrain ?", "Avec photo");
    await toucher(r, "Photo");
    await toucher(r, "Publier");
    expect(mockPublier).toHaveBeenCalledTimes(1);
    expect(mockAttacher).not.toHaveBeenCalled();
    expect(mockPrevenir).toHaveBeenCalledWith("Photo non envoyée", expect.stringContaining("publié"));
  });
});
