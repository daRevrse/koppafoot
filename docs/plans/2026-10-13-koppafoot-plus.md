# KoppaFoot+ et « Pas de pubs » — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** KoppaFoot Pro devient KoppaFoot+, proposé aux seuls managers, organisateurs et propriétaires de terrain, et limité à ce que le compte est ; le retrait de la publicité se vend à part, « Pas de pubs », à tout le monde ; le Club multi-équipes et la création d'équipe demandent le rôle manager.

**Architecture:** Une règle pure dans `lib/offre` dit ce qu'un compte est (ses « titres » : manager, organisateur, gérant) et ce que KoppaFoot+ lui lève. Le catalogue de `lib/paiement` passe à quatre formules, chacune portant son droit (`pro` ou `sans_pub`) ; le serveur des paiements propose, refuse et accorde d'après cette règle et ce catalogue. Les plafonds, le club et la création d'équipe relisent le profil au serveur. Les écrans n'affichent que ce que le serveur leur rend.

**Tech Stack:** Next.js 16.2.3, firebase-admin 13, React 19, Tailwind 4, jest (dans `mobile/`). Aucune dépendance nouvelle.

**Spec:** `docs/plans/2026-10-13-koppafoot-plus-design.md`

## Global Constraints

- **Branche** `feat/koppafoot-plus`. Un commit par tâche, message en français, terminé par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **Avant chaque tâche : `git branch --show-current` doit rendre `feat/koppafoot-plus`.**
- **Les noms internes ne bougent pas** : `pro`, `pro_mois`, `pro_an`, `droits.pro`, `estPro`, et l'objet de paiement `"pro"` (qui veut dire « achat d'une formule », quel que soit son droit). Seul ce qui se lit change.
- **Les noms qui se lisent** : « KoppaFoot+ » dans une phrase, « KOPPAFOOT+ » en titre de menu et de page ; « Pas de pubs » en français, « No ads » en anglais.
- **Un manager l'est par son rôle** (`user_type` ou `evolution_role` vaut `manager`), jamais par le staff d'une équipe ni par une équipe à son nom. Le superadmin est organisateur d'office. Le scoreur n'ouvre rien.
- **Aucune règle Firestore dans ce chantier. Ne rien déployer depuis cette branche** : son `firestore.rules` date d'avant la PR #110 ; le déployer rouvrirait la faille de création de profil.
- **Avant de toucher une route** : `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`. `params` est une promesse.
- **Tests** : modules purs par `import` dans `mobile/src/__tests__/` ; modules serveur par `require` avec le faux Firestore (`mobile/src/test-aides/faux-firestore.ts`). Lancer : `(cd mobile && npx jest src/__tests__/<fichier>)`. `(cd mobile && npx tsc --noEmit)` a 3 erreurs préexistantes : n'en ajouter aucune.
- **Un texte JSX sur plusieurs lignes qui contient une entité (`&apos;`) perd son espace de tête** après une balise ou une accolade : écrire `{" "}`. Le contrôler sur le texte compilé (tâche 9).
- **Serveur de dev** par `preview_start` (`koppafoot-dev`), jamais par Bash. Un seul `npm run build`, à la fin, serveur arrêté. **Ne jamais appeler la tâche cron en local.**
- **Bac à sable** : seul un superadmin peut payer ; le poste de dev écrit dans la base de production.

## Review Focus

