import {
  DELAI_ENTRE_ANNONCES_MS,
  decisionAnnonce,
  listeDesPostes,
  messageDeLAnnonce,
  MESSAGE_ANNONCE_MAX,
  postesValides,
  texteDeLAnnonce,
} from "@/lib/annonce-recrutement";
import { categorieDuType, CATEGORIES_PUSH } from "@/lib/push-categories";
import {
  COMMENTAIRE_MAX,
  nomDansLaTribune,
  notificationDeCommentaire,
  PAUSE_PUSH_COMMENTAIRES_MS,
  sonnerPourCeCommentaire,
  texteDuCommentaire,
} from "@/lib/tribune-commentaires";

// Jest tourne sous Node, mais l'application ne déclare pas les types de Node.
declare const require: (module: string) => unknown;
declare const __dirname: string;
const { readFileSync } = require("fs") as { readFileSync: (chemin: string, encodage: "utf8") => string };
const { join } = require("path") as { join: (...morceaux: string[]) => string };

describe("les commentaires de la Tribune", () => {
  it("publient un texte, ni vide ni trop long", () => {
    expect(texteDuCommentaire("  Quel but !  ")).toBe("Quel but !");
    expect(texteDuCommentaire("   ")).toBeNull();
    expect(texteDuCommentaire(42)).toBeNull();
    expect(texteDuCommentaire("a".repeat(COMMENTAIRE_MAX))).toHaveLength(COMMENTAIRE_MAX);
    expect(texteDuCommentaire("a".repeat(COMMENTAIRE_MAX + 1))).toBeNull();
  });

  it("signent du prénom et de l'initiale, comme une publication", () => {
    expect(nomDansLaTribune({ first_name: "Afi", last_name: "Lawson" })).toBe("Afi L.");
    expect(nomDansLaTribune({ first_name: "Afi", last_name: "" })).toBe("Afi");
    expect(nomDansLaTribune({ first_name: "Yawo", last_name: "Agbeko", is_venue_owner: true, company_name: "Complexe de Bè" }))
      .toBe("Complexe de Bè");
    // Un établissement sans nom : la personne.
    expect(nomDansLaTribune({ first_name: "Yawo", last_name: "Agbeko", is_venue_owner: true, company_name: " " }))
      .toBe("Yawo A.");
    expect(nomDansLaTribune({})).toBe("Un membre");
  });

  it("font sonner le téléphone au plus une fois toutes les dix minutes", () => {
    const t0 = 1_000_000;
    expect(sonnerPourCeCommentaire(null, t0)).toBe(true);
    expect(sonnerPourCeCommentaire(t0, t0 + 60_000)).toBe(false);
    expect(sonnerPourCeCommentaire(t0, t0 + PAUSE_PUSH_COMMENTAIRES_MS - 1)).toBe(false);
    expect(sonnerPourCeCommentaire(t0, t0 + PAUSE_PUSH_COMMENTAIRES_MS)).toBe(true);
  });

  it("préviennent l'auteur avec un extrait et un lien vers la publication", () => {
    const n = notificationDeCommentaire("Afi L.", "Quel   but\nKafui !!", "p1");
    expect(n.title).toBe("Afi L. a commenté ta publication");
    expect(n.body).toBe("« Quel but Kafui !! »");
    expect(n.link).toBe("/feed?post=p1&commentaires=1");
    const long = notificationDeCommentaire("Afi L.", "x".repeat(300), "p1");
    expect(long.body.length).toBeLessThan(130);
    expect(long.body).toContain("…");
  });

  it("ont leur catégorie de notifications, qu'on peut couper seule", () => {
    expect(categorieDuType("tribune_comment")).toBe("tribune");
    expect(CATEGORIES_PUSH).toContain("tribune");
  });

  it("ne s'écrivent que par le serveur", () => {
    const regles = readFileSync(join(__dirname, "../../../firestore.rules"), "utf8");
    const bloc = regles.slice(regles.indexOf("match /comments/{commentId}"));
    expect(bloc.slice(0, bloc.indexOf("allow delete"))).toMatch(/allow create: if false;/);
  });
});

describe("l'annonce de recrutement", () => {
  it("garde les postes connus, sans doublon, dans l'ordre du terrain", () => {
    expect(postesValides(["attaquant", "gardien", "gardien", "libero"])).toEqual(["gardien", "attaquant"]);
    expect(postesValides("gardien")).toEqual([]);
  });

  it("écrit une phrase quand le manager n'a rien écrit", () => {
    expect(listeDesPostes(["gardien"])).toBe("gardien");
    expect(listeDesPostes(["gardien", "milieu", "attaquant"])).toBe("gardien, milieu et attaquant");
    expect(texteDeLAnnonce("Avenir d'Adakpamé", ["gardien"], null))
      .toBe("Avenir d'Adakpamé recrute ! On cherche : gardien. Envoie ta demande depuis la Tribune.");
    expect(texteDeLAnnonce("Avenir d'Adakpamé", [], null))
      .toBe("Avenir d'Adakpamé recrute ! Envoie ta demande depuis la Tribune.");
    expect(texteDeLAnnonce("Avenir d'Adakpamé", ["gardien"], "On cherche un gardien pour samedi !"))
      .toBe("On cherche un gardien pour samedi !");
  });

  it("tronque le mot du manager plutôt que de le refuser", () => {
    expect(messageDeLAnnonce("   ")).toBeNull();
    expect(messageDeLAnnonce("x".repeat(MESSAGE_ANNONCE_MAX + 50))).toHaveLength(MESSAGE_ANNONCE_MAX);
  });

  it("paraît au plus une fois par semaine et par équipe", () => {
    const t0 = 10 * DELAI_ENTRE_ANNONCES_MS;
    expect(decisionAnnonce(null, t0)).toEqual({ action: "publier", fermer: null });
    // Déjà en ligne cette semaine.
    expect(decisionAnnonce({ postId: "a", publieeLe: t0 - 1000, close: false }, t0))
      .toEqual({ action: "refuser", postId: "a", possibleLe: t0 - 1000 + DELAI_ENTRE_ANNONCES_MS });
    // Fermée cette semaine (recrutement coupé puis rouvert) : on la rouvre.
    expect(decisionAnnonce({ postId: "a", publieeLe: t0 - 1000, close: true }, t0))
      .toEqual({ action: "rouvrir", postId: "a" });
    // Plus d'une semaine : une nouvelle, et l'ancienne se ferme.
    expect(decisionAnnonce({ postId: "a", publieeLe: t0 - DELAI_ENTRE_ANNONCES_MS, close: false }, t0))
      .toEqual({ action: "publier", fermer: "a" });
    expect(decisionAnnonce({ postId: "a", publieeLe: t0 - DELAI_ENTRE_ANNONCES_MS, close: true }, t0))
      .toEqual({ action: "publier", fermer: null });
  });

  it("ne se publie pas depuis le navigateur", () => {
    const regles = readFileSync(join(__dirname, "../../../firestore.rules"), "utf8");
    const bloc = regles.slice(regles.indexOf("match /posts/{postId}"));
    expect(bloc.slice(0, bloc.indexOf("allow update"))).toContain("request.resource.data.type != 'team_announcement'");
  });
});
