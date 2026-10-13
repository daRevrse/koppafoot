// Les règles Firestore du profil (`users/{uid}`), lues comme du texte : la
// suite de l'application mobile n'a pas d'émulateur. Ce que ces règles
// laissent réellement passer se vérifie contre le moteur de Firebase (voir
// le message de commit qui a posé `creationSansPrivilege`) ; ici on tient que
// personne ne retire la garde sans qu'un test tombe.
//
// LA FAILLE QUE CETTE SUITE GARDE FERMÉE. La création d'un profil ne
// regardait que son auteur et son genre. Un compte neuf, ouvert sans passer
// par l'application, pouvait donc écrire `is_superadmin: true` dans son propre
// profil et prendre toute l'administration. La modification était protégée
// (`noProtectedFields`) ; la création, non.

// `require`, comme les autres suites qui lisent firestore.rules : la
// vérification de types de l'application mobile n'a pas ceux de Node.
declare const __dirname: string;
const { readFileSync } = require("fs") as { readFileSync: (chemin: string, encodage: "utf8") => string };
const { join } = require("path") as { join: (...morceaux: string[]) => string };

const regles = readFileSync(join(__dirname, "../../../firestore.rules"), "utf8").replace(/\r\n/g, "\n");

/** Les commentaires racontent les anciennes règles : on ne lit que le code. */
const sansCommentaires = (texte: string) =>
  texte.split("\n").filter((ligne) => !ligne.trim().startsWith("//")).join("\n");

const corps = (motif: RegExp) => sansCommentaires(motif.exec(regles)?.[1] ?? "");

describe("firestore.rules : la création d'un profil", () => {
  const profil = corps(/match \/users\/\{uid\} \{([\s\S]*?)\n    \}\n/);
  const garde = corps(/function creationSansPrivilege\(\) \{([\s\S]*?)\n    \}\n/);

  it("passe par la garde", () => {
    expect(profil).toContain("allow create: if isOwner(uid) && genreValide() && creationSansPrivilege();");
    expect(profil.match(/allow create/g)).toHaveLength(1);
  });

  it.each(["is_superadmin", "is_organizer", "is_venue_owner", "is_scorer"])(
    "refuse un profil qui naît avec %s",
    (drapeau) => {
      // La VALEUR, pas la présence de la clé : un ancien client qui écrirait
      // `false` en toutes lettres ne doit pas être refusé.
      expect(garde).toContain(`d.get('${drapeau}', false) == false`);
    },
  );

  it("n'accepte que les rôles ordinaires, jamais « superadmin » ni « organizer »", () => {
    expect(garde).toContain("d.user_type in ['user', 'player', 'manager', 'referee']");
    expect(garde).toContain("d.evolution_role in ['player', 'manager', 'referee']");
    expect(garde).not.toMatch(/'superadmin'|'organizer'/);
  });

  it("refuse un profil qui naît suspendu ou inactif", () => {
    expect(garde).toContain("d.get('is_active', true) == true");
    expect(garde).toContain("d.get('suspended_at', null) == null");
  });
});