1. **Un compte hors profil qui a déjà KoppaFoot+** (un joueur à qui l'administration l'a accordé avant la règle) ouvre son offre → il voit son état et son échéance, rien à acheter, et « Pas de pubs » ne lui est pas vendu tant que KoppaFoot+ court. → tests de `formulesPour` (tâche 3) et de `ecranOffre` (tâche 5).
2. **Un paiement KoppaFoot+ arrive après que le compte a perdu son titre** (manager devenu joueur entre le clic et le paiement) → l'argent est reçu, le droit est accordé quand même. → test de `reglerPaiement`, tâche 3.
3. **Un joueur organisateur avec KoppaFoot+ crée une troisième équipe** → refusé : KoppaFoot+ ne lui lève que ses compétitions. → test de `limiteDeCreation`, tâche 4.
4. **Un joueur membre du staff d'une équipe demande KoppaFoot+** → refusé comme n'importe quel joueur ; le staff ne se lit nulle part dans son profil. → tests de `demarrerPaiement` (tâche 3) et de `estManager` (tâche 4).
5. **Les prix de « Pas de pubs » ne sont pas encore saisis** (l'état de la production au déploiement) → un joueur ouvre sa page : elle dit que l'option n'est pas encore en vente, sans bouton mort ni page vide. → test de `ecranOffre`, tâche 5.

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `src/lib/offre.ts` | Pur : les titres d'un profil, qui a droit à KoppaFoot+, ce qu'il lève. |
| `src/lib/paiement.ts` | Pur : le catalogue à quatre formules, leurs noms. |
| `src/lib/paiement-serveur.ts` | Les formules d'un profil, les refus, l'effet par droit, l'accusé, les rappels. |
| `src/lib/offre-server.ts` | Les plafonds par titre ; `plusLeve`, `estManager`. |
| `src/lib/clubs-serveur.ts`, `src/app/api/clubs/route.ts`, `src/app/api/teams/route.ts` | Le club et l'équipe demandent le rôle manager. |
| `mobile/src/test-aides/faux-firestore.ts` | Sous-collections et `count()`, pour les suites serveur. |
| `src/lib/offre-ecran.ts` (nouveau) | Pur : ce que la page de l'offre montre à un compte, cas par cas. |
| `src/app/api/offre/route.ts`, `src/app/(app)/offre/page.tsx` | L'offre du profil, à l'écran. |
| Menu, administration, textes (tâches 6 à 8) | L'entrée de menu, les quatre prix, le renommage. |

---

### Task 1: Ce qu'un compte est, et ce que KoppaFoot+ lui lève

**Files:**
- Modify: `src/lib/offre.ts`
- Test: `mobile/src/__tests__/offre-profil.test.ts`

**Interfaces:**
- Produces (de `@/lib/offre`) :
  - `interface Titres { manager: boolean; organisateur: boolean; gerant: boolean }`
  - `interface ProfilPourOffre { user_type?: unknown; evolution_role?: unknown; is_organizer?: unknown; is_venue_owner?: unknown; is_superadmin?: unknown }`
  - `titresDuProfil(p: ProfilPourOffre | null | undefined): Titres`
  - `titresDuCompte(u: { userType?: unknown; evolutionRole?: unknown; isOrganizer?: unknown; isVenueOwner?: unknown; isSuperAdmin?: unknown } | null | undefined): Titres`
  - `aDroitAKoppaFootPlus(t: Titres): boolean`
  - `offreAffichee(t: Titres): DroitOffre` : l'offre qui donne son nom au menu et à la page (`"pro"` → « KOPPAFOOT+ », `"sans_pub"` → « Pas de pubs »).
  - `type Avantage = CleLimite | "club"`
  - `koppaFootPlusLeve(t: Titres, avantage: Avantage): boolean`

La spec nomme cette règle `offresDuProfil` ; elle est ici en deux fonctions, parce que le serveur a besoin des titres eux-mêmes (pour les plafonds) et pas seulement de leur conclusion.

- [ ] **Step 1: Écrire les tests**

Créer `mobile/src/__tests__/offre-profil.test.ts` :

```ts
import { aDroitAKoppaFootPlus, koppaFootPlusLeve, offreAffichee, titresDuCompte, titresDuProfil } from "@/lib/offre";

// Le module vit côté site (src/lib/offre) ; il est pur, et c'est ici que la
// suite de tests des modules partagés tourne.

const AUCUN = { manager: false, organisateur: false, gerant: false };

describe("titresDuProfil", () => {
  it("un manager l'est par son rôle, quel que soit le champ qui le porte", () => {
    expect(titresDuProfil({ user_type: "manager" })).toEqual({ ...AUCUN, manager: true });
    expect(titresDuProfil({ user_type: "user", evolution_role: "manager" })).toEqual({ ...AUCUN, manager: true });
  });

  it.each(["user", "player", "referee"])("un compte « %s » n'a aucun titre", (role) => {
    expect(titresDuProfil({ user_type: role, evolution_role: role === "user" ? undefined : role })).toEqual(AUCUN);
  });

  it("les casquettes se lisent dans leurs drapeaux, et se cumulent avec le rôle", () => {
    expect(titresDuProfil({ user_type: "player", is_organizer: true })).toEqual({ ...AUCUN, organisateur: true });
    expect(titresDuProfil({ user_type: "referee", is_venue_owner: true })).toEqual({ ...AUCUN, gerant: true });
    expect(titresDuProfil({ user_type: "manager", is_organizer: true, is_venue_owner: true }))
      .toEqual({ manager: true, organisateur: true, gerant: true });
  });

  it("le superadmin organise d'office", () => {
    expect(titresDuProfil({ user_type: "player", is_superadmin: true }).organisateur).toBe(true);
    expect(titresDuProfil({ user_type: "superadmin" }).organisateur).toBe(true);
  });

  it("le scoreur est une casquette qui n'ouvre rien", () => {
    expect(titresDuProfil({ user_type: "player", is_scorer: true } as never)).toEqual(AUCUN);
  });

  it("un drapeau qui n'est pas exactement vrai ne compte pas", () => {
    expect(titresDuProfil({ is_organizer: "true", is_venue_owner: 1 })).toEqual(AUCUN);
  });

  it("un profil absent n'a aucun titre", () => {
    expect(titresDuProfil(null)).toEqual(AUCUN);
    expect(titresDuProfil(undefined)).toEqual(AUCUN);
  });
});

describe("titresDuCompte", () => {
  it("lit le profil tel que le navigateur le tient", () => {
    expect(titresDuCompte({ userType: "user", evolutionRole: "manager", isVenueOwner: true }))
      .toEqual({ manager: true, organisateur: false, gerant: true });
    expect(titresDuCompte({ userType: "player", isSuperAdmin: true }).organisateur).toBe(true);
    expect(titresDuCompte(null)).toEqual(AUCUN);
  });
});

describe("aDroitAKoppaFootPlus", () => {
  it("un seul titre suffit", () => {
    expect(aDroitAKoppaFootPlus({ ...AUCUN, manager: true })).toBe(true);
    expect(aDroitAKoppaFootPlus({ ...AUCUN, organisateur: true })).toBe(true);
    expect(aDroitAKoppaFootPlus({ ...AUCUN, gerant: true })).toBe(true);
  });

  it("sans titre, non : un joueur, un arbitre, un spectateur, un scoreur", () => {
    expect(aDroitAKoppaFootPlus(AUCUN)).toBe(false);
  });
});

describe("offreAffichee", () => {
  it("KOPPAFOOT+ pour qui gère, « Pas de pubs » pour les autres", () => {
    expect(offreAffichee({ ...AUCUN, manager: true })).toBe("pro");
    expect(offreAffichee({ ...AUCUN, gerant: true })).toBe("pro");
    expect(offreAffichee(titresDuCompte({ userType: "player", isOrganizer: true }))).toBe("pro");
    expect(offreAffichee(AUCUN)).toBe("sans_pub");
    expect(offreAffichee(titresDuCompte({ userType: "referee" }))).toBe("sans_pub");
    expect(offreAffichee(titresDuCompte(null))).toBe("sans_pub");
  });
});

describe("koppaFootPlusLeve", () => {
  it("à un manager : ses équipes et son club, rien d'autre", () => {
    const t = { ...AUCUN, manager: true };
    expect(koppaFootPlusLeve(t, "equipes")).toBe(true);
    expect(koppaFootPlusLeve(t, "club")).toBe(true);
    expect(koppaFootPlusLeve(t, "terrains")).toBe(false);
    expect(koppaFootPlusLeve(t, "competitions")).toBe(false);
    expect(koppaFootPlusLeve(t, "equipesParCompetition")).toBe(false);
  });

  it("à un organisateur : ses compétitions, rien d'autre", () => {
    const t = { ...AUCUN, organisateur: true };
    expect(koppaFootPlusLeve(t, "competitions")).toBe(true);
    expect(koppaFootPlusLeve(t, "equipesParCompetition")).toBe(true);
    expect(koppaFootPlusLeve(t, "equipes")).toBe(false);
    expect(koppaFootPlusLeve(t, "club")).toBe(false);
    expect(koppaFootPlusLeve(t, "terrains")).toBe(false);
  });

  it("à un propriétaire de terrain : ses terrains, rien d'autre", () => {
    const t = { ...AUCUN, gerant: true };
    expect(koppaFootPlusLeve(t, "terrains")).toBe(true);
    expect(koppaFootPlusLeve(t, "equipes")).toBe(false);
    expect(koppaFootPlusLeve(t, "competitions")).toBe(false);
  });

  it("les titres se cumulent", () => {
    const t = { manager: true, organisateur: false, gerant: true };
    expect(koppaFootPlusLeve(t, "equipes")).toBe(true);
    expect(koppaFootPlusLeve(t, "terrains")).toBe(true);
    expect(koppaFootPlusLeve(t, "competitions")).toBe(false);
  });

  it("sans titre, rien", () => {
    expect(koppaFootPlusLeve(AUCUN, "equipes")).toBe(false);
    expect(koppaFootPlusLeve(AUCUN, "club")).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer, constater l'échec**

Run: `(cd mobile && npx jest src/__tests__/offre-profil.test.ts)`
Expected: FAIL, `titresDuProfil is not a function`.

- [ ] **Step 3: Écrire la règle**

Dans `src/lib/offre.ts`, après la fonction `limitesEnVigueur`, ajouter :

```ts
// ─── Ce qu'un compte EST, pour l'offre ──────────────────────

/**
 * Les titres d'un compte : ce qui lui donne quelque chose à gérer.
 *
 * KOPPAFOOT+ N'EST PAS POUR TOUT LE MONDE. Il ne sert qu'à qui gère : des
 * équipes (le manager), des compétitions (l'organisateur), des terrains (le
 * propriétaire). Un joueur, un arbitre, un spectateur, un scoreur n'y gagnent
 * que le retrait de la publicité, qui se vend à part (« Pas de pubs »).
 */
export interface Titres {
  manager: boolean;
  organisateur: boolean;
  gerant: boolean;
}

/** Le profil tel que Firestore le range (`users/{uid}`). */
export interface ProfilPourOffre {
  user_type?: unknown;
  evolution_role?: unknown;
  is_organizer?: unknown;
  is_venue_owner?: unknown;
  is_superadmin?: unknown;
}

/**
 * Les titres d'un profil.
 *
 * UN MANAGER L'EST PAR SON RÔLE, et par lui seul. Le staff d'une équipe n'en
 * fait pas un manager : c'est un joueur qu'on aide, avec des limites. Une
 * équipe à son nom sans le rôle, non plus. Le superadmin organise d'office
 * (lib/hats).
 */
export function titresDuProfil(p: ProfilPourOffre | null | undefined): Titres {
  return {
    manager: p?.user_type === "manager" || p?.evolution_role === "manager",
    organisateur: p?.is_organizer === true || p?.is_superadmin === true || p?.user_type === "superadmin",
    gerant: p?.is_venue_owner === true,
  };
}

/** Les mêmes titres, lus sur le profil que le navigateur tient (`UserProfile`). */
export function titresDuCompte(u: {
  userType?: unknown; evolutionRole?: unknown; isOrganizer?: unknown; isVenueOwner?: unknown; isSuperAdmin?: unknown;
} | null | undefined): Titres {
  return titresDuProfil({
    user_type: u?.userType,
    evolution_role: u?.evolutionRole,
    is_organizer: u?.isOrganizer,
    is_venue_owner: u?.isVenueOwner,
    is_superadmin: u?.isSuperAdmin,
  });
}

/** KoppaFoot+ se propose à qui porte au moins un titre. */
export function aDroitAKoppaFootPlus(t: Titres): boolean {
  return t.manager || t.organisateur || t.gerant;
}

/**
 * L'offre qui donne son nom à l'entrée de menu et à la page : KOPPAFOOT+
 * (`pro`) pour qui y a droit, « Pas de pubs » (`sans_pub`) pour les autres.
 * Le menu et la page lisent la même fonction : ils ne peuvent pas se contredire.
 */
export function offreAffichee(t: Titres): DroitOffre {
  return aDroitAKoppaFootPlus(t) ? "pro" : "sans_pub";
}

/** Ce que KoppaFoot+ peut lever : chaque plafond, et le Club multi-équipes. */
export type Avantage = CleLimite | "club";

const TITRE_REQUIS: Record<Avantage, keyof Titres> = {
  equipes: "manager",
  club: "manager",
  terrains: "gerant",
  competitions: "organisateur",
  equipesParCompetition: "organisateur",
};

/**
 * KoppaFoot+ lève-t-il cet avantage pour ce compte ?
 *
 * IL N'AGIT QUE POUR CE QUE LE COMPTE EST. Un joueur organisateur qui l'a
 * mène autant de compétitions qu'il veut, mais il n'a ni équipes au-delà du
 * plafond, ni club. Les titres se cumulent. Le droit lui-même (`estPro`) se
 * vérifie à part : ceci ne dit que ce qu'il ouvrirait.
 */
export function koppaFootPlusLeve(t: Titres, avantage: Avantage): boolean {
  return t[TITRE_REQUIS[avantage]];
}
```

- [ ] **Step 4: Lancer, constater le succès**

Run: `(cd mobile && npx jest src/__tests__/offre-profil.test.ts)`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add src/lib/offre.ts mobile/src/__tests__/offre-profil.test.ts
git commit -m "feat(offre): ce qu'un compte est, et ce que KoppaFoot+ lui lève

KoppaFoot+ ne sert qu'à qui gère : des équipes, des compétitions, des
terrains. Une règle pure dit les titres d'un profil (un manager l'est
par son rôle, jamais par le staff d'une équipe), qui a droit à l'offre,
et ce qu'elle lève pour chacun.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Le catalogue à quatre formules

**Files:**
- Modify: `src/lib/paiement.ts`
- Modify: `src/lib/offre.ts` (le type du réglage : quatre prix)
- Modify: `src/lib/paiement-serveur.ts` (l'appel de `motifAchat`, le libellé local)
- Modify: `src/app/(admin)/admin/offre/page.tsx` (les libellés et la saisie des prix suivent le catalogue, pour que les types tiennent)
- Test: `mobile/src/__tests__/paiement.test.ts`, `mobile/src/__tests__/paiement-serveur.test.ts`

**Interfaces:**
- Produces (de `@/lib/paiement`) :
  - `FORMULES` gagne `sans_pub_mois` et `sans_pub_an` (`droit: "sans_pub"`), donc `IdFormule` et `ID_FORMULES` aussi ; l'ordre de `ID_FORMULES` est `pro_mois`, `pro_an`, `sans_pub_mois`, `sans_pub_an`.
  - `PrixOffre` porte les quatre clés.
  - `interface FormuleEnVente { id: IdFormule; droit: DroitOffre; mois: number; prix: number }`
  - `NOM_OFFRE: Record<DroitOffre, string>` = `{ pro: "KoppaFoot+", sans_pub: "Pas de pubs" }`
  - `libelleFormule(id: IdFormule): string` → « KoppaFoot+, 1 mois », « Pas de pubs, 1 an »
  - `motifAchat(droit: DroitOffre, mois: number, environnement: EnvironnementPaiement): string`

- [ ] **Step 1: Les tests**

Dans `mobile/src/__tests__/paiement.test.ts`, ajouter `NOM_OFFRE`, `libelleFormule`, `ID_FORMULES` à l'import de `@/lib/paiement`, puis :

- suite `estFormule` : le test « reconnaît les deux formules » devient « reconnaît les quatre formules », avec en plus

```ts
    expect(estFormule("sans_pub_mois")).toBe(true);
    expect(estFormule("sans_pub_an")).toBe(true);
```

  (le test suivant refuse déjà `"sans_pub"`, qui est un droit et pas une formule : il reste tel quel.)

- suite `prixValide et lirePrix` : remplacer les trois attentes de `lirePrix` par

```ts
    expect(lirePrix({ pro_mois: 1500, pro_an: "15000", sans_pub_mois: 300 }))
      .toEqual({ pro_mois: 1500, pro_an: null, sans_pub_mois: 300, sans_pub_an: null });
    const vide = { pro_mois: null, pro_an: null, sans_pub_mois: null, sans_pub_an: null };
    expect(lirePrix(undefined)).toEqual(vide);
    expect(lirePrix("n'importe quoi")).toEqual(vide);
```

- suite `formulesEnVente` : remplacer ses trois tests par

```ts
  const AUCUN_PRIX = { pro_mois: null, pro_an: null, sans_pub_mois: null, sans_pub_an: null };

  it("ne garde que les formules qui ont un prix, avec leur droit", () => {
    expect(formulesEnVente({ ...AUCUN_PRIX, pro_mois: 1500 })).toEqual([{ id: "pro_mois", droit: "pro", mois: 1, prix: 1500 }]);
    expect(formulesEnVente({ ...AUCUN_PRIX, sans_pub_an: 3000 }))
      .toEqual([{ id: "sans_pub_an", droit: "sans_pub", mois: 12, prix: 3000 }]);
  });

  it("les rend dans l'ordre : KoppaFoot+ d'abord, le mois avant l'année", () => {
    expect(formulesEnVente({ pro_mois: 1500, pro_an: 15000, sans_pub_mois: 300, sans_pub_an: 3000 }).map((f) => f.id))
      .toEqual(["pro_mois", "pro_an", "sans_pub_mois", "sans_pub_an"]);
    expect(ID_FORMULES).toEqual(["pro_mois", "pro_an", "sans_pub_mois", "sans_pub_an"]);
  });

  it("ne rend rien quand rien n'a de prix", () => {
    expect(formulesEnVente(AUCUN_PRIX)).toEqual([]);
  });
```

- suite `motifAchat` : remplacer ses attentes par

```ts
    expect(motifAchat("pro", 1, "live")).toBe("Achat KoppaFoot+ 1 mois");
    expect(motifAchat("pro", 12, "sandbox")).toBe("Achat KoppaFoot+ 12 mois (bac à sable)");
    expect(motifAchat("sans_pub", 1, "live")).toBe("Achat Pas de pubs 1 mois");
```

- ajouter une suite :

```ts
describe("libelleFormule", () => {
  it("dit l'offre et la durée, comme on les lit chez FedaPay et sur le reçu", () => {
    expect(libelleFormule("pro_mois")).toBe("KoppaFoot+, 1 mois");
    expect(libelleFormule("pro_an")).toBe("KoppaFoot+, 1 an");
    expect(libelleFormule("sans_pub_mois")).toBe("Pas de pubs, 1 mois");
    expect(libelleFormule("sans_pub_an")).toBe("Pas de pubs, 1 an");
    expect(NOM_OFFRE).toEqual({ pro: "KoppaFoot+", sans_pub: "Pas de pubs" });
  });
});
```

Run: `(cd mobile && npx jest src/__tests__/paiement.test.ts)`
Expected: FAIL (`libelleFormule` n'existe pas ; `lirePrix` rend deux clés ; `motifAchat` rend « Achat Pro »).

- [ ] **Step 2: Le catalogue**

Dans `src/lib/paiement.ts` :

- remplacer `FORMULES` et son commentaire par :

```ts
/**
 * Ce qui s'achète : le droit accordé, et pour combien de mois.
 *
 * DEUX OFFRES. KoppaFoot+ (le droit `pro`) pour qui gère des équipes, des
 * compétitions ou des terrains ; « Pas de pubs » (le droit `sans_pub`) pour
 * tout le monde. Qui peut acheter quoi se décide au serveur, sur le profil
 * (lib/offre, lib/paiement-serveur) : ce catalogue ne dit que ce qui existe.
 *
 * Les identifiants `pro_*` gardent l'ancien nom de l'offre : ils sont écrits
 * dans les paiements déjà faits et dans les références envoyées à FedaPay.
 */
export const FORMULES = {
  pro_mois: { droit: "pro", mois: 1 },
  pro_an: { droit: "pro", mois: 12 },
  sans_pub_mois: { droit: "sans_pub", mois: 1 },
  sans_pub_an: { droit: "sans_pub", mois: 12 },
} as const satisfies Record<string, { droit: DroitOffre; mois: number }>;
```

- remplacer le commentaire de `ID_FORMULES` par `/** Dans l'ordre où on les montre : KoppaFoot+ d'abord, le mois avant l'année. */`.

- après `estFormule`, ajouter :

```ts
/** Le nom de chaque offre, tel qu'on le lit. */
export const NOM_OFFRE: Record<DroitOffre, string> = { pro: "KoppaFoot+", sans_pub: "Pas de pubs" };

/** « KoppaFoot+, 1 mois » : ce qui s'affiche chez FedaPay et sur le reçu. */
export function libelleFormule(id: IdFormule): string {
  const { droit, mois } = FORMULES[id];
  return `${NOM_OFFRE[droit]}, ${mois === 12 ? "1 an" : "1 mois"}`;
}
```

- remplacer `lirePrix` par :

```ts
/** Les prix tels que rangés, assainis : tout ce qui n'est pas un prix vaut `null`. */
export function lirePrix(brut: unknown): PrixOffre {
  const p = (brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>;
  return Object.fromEntries(ID_FORMULES.map((id) => {
    const v = p[id];
    return [id, prixValide(v) ? v : null];
  })) as PrixOffre;
}
```

- remplacer `FormuleEnVente` et `formulesEnVente` par :

```ts
export interface FormuleEnVente {
  id: IdFormule;
  /** Ce qu'elle accorde : KoppaFoot+ (`pro`) ou « Pas de pubs » (`sans_pub`). */
  droit: DroitOffre;
  mois: number;
  prix: number;
}

export function formulesEnVente(prix: PrixOffre): FormuleEnVente[] {
  return ID_FORMULES.flatMap((id) => {
    const p = prix[id];
    return prixValide(p) ? [{ id, droit: FORMULES[id].droit, mois: FORMULES[id].mois, prix: p }] : [];
  });
}
```

- remplacer `motifAchat` par :

```ts
/** Le motif écrit sur le droit, pour l'administration. */
export function motifAchat(droit: DroitOffre, mois: number, environnement: EnvironnementPaiement): string {
  return `Achat ${NOM_OFFRE[droit]} ${mois} mois${environnement === "live" ? "" : " (bac à sable)"}`;
}
```

- [ ] **Step 3: Ce qui en dépend, pour que tout compile**

Dans `src/lib/paiement-serveur.ts` :
- supprimer la constante locale `libelleFormule` (les deux lignes `const libelleFormule = …`) et ajouter `libelleFormule` à l'import de `@/lib/paiement` ;
- dans `effetPro`, l'appel `motifAchat(mois, c.environnement)` devient `motifAchat("pro", mois, c.environnement)`.

Dans `src/lib/offre.ts`, le champ `prix` de `FirestoreReglageOffre` devient :

```ts
  /** Le prix de chaque formule, en XOF ; vide = pas en vente (lib/paiement). */
  prix?: Partial<Record<"pro_mois" | "pro_an" | "sans_pub_mois" | "sans_pub_an", number | null>>;
```

Dans `src/app/(admin)/admin/offre/page.tsx`, trois endroits écrivaient les deux formules en dur :
- supprimer la constante `LIBELLE_FORMULE`, ajouter `libelleFormule` à l'import de `@/lib/paiement`, et remplacer ses deux usages : `LIBELLE_FORMULE[id]` devient `libelleFormule(id)` (le message d'erreur de `enregistrerPrix`, l'étiquette du champ de prix), `LIBELLE_FORMULE[p.formule]` devient `libelleFormule(p.formule)` (la ligne d'un paiement) ;
- `versSaisie` devient :

```ts
/** Les prix rangés, tels qu'on les saisit : vide quand la formule n'est pas en vente. */
const versSaisie = (prix: Partial<PrixOffre>): Record<IdFormule, string> =>
  Object.fromEntries(ID_FORMULES.map((id) => [id, prix[id] == null ? "" : String(prix[id])])) as Record<IdFormule, string>;
```

- l'état `saisiePrix` s'initialise par `useState<Record<IdFormule, string>>(() => versSaisie({}))`.

Dans `mobile/src/__tests__/paiement-serveur.test.ts` :
- les deux descriptions attendues par `demarrerPaiement` deviennent `"KoppaFoot+, 1 mois"` et `"KoppaFoot+, 1 an"` ;
- la suite `formulesPour` attend désormais le droit : remplacer chaque `{ id: "pro_mois", mois: 1, prix: 1500 }` par `{ id: "pro_mois", droit: "pro", mois: 1, prix: 1500 }` ;
- chercher `Achat Pro` dans le fichier : toute attente sur ce motif devient `Achat KoppaFoot+`.

- [ ] **Step 4: Lancer, constater le succès**

Run: `(cd mobile && npx jest src/__tests__/paiement.test.ts src/__tests__/paiement-serveur.test.ts)`
Expected: PASS pour les deux suites.

Run: `npx tsc --noEmit`
Expected: aucune erreur. (La page d'administration affiche maintenant quatre champs de prix : elle les tire de `ID_FORMULES`.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/paiement.ts src/lib/offre.ts src/lib/paiement-serveur.ts "src/app/(admin)/admin/offre/page.tsx" mobile/src/__tests__/paiement.test.ts mobile/src/__tests__/paiement-serveur.test.ts
git commit -m "feat(paiement): quatre formules, deux offres

Le catalogue porte désormais « Pas de pubs », au mois et à l'an, à
côté de KoppaFoot+. Chaque formule dit le droit qu'elle accorde ; les
prix, les libellés et le motif d'achat la suivent. Les identifiants
pro_* ne bougent pas : ils sont dans les paiements déjà faits.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Le serveur des paiements vend, refuse et accorde par offre

**Files:**
- Modify: `src/lib/paiement-serveur.ts`
- Modify: `src/lib/email.ts` (`recuPaiementHtml`)
- Modify: `src/app/api/paiements/route.ts` (statuts des refus), `src/app/api/cron/scoreur-manquant/route.ts` (nom de la fonction de rappel)
- Test: `mobile/src/__tests__/paiement-serveur.test.ts`

**Interfaces:**
- Consumes: `titresDuProfil`, `aDroitAKoppaFootPlus`, `estPro`, `droitActif` de `@/lib/offre` (tâche 1) ; `FORMULES`, `NOM_OFFRE`, `libelleFormule`, `motifAchat`, `formulesEnVente` de `@/lib/paiement` (tâche 2).
- Produces (de `@/lib/paiement-serveur`) :
  - `formulesPour(profil: Record<string, unknown> | undefined, droits?: Pick<FirestoreDroits, "pro" | "sans_pub"> | null): Promise<FormuleEnVente[]>` : ce que CE compte peut acheter.
  - `RefusPaiement` gagne `"profil"` et `"deja_compris"`.
  - `EtatPaiement` gagne `droit: DroitOffre | null`.
  - `rappelerEcheances(jour?: string): Promise<number>` remplace `rappelerEcheancesPro`.

- [ ] **Step 1: Les tests**

Dans `mobile/src/__tests__/paiement-serveur.test.ts` :

**a.** Dans le bloc `require("@/lib/paiement-serveur")`, renommer `rappelerEcheancesPro` en `rappelerEcheances` (les deux occurrences) et remplacer la signature de `formulesPour` par :

```ts
  formulesPour: (profil: Doc | undefined, droits?: Doc | null) => Promise<{ id: string; droit: string; mois: number; prix: number }[]>;
```

Ajouter sous les aides `ligne` et `pro` :

```ts
const sansPub = () => (mockBase.get(`droits/${UID}`) as { sans_pub?: DroitAccorde } | undefined)?.sans_pub ?? null;
const PRIX = { pro_mois: 1500, pro_an: 15000, sans_pub_mois: 300, sans_pub_an: 3000 };
const droitDate = (jusqu_au: string | null): DroitAccorde =>
  ({ depuis: "2026-01-01", jusqu_au, source: "paiement", accorde_par: null, motif: null });
```

**b.** Suite `demarrerPaiement` : dans son `beforeEach`, la ligne des prix devient `mockBase.set("settings/offre", { prix: PRIX });`. Remplacer le test « en réel, vend à tout le monde et ramène toujours sur le site » par :

```ts
  it("en réel, vend KoppaFoot+ à un manager et ramène toujours sur le site", async () => {
    mockFedapay.environnement = "live";
    mockBase.set(`users/${UID}`, { first_name: "Ama", last_name: "Koffi", email: "ama@exemple.test", user_type: "manager" });

    const { id } = await demarrerPaiement(UID, "pro_mois", "https://faux-site.exemple");

    expect(mockBase.get(`paiements/${id}`)).toMatchObject({ environnement: "live", montant: 1500, droit: "pro" });
    expect(mockFedapay.creerCollecte).toHaveBeenCalledWith(
      expect.objectContaining({ retour: `https://www.koppafoot.com/offre?paiement=${id}` }),
    );
  });

  describe("qui peut acheter quoi", () => {
    const profil = (p: Doc) => mockBase.set(`users/${UID}`, { first_name: "Ama", last_name: "Koffi", ...p });

    beforeEach(() => { mockFedapay.environnement = "live"; });

    it.each([["un joueur", { user_type: "player" }], ["un arbitre", { user_type: "referee" }], ["un spectateur", { user_type: "user" }]])(
      "refuse KoppaFoot+ à %s, sans rien écrire",
      async (_qui, p) => {
        profil(p);
        await expect(demarrerPaiement(UID, "pro_mois", ORIGINE)).rejects.toMatchObject({ code: "profil" });
        expect(lignes()).toHaveLength(0);
        expect(mockFedapay.creerCollecte).not.toHaveBeenCalled();
      },
    );

    it("refuse KoppaFoot+ à un joueur membre du staff d'une équipe : le staff n'est pas un manager", async () => {
      profil({ user_type: "player" });
      mockBase.set("teams/equipe1", { manager_id: "quelqu-un-d-autre", staff_manager_ids: [UID] });
      await expect(demarrerPaiement(UID, "pro_an", ORIGINE)).rejects.toMatchObject({ code: "profil" });
    });

    it("vend KoppaFoot+ à un joueur qui porte une casquette", async () => {
      profil({ user_type: "player", is_organizer: true });
      await expect(demarrerPaiement(UID, "pro_mois", ORIGINE)).resolves.toMatchObject({ url: URL_PAIEMENT });
      profil({ user_type: "referee", is_venue_owner: true });
      await expect(demarrerPaiement(UID, "pro_mois", ORIGINE)).resolves.toMatchObject({ url: URL_PAIEMENT });
    });

    it("vend « Pas de pubs » à un joueur, à son prix et sous son nom", async () => {
      profil({ user_type: "player" });

      const { id } = await demarrerPaiement(UID, "sans_pub_mois", ORIGINE);

      expect(mockBase.get(`paiements/${id}`)).toMatchObject({ formule: "sans_pub_mois", droit: "sans_pub", montant: 300 });
      expect(mockFedapay.creerCollecte).toHaveBeenCalledWith(expect.objectContaining({ description: "Pas de pubs, 1 mois", montant: 300 }));
    });

    it("vend aussi « Pas de pubs » à un manager", async () => {
      profil({ user_type: "manager" });
      await expect(demarrerPaiement(UID, "sans_pub_an", ORIGINE)).resolves.toMatchObject({ url: URL_PAIEMENT });
    });

    it("refuse « Pas de pubs » à qui a KoppaFoot+ : il le comprend déjà", async () => {
      profil({ user_type: "manager" });
      mockBase.set(`droits/${UID}`, { pro: droitDate("2099-12-31") });
      await expect(demarrerPaiement(UID, "sans_pub_mois", ORIGINE)).rejects.toMatchObject({ code: "deja_compris" });
      expect(lignes()).toHaveLength(0);
    });

    it("revend « Pas de pubs » une fois KoppaFoot+ terminé", async () => {
      profil({ user_type: "player" });
      mockBase.set(`droits/${UID}`, { pro: droitDate("2026-01-31") });
      await expect(demarrerPaiement(UID, "sans_pub_mois", ORIGINE)).resolves.toMatchObject({ url: URL_PAIEMENT });
    });

    it("refuse de prolonger un « Pas de pubs » sans échéance", async () => {
      profil({ user_type: "player" });
      mockBase.set(`droits/${UID}`, { sans_pub: droitDate(null) });
      await expect(demarrerPaiement(UID, "sans_pub_mois", ORIGINE)).rejects.toMatchObject({ code: "deja_illimite" });
    });

    it("refuse une formule « Pas de pubs » sans prix", async () => {
      profil({ user_type: "player" });
      mockBase.set("settings/offre", { prix: { ...PRIX, sans_pub_mois: null } });
      await expect(demarrerPaiement(UID, "sans_pub_mois", ORIGINE)).rejects.toMatchObject({ code: "pas_en_vente" });
    });
  });
```

**c.** Remplacer la suite `formulesPour` entière par :

```ts
describe("formulesPour", () => {
  const ids = async (profil: Doc | undefined, droits?: Doc | null) => (await formulesPour(profil, droits)).map((f) => f.id);

  beforeEach(() => {
    mockBase.set("settings/offre", { prix: PRIX });
  });

  it("en bac à sable, ne montre rien à un compte ordinaire", async () => {
    expect(await formulesPour({ user_type: "manager" })).toEqual([]);
    expect(await formulesPour(undefined)).toEqual([]);
  });

  it("en bac à sable, montre les deux offres à un superadmin, chacune avec son droit", async () => {
    mockBase.set("settings/offre", { prix: { pro_mois: 1500, sans_pub_mois: 300 } });
    expect(await formulesPour({ is_superadmin: true })).toEqual([
      { id: "pro_mois", droit: "pro", mois: 1, prix: 1500 },
      { id: "sans_pub_mois", droit: "sans_pub", mois: 1, prix: 300 },
    ]);
  });

  it("ne montre rien sans clé FedaPay", async () => {
    mockFedapay.configure = false;
    expect(await formulesPour({ is_superadmin: true })).toEqual([]);
  });

  describe("en réel", () => {
    beforeEach(() => { mockFedapay.environnement = "live"; });

    it("un manager, un organisateur, un propriétaire voient les deux offres", async () => {
      const TOUT = ["pro_mois", "pro_an", "sans_pub_mois", "sans_pub_an"];
      expect(await ids({ user_type: "manager" })).toEqual(TOUT);
      expect(await ids({ user_type: "player", is_organizer: true })).toEqual(TOUT);
      expect(await ids({ user_type: "user", is_venue_owner: true })).toEqual(TOUT);
    });

    it("un joueur, un arbitre, un spectateur ne voient que « Pas de pubs »", async () => {
      const SANS_PUB = ["sans_pub_mois", "sans_pub_an"];
      expect(await ids({ user_type: "player" })).toEqual(SANS_PUB);
      expect(await ids({ user_type: "referee" })).toEqual(SANS_PUB);
      expect(await ids({ user_type: "user" })).toEqual(SANS_PUB);
      expect(await ids(undefined)).toEqual(SANS_PUB);
    });

    it("KoppaFoot+ actif : il se prolonge, et « Pas de pubs » n'est plus proposé", async () => {
      expect(await ids({ user_type: "manager" }, { pro: droitDate("2099-12-31") })).toEqual(["pro_mois", "pro_an"]);
    });

    it("un compte hors profil qui a déjà KoppaFoot+ n'a rien à acheter tant qu'il court", async () => {
      expect(await ids({ user_type: "player" }, { pro: droitDate("2099-12-31") })).toEqual([]);
    });

    it("le même, une fois KoppaFoot+ terminé, se voit proposer « Pas de pubs »", async () => {
      expect(await ids({ user_type: "player" }, { pro: droitDate("2026-01-31") })).toEqual(["sans_pub_mois", "sans_pub_an"]);
    });

    it("un droit sans échéance ne se prolonge pas", async () => {
      expect(await ids({ user_type: "manager" }, { pro: droitDate(null) })).toEqual([]);
      expect(await ids({ user_type: "manager" }, { sans_pub: droitDate(null) })).toEqual(["pro_mois", "pro_an"]);
    });

    it("« Pas de pubs » en cours se prolonge", async () => {
      expect(await ids({ user_type: "player" }, { sans_pub: droitDate("2099-12-31") })).toEqual(["sans_pub_mois", "sans_pub_an"]);
    });

    it("une offre sans prix ne se montre pas", async () => {
      mockBase.set("settings/offre", { prix: { pro_mois: 1500 } });
      expect(await ids({ user_type: "player" })).toEqual([]);
      expect(await ids({ user_type: "manager" })).toEqual(["pro_mois"]);
    });
  });
});
```

**d.** Suite des rappels : renommer `describe("rappelerEcheancesPro"` en `describe("rappelerEcheances"`, remplacer chaque appel `rappelerEcheancesPro(` par `rappelerEcheances(`, la ligne des prix de son `beforeEach` par `mockBase.set("settings/offre", { prix: { pro_mois: 1500, sans_pub_mois: 300 } });`, les deux titres attendus par `"demain : Ton KoppaFoot+ se termine demain"` et `"semaine : Ton KoppaFoot+ se termine dans 7 jours"`, et le titre attendu par le troisième test par `"semaine : Ton KoppaFoot+ se termine demain"`. Puis ajouter à la fin de la suite :

```ts
  describe("« Pas de pubs »", () => {
    const sansPubJusquAu = (jusqu_au: string | null, p: Doc = {}) => ({ sans_pub: droitDate(jusqu_au), ...p });

    it("prévient aussi de sa fin, la veille et sept jours avant", async () => {
      mockBase.set("droits/joueur-demain", sansPubJusquAu("2026-11-06"));
      mockBase.set("droits/joueur-semaine", sansPubJusquAu("2026-11-12"));

      expect(await rappelerEcheances(AUJOURDHUI)).toBe(4);

      expect(titres().filter((t) => t.startsWith("joueur")).sort()).toEqual([
        "joueur-demain : Ton option Pas de pubs se termine demain",
        "joueur-semaine : Ton option Pas de pubs se termine dans 7 jours",
      ]);
    });

    it("ne prévient pas quand KoppaFoot+ court encore : la publicité ne revient pas", async () => {
      mockBase.set("droits/couvert", sansPubJusquAu("2026-11-06", { pro: droitDate("2027-06-30") }));
      expect(await rappelerEcheances(AUJOURDHUI)).toBe(2);
      expect(titres().some((t) => t.startsWith("couvert"))).toBe(false);
    });

    it("prévient quand KoppaFoot+ est fini et que seul « Pas de pubs » reste", async () => {
      mockBase.set("droits/seul", sansPubJusquAu("2026-11-06", { pro: droitDate("2026-09-30") }));
      await rappelerEcheances(AUJOURDHUI);
      expect(titres()).toContain("seul : Ton option Pas de pubs se termine demain");
    });

    it("ne sonne pas deux fois le même jour", async () => {
      mockBase.set("droits/joueur-demain", sansPubJusquAu("2026-11-06"));
      await rappelerEcheances(AUJOURDHUI);
      expect(await rappelerEcheances(AUJOURDHUI)).toBe(0);
    });

    it("ne rappelle que l'offre qui est en vente", async () => {
      mockBase.set("droits/joueur-demain", sansPubJusquAu("2026-11-06"));
      mockBase.set("settings/offre", { prix: { pro_mois: 1500 } });
      expect(await rappelerEcheances(AUJOURDHUI)).toBe(2);
      expect(titres().some((t) => t.startsWith("joueur"))).toBe(false);
    });
  });
```

**e.** Suite `reglerPaiement` : ajouter à la fin :

```ts
  describe("un achat « Pas de pubs »", () => {
    const poserSansPub = (p: Partial<FirestorePaiement> = {}) =>
      poserLigne({ formule: "sans_pub_mois", droit: "sans_pub", montant: 300, ...p });
    const payee = () => mockFedapay.lireCollecte.mockResolvedValue(collecte("approved", { montant: 300 }));

    it("accorde le droit sans pub, et pas KoppaFoot+", async () => {
      poserSansPub();
      payee();

      expect(await reglerPaiement(ID)).toMatchObject({ statut: "paye", jusquAu: ajouterMois(JOUR, 1) });

      expect(sansPub()).toMatchObject({ depuis: JOUR, jusqu_au: ajouterMois(JOUR, 1), source: "paiement" });
      expect(sansPub()?.motif).toContain("Pas de pubs");
      expect(pro()).toBeNull();
      expect(mockNotifier.mock.calls[0][1]).toMatchObject({ type: "offre", link: "/offre" });
      expect((mockNotifier.mock.calls[0][1] as { body: string }).body).toContain("publicité");
    });

    it("se prolonge à partir de sa fin en cours", async () => {
      mockBase.set(`droits/${UID}`, { sans_pub: droitDate("2099-03-15") });
      poserSansPub();
      payee();

      await reglerPaiement(ID);

      expect(sansPub()).toMatchObject({ jusqu_au: "2099-04-15" });
      expect(ligne()).toMatchObject({ echeance_avant: "2099-03-15", echeance_apres: "2099-04-15" });
    });

    it("réglé deux fois, n'accorde qu'une fois", async () => {
      poserSansPub();
      payee();

      await reglerPaiement(ID);
      await reglerPaiement(ID);

      expect(sansPub()).toMatchObject({ jusqu_au: ajouterMois(JOUR, 1) });
      expect(mockNotifier).toHaveBeenCalledTimes(1);
    });

    it("ne touche pas à un KoppaFoot+ que le compte a par ailleurs", async () => {
      mockBase.set(`droits/${UID}`, { pro: droitDate("2099-12-31") });
      poserSansPub();
      payee();

      await reglerPaiement(ID);

      expect(pro()).toMatchObject({ jusqu_au: "2099-12-31" });
      expect(sansPub()).toMatchObject({ jusqu_au: ajouterMois(JOUR, 1) });
    });
  });

  it("accorde KoppaFoot+ même si le compte a perdu son titre entre le clic et le paiement : l'argent est reçu", async () => {
    mockBase.set(`users/${UID}`, { first_name: "Ama", user_type: "player" });
    poserLigne();
    mockFedapay.lireCollecte.mockResolvedValue(collecte("approved"));

    expect(await reglerPaiement(ID)).toMatchObject({ statut: "paye" });

    expect(pro()).toMatchObject({ jusqu_au: ajouterMois(JOUR, 1), source: "paiement" });
  });
```

- [ ] **Step 2: Lancer, constater l'échec**

Run: `(cd mobile && npx jest src/__tests__/paiement-serveur.test.ts)`
Expected: FAIL. Notamment : `rappelerEcheances is not a function` ; KoppaFoot+ vendu à un joueur ; « Pas de pubs » accordant le droit `pro`.

- [ ] **Step 3: Proposer et refuser**

Dans `src/lib/paiement-serveur.ts` :

- imports : à celui de `@/lib/offre`, ajouter `aDroitAKoppaFootPlus`, `estPro`, `titresDuProfil`, `type DroitOffre` ; à celui de `@/lib/paiement`, ajouter `NOM_OFFRE`.

- remplacer `formulesPour` et son commentaire par :

```ts
/**
 * Les formules que CE compte peut acheter.
 *
 * Aucune sans clé FedaPay, et en bac à sable seulement pour un superadmin.
 * Ensuite, l'offre suit le profil (lib/offre) :
 *  - KoppaFoot+ : aux managers, organisateurs et propriétaires de terrain ;
 *  - « Pas de pubs » : à tout le monde, sauf tant que KoppaFoot+ court, qui
 *    retire déjà la publicité. On ne vend pas deux fois la même chose.
 * Un droit sans échéance n'a rien à prolonger : sa formule ne se montre pas.
 */
export async function formulesPour(
  profil: Record<string, unknown> | undefined,
  droits: Pick<FirestoreDroits, "pro" | "sans_pub"> | null = null,
): Promise<FormuleEnVente[]> {
  if (!fedapayConfigure()) return [];
  if (environnementFedapay() !== "live" && !estSuperadmin(profil)) return [];

  const jour = jourDeLome();
  const plus = aDroitAKoppaFootPlus(titresDuProfil(profil));
  const plusActif = estPro(droits, jour);
  return formulesEnVente(await lirePrixOffre()).filter((f) => {
    const actuel = droits?.[f.droit];
    if (droitActif(actuel, jour) && actuel?.jusqu_au === null) return false;
    return f.droit === "pro" ? plus : !plusActif;
  });
}
```

- étendre `RefusPaiement` :

```ts
export type RefusPaiement =
  | "formule" | "non_configure" | "bac_a_sable" | "pas_en_vente" | "deja_illimite" | "trop_de_tentatives" | "fedapay"
  | "reservation" | "deja_paye" | "trop_tard" | "telephone"
  | "profil" | "deja_compris";
```

- remplacer `demarrerPaiement` et son commentaire par :

```ts
/**
 * Démarre l'achat d'une formule : KoppaFoot+ ou « Pas de pubs ». `origine` :
 * d'où vient la requête, pour le retour en bac à sable (en réel, toujours le
 * site).
 *
 * L'OFFRE D'UN PROFIL SE DÉCIDE ICI, pas à l'écran. La page ne montre que les
 * formules du compte (`formulesPour`) ; un appel direct est refusé de même.
 */
export async function demarrerPaiement(uid: string, formule: unknown, origine: string): Promise<{ id: string; url: string }> {
  if (!estFormule(formule)) throw new ErreurPaiement("formule", "Formule inconnue.");
  const { droit, mois } = FORMULES[formule];
  const { profil, environnement } = await verifierAcces(uid, `${NOM_OFFRE[droit]} n'est pas encore en vente.`);

  if (droit === "pro" && !aDroitAKoppaFootPlus(titresDuProfil(profil))) {
    throw new ErreurPaiement("profil", "KoppaFoot+ est réservé aux managers, organisateurs et propriétaires de terrain.");
  }

  const prix = (await lirePrixOffre())[formule];
  if (!prixValide(prix)) throw new ErreurPaiement("pas_en_vente", "Cette formule n'est pas en vente.");

  const jour = jourDeLome();
  const droits = (await adminDb.collection("droits").doc(uid).get()).data() as FirestoreDroits | undefined;
  if (droit === "sans_pub" && estPro(droits, jour)) {
    throw new ErreurPaiement("deja_compris", "Ton KoppaFoot+ retire déjà la publicité.");
  }
  if (nouvelleEcheance(droits?.[droit], jour, mois) === null) {
    throw new ErreurPaiement("deja_illimite", `${NOM_OFFRE[droit]} est déjà à toi sans échéance : il n'y a rien à prolonger.`);
  }
  await verifierTentatives(uid);

  const base = environnement === "live" ? APP_URL : origine;
  return ouvrirCollecte(
    // L'objet « pro » est l'achat d'une formule, quel que soit son droit.
    { uid, objet: "pro", formule, droit, montant: prix, environnement },
    libelleFormule(formule),
    (id) => `${base}/offre?paiement=${id}`,
    profil,
  );
}
```

- [ ] **Step 4: Accorder le droit de la formule**

Toujours dans `src/lib/paiement-serveur.ts` :

- `EtatPaiement` et `vueEtat` : ajouter le droit.

```ts
/** Ce que le titulaire apprend de son paiement. */
export interface EtatPaiement {
  statut: StatutPaiement;
  /** `null` : le paiement n'achète pas une formule (les frais de réservation d'un terrain). */
  formule: IdFormule | null;
  /** Ce que la formule accorde ; `null` de même. */
  droit: DroitOffre | null;
  montant: number;
  /** L'échéance du droit acheté après ce paiement ; `null` tant qu'il n'est pas réglé. */
  jusquAu: string | null;
  /** Un écart entre la ligne et la collecte : l'administration doit regarder. */
  aVerifier: boolean;
}

export function vueEtat(ligne: FirestorePaiement): EtatPaiement {
  return {
    statut: ligne.statut,
    formule: ligne.formule,
    droit: ligne.droit,
    montant: ligne.montant,
    jusquAu: ligne.echeance_apres,
    aVerifier: ligne.anomalie !== null,
  };
}
```

- remplacer `accuserReception` par :

```ts
/** Ce qu'on dit à qui vient de payer, selon ce qu'il a acheté. */
const ACCUSE: Record<DroitOffre, (date: string) => string> = {
  pro: (date) => `Tu as KoppaFoot+ jusqu'au ${date}.`,
  sans_pub: (date) => `Plus de publicité jusqu'au ${date}.`,
};

async function accuserReception(
  ligne: FirestorePaiement,
  droit: DroitOffre,
  jusquAu: string,
  recuUrl: string | null,
): Promise<void> {
  const profil = (await adminDb.collection("users").doc(ligne.uid).get().catch(() => null))?.data() ?? {};
  const email = typeof profil.email === "string" ? profil.email : null;
  await Promise.allSettled([
    notifierCompte(ligne.uid, {
      type: "offre",
      title: "Paiement reçu",
      body: ACCUSE[droit](dateLongue(jusquAu)),
      link: "/offre",
    }),
    email
      ? sendNotificationEmail(email, `Ton reçu ${NOM_OFFRE[droit]}`, recuPaiementHtml({
          prenom: typeof profil.first_name === "string" ? profil.first_name : "",
          formule: ligne.formule ? libelleFormule(ligne.formule) : NOM_OFFRE[droit],
          droit,
          montant: ligne.montant,
          jusquAu: dateLongue(jusquAu),
          recuUrl,
        }))
      : null,
  ]);
}
```

- remplacer `effetPro` et son commentaire par :

```ts
/**
 * L'achat d'une formule : sa période s'ajoute à la fin en cours du droit
 * qu'elle accorde (lib/paiement, nouvelleEcheance).
 *
 * LE DROIT VIENT DE LA LIGNE, écrite au clic. On ne revérifie pas ici que le
 * compte y a encore droit : l'argent est reçu. Un manager devenu joueur entre
 * le clic et le paiement a son KoppaFoot+, limité à ce que son profil ouvre
 * (lib/offre) ; garder un paiement sans rien donner serait pire.
 */
const effetFormule: Effet = async (tx, ligne, c) => {
  // Une ligne d'avant les deux offres ne porte que `pro`.
  const droit: DroitOffre = ligne.droit ?? "pro";
  const droitsRef = adminDb.collection("droits").doc(ligne.uid);
  const actuel = ((await tx.get(droitsRef)).data() as FirestoreDroits | undefined)?.[droit] ?? null;
  const mois = ligne.formule ? FORMULES[ligne.formule].mois : 0;
  const suite = mois > 0 ? nouvelleEcheance(actuel, c.jour, mois) : null;
  if (!suite) {
    // Le même droit, sans échéance, a été accordé entre le clic et le
    // paiement : on ne l'écrase pas. La ligne est payée, sans échéance :
    // l'administration la voit « payée sans effet » et rembourse à la main.
    return { ecrire: () => {}, champs: { echeance_avant: null, echeance_apres: null }, apres: null };
  }
  const accorde: DroitAccorde = {
    depuis: suite.depuis,
    jusqu_au: suite.jusqu_au,
    source: "paiement",
    accorde_par: null,
    motif: motifAchat(droit, mois, c.environnement),
  };
  return {
    ecrire: () => tx.set(droitsRef, { [droit]: accorde, updated_at: FieldValue.serverTimestamp() }, { merge: true }),
    champs: {
      echeance_avant: actuel && droitActif(actuel, c.jour) ? actuel.jusqu_au : null,
      echeance_apres: suite.jusqu_au,
    },
    apres: () => accuserReception(ligne, droit, suite.jusqu_au, c.collecte.recuUrl),
  };
};
```

et `EFFETS` devient `export const EFFETS: Record<ObjetPaiement, Effet> = { pro: effetFormule, acompte: effetAcompte };`.

Dans `src/lib/email.ts`, `recuPaiementHtml` reçoit le droit :

- ajouter `droit: "pro" | "sans_pub";` à son paramètre, après `formule: string;` ;
- remplacer la phrase `Ton Pro court jusqu'au <strong>${echapper(p.jusquAu)}</strong> inclus.` par `${p.droit === "sans_pub" ? "La publicité est retirée" : "Ton KoppaFoot+ court"} jusqu'au <strong>${echapper(p.jusquAu)}</strong> inclus.` ;
- le bouton `ctaButton("Voir mon offre", …)` devient `ctaButton("Voir sur KoppaFoot", …)` : l'entrée « Mon offre » n'existe plus ;
- la première ligne de son commentaire, « Le reçu d'un achat du Pro », devient « Le reçu d'un achat, KoppaFoot+ ou « Pas de pubs » ».

- [ ] **Step 5: Rappeler la fin des deux droits**

Remplacer `rappelerEcheancesPro` et son commentaire par :

```ts
const RAPPEL: Record<DroitOffre, { marque: string; nom: string; corps: (date: string) => string }> = {
  pro: {
    marque: "rappel_pro_le",
    nom: "Ton KoppaFoot+",
    corps: (date) => `KoppaFoot+ court jusqu'au ${date}. Tu peux le prolonger dès maintenant : la période s'ajoute à la fin.`,
  },
  sans_pub: {
    marque: "rappel_sans_pub_le",
    nom: "Ton option Pas de pubs",
    corps: (date) => `La publicité reste retirée jusqu'au ${date}. Tu peux prolonger dès maintenant : la période s'ajoute à la fin.`,
  },
};

/**
 * Prévient de la fin d'un droit acheté, sept jours avant et la veille. Rend le
 * nombre de rappels envoyés.
 *
 * SEULEMENT EN RÉEL, et seulement pour une offre en vente : un rappel qui ne
 * mène à rien à prolonger n'apprend qu'à ignorer les notifications. Chaque
 * droit a sa marque du jour : la tâche rejouée ne sonne pas deux fois.
 *
 * « PAS DE PUBS » NE SE RAPPELLE PAS SOUS KOPPAFOOT+ : tant qu'il court, la
 * publicité ne revient pas, il n'y a rien à annoncer.
 */
export async function rappelerEcheances(jour: string = jourDeLome()): Promise<number> {
  if (!fedapayConfigure() || environnementFedapay() !== "live") return 0;
  const enVente = new Set(formulesEnVente(await lirePrixOffre()).map((f) => f.droit));

  const { demain, dansSeptJours } = joursDeRappel(jour);
  let rappels = 0;
  for (const droit of ["pro", "sans_pub"] as const) {
    if (!enVente.has(droit)) continue;
    const { marque, nom, corps } = RAPPEL[droit];
    const snap = await adminDb.collection("droits").where(`${droit}.jusqu_au`, "in", [demain, dansSeptJours]).get();
    for (const d of snap.docs) {
      const droits = d.data() as FirestoreDroits;
      const fin = droits[droit]?.jusqu_au;
      if (!fin || d.get(marque) === jour) continue;
      if (droit === "sans_pub" && estPro(droits, jour)) continue;
      await notifierCompte(d.id, {
        type: "offre",
        title: `${nom} se termine ${fin === demain ? "demain" : "dans 7 jours"}`,
        body: corps(dateLongue(fin)),
        link: "/offre",
      });
      await d.ref.update({ [marque]: jour });
      rappels += 1;
    }
  }
  return rappels;
}
```

Dans `src/app/api/cron/scoreur-manquant/route.ts` : `rappelerEcheancesPro` devient `rappelerEcheances` à l'import et à l'appel ; la variable et la clé de réponse `echeancesPro` deviennent `echeances` ; le message d'erreur « échéances Pro: » devient « échéances: » ; dans le commentaire, « ne reste pas sans son Pro plus d'une nuit. Et elle prévient de la fin d'un Pro » devient « ne reste pas sans ce qu'il a acheté plus d'une nuit. Et elle prévient de la fin de KoppaFoot+ ou de « Pas de pubs » ». **Ne pas appeler cette route pour la vérifier** : elle notifie de vrais comptes.

Dans `src/app/api/paiements/route.ts`, ajouter à `STATUT` : `profil: 403,` et `deja_compris: 409,`.

- [ ] **Step 6: Lancer, constater le succès**

Run: `(cd mobile && npx jest src/__tests__/paiement-serveur.test.ts src/__tests__/reglement-serveur.test.ts)`
Expected: PASS pour les deux suites.

Run: `npx tsc --noEmit`
Expected: aucune erreur.

Run: `npx eslint src/lib/paiement-serveur.ts src/lib/paiement.ts src/lib/offre.ts src/lib/email.ts src/app/api/paiements src/app/api/cron/scoreur-manquant`
Expected: aucune erreur nouvelle.

- [ ] **Step 7: Commit**

```bash
git add src/lib/paiement-serveur.ts src/lib/email.ts src/app/api/paiements/route.ts src/app/api/cron/scoreur-manquant/route.ts mobile/src/__tests__/paiement-serveur.test.ts
git commit -m "feat(paiement): KoppaFoot+ pour qui gère, « Pas de pubs » pour tous

Le serveur ne propose à un compte que ses formules : KoppaFoot+ aux
managers, organisateurs et propriétaires de terrain, « Pas de pubs » à
tout le monde sauf sous KoppaFoot+, qui le comprend déjà. Un appel
direct est refusé de même. Un achat accorde le droit de sa formule, et
les rappels d'échéance couvrent les deux.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: KoppaFoot+ limité au titre, le club et l'équipe au manager

**Files:**
- Modify: `mobile/src/test-aides/faux-firestore.ts` (sous-collections, `count()`)
- Modify: `src/lib/offre-server.ts`, `src/lib/clubs-serveur.ts`
- Modify: `src/app/api/clubs/route.ts`, `src/app/api/teams/route.ts`
- Test: `mobile/src/__tests__/offre-serveur.test.ts`

**Interfaces:**
- Consumes: `titresDuProfil`, `koppaFootPlusLeve`, `type Avantage`, `type Titres` de `@/lib/offre` (tâche 1).
- Produces (de `@/lib/offre-server`) :
  - `lireTitres(uid: string): Promise<Titres>`
  - `estManager(uid: string): Promise<boolean>`
  - `plusLeve(uid: string, avantage: Avantage, jour?: string): Promise<boolean>` : le compte a KoppaFoot+ **et** le titre qui ouvre cet avantage.
  - `limiteDeCreation` et `limiteEquipesDeCompetition` : mêmes signatures, plafonds levés par titre.
- `GET /api/clubs` rend en plus `estManager: boolean`.

- [ ] **Step 1: Le faux Firestore apprend les sous-collections et `count()`**

`lib/offre-server` compte par `query.count().get()` et lit la sous-collection `competitions/{id}/comp_teams` ; le faux Firestore ne connaît ni l'un ni l'autre. Dans `mobile/src/test-aides/faux-firestore.ts`, remplacer tout ce qui va de `function ref(chemin: string) {` jusqu'à la propriété `collection` de `adminDb` comprise (la ligne `}),` qui précède `getAll`) par :

```ts
/** Le dernier segment d'un chemin : l'identifiant du document. */
const idDe = (chemin: string) => chemin.split("/").pop() ?? "";

function ref(chemin: string) {
  return {
    id: idDe(chemin),
    path: chemin,
    get: async () => snap(chemin),
    set: async (data: Doc, options?: { merge?: boolean }) => {
      base.set(chemin, options?.merge ? { ...(base.get(chemin) ?? {}), ...data } : { ...data });
    },
    update: async (data: Doc) => {
      if (!base.has(chemin)) throw new Error(`document absent : ${chemin}`);
      base.set(chemin, { ...base.get(chemin), ...data });
    },
    delete: async () => { base.delete(chemin); },
    // Une sous-collection : « competitions/{id}/comp_teams ».
    collection: (sous: string) => collectionDe(`${chemin}/${sous}`),
  };
}

function snap(chemin: string) {
  const data = base.get(chemin);
  return {
    exists: data !== undefined,
    id: idDe(chemin),
    ref: ref(chemin),
    data: () => (data ? { ...data } : undefined),
    get: (nom: string) => (data ? champ(data, nom) : undefined),
  };
}

type Filtre = [string, string, unknown];

function requete(collection: string, filtres: Filtre[]) {
  const prefixe = `${collection}/`;
  const lire = async () => {
    const docs = [...base.entries()]
      // Les documents de CETTE collection, pas ceux de ses sous-collections.
      .filter(([chemin]) => chemin.startsWith(prefixe) && !chemin.slice(prefixe.length).includes("/"))
      .filter(([, data]) => filtres.every(([nom, op, valeur]) => {
        const v = champ(data, nom);
        return op === "in" ? (valeur as unknown[]).includes(v) : v === valeur;
      }))
      .map(([chemin]) => snap(chemin));
    return { docs, empty: docs.length === 0, size: docs.length };
  };
  return {
    where: (nom: string, op: string, valeur: unknown) => requete(collection, [...filtres, [nom, op, valeur]]),
    limit: () => requete(collection, filtres),
    orderBy: () => requete(collection, filtres),
    // Le décompte côté serveur de Firestore : `query.count().get()`.
    count: () => ({
      get: async () => {
        const { size } = await lire();
        return { data: () => ({ count: size }) };
      },
    }),
    get: lire,
  };
}

function collectionDe(nom: string) {
  return {
    doc: (id?: string) => ref(`${nom}/${id ?? idNeuf()}`),
    ...requete(nom, []),
  };
}

export const adminDb = {
  collection: collectionDe,
```

Le reste de `adminDb` (`getAll`, `runTransaction`) et `vider` ne changent pas. Trois choses changent pour les suites existantes, sans effet sur elles : l'identifiant d'un document est le dernier segment de son chemin, une requête ne rend plus les documents des sous-collections, et `adminDb.collection(x)` gagne `limit` et `count`.

Ce bloc a été essayé à blanc avant d'écrire ce plan : mêmes 3 erreurs de types qu'avant, et les trois suites serveur vertes (104 tests).

Run: `(cd mobile && npx jest src/__tests__/paiement-serveur.test.ts src/__tests__/reglement-serveur.test.ts src/__tests__/versements-serveur.test.ts)`
Expected: PASS pour les trois suites : rien n'a changé pour elles.

Run: `(cd mobile && npx tsc --noEmit)`
Expected: les 3 erreurs préexistantes, aucune dans `test-aides`.

- [ ] **Step 2: Les tests**

Créer `mobile/src/__tests__/offre-serveur.test.ts` :

```ts
import { base, vider } from "../test-aides/faux-firestore";

// L'offre côté serveur (src/lib/offre-server), jouée contre le faux
// Firestore : c'est ici que tient « KoppaFoot+ n'agit que pour ce que le
// compte est ». Avoir le droit ne suffit plus : il faut le titre qui va avec.

type Doc = Record<string, unknown>;
type Limite = { code: string; cle: string; max: number } | null;

jest.mock("next/server", () => ({
  NextResponse: { json: (corps: unknown, init?: { status?: number }) => ({ corps, status: init?.status ?? 200 }) },
}));
jest.mock("@/lib/firebase-admin", () => ({ adminDb: require("../test-aides/faux-firestore").adminDb }));
jest.mock("@/lib/appelant", () => ({ uidAppelant: jest.fn() }));

// `require`, et non `import` : le module tire firebase-admin et next/server,
// dont la vérification de types de l'application mobile n'a pas les types.
const { limiteDeCreation, limiteEquipesDeCompetition, plusLeve, estManager } = require("@/lib/offre-server") as {
  limiteDeCreation: (uid: string, cle: "equipes" | "terrains" | "competitions") => Promise<Limite>;
  limiteEquipesDeCompetition: (cid: string, competition: Doc, ajout?: number) => Promise<Limite>;
  plusLeve: (uid: string, avantage: string, jour?: string) => Promise<boolean>;
  estManager: (uid: string) => Promise<boolean>;
};

const UID = "compte1";
/** Un KoppaFoot+ sans échéance : actif, quel que soit le jour où la suite tourne. */
const PLUS = { pro: { depuis: "2026-01-01", jusqu_au: null, source: "admin", accorde_par: "admin1", motif: null } };

const profil = (p: Doc) => base.set(`users/${UID}`, { first_name: "Ama", ...p });
const equipes = (n: number, manager = UID) => {
  for (let i = 0; i < n; i += 1) base.set(`teams/equipe${manager}${i}`, { name: `Équipe ${i}`, manager_id: manager });
};

beforeEach(() => {
  vider();
  // Les plafonds sont en vigueur depuis longtemps.
  base.set("settings/offre", { limites_depuis: "2026-01-01" });
});

describe("limiteDeCreation : le plafond d'équipes", () => {
  it("tient pour un manager sans KoppaFoot+", async () => {
    profil({ user_type: "manager" });
    equipes(2);
    expect(await limiteDeCreation(UID, "equipes")).toEqual({ code: "limite_offre", cle: "equipes", max: 2 });
  });

  it("laisse créer tant qu'on est sous le plafond", async () => {
    profil({ user_type: "manager" });
    equipes(1);
    expect(await limiteDeCreation(UID, "equipes")).toBeNull();
  });

  it("se lève pour un manager qui a KoppaFoot+", async () => {
    profil({ user_type: "manager" });
    base.set(`droits/${UID}`, PLUS);
    equipes(5);
    expect(await limiteDeCreation(UID, "equipes")).toBeNull();
  });

  it("ne se lève pas pour un joueur organisateur : son KoppaFoot+ ne couvre que ses compétitions", async () => {
    profil({ user_type: "player", is_organizer: true });
    base.set(`droits/${UID}`, PLUS);
    equipes(2);
    expect(await limiteDeCreation(UID, "equipes")).toEqual({ code: "limite_offre", cle: "equipes", max: 2 });
  });

  it("ne se lève pas pour un joueur qui a KoppaFoot+ sans aucun titre", async () => {
    profil({ user_type: "player" });
    base.set(`droits/${UID}`, PLUS);
    equipes(2);
    expect(await limiteDeCreation(UID, "equipes")).not.toBeNull();
  });

  it("ne tient pas avant l'entrée en vigueur des plafonds", async () => {
    base.set("settings/offre", { limites_depuis: "2099-01-01" });
    profil({ user_type: "manager" });
    equipes(9);
    expect(await limiteDeCreation(UID, "equipes")).toBeNull();
  });
});

describe("limiteDeCreation : chaque plafond a son titre", () => {
  const competitions = (n: number) => {
    for (let i = 0; i < n; i += 1) base.set(`competitions/comp${i}`, { created_by: UID, status: "active" });
  };

  it("le plafond de compétitions se lève pour un organisateur, pas pour un manager", async () => {
    base.set(`droits/${UID}`, PLUS);
    competitions(1);

    profil({ user_type: "player", is_organizer: true });
    expect(await limiteDeCreation(UID, "competitions")).toBeNull();

    profil({ user_type: "manager" });
    expect(await limiteDeCreation(UID, "competitions")).toEqual({ code: "limite_offre", cle: "competitions", max: 1 });
  });

  it("le plafond de terrains se lève pour un propriétaire, pas pour un manager", async () => {
    base.set(`droits/${UID}`, PLUS);
    base.set("venues/terrain1", { owner_id: UID });

    profil({ user_type: "user", is_venue_owner: true });
    expect(await limiteDeCreation(UID, "terrains")).toBeNull();

    profil({ user_type: "manager" });
    expect(await limiteDeCreation(UID, "terrains")).toEqual({ code: "limite_offre", cle: "terrains", max: 1 });
  });

  it("les titres se cumulent : un manager propriétaire a les deux", async () => {
    base.set(`droits/${UID}`, PLUS);
    profil({ user_type: "manager", is_venue_owner: true });
    equipes(4);
    base.set("venues/terrain1", { owner_id: UID });

    expect(await limiteDeCreation(UID, "equipes")).toBeNull();
    expect(await limiteDeCreation(UID, "terrains")).toBeNull();
  });
});

describe("limiteEquipesDeCompetition", () => {
  const COMPETITION = { organizer_ids: ["orga1"], created_at: "2026-06-01T10:00:00.000Z" };
  const inscrire = (n: number) => {
    for (let i = 0; i < n; i += 1) base.set(`competitions/coupe/comp_teams/equipe${i}`, { name: `Équipe ${i}` });
  };

  beforeEach(() => {
    base.set("competitions/coupe", COMPETITION);
    inscrire(16);
  });

  it("tient à 16 équipes sans KoppaFoot+", async () => {
    base.set("users/orga1", { is_organizer: true });
    expect(await limiteEquipesDeCompetition("coupe", COMPETITION)).toEqual({ code: "limite_offre", cle: "equipesParCompetition", max: 16 });
  });

  it("se lève quand un organisateur de la compétition a KoppaFoot+", async () => {
    base.set("users/orga1", { is_organizer: true });
    base.set("droits/orga1", PLUS);
    expect(await limiteEquipesDeCompetition("coupe", COMPETITION)).toBeNull();
  });

  it("ne se lève pas par le KoppaFoot+ de quelqu'un qui n'a pas la casquette", async () => {
    base.set("users/orga1", { user_type: "manager" });
    base.set("droits/orga1", PLUS);
    expect(await limiteEquipesDeCompetition("coupe", COMPETITION)).not.toBeNull();
  });

  it("ne compte que les équipes de cette compétition", async () => {
    base.set("users/orga1", { is_organizer: true });
    base.set("competitions/autre", COMPETITION);
    base.set("competitions/autre/comp_teams/x", { name: "X" });
    expect(await limiteEquipesDeCompetition("autre", COMPETITION)).toBeNull();
  });
});

describe("plusLeve : le Club multi-équipes", () => {
  it("s'ouvre à un manager qui a KoppaFoot+", async () => {
    profil({ user_type: "manager" });
    base.set(`droits/${UID}`, PLUS);
    expect(await plusLeve(UID, "club")).toBe(true);
  });

  it("reste fermé à un manager sans KoppaFoot+", async () => {
    profil({ user_type: "manager" });
    expect(await plusLeve(UID, "club")).toBe(false);
  });

  it("reste fermé à un joueur, à un organisateur, à un propriétaire qui ont KoppaFoot+", async () => {
    base.set(`droits/${UID}`, PLUS);
    for (const p of [{ user_type: "player" }, { user_type: "player", is_organizer: true }, { user_type: "user", is_venue_owner: true }]) {
      profil(p);
      expect(await plusLeve(UID, "club")).toBe(false);
    }
  });

  it("se referme quand KoppaFoot+ est terminé", async () => {
    profil({ user_type: "manager" });
    base.set(`droits/${UID}`, { pro: { ...PLUS.pro, jusqu_au: "2026-01-31" } });
    expect(await plusLeve(UID, "club", "2026-02-01")).toBe(false);
    expect(await plusLeve(UID, "club", "2026-01-31")).toBe(true);
  });
});

describe("estManager : qui peut créer une équipe", () => {
  it("un manager, par l'un ou l'autre champ", async () => {
    profil({ user_type: "manager" });
    expect(await estManager(UID)).toBe(true);
    profil({ user_type: "user", evolution_role: "manager" });
    expect(await estManager(UID)).toBe(true);
  });

  it("ni un joueur, ni un arbitre, ni un organisateur", async () => {
    for (const p of [{ user_type: "player" }, { user_type: "referee" }, { user_type: "player", is_organizer: true }]) {
      profil(p);
      expect(await estManager(UID)).toBe(false);
    }
  });

  it("ni un joueur membre du staff d'une équipe, ni un compte qui a une équipe à son nom sans le rôle", async () => {
    profil({ user_type: "player" });
    base.set("teams/equipe1", { manager_id: "quelqu-un-d-autre", staff_manager_ids: [UID] });
    expect(await estManager(UID)).toBe(false);
    equipes(1);
    expect(await estManager(UID)).toBe(false);
  });

  it("ni un compte sans profil", async () => {
    expect(await estManager("fantome")).toBe(false);
  });
});
```

Run: `(cd mobile && npx jest src/__tests__/offre-serveur.test.ts)`
Expected: FAIL, `plusLeve is not a function` (et, pour les plafonds, le joueur organisateur qui passe).

- [ ] **Step 3: Les plafonds par titre**

Dans `src/lib/offre-server.ts` :

- l'import de `@/lib/offre` devient :

```ts
import {
  CODE_LIMITE, LIMITES_GRATUIT, estPro, jourDeLome, koppaFootPlusLeve, limitesEnVigueur, messageLimite, titresDuProfil,
  type Avantage, type CleLimite, type FirestoreDroits, type LimiteAtteinte, type Titres,
} from "@/lib/offre";
```

- dans l'en-tête de commentaire, après le paragraphe « C'EST ICI QUE LES LIMITES TIENNENT… », ajouter :

```ts
// KOPPAFOOT+ NE LÈVE QUE CE QUE LE COMPTE EST. Avoir le droit ne suffit pas :
// il faut le titre qui va avec (lib/offre, koppaFootPlusLeve). Un joueur
// organisateur qui a KoppaFoot+ mène autant de compétitions qu'il veut, mais
// son plafond d'équipes tient. D'où `plusLeve`, que tout passe par lui.
```

- après `lireLimitesDepuis`, ajouter :

```ts
/** Ce que le compte est, pour l'offre : manager, organisateur, gérant. */
export async function lireTitres(uid: string): Promise<Titres> {
  return titresDuProfil((await adminDb.collection("users").doc(uid).get()).data());
}

/** Le compte a-t-il le rôle manager ? Le staff d'une équipe ne le donne pas. */
export async function estManager(uid: string): Promise<boolean> {
  return (await lireTitres(uid)).manager;
}

/** KoppaFoot+ lève-t-il cet avantage pour ce compte ? Il faut le droit ET le titre. */
export async function plusLeve(uid: string, avantage: Avantage, jour: string = jourDeLome()): Promise<boolean> {
  const [droits, titres] = await Promise.all([lireDroits(uid), lireTitres(uid)]);
  return estPro(droits, jour) && koppaFootPlusLeve(titres, avantage);
}
```

- dans `limiteDeCreation`, la ligne `if (estPro(await lireDroits(uid), jour)) return null;` devient `if (await plusLeve(uid, cle, jour)) return null;`.

- dans `limiteEquipesDeCompetition`, remplacer

```ts
  const droits = await Promise.all((competition.organizer_ids ?? []).map(lireDroits));
  if (droits.some((d) => estPro(d, jour))) return null;
```

par

```ts
  const leves = await Promise.all((competition.organizer_ids ?? []).map((o) => plusLeve(o, "equipesParCompetition", jour)));
  if (leves.some(Boolean)) return null;
```

et, dans son commentaire, « ni si l'un de ses organisateurs a le Pro » devient « ni si l'un de ses organisateurs a KoppaFoot+ avec la casquette ».

Run: `(cd mobile && npx jest src/__tests__/offre-serveur.test.ts)`
Expected: PASS.

- [ ] **Step 4: Le club et l'équipe**

Dans `src/lib/clubs-serveur.ts` : importer `plusLeve` de `@/lib/offre-server` et remplacer `estEveille` par :

```ts
/**
 * Le club vit-il ? Oui tant que son propriétaire est manager et a KoppaFoot+.
 * L'un sans l'autre, il s'endort : sa page ne s'affiche plus, rien n'est
 * effacé, il revit tel quel.
 */
export async function estEveille(club: Pick<FirestoreClub, "proprietaire_id">): Promise<boolean> {
  return plusLeve(club.proprietaire_id, "club");
}
```

Retirer de ce fichier les imports devenus inutiles (`estPro`, `jourDeLome`, `lireDroits`) s'ils ne servent plus ailleurs dedans : `npx tsc --noEmit` et eslint le diront.

Dans `src/app/api/clubs/route.ts` :

- importer `estManager` de `@/lib/offre-server` ;
- dans `POST`, remplacer le premier refus (le bloc `if (!estPro(await lireDroits(uid), jourDeLome())) { … }`) par :

```ts
    // Un club réunit les équipes d'un manager : ni KoppaFoot+ seul, ni le
    // rôle seul ne suffisent (lib/offre, « KoppaFoot+ n'agit que pour ce que
    // le compte est »).
    if (!(await estManager(uid))) {
      return NextResponse.json({ error: "Le Club multi-équipes réunit les équipes d'un manager." }, { status: 403 });
    }
    if (!estPro(await lireDroits(uid), jourDeLome())) {
      return NextResponse.json({ error: "Le Club multi-équipes fait partie de KoppaFoot+." }, { status: 403 });
    }
```

- dans `GET`, la réponse gagne `estManager: await estManager(uid),` juste après `estPro: …` ;
- dans le commentaire d'en-tête, « Créer un club demande KoppaFoot Pro » devient « Créer un club demande d'être manager et d'avoir KoppaFoot+ ».

Dans `src/app/api/teams/route.ts` :

- l'import de `@/lib/offre-server` devient `import { estManager, limiteDeCreation, reponseLimite, uidAppelant } from "@/lib/offre-server";` ;
- juste après le contrôle `if (!uid) return …401…`, ajouter :

```ts
    // Un joueur ne dirige pas d'équipe. Seul l'écran le vérifiait : cette
    // route acceptait n'importe quel compte.
    if (!(await estManager(uid))) {
      return NextResponse.json({ error: "Créer une équipe demande le rôle manager." }, { status: 403 });
    }
```

- dans le commentaire d'en-tête, après la première phrase, ajouter : `L'appelant doit avoir le rôle manager : c'est la règle « un joueur ne dirige pas d'équipe », tenue ici et plus seulement à l'écran.`

- [ ] **Step 5: Vérifier**

Run: `(cd mobile && npx jest)`
Expected: toutes les suites vertes.

Run: `npx tsc --noEmit`
Expected: aucune erreur.

Run: `npx eslint src/lib/offre-server.ts src/lib/clubs-serveur.ts src/app/api/clubs src/app/api/teams`
Expected: aucune erreur nouvelle.

Sur le serveur de dev, sans jeton :

Run: `curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/teams -H "Content-Type: application/json" -d '{"name":"x","city":"y"}'`
Expected: `401`

Run: `curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/clubs -H "Content-Type: application/json" -d '{"nom":"x"}'`
Expected: `401`

- [ ] **Step 6: Commit**

```bash
git add mobile/src/test-aides/faux-firestore.ts mobile/src/__tests__/offre-serveur.test.ts src/lib/offre-server.ts src/lib/clubs-serveur.ts src/app/api/clubs/route.ts src/app/api/teams/route.ts
git commit -m "feat(offre): KoppaFoot+ n'agit que pour ce que le compte est

Avoir le droit ne suffit plus : chaque plafond ne se lève que pour le
titre qui va avec. Un joueur organisateur mène ses compétitions sans
plafond, son plafond d'équipes tient. Le Club multi-équipes demande
d'être manager, pour le créer comme pour l'éveiller ; créer une équipe
aussi, côté serveur et plus seulement à l'écran.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: L'offre du profil, à l'écran

**Files:**
- Create: `src/lib/offre-ecran.ts`
- Test: `mobile/src/__tests__/offre-ecran.test.ts`
- Modify: `src/app/api/offre/route.ts`
- Modify: `src/app/(app)/offre/page.tsx`

**Interfaces:**
- Consumes: `titresDuProfil`, `aDroitAKoppaFootPlus`, `offreAffichee`, `koppaFootPlusLeve`, `type Titres` (tâche 1) ; `FormuleEnVente` avec son `droit` (tâche 2) ; `formulesPour(profil, droits)` et `EtatPaiement.droit` (tâche 3).
- Produces :
  - de `@/lib/offre-ecran` : `type EtatBloc = "actif" | "a_vendre" | "pas_en_vente"`, `interface EcranOffre`, `ecranOffre(o: { titres: Titres; plusActif: boolean; sansPubActif: boolean; formules: FormuleEnVente[] }): EcranOffre`.
  - `GET /api/offre` rend : `jour`, `estPro`, `estSansPub`, `pro`, `sansPub`, `limitesDepuis`, `limitesActives`, `limites`, `usage` (inchangés), `casquettes: Titres` (les titres du profil, et plus « a une équipe »), `plus: boolean`, `leve: Record<CleLimite, boolean>`, `formules: FormuleEnVente[]`. `proIllimite` disparaît : le serveur ne rend plus de formule pour un droit sans échéance.

- [ ] **Step 1: Les tests de l'écran**

Créer `mobile/src/__tests__/offre-ecran.test.ts` :

```ts
import { ecranOffre } from "@/lib/offre-ecran";
import type { FormuleEnVente } from "@/lib/paiement";

// Le module vit côté site (src/lib/offre-ecran) ; il est pur, et c'est ici
// que la suite de tests des modules partagés tourne. Il décide ce que la page
// de l'offre montre : la page elle-même ne fait que le dessiner.

const AUCUN = { manager: false, organisateur: false, gerant: false };
const MANAGER = { ...AUCUN, manager: true };
const PLUS_MOIS: FormuleEnVente = { id: "pro_mois", droit: "pro", mois: 1, prix: 500 };
const PLUS_AN: FormuleEnVente = { id: "pro_an", droit: "pro", mois: 12, prix: 5000 };
const SANS_PUB_MOIS: FormuleEnVente = { id: "sans_pub_mois", droit: "sans_pub", mois: 1, prix: 200 };

const ecran = (p: Partial<Parameters<typeof ecranOffre>[0]> = {}) =>
  ecranOffre({ titres: AUCUN, plusActif: false, sansPubActif: false, formules: [], ...p });

describe("ecranOffre : un compte qui ne gère rien", () => {
  it("ne voit que « Pas de pubs » : ni KoppaFoot+, ni plafonds, ni club", () => {
    expect(ecran({ formules: [SANS_PUB_MOIS] })).toEqual({
      titre: "sans_pub",
      plus: null,
      jauges: false,
      club: false,
      sansPub: { etat: "a_vendre", formules: [SANS_PUB_MOIS] },
    });
  });

  it("tant que « Pas de pubs » n'a pas de prix, la page le dit : pas en vente, aucune formule", () => {
    expect(ecran().sansPub).toEqual({ etat: "pas_en_vente", formules: [] });
  });

  it("« Pas de pubs » en cours : son état, et de quoi le prolonger", () => {
    expect(ecran({ sansPubActif: true, formules: [SANS_PUB_MOIS] }).sansPub).toEqual({ etat: "actif", formules: [SANS_PUB_MOIS] });
  });

  it("« Pas de pubs » sans échéance : son état, rien à vendre", () => {
    expect(ecran({ sansPubActif: true }).sansPub).toEqual({ etat: "actif", formules: [] });
  });

  it("avec un KoppaFoot+ d'avant la règle : son état et rien d'autre, tant qu'il court", () => {
    expect(ecran({ plusActif: true })).toEqual({
      titre: "sans_pub",
      plus: { etat: "actif", formules: [], horsProfil: true },
      jauges: false,
      club: false,
      sansPub: null,
    });
  });
});

describe("ecranOffre : un compte qui gère", () => {
  it("voit KoppaFoot+ d'abord, ses plafonds, puis « Pas de pubs »", () => {
    expect(ecran({ titres: MANAGER, formules: [PLUS_MOIS, PLUS_AN, SANS_PUB_MOIS] })).toEqual({
      titre: "pro",
      plus: { etat: "a_vendre", formules: [PLUS_MOIS, PLUS_AN], horsProfil: false },
      jauges: true,
      club: false,
      sansPub: { etat: "a_vendre", formules: [SANS_PUB_MOIS] },
    });
  });

  it("KoppaFoot+ sans prix : il se présente, sans rien à acheter", () => {
    expect(ecran({ titres: MANAGER, formules: [SANS_PUB_MOIS] }).plus).toEqual({ etat: "pas_en_vente", formules: [], horsProfil: false });
  });

  it("KoppaFoot+ actif : il se prolonge, et « Pas de pubs » disparaît", () => {
    const e = ecran({ titres: MANAGER, plusActif: true, formules: [PLUS_MOIS] });
    expect(e.plus).toEqual({ etat: "actif", formules: [PLUS_MOIS], horsProfil: false });
    expect(e.sansPub).toBeNull();
  });

  it("le club ne se propose qu'à un manager qui a KoppaFoot+", () => {
    expect(ecran({ titres: MANAGER, plusActif: true }).club).toBe(true);
    expect(ecran({ titres: MANAGER }).club).toBe(false);
    expect(ecran({ titres: { ...AUCUN, organisateur: true }, plusActif: true }).club).toBe(false);
    expect(ecran({ titres: { ...AUCUN, gerant: true }, plusActif: true }).club).toBe(false);
  });

  it("un organisateur et un propriétaire ont le titre KOPPAFOOT+ et leurs plafonds", () => {
    for (const titres of [{ ...AUCUN, organisateur: true }, { ...AUCUN, gerant: true }]) {
      expect(ecran({ titres })).toMatchObject({ titre: "pro", jauges: true });
    }
  });
});
```

- [ ] **Step 2: Lancer, constater l'échec**

Run: `(cd mobile && npx jest src/__tests__/offre-ecran.test.ts)`
Expected: FAIL, `Cannot find module '@/lib/offre-ecran'`.

- [ ] **Step 3: Écrire la décision**

Créer `src/lib/offre-ecran.ts` :

```ts
import { aDroitAKoppaFootPlus, offreAffichee, type DroitOffre, type Titres } from "@/lib/offre";
import type { FormuleEnVente } from "@/lib/paiement";

// ============================================
// Ce que la page de l'offre montre, décidé hors de l'écran.
//
// CHAQUE PROFIL NE VOIT QUE CE QUI LUI SERT. Qui gère voit KoppaFoot+, ses
// plafonds, puis « Pas de pubs » ; les autres ne voient que « Pas de pubs ».
// La page a une demi-douzaine de cas (en vente ou non, actif ou non, avec ou
// sans titre) : ils se décident ici, d'après ce que /api/offre rend, pour
// pouvoir être testés un par un. La page ne fait que les dessiner.
//
// Module pur : aucun SDK, aucun composant.
// ============================================

/** Où en est une offre pour ce compte : en cours, à vendre, ou sans prix pour l'instant. */
export type EtatBloc = "actif" | "a_vendre" | "pas_en_vente";

export interface EcranOffre {
  /** Le nom de la page, le même que l'entrée de menu (lib/offre, offreAffichee). */
  titre: DroitOffre;
  /**
   * Le bloc KoppaFoot+. `null` : le compte n'y a pas droit et ne l'a pas.
   * `horsProfil` : il l'a sans y avoir droit (accordé avant la règle, ou à la
   * main) ; il ne lui retire que la publicité.
   */
  plus: { etat: EtatBloc; formules: FormuleEnVente[]; horsProfil: boolean } | null;
  /** Les plafonds et ce que le compte utilise : seulement pour qui gère quelque chose. */
  jauges: boolean;
  /** Le lien vers le Club multi-équipes : à un manager qui a KoppaFoot+. */
  club: boolean;
  /** Le bloc « Pas de pubs ». `null` tant que KoppaFoot+ court : il le comprend déjà. */
  sansPub: { etat: EtatBloc; formules: FormuleEnVente[] } | null;
}

export function ecranOffre(o: {
  titres: Titres;
  plusActif: boolean;
  sansPubActif: boolean;
  /** Ce que le compte peut acheter (lib/paiement-serveur, formulesPour). */
  formules: FormuleEnVente[];
}): EcranOffre {
  const eligible = aDroitAKoppaFootPlus(o.titres);
  const bloc = (droit: DroitOffre, actif: boolean) => {
    const formules = o.formules.filter((f) => f.droit === droit);
    const etat: EtatBloc = actif ? "actif" : formules.length > 0 ? "a_vendre" : "pas_en_vente";
    return { etat, formules };
  };
  return {
    titre: offreAffichee(o.titres),
    plus: eligible || o.plusActif ? { ...bloc("pro", o.plusActif), horsProfil: !eligible } : null,
    jauges: eligible,
    club: o.plusActif && o.titres.manager,
    sansPub: o.plusActif ? null : bloc("sans_pub", o.sansPubActif),
  };
}
```

Run: `(cd mobile && npx jest src/__tests__/offre-ecran.test.ts)`
Expected: PASS.

- [ ] **Step 4: La route rend l'offre du profil**

Remplacer le contenu de `src/app/api/offre/route.ts` par :

```ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  LIMITES_GRATUIT, aDroitAKoppaFootPlus, droitActif, estPro, estSansPub, jourDeLome, koppaFootPlusLeve, limitesEnVigueur,
  titresDuProfil, type CleLimite, type DroitAccorde,
} from "@/lib/offre";
import { compterUsage, lireDroits, lireLimitesDepuis, uidAppelant } from "@/lib/offre-server";
import { formulesPour } from "@/lib/paiement-serveur";

/**
 * GET /api/offre, ce que la page de l'offre affiche : KoppaFoot+ et « Pas de
 * pubs » (actifs ou non, jusqu'à quand), les limites de l'offre gratuite,
 * leur date d'entrée en vigueur, et ce que le compte utilise déjà.
 *
 * TOUT PART DE CE QUE LE COMPTE EST (lib/offre, titresDuProfil). `casquettes`
 * dit ses titres, `plus` si KoppaFoot+ lui est proposé, `leve` les plafonds
 * que son KoppaFoot+ lève aujourd'hui. Un joueur qui ne gère rien n'a ni
 * compteur ni KoppaFoot+ à lire.
 *
 * `formules` : ce que CE compte peut acheter, avec le prix et le droit
 * accordé. Vide tant que rien n'est en vente, et, en bac à sable, pour tout
 * autre qu'un superadmin.
 */

export const dynamic = "force-dynamic";

const vue = (d: DroitAccorde | null | undefined, jour: string) =>
  d ? { actif: droitActif(d, jour), depuis: d.depuis, jusquAu: d.jusqu_au, source: d.source } : null;

export async function GET(req: Request) {
  const uid = await uidAppelant(req);
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    const jour = jourDeLome();
    const [droits, limitesDepuis, usage, profil] = await Promise.all([
      lireDroits(uid),
      lireLimitesDepuis(),
      compterUsage(uid),
      adminDb.collection("users").doc(uid).get().then((s) => s.data() ?? {}),
    ]);
    const pro = estPro(droits, jour);
    const titres = titresDuProfil(profil);
    const leve = Object.fromEntries(
      (Object.keys(LIMITES_GRATUIT) as CleLimite[]).map((cle) => [cle, pro && koppaFootPlusLeve(titres, cle)]),
    ) as Record<CleLimite, boolean>;
    return NextResponse.json({
      jour,
      estPro: pro,
      estSansPub: estSansPub(droits, jour),
      pro: vue(droits?.pro, jour),
      sansPub: vue(droits?.sans_pub, jour),
      limitesDepuis,
      limitesActives: limitesEnVigueur(limitesDepuis, jour),
      limites: LIMITES_GRATUIT,
      usage,
      casquettes: titres,
      plus: aDroitAKoppaFootPlus(titres),
      leve,
      formules: await formulesPour(profil, droits),
    });
  } catch (err) {
    console.error("GET /api/offre:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
```

- [ ] **Step 5: La page, ses données et ses textes**

Dans `src/app/(app)/offre/page.tsx` :

**a.** Les imports de `@/lib/offre` et suivants deviennent :

```ts
import type { CleLimite, DroitOffre } from "@/lib/offre";
import { ecranOffre } from "@/lib/offre-ecran";
import { idPaiementDuRetour, type FormuleEnVente, type IdFormule, type StatutPaiement } from "@/lib/paiement";
```

**b.** Le commentaire d'en-tête (de `// Mon offre.` jusqu'au paragraphe « LE PRO S'ACHÈTE ICI » compris) devient, le paragraphe « AU RETOUR DU PAIEMENT » restant tel quel :

```ts
// L'offre du compte : KOPPAFOOT+ ou « Pas de pubs ».
//
// CHAQUE PROFIL NE VOIT QUE CE QUI LUI SERT. Qui gère des équipes, des
// compétitions ou des terrains voit KoppaFoot+ (son état, ses formules, les
// plafonds que SON profil lève), puis « Pas de pubs » en dessous. Les autres
// ne voient que « Pas de pubs » : ni plafonds, ni club. Ce qui se montre se
// décide dans lib/offre-ecran, d'après ce que /api/offre rend.
//
// « PAS DE PUBS » NE SE MONTRE PAS SOUS KOPPAFOOT+ : il le comprend déjà.
//
// TOUT S'ACHÈTE ICI, quand c'est en vente : une formule, un prix, un bouton
// qui mène à la page de paiement FedaPay. Tant qu'une offre n'a pas de prix,
// la page le dit.
```

**c.** L'interface `Offre` et le type `Retour` deviennent :

```ts
interface Offre {
  jour: string;
  estPro: boolean;
  estSansPub: boolean;
  pro: VueDroit | null;
  sansPub: VueDroit | null;
  limitesDepuis: string | null;
  limitesActives: boolean;
  limites: Record<CleLimite, number>;
  usage: Record<"equipes" | "terrains" | "competitions", number>;
  /** Ce que le compte est : manager, organisateur, propriétaire de terrain. */
  casquettes: { manager: boolean; organisateur: boolean; gerant: boolean };
  /** KoppaFoot+ lui est-il proposé ? */
  plus: boolean;
  /** Les plafonds que SON KoppaFoot+ lève aujourd'hui. */
  leve: Record<CleLimite, boolean>;
  formules: FormuleEnVente[];
}

/** Où en est le paiement dont on revient. `aucun` : l'identifiant ne nous dit rien. */
type Retour =
  | { etat: "recu"; droit: DroitOffre | null; jusquAu: string | null }
  | { etat: "echec" | "lent" | "verifier" | "aucun" };
```

**d.** Le dictionnaire `T` devient, en entier :

```ts
const T = textes(
  {
    titrePlus: "KOPPAFOOT+",
    titreSansPub: "Pas de pubs",
    sousTitre: "Jouer, suivre un match, s'inscrire à une compétition, arbitrer : c'est gratuit et ça le reste.",
    gratuit: "Offre gratuite",
    plus: "KoppaFoot+",
    jusquAu: (date: string) => `jusqu'au ${date}`,
    sansEcheance: "sans échéance",
    plusActif: "Les plafonds de ce que tu gères sont levés, et la publicité est retirée.",
    plusHorsProfil: "Il retire la publicité. Le reste de KoppaFoot+ sert à qui gère des équipes, des compétitions ou des terrains.",
    pasEncore: "Les limites de l'offre gratuite ne s'appliquent pas encore. Tu seras prévenu avant.",
    aPartirDu: (date: string) => `À partir du ${date}, l'offre gratuite comptera ce qui suit.`,
    depuis: (date: string) => `En vigueur depuis le ${date}.`,
    garde: "Ce que tu as déjà créé reste à toi, même au-delà : une limite empêche seulement de créer plus.",
    chezToi: "Chez toi",
    equipes: "Équipes que tu gères",
    terrains: "Terrains référencés",
    competitions: "Compétitions en cours",
    competitionsDetail: "brouillons compris",
    tailleComp: "Équipes par compétition",
    illimite: "illimité",
    plusDebloque: "Ce que KoppaFoot+ débloque pour toi",
    avantageClub: "Club multi-équipes : réunis tes équipes sous un même club, avec sa page et son encadrement",
    avantageEquipes: "Équipes illimitées",
    avantageCompetitions: "Compétitions en cours illimitées, et plus de 16 équipes par compétition",
    avantageTerrains: "Terrains illimités",
    avantagePub: "Aucune publicité",
    gererClub: "Gérer mon Club multi-équipes",
    plusPasEnVente: "KoppaFoot+ n'est pas encore en vente. Pour l'essayer avec ton équipe, ta compétition ou ton terrain, écris-nous.",
    ecrire: "Nous écrire",
    erreur: "Impossible de charger ton offre.",
    prolongerPlus: "Prolonger KoppaFoot+",
    prolongerDetail: "La période achetée s'ajoute à la fin de celle en cours.",
    sansPub: "Pas de pubs",
    sansPubDetail: "Retire les emplacements des partenaires et les annonces, partout dans l'application. Rien d'autre ne change.",
    sansPubActif: (fin: string) => `La publicité est retirée, ${fin}.`,
    sansPubPasEnVente: "« Pas de pubs » n'est pas encore en vente.",
    unMois: "1 mois",
    unAn: "1 an",
    parMois: (montant: string) => `soit ${montant} FCFA par mois`,
    payer: "Payer",
    redirection: "Redirection…",
    moyens: "Mobile money ou carte, sur la page de paiement sécurisée de FedaPay. Tu achètes une période : rien ne se renouvelle tout seul.",
    retourAttente: "Paiement en cours de confirmation…",
    retourRecu: (date: string) => `Paiement reçu. Tu as KoppaFoot+ jusqu'au ${date}.`,
    retourRecuSansPub: (date: string) => `Paiement reçu. Plus de publicité jusqu'au ${date}.`,
    retourRecuSimple: "Paiement reçu.",
    retourEchec: "Le paiement n'a pas abouti. Tu peux réessayer.",
    retourLent: "La confirmation tarde. Ton achat s'activera tout seul dès qu'elle arrive : tu peux fermer cette page.",
    retourVerifier: "Ce paiement demande une vérification de notre part. Écris-nous, on règle ça.",
    refusPasEnVente: "Cette formule n'est pas en vente pour l'instant.",
    refusIllimite: "Tu l'as déjà sans échéance : il n'y a rien à prolonger.",
    refusProfil: "KoppaFoot+ est réservé aux managers, organisateurs et propriétaires de terrain.",
    refusDejaCompris: "Ton KoppaFoot+ retire déjà la publicité.",
    refusTentatives: "Trop de tentatives. Réessaie dans une heure.",
    refusIndisponible: "Paiement indisponible pour l'instant. Réessaie dans un moment.",
  },
  {
    titrePlus: "KOPPAFOOT+",
    titreSansPub: "No ads",
    sousTitre: "Playing, following a match, entering a competition, refereeing: it's free and it stays free.",
    gratuit: "Free plan",
    plus: "KoppaFoot+",
    jusquAu: (date: string) => `until ${date}`,
    sansEcheance: "no end date",
    plusActif: "The limits on what you manage are lifted, and ads are removed.",
    plusHorsProfil: "It removes ads. The rest of KoppaFoot+ is for those who manage teams, competitions or venues.",
    pasEncore: "The free plan's limits don't apply yet. You'll be told beforehand.",
    aPartirDu: (date: string) => `From ${date}, the free plan will count the following.`,
    depuis: (date: string) => `In force since ${date}.`,
    garde: "What you've already created stays yours, even beyond: a limit only stops you creating more.",
    chezToi: "Your usage",
    equipes: "Teams you manage",
    terrains: "Listed venues",
    competitions: "Running competitions",
    competitionsDetail: "drafts included",
    tailleComp: "Teams per competition",
    illimite: "unlimited",
    plusDebloque: "What KoppaFoot+ unlocks for you",
    avantageClub: "Multi-team club: bring your teams together under one club, with its page and staff",
    avantageEquipes: "Unlimited teams",
    avantageCompetitions: "Unlimited running competitions, and more than 16 teams per competition",
    avantageTerrains: "Unlimited venues",
    avantagePub: "No ads",
    gererClub: "Manage my multi-team club",
    plusPasEnVente: "KoppaFoot+ isn't on sale yet. To try it with your team, competition or venue, write to us.",
    ecrire: "Write to us",
    erreur: "Couldn't load your plan.",
    prolongerPlus: "Extend KoppaFoot+",
    prolongerDetail: "The period you buy is added to the end of the current one.",
    sansPub: "No ads",
    sansPubDetail: "Removes partner slots and announcements, everywhere in the app. Nothing else changes.",
    sansPubActif: (fin: string) => `Ads are removed, ${fin}.`,
    sansPubPasEnVente: "\"No ads\" isn't on sale yet.",
    unMois: "1 month",
    unAn: "1 year",
    parMois: (montant: string) => `that's ${montant} FCFA a month`,
    payer: "Pay",
    redirection: "Redirecting…",
    moyens: "Mobile money or card, on FedaPay's secure payment page. You buy a period: nothing renews by itself.",
    retourAttente: "Confirming your payment…",
    retourRecu: (date: string) => `Payment received. You have KoppaFoot+ until ${date}.`,
    retourRecuSansPub: (date: string) => `Payment received. No more ads until ${date}.`,
    retourRecuSimple: "Payment received.",
    retourEchec: "The payment didn't go through. You can try again.",
    retourLent: "Confirmation is taking a while. Your purchase will switch on by itself when it arrives: you can close this page.",
    retourVerifier: "This payment needs a check on our side. Write to us and we'll sort it out.",
    refusPasEnVente: "This plan isn't on sale right now.",
    refusIllimite: "You already have it with no end date: there's nothing to extend.",
    refusProfil: "KoppaFoot+ is for managers, organisers and venue owners.",
    refusDejaCompris: "Your KoppaFoot+ already removes ads.",
    refusTentatives: "Too many attempts. Try again in an hour.",
    refusIndisponible: "Payment is unavailable right now. Try again in a moment.",
  },
);
```

**e.** Dans l'effet qui vérifie le paiement au retour, l'état lu porte le droit :

```ts
      let etat: { statut?: StatutPaiement; droit?: DroitOffre | null; jusquAu?: string | null; aVerifier?: boolean } | null = null;
```

et la branche « payé » devient :

```ts
      if (etat?.statut === "paye") {
        setRetour({ etat: "recu", droit: etat.droit ?? null, jusquAu: etat.jusquAu ?? null });
        void charger();
        return;
      }
```

**f.** `refus` connaît les deux refus nouveaux :

```ts
  const refus = (code: string): string =>
    code === "deja_illimite" ? t.refusIllimite
      : code === "profil" ? t.refusProfil
        : code === "deja_compris" ? t.refusDejaCompris
          : code === "trop_de_tentatives" ? t.refusTentatives
            : code === "fedapay" || code === "" ? t.refusIndisponible
              : t.refusPasEnVente;
```

- [ ] **Step 6: La page, son rendu**

Toujours dans `src/app/(app)/offre/page.tsx`, remplacer tout ce qui suit le squelette de chargement (de la ligne `const illimite = offre.estPro ? t.illimite : null;` jusqu'à la fin du fichier) par :

```tsx
  const { casquettes: c } = offre;
  const ecran = ecranOffre({
    titres: c, plusActif: offre.estPro, sansPubActif: offre.sansPub?.actif === true, formules: offre.formules,
  });
  const libellesFormules = {
    unMois: t.unMois, unAn: t.unAn, parMois: t.parMois, payer: t.payer, redirection: t.redirection, moyens: t.moyens,
  };
  const formules = (liste: FormuleEnVente[]) => (
    <Formules formules={liste} enCours={achat} onPayer={(f) => void payer(f)} locale={locale} libelles={libellesFormules} />
  );
  const etatRetour = retour?.etat ?? (idRetour ? "attente" : "aucun");
  // Un plafond n'est « illimité » que si KoppaFoot+ le lève pour CE compte.
  const illimite = (cle: CleLimite) => (offre.leve[cle] ? t.illimite : null);
  const lignes = [
    c.manager && (
      <Jauge key="e" libelle={t.equipes} usage={offre.usage.equipes} max={offre.limites.equipes} illimite={illimite("equipes")} />
    ),
    c.gerant && (
      <Jauge key="t" libelle={t.terrains} usage={offre.usage.terrains} max={offre.limites.terrains} illimite={illimite("terrains")} />
    ),
    c.organisateur && (
      <Jauge key="c" libelle={t.competitions} detail={t.competitionsDetail} usage={offre.usage.competitions}
        max={offre.limites.competitions} illimite={illimite("competitions")} />
    ),
    c.organisateur && (
      <div key="taille" className="flex items-baseline justify-between gap-3 px-4 py-3">
        <span className="text-sm font-semibold text-gray-800">{t.tailleComp}</span>
        <span className="font-display text-lg font-black tabular-nums text-gray-900">
          {illimite("equipesParCompetition") ?? offre.limites.equipesParCompetition}
        </span>
      </div>
    ),
  ].filter(Boolean);
  // Seulement ce que KoppaFoot+ ouvrirait à ce profil.
  const avantages = [
    c.manager && t.avantageClub,
    c.manager && t.avantageEquipes,
    c.organisateur && t.avantageCompetitions,
    c.gerant && t.avantageTerrains,
    t.avantagePub,
  ].filter((a): a is string => typeof a === "string");
  const titreSection = "mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400";

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24">
      <div>
        <motion.h1
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="font-display text-2xl font-extrabold text-gray-900 sm:text-3xl"
        >
          {ecran.titre === "pro" ? t.titrePlus : t.titreSansPub}
        </motion.h1>
        <p className="mt-1 text-sm text-gray-500">{t.sousTitre}</p>
      </div>

      {etatRetour !== "aucun" && (
        <p
          role="status"
          className={`flex items-center gap-2 border px-4 py-3 text-sm font-semibold ${
            etatRetour === "recu" ? "border-emerald-600 bg-emerald-50 text-emerald-900"
              : etatRetour === "echec" || etatRetour === "verifier" ? "border-amber-500 bg-amber-50 text-amber-900"
                : "border-gray-200/70 bg-white text-gray-700"
          }`}
        >
          {etatRetour === "attente" && <Loader2 size={16} className="shrink-0 animate-spin" />}
          {etatRetour === "recu" && <Check size={16} className="shrink-0" />}
          {etatRetour === "attente" && t.retourAttente}
          {retour?.etat === "recu" && (
            !retour.jusquAu ? t.retourRecuSimple
              : retour.droit === "sans_pub" ? t.retourRecuSansPub(date(retour.jusquAu))
                : t.retourRecu(date(retour.jusquAu))
          )}
          {etatRetour === "echec" && t.retourEchec}
          {etatRetour === "lent" && t.retourLent}
          {etatRetour === "verifier" && t.retourVerifier}
        </p>
      )}

      {ecran.plus && (
        <section className={`border p-5 ${ecran.plus.etat === "actif" ? "border-emerald-600 bg-emerald-950 text-white" : "border-gray-200/70 bg-white"}`}>
          <p className="flex items-center gap-2">
            {ecran.plus.etat === "actif" && <Gem size={18} className="shrink-0 text-emerald-400" />}
            <span className="font-display text-xl font-black uppercase tracking-tight">
              {ecran.plus.etat === "actif" ? t.plus : t.gratuit}
            </span>
          </p>
          {ecran.plus.etat === "actif" && (
            <>
              <p className="mt-0.5 text-xs font-bold uppercase tracking-[0.14em] text-emerald-300">{fin(offre.pro)}</p>
              <p className="mt-2 text-sm text-emerald-100">{ecran.plus.horsProfil ? t.plusHorsProfil : t.plusActif}</p>
              {ecran.club && (
                <Link href="/mon-club" className="mt-3 inline-flex text-xs font-black uppercase tracking-[0.12em] text-emerald-300 hover:text-white">
                  {t.gererClub} →
                </Link>
              )}
            </>
          )}
        </section>
      )}

      {ecran.plus?.etat === "actif" && ecran.plus.formules.length > 0 && (
        <section>
          <h2 className={titreSection}>{t.prolongerPlus}</h2>
          <p className="mb-3 text-sm text-gray-600">{t.prolongerDetail}</p>
          {formules(ecran.plus.formules)}
        </section>
      )}

      {ecran.jauges && (
        <section>
          <h2 className={titreSection}>{t.chezToi}</h2>
          <div className="border border-gray-200/70 bg-white">
            <p className="border-b border-gray-200/70 px-4 py-3 text-sm text-gray-600">
              {offre.limitesActives
                ? t.depuis(date(offre.limitesDepuis!))
                : offre.limitesDepuis ? t.aPartirDu(date(offre.limitesDepuis)) : t.pasEncore}
              {" "}{t.garde}
            </p>
            <div className="divide-y divide-gray-200/70">{lignes}</div>
          </div>
        </section>
      )}

      {ecran.plus && ecran.plus.etat !== "actif" && (
        <section>
          <h2 className={titreSection}>{t.plusDebloque}</h2>
          <div className="border border-gray-200/70 bg-white p-4">
            <ul className="space-y-2">
              {avantages.map((a) => (
                <li key={a} className="flex items-start gap-2 text-sm text-gray-700">
                  <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                  {a}
                </li>
              ))}
            </ul>
            {ecran.plus.etat === "a_vendre" ? (
              <div className="mt-4">{formules(ecran.plus.formules)}</div>
            ) : (
              <>
                <p className="mt-4 text-sm text-gray-500">{t.plusPasEnVente}</p>
                <Link
                  href="/aide"
                  className="mt-3 inline-flex items-center border border-gray-900 bg-gray-900 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-gray-700"
                >
                  {t.ecrire}
                </Link>
              </>
            )}
          </div>
        </section>
      )}

      {ecran.sansPub && (
        <section>
          {/* Sur la page « Pas de pubs », le titre de la page le dit déjà. */}
          {ecran.titre === "pro" && <h2 className={titreSection}>{t.sansPub}</h2>}
          <div className="border border-gray-200/70 bg-white p-4">
            <p className="text-sm text-gray-700">
              {ecran.sansPub.etat === "actif" ? t.sansPubActif(fin(offre.sansPub)) : t.sansPubDetail}
            </p>
            {ecran.sansPub.formules.length > 0 && (
              <div className="mt-4">
                {ecran.sansPub.etat === "actif" && <p className="mb-3 text-sm text-gray-600">{t.prolongerDetail}</p>}
                {formules(ecran.sansPub.formules)}
              </div>
            )}
            {ecran.sansPub.etat === "pas_en_vente" && <p className="mt-3 text-sm text-gray-500">{t.sansPubPasEnVente}</p>}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Vérifier**

Run: `(cd mobile && npx jest src/__tests__/offre-ecran.test.ts src/__tests__/offre-profil.test.ts)`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: aucune erreur. (Une clé de `T` restée d'un côté seulement, ou un texte encore lu par le rendu et retiré du dictionnaire, se voit ici.)

Run: `npx eslint "src/app/(app)/offre/page.tsx" src/app/api/offre/route.ts src/lib/offre-ecran.ts`
Expected: aucune erreur.

Sur le serveur de dev, sans jeton :

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/offre`
Expected: `401`

La page elle-même demande un compte connecté : elle se regarde en bac à sable, avec le fondateur, à la tâche 9.

- [ ] **Step 8: Commit**

```bash
git add src/lib/offre-ecran.ts mobile/src/__tests__/offre-ecran.test.ts src/app/api/offre/route.ts "src/app/(app)/offre/page.tsx"
git commit -m "feat(offre): la page montre à chacun son offre

Qui gère des équipes, des compétitions ou des terrains voit KOPPAFOOT+,
les plafonds que son profil lève, puis « Pas de pubs ». Les autres ne
voient que « Pas de pubs ». Ce qui se montre se décide dans un module
pur, testé cas par cas ; la page ne fait que le dessiner. Le lien vers
le club ne se propose plus qu'aux managers.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: L'entrée de menu porte le nom de l'offre

**Files:**
- Modify: `src/i18n/fr.ts`, `src/i18n/en.ts`
- Modify: `src/components/layout/AvatarBottomSheet.tsx`
- Modify: `src/components/layout/v2/ScoreHeader.tsx`

**Interfaces:**
- Consumes: `offreAffichee`, `titresDuCompte` de `@/lib/offre` (tâche 1).
- Produces: les clés de traduction `compte.offrePlus` et `compte.offreSansPub` ; la clé `compte.offre` disparaît.

Pas de test nouveau : le choix du nom est `offreAffichee`, testé à la tâche 1, et la vérification de types refuse toute clé de traduction qui n'existe pas. L'adresse reste `/offre` : les notifications et les e-mails déjà envoyés y mènent.

- [ ] **Step 1: Les deux noms**

Dans `src/i18n/fr.ts`, la ligne `"compte.offre": "Mon offre",` devient :

```ts
  "compte.offrePlus": "KOPPAFOOT+",
  "compte.offreSansPub": "Pas de pubs",
```

Dans `src/i18n/en.ts`, la ligne `"compte.offre": "My plan",` devient :

```ts
  "compte.offrePlus": "KOPPAFOOT+",
  "compte.offreSansPub": "No ads",
```

- [ ] **Step 2: Les deux menus**

Dans `src/components/layout/AvatarBottomSheet.tsx` et dans `src/components/layout/v2/ScoreHeader.tsx` :
- ajouter l'import `import { offreAffichee, titresDuCompte } from "@/lib/offre";` ;
- remplacer `t("compte.offre")` par :

```tsx
t(offreAffichee(titresDuCompte(user)) === "pro" ? "compte.offrePlus" : "compte.offreSansPub")
```

- dans les deux fichiers, le commentaire `{/* L'offre, elle, est celle du COMPTE : seulement connecté. */}` devient `{/* L'offre est celle du COMPTE : seulement connecté, et sous le nom de ce qu'il peut avoir (lib/offre). */}`.

- [ ] **Step 3: Vérifier**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

Run: `grep -rn "compte.offre\"" src`
Expected: aucune ligne.

Run: `npx eslint src/components/layout/AvatarBottomSheet.tsx src/components/layout/v2/ScoreHeader.tsx src/i18n`
Expected: aucune erreur nouvelle.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/fr.ts src/i18n/en.ts src/components/layout/AvatarBottomSheet.tsx src/components/layout/v2/ScoreHeader.tsx
git commit -m "feat(offre): l'entrée « Mon offre » porte le nom de l'offre du profil

« KOPPAFOOT+ » pour qui gère des équipes, des compétitions ou des
terrains, « Pas de pubs » pour les autres. La même fonction nomme
l'entrée de menu et la page : elles ne peuvent pas se contredire.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: L'administration règle quatre prix et parle des deux offres

**Files:**
- Modify: `src/app/(admin)/admin/offre/page.tsx`
- Modify: `src/app/api/admin/offre/route.ts` (commentaires seulement : sa boucle suit déjà `ID_FORMULES`)

**Interfaces:**
- Consumes: `FORMULES`, `NOM_OFFRE`, `libelleFormule`, `ID_FORMULES` de `@/lib/paiement` (tâche 2).
- Produces: rien que d'autres tâches lisent.

Pas de test nouveau : la route enregistre déjà toute formule du catalogue (sa boucle parcourt `ID_FORMULES`, testé par `lirePrix` à la tâche 2), et cette tâche ne change que des libellés. Les quatre champs de prix sont apparus à la tâche 2.

- [ ] **Step 1: Les imports et la pastille**

Dans `src/app/(admin)/admin/offre/page.tsx` :

- l'import de `@/lib/paiement` devient :

```ts
import {
  FORMULES, ID_FORMULES, NOM_OFFRE, PRIX_PLANCHER, libelleFormule, type IdFormule, type PrixOffre, type StatutPaiement,
} from "@/lib/paiement";
```

- `PastilleDroit` devient, et ses deux appels deviennent `<PastilleDroit offre="pro" droit={c.pro} />` et `<PastilleDroit offre="sans_pub" droit={c.sansPub} />` :

```tsx
function PastilleDroit({ offre, droit }: { offre: DroitOffre; droit: VueDroit | null }) {
  if (!droit) return null;
  const nom = NOM_OFFRE[offre];
  if (!droit.actif) return <Pastille ton="gris">{nom} expiré</Pastille>;
  return (
    <Pastille ton={offre === "pro" ? "vert" : "bleu"}>
      {nom} {droit.jusquAu ? `jusqu'au ${jourCourt(droit.jusquAu)}` : "sans échéance"}
    </Pastille>
  );
}
```

- [ ] **Step 2: Les libellés**

Toujours dans cette page, chaque texte de gauche devient celui de droite :

| Avant | Après |
|---|---|
| `toast.success(accord.droit === "pro" ? "Pro accordé" : "Option sans pub accordée");` | ``toast.success(`${NOM_OFFRE[accord.droit]} accordé`);`` |
| `const quoi = droit === "pro" ? "le Pro" : "l'option sans pub";` | `const quoi = droit === "pro" ? "KoppaFoot+" : "« Pas de pubs »";` |
| `"Paiement confirmé, Pro accordé"` | `"Paiement confirmé, droit accordé"` |
| `sousTitre="Les limites de l'offre gratuite, les prix de KoppaFoot Pro, les comptes qui l'ont, et les paiements."` | `sousTitre="Les limites de l'offre gratuite, les prix de KoppaFoot+ et de « Pas de pubs », les comptes qui les ont, et les paiements."` |
| `libelle="Comptes Pro actifs"` | `libelle="KoppaFoot+ actifs"` |
| `libelle="Sans pub seul"` | `libelle="Pas de pubs seul"` |
| `<Titre>Vente de KoppaFoot Pro</Titre>` | `<Titre>Vente des offres</Titre>` |
| `Vide les deux pour fermer la vente.` | `Vide un prix pour retirer sa formule de la vente.` |
| `texte="Accorde le Pro à un organisateur ou un gérant pour le lui faire essayer."` | `texte="Accorde KoppaFoot+ à un manager, un organisateur ou un gérant pour le lui faire essayer."` |
| `label: "Retirer le Pro"` | `label: "Retirer KoppaFoot+"` |
| `label: "Retirer l'option sans pub"` | `label: "Retirer « Pas de pubs »"` |
| `texte="Les achats du Pro apparaîtront ici, du plus récent au plus ancien."` | `texte="Les achats apparaîtront ici, du plus récent au plus ancien."` |
| `title="Le compte avait déjà un Pro sans échéance : à rembourser."` | `title="Le compte avait déjà ce droit sans échéance : à rembourser."` |
| `KoppaFoot Pro (lève les limites, comprend le sans pub)` | `KoppaFoot+ (lève les plafonds de ce que le compte gère, retire la publicité)` |
| `Option sans pub seule` | `Pas de pubs (retire la publicité, rien d&apos;autre)` |

- [ ] **Step 3: Ce qui change de forme**

- Sous le paragraphe qui dit l'état de FedaPay, dans la section « Vente des offres », ajouter :

```tsx
          <p className="text-sm text-gray-600">
            KoppaFoot+ n&apos;est proposé qu&apos;aux managers, organisateurs et propriétaires de terrain. « Pas de pubs »
            est proposé à tout le monde, sauf à qui a déjà KoppaFoot+.
          </p>
```

- La ligne d'un paiement qui disait `{p.echeanceApres && <> · Pro jusqu&apos;au {jourCourt(p.echeanceApres)}</>}` devient (le texte est construit en JavaScript : aucune entité, donc aucune espace à perdre) :

```tsx
                      {p.echeanceApres && <> · {`${p.formule ? NOM_OFFRE[FORMULES[p.formule].droit] : "Droit"} jusqu'au ${jourCourt(p.echeanceApres)}`}</>}
```

- Dans la fenêtre « Accorder un droit », juste après la `</div>` qui ferme les deux boutons radio, ajouter :

```tsx
              {accord.droit === "pro" && (
                <p className="mt-2 text-xs text-gray-500">
                  KoppaFoot+ n&apos;agit que pour ce que le compte est : à un joueur, un arbitre ou un spectateur, il ne
                  retire que la publicité.
                </p>
              )}
```

- Le commentaire d'en-tête : « FIXER LES PRIX du Pro. Une formule est en vente dès qu'elle a un prix ; vider les deux ferme la vente sur-le-champ. » devient « FIXER LES PRIX des deux offres, KoppaFoot+ et « Pas de pubs ». Une formule est en vente dès qu'elle a un prix ; vider un prix la retire sur-le-champ. » ; « ACCORDER LE PRO (ou l'option sans pub) à la main » devient « ACCORDER KOPPAFOOT+ (ou « Pas de pubs ») à la main » ; « accorde le Pro si le paiement a bien abouti » devient « accorde le droit acheté si le paiement a bien abouti ».

Dans `src/app/api/admin/offre/route.ts`, deux lignes du commentaire : « fixer l'entrée en vigueur des limites, les prix du Pro. » devient « fixer l'entrée en vigueur des limites, les prix des formules. » ; « accorder le Pro ou l'option sans pub. » devient « accorder KoppaFoot+ ou « Pas de pubs ». ».

- [ ] **Step 4: Vérifier**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

Run: `npx eslint "src/app/(admin)/admin/offre/page.tsx" src/app/api/admin/offre/route.ts`
Expected: aucune erreur nouvelle.

Run: `grep -nE "\bPro\b|\bPRO\b|[Ss]ans pub" "src/app/(admin)/admin/offre/page.tsx" src/app/api/admin/offre/route.ts`
Expected: aucune ligne.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/admin/offre/page.tsx" src/app/api/admin/offre/route.ts
git commit -m "feat(admin): l'offre parle de KoppaFoot+ et de « Pas de pubs »

Les libellés suivent les deux offres, la fenêtre d'accord rappelle que
KoppaFoot+ n'agit que pour ce que le compte est, et la ligne d'un
paiement dit quel droit il a prolongé.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Le nom partout, et le club pour les managers

**Files:**
- Modify: `src/lib/offre.ts` (le message de plafond, les commentaires)
- Modify: `src/components/offre/LimiteOffre.tsx`
- Modify: `src/app/(app)/mon-club/page.tsx`, `src/app/(app)/clubs/[slug]/page.tsx`
- Modify: `src/app/api/clubs/[id]/route.ts`, `src/app/api/clubs/[id]/sections/route.ts`
- Modify: `src/app/(marketing)/conditions/page.tsx`, `src/app/(marketing)/confidentialite/page.tsx`
- Modify: les commentaires qui nomment encore le produit (liste à l'étape 6)

**Interfaces:**
- Consumes: `estManager` rendu par `GET /api/clubs` (tâche 4).
- Produces: rien que d'autres tâches lisent.

- [ ] **Step 1: Le message de plafond**

Dans `src/lib/offre.ts`, la dernière ligne de `messageLimite` devient :

```ts
  return `${quoi[cle]} KoppaFoot+ lève cette limite.`;
```

Dans `src/components/offre/LimiteOffre.tsx` : `leve: "KoppaFoot Pro lève cette limite.",` devient `leve: "KoppaFoot+ lève cette limite.",` ; `leve: "KoppaFoot Pro removes this limit.",` devient `leve: "KoppaFoot+ removes this limit.",` ; `voir: "Voir mon offre",` devient `voir: "Voir KoppaFoot+",` ; `voir: "See my plan",` devient `voir: "See KoppaFoot+",`. Dans son commentaire, « et propose « Mon offre » : ce qu'elle a, ce que le Pro lève. Pas de « Payer » : rien ne s'achète encore. » devient « et mène à la page de l'offre : ce qu'elle a, ce que KoppaFoot+ lève. ».

Ce message reste vrai sous la nouvelle règle : seul un manager atteint le plafond d'équipes, seul un propriétaire celui des terrains, seul un organisateur ceux des compétitions, et KoppaFoot+ lève à chacun le sien.

- [ ] **Step 2: « Mon club » pour qui n'est pas manager**

Dans `src/app/(app)/mon-club/page.tsx` :

- l'interface `Donnees` devient `interface Donnees { estPro: boolean; estManager: boolean; club: MonClub | null; mesEquipes: MonEquipe[]; invitationsRecues: InvitationRecue[] }` ;
- dans les textes français : `proRequis` devient `"Le Club multi-équipes fait partie de KoppaFoot+."`, `voirOffre` devient `"Voir KoppaFoot+"`, `sommeil` devient `"Ton club est en sommeil : il vit tant que tu es manager avec KoppaFoot+. Sa page ne s'affiche plus, rien n'est effacé, et il revit tel quel."`, et deux clés s'ajoutent après `voirOffre` :

```ts
    managerRequis: "Le Club multi-équipes réunit les équipes d'un manager.",
    managerRequisDetail: "Seul un manager peut en créer un : il y rattache les équipes qu'il gère.",
```

- dans les textes anglais : `proRequis` devient `"The multi-team club is part of KoppaFoot+."`, `voirOffre` devient `"See KoppaFoot+"`, `sommeil` devient `"Your club is dormant: it lives as long as you're a manager with KoppaFoot+. Its page is hidden, nothing is deleted, and it comes back as it was."`, et s'ajoutent après `voirOffre` :

```ts
    managerRequis: "The multi-team club brings a manager's teams together.",
    managerRequisDetail: "Only a manager can create one, and attach the teams they manage.",
```

- dans le rendu, la chaîne `d.club ? (…) : d.estPro ? (…) : (…)` gagne un cas, entre le club existant et la création :

```tsx
      ) : !d.estManager ? (
        <section className={`${CARTE} space-y-2`}>
          <p className="font-display text-lg font-black text-gray-900">{t.managerRequis}</p>
          <p className="text-sm text-gray-600">{t.managerRequisDetail}</p>
        </section>
      ) : d.estPro ? (
```

  (le propriétaire d'un club qui n'est plus manager garde l'accès à sa gestion : le premier cas, `d.club`, passe avant, et `enSommeil` lui dit pourquoi son club dort.)
- dans le commentaire d'en-tête, « Le PROPRIÉTAIRE (KoppaFoot Pro) » devient « Le PROPRIÉTAIRE (un manager qui a KoppaFoot+) ».

- [ ] **Step 3: Le club en sommeil**

- `src/app/(app)/clubs/[slug]/page.tsx` : `sommeilProprietaire` devient, en français, `"Ton club dort : il vit tant que tu es manager avec KoppaFoot+. Rien n'est effacé : sections, identité et encadrement reviennent tels quels."` et, en anglais, `"Your club is dormant: it lives as long as you're a manager with KoppaFoot+. Nothing is deleted: sections, identity and staff come back as they were."` ; `voirOffre` devient `"Voir KoppaFoot+"` et `"See KoppaFoot+"`.
- `src/app/api/clubs/[id]/route.ts` et `src/app/api/clubs/[id]/sections/route.ts` : le message `"Ton club est en sommeil : il revit avec KoppaFoot Pro."` devient `"Ton club est en sommeil : il revit quand tu es manager avec KoppaFoot+."`.

- [ ] **Step 4: Les conditions d'utilisation**

Dans `src/app/(marketing)/conditions/page.tsx` :

- `MIS_A_JOUR` prend la date du jour où cette tâche est faite, au même format (« 14 octobre 2026 »).
- Dans la section « Le service », les deux paragraphes qui vont de « L'utilisation de KoppaFoot est gratuite. KoppaFoot Pro est une option payante » à « nous prolongeons ta période ou nous te remboursons. » deviennent ces trois-ci :

```tsx
        <p>
          L&apos;utilisation de KoppaFoot est gratuite. Deux options payantes existent : <strong>KoppaFoot+</strong>,
          pour ceux qui gèrent des équipes, des compétitions ou des terrains, et <strong>Pas de pubs</strong>, pour
          tout le monde. Leur prix est affiché avant tout paiement, et aucune n&apos;est jamais exigée pour terminer
          un match ou une compétition déjà commencés.
        </p>
        <p>
          KoppaFoot+ n&apos;est proposé qu&apos;aux managers, aux organisateurs et aux propriétaires de terrain, et il
          n&apos;agit que pour ce que ton compte est : il lève le plafond d&apos;équipes et ouvre le Club
          multi-équipes à un manager, lève les plafonds de compétitions à un organisateur, et le plafond de terrains
          à un propriétaire. Il retire aussi la publicité. « Pas de pubs » retire la publicité, et rien
          d&apos;autre ; il n&apos;est pas proposé tant que KoppaFoot+ court, qui le comprend déjà.
        </p>
        <p>
          L&apos;une comme l&apos;autre s&apos;achète pour une période, un mois ou un an,{" "}
          <strong>sans renouvellement automatique</strong>{" "}: à l&apos;échéance, rien n&apos;est prélevé, et tu es
          prévenu avant. Le paiement se fait par mobile money ou par carte, sur la page de notre prestataire FedaPay.
          Une période commencée n&apos;est pas remboursée ; en cas de double paiement ou d&apos;erreur, écris-nous :
          nous prolongeons ta période ou nous te remboursons.
        </p>
```

- Plus bas, « Ces limites sont détaillées sur la page « Mon offre », » devient « Ces limites sont détaillées sur la page « KOPPAFOOT+ » de ton compte, ».
- Le paragraphe du club devient :

```tsx
        <p>
          Le Club multi-équipes, qui réunit plusieurs équipes sous un même club, est réservé aux managers qui ont
          KoppaFoot+. Si l&apos;un ou l&apos;autre s&apos;arrête, le club se met en sommeil : sa page ne
          s&apos;affiche plus, mais rien n&apos;est effacé, et ses équipes continuent comme des équipes autonomes,
          avec tout leur historique.
        </p>
```

- Dans la section « Partenaires, sponsors et annonces », « Avec KoppaFoot Pro ou l&apos;option sans pub, aucune ne s&apos;affiche. » devient « Avec KoppaFoot+ ou « Pas de pubs », aucune ne s&apos;affiche. ».
- Dans le commentaire d'en-tête, « KoppaFoot Pro, son prix affiché avant de payer » devient « KoppaFoot+ et « Pas de pubs », leur prix affiché avant de payer ».

Dans `src/app/(marketing)/confidentialite/page.tsx` : `MIS_A_JOUR` prend la même date ; « le paiement de KoppaFoot Pro et des frais de réservation d&apos;un terrain, » devient « le paiement de KoppaFoot+, de « Pas de pubs » et des frais de réservation d&apos;un terrain, » ; dans le commentaire d'en-tête, « FedaPay à l'achat du Pro » devient « FedaPay à l'achat d'une offre ».

- [ ] **Step 5: Le texte compilé des deux pages**

Un texte JSX sur plusieurs lignes qui contient une entité perd son espace de tête. Écrire ce contrôle dans le dossier de travail de la session (hors du dépôt), sous le nom `swc-espaces.cjs` :

```js
// Compile un fichier avec le SWC de Next et montre les textes JSX autour d'un motif :
// c'est ce que le navigateur recevra, espaces comprises.
const { readFileSync } = require("node:fs");
const swc = require("C:/football-network/koppafoot/node_modules/next/dist/build/swc");
(async () => {
  const [, , fichier, ...motifs] = process.argv;
  await swc.loadBindings();
  const { code } = await swc.transform(readFileSync(fichier, "utf8"), {
    filename: fichier,
    jsc: { parser: { syntax: "typescript", tsx: true }, transform: { react: { runtime: "automatic" } }, target: "es2022" },
  });
  for (const m of motifs) {
    const i = code.indexOf(m);
    console.log(`[${m}]`, i < 0 ? "(introuvable)" : JSON.stringify(code.slice(Math.max(0, i - 70), i + m.length + 60)));
  }
})().catch((e) => { console.error("ÉCHEC", e.message); process.exit(1); });
```

Run: `node <dossier de travail>/swc-espaces.cjs "src/app/(marketing)/conditions/page.tsx" "KoppaFoot+\"" "Pas de pubs\"" "sans renouvellement" "aucune ne s"`
Expected: autour de chaque balise `strong`, le texte qui précède finit par une espace (« existent : », « terrains, et », « un an, ») ou une espace explicite `" "` suit ; « sans renouvellement automatique » est suivi de `" "` puis de « : à l'échéance » ; aucun mot collé à une balise.

Run: `node <dossier de travail>/swc-espaces.cjs "src/app/(marketing)/confidentialite/page.tsx" "FedaPay\""`
Expected: `" "` puis « : le paiement de KoppaFoot+, de « Pas de pubs » et des frais… ».

Si une espace manque : l'écrire `{" "}` à cet endroit, et relancer.

- [ ] **Step 6: Les commentaires, et le contrôle final du nom**

Run: `grep -rnE "\bPro\b|\bPRO\b|Mon offre|My plan|[Oo]ption sans pub|Voir mon offre|See my plan" src --include=*.ts --include=*.tsx`

Il ne reste que des commentaires (la liste est indicative, c'est la commande qui fait foi : `lib/offre.ts`, `lib/paiement.ts`, `lib/paiement-serveur.ts`, `lib/clubs.ts`, `lib/clubs-serveur.ts`, `hooks/useSansPub.ts`, `components/partenaires/Emplacement.tsx`, `types/index.ts`, `app/api/paiements/route.ts`, `app/api/paiements/[id]/route.ts`, `app/api/clubs/route.ts`, `app/api/clubs/[id]/route.ts`, `app/api/public/club/[slug]/route.ts`, `app/(app)/teams/page.tsx`). Dans chacun, écrire le nouveau nom, sans toucher à aucun identifiant ni à aucune chaîne de données (`"pro"`, `estPro`, `pro_mois`) :
- « KoppaFoot Pro », « le Pro », « du Pro », « un Pro », « son Pro », « Pro » seul → « KoppaFoot+ » (avec l'article qui convient : « l'achat de KoppaFoot+ », « son KoppaFoot+ ») ; de même en capitales : « UN SEUL DOCUMENT DIT QUI EST PRO » devient « UN SEUL DOCUMENT DIT QUI A KOPPAFOOT+ », « UNE SEULE FONCTION ACCORDE LE PRO » devient « UNE SEULE FONCTION ACCORDE UN DROIT ACHETÉ », « RÉSERVÉ À KOPPAFOOT PRO » devient « RÉSERVÉ AUX MANAGERS QUI ONT KOPPAFOOT+ » ;
- « l'option sans pub » → « « Pas de pubs » » ;
- « la page « Mon offre » » → « la page de l'offre » ;
- là où un commentaire dit que le club vit « du Pro de son propriétaire », dire « tant que son propriétaire est manager avec KoppaFoot+ » : c'est la règle depuis la tâche 4 ;
- dans `lib/offre.ts`, le commentaire de `LIMITES_GRATUIT` devient « Ce que l'offre gratuite permet. KoppaFoot+ lève chacune de ces limites, pour qui porte le titre qui va avec. », et celui de `DroitOffre` devient « Les deux droits qu'on accorde : KoppaFoot+ (`pro`), et « Pas de pubs » (`sans_pub`), vendu à part. ».

Run (de nouveau): `grep -rnE "\bPro\b|\bPRO\b|Mon offre|My plan|[Oo]ption sans pub|Voir mon offre|See my plan" src --include=*.ts --include=*.tsx`
Expected: aucune ligne.

- [ ] **Step 7: Vérifier**

Run: `(cd mobile && npx jest)`
Expected: toutes les suites vertes.

Run: `npx tsc --noEmit`
Expected: aucune erreur.

Run: `npx eslint src/lib src/components/offre "src/app/(app)/mon-club" "src/app/(app)/clubs" src/app/api/clubs "src/app/(marketing)/conditions" "src/app/(marketing)/confidentialite"`
Expected: aucune erreur nouvelle.

- [ ] **Step 8: Commit**

```bash
git add -A src
git commit -m "feat(offre): KoppaFoot Pro s'appelle KoppaFoot+, partout où il se lit

Les messages de plafond, le club en sommeil, les conditions et la
confidentialité disent KoppaFoot+ et « Pas de pubs », et pour qui ils
sont. « Mon club », ouvert par un compte qui n'est pas manager, dit que
le club réunit les équipes d'un manager, sans formulaire. Les noms
internes ne bougent pas.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Avant `git add -A src` : `git status --short` ne doit montrer que des fichiers de cette tâche.)

---

### Task 9: Vérification d'ensemble

**Files:** aucun, sauf correction.

**Interfaces:** rien.

- [ ] **Step 1: Tout ce qui se teste tout seul**

Run: `(cd mobile && npx jest)`
Expected: toutes les suites vertes ; trois suites nouvelles (`offre-profil`, `offre-serveur`, `offre-ecran`).

Run: `npx tsc --noEmit`
Expected: aucune erreur.

Run: `(cd mobile && npx tsc --noEmit)`
Expected: les 3 erreurs d'avant (`expo-notifications`, deux fois, et `push.ts`), aucune autre.

Run: `git diff --name-only origin/master...HEAD -- src | grep -E "\.(ts|tsx)$" | xargs npx eslint`
Expected: aucune erreur.

- [ ] **Step 2: Ce qui se voit sans compte**

Démarrer le serveur de dev par `preview_start` (`koppafoot-dev`), puis :

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/offre`
Expected: `401`

Run: `curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/teams -H "Content-Type: application/json" -d '{"name":"x","city":"y"}'`
Expected: `401`

Run: `curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/paiements -H "Content-Type: application/json" -d '{"formule":"sans_pub_mois"}'`
Expected: `401`

Ouvrir `/conditions` et `/confidentialite` dans le navigateur de la session et lire le texte de la page : « KoppaFoot+ » et « Pas de pubs » y sont, « KoppaFoot Pro » n'y est plus, aucun mot n'est collé à son voisin autour des passages en gras.

- [ ] **Step 3: La construction**

Arrêter le serveur de dev, puis, une seule fois :

Run: `npm run build`
Expected: la construction aboutit, sans erreur de types ni de lint.

- [ ] **Step 4: Le bac à sable, avec le fondateur**

Redémarrer le serveur de dev. Le poste écrit dans la base de production, et seul un superadmin peut y payer. À faire vérifier, dans cet ordre :

1. **Administration → Offre** : quatre champs de prix. Saisir un prix pour « Pas de pubs, 1 mois ».
2. **Un compte joueur sans casquette** : le menu dit « Pas de pubs » ; la page ne montre que « Pas de pubs » (sans formule en bac à sable : il n'est pas superadmin) ; ni plafonds, ni club. `/mon-club` dit que le club réunit les équipes d'un manager, sans formulaire.
3. **Un compte manager** : le menu dit « KOPPAFOOT+ » ; la page montre l'offre gratuite, ses équipes comptées, ce que KoppaFoot+ débloque pour un manager (club, équipes, pas de pub), puis « Pas de pubs ».
4. **Le compte superadmin du fondateur** (joueur, KoppaFoot+ actif) : le menu dit « KOPPAFOOT+ » (un superadmin organise d'office) ; la page montre KoppaFoot+ et son échéance, le compteur de compétitions, **pas** de lien vers le club, et **pas** de bloc « Pas de pubs ».
5. **Acheter « Pas de pubs »** avec un superadmin qui n'a pas KoppaFoot+ (ou après l'avoir retiré au compte de test dans l'administration) : page FedaPay de test, retour « Plus de publicité jusqu'au… », notification, et les emplacements des partenaires disparaissent après un rechargement.
6. **Le club** : un manager avec KoppaFoot+ crée son club ; son rôle repassé à joueur, la page du club se met en sommeil ; redevenu manager, elle revit.

- [ ] **Step 5: Avant la fusion**

- La PR daRevrse/koppafoot#110 (la garde de création de profil) doit être fusionnée dans `master`, puis `origin/master` fusionné dans cette branche : `firestore.rules` y retrouve la garde. **Aucun déploiement de règles depuis cette branche avant cela.**
- Ce chantier ne demande aucune règle Firestore, aucun index, aucune variable d'environnement.
- Après la mise en production : saisir les prix de « Pas de pubs » dans l'administration. Rien ne s'en vend avant.
