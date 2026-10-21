# Application mobile — identité sombre : plan d'implémentation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal :** l'application passe à une palette sombre partie du fond de l'écran de lancement, avec la frise des jours, un Direct en cartes, des squelettes, des vibrations et un onglet Compte qui montre les compétitions suivies.

**Architecture :** la palette vit dans `mobile/src/theme.ts`, nommée par rôles et gardée par un test de contraste. Les composants sont retouchés à la main, sans bibliothèque de style. Les animations passent par `Animated` de React Native. Le seul module natif ajouté est `expo-haptics`, ce qui impose un nouveau build de développement EAS.

**Tech stack :** Expo SDK 57, Expo Router 57 (qui exporte `ThemeProvider`, `DarkTheme` et `useFocusEffect`), React Native 0.86, jest-expo 57, Firebase JS SDK 12, `expo-haptics`.

**Design de référence :** [2026-09-25-app-mobile-ui-sombre-design.md](2026-09-25-app-mobile-ui-sombre-design.md)

---

## À lire d'abord

**Branche :** `claude/app-ui-sombre`, rebasée le 2026-10-21 sur `origin/master` (4509cfa). Elle porte le design et ce plan. **Ne pas pousser ni ouvrir la PR sans l'accord de l'utilisateur.**

**Ce que master a changé depuis l'écriture du plan** (pris en compte plus bas) :
- les notifications push : `expo-notifications`, `lib/push.ts`, et le réglage `components/ReglagePush.tsx` dans l'onglet Compte ;
- la minute du direct : `minuteDuDirect(entree, libellés)` remplace `liveMinute` et rend « 13′ », « 45+2′ », « MT » ou « TAB », déjà avec le prime ; libellés dans `FOOT.fr` (`@/i18n/foot`) ;
- `_layout.tsx` ouvre la page d'une notification touchée dans le navigateur intégré.

**Toutes les commandes se lancent depuis la racine du dépôt**, `C:\football-network\koppafoot`, avec `--prefix mobile`, sauf mention contraire.

**La barrière des tests.** Au 2026-10-21, master a **9 tests en échec qui ne viennent pas du mobile**, dans `classement.test.ts` et `etat-de-forme.test.ts` (signalés à part). `npm --prefix mobile test` doit donc afficher `Tests: 9 failed, N passed`, avec ces deux suites pour seuls échecs. **Un total à 0 est un échec.** Au lot 1, un `expo install` avait imbriqué `expo-modules-core` et plus aucun test ne tournait, sans erreur visible. Le nombre attendu est donné à chaque étape : 750 réussis au départ, 780 à la fin. Si les 9 échecs ont été réparés entre-temps, ils comptent parmi les réussis.

**Lint et types**, avant chaque commit qui touche du code :
- `npm --prefix mobile run lint -- --no-cache` : le cache d'`expo lint` garde des erreurs périmées, comme un `expo-notifications` introuvable après une réinstallation ;
- `npm --prefix mobile run typecheck` : une erreur préexistante dans `__tests__/suppression-match.test.ts` (TS2352), signalée à part. Aucune autre ne doit apparaître.

Le lint embarque les règles du compilateur React. Deux sont déjà tombées au lot 1 :
- **`set-state-in-effect`** : pas de `setState` synchrone dans le corps d'un effet. Dans un `.then`, c'est permis.
- **`refs`** : pas de lecture de `ref.current` pendant le rendu. D'où `useState(() => new Animated.Value(1))` plutôt que `useRef(...).current`.

**Ce que l'application n'importe pas du site :** voir `mobile/eslint.config.js`. `@/config/*`, `@/lib/dates`, `@/lib/direct-shared` et `@/lib/competition-mappers` sont permis.

**Une liste horizontale dans une colonne** (`ScrollView` ou `FlatList` horizontale) **prend toute la hauteur libre** sans `flexGrow: 0`. C'est déjà arrivé aux filtres du Direct au lot 1.

**Vérifier dans Chrome, pas dans le volet intégré.** Dans le volet, `requestAnimationFrame` ne tourne pas : `onLayout` ne se déclenche jamais et les animations restent figées.

**Ne jamais saisir de mot de passe.** Pour voir l'onglet Compte connecté, c'est l'utilisateur qui se connecte.

---

## Task 1 : la palette et son test de contraste (TDD)

**Files:**
- Create: `mobile/src/__tests__/theme.test.ts`
- Modify: `mobile/src/theme.ts`
- Modify: `mobile/src/app/(tabs)/index.tsx:115`, `mobile/src/app/accueil.tsx:76,118,125`, `mobile/src/components/direct/EnTeteCompetition.tsx:46`, `mobile/src/components/direct/LigneMatch.tsx:56`, `mobile/src/components/Ecusson.tsx:30` (les jetons retirés)
- Modify: `docs/plans/2026-09-25-app-mobile-ui-sombre-design.md` (deux valeurs de la palette)

**Step 1 : écrire le test**

`mobile/src/__tests__/theme.test.ts` :

```ts
import { SPLASH_FOND } from "@/config/ios-launch";
import { couleurs } from "~/theme";

/** Le contraste WCAG 2 entre deux couleurs « #rrggbb ». */
function contraste(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bleu] = [1, 3, 5].map((i) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bleu;
  };
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (clair + 0.05) / (sombre + 0.05);
}

const TEXTES = ["texte", "texteSecondaire", "texteDiscret", "primaire", "direct", "accent", "erreur"] as const;
const FONDS = ["fond", "surface", "surfaceHaute"] as const;

describe("la palette", () => {
  it("part du fond de l'écran de lancement", () => {
    expect(couleurs.fond.toLowerCase()).toBe(SPLASH_FOND.toLowerCase());
  });

  // Toute couleur de texte sur tout fond : un composant n'a pas à savoir
  // sur quelle surface il sera posé.
  it.each(TEXTES.flatMap((t) => FONDS.map((f) => [t, f] as const)))("%s sur %s : 4,5 au moins", (t, f) => {
    expect(contraste(couleurs[t], couleurs[f])).toBeGreaterThanOrEqual(4.5);
  });

  it("le libellé d'un bouton plein se lit sur primaire", () => {
    expect(contraste(couleurs.surPrimaire, couleurs.primaire)).toBeGreaterThanOrEqual(4.5);
  });
});
```

**Step 2 : le lancer, il échoue**

Run: `npm --prefix mobile test -- theme`
Expected : FAIL. `fond` vaut `#FFFFFF`, et `surface` n'existe pas (le contraste donne `NaN`).

**Step 3 : la palette**

Dans `mobile/src/theme.ts`, remplacer le bloc `couleurs` et son commentaire. Le bloc `polices` ne change pas.

```ts
/**
 * La palette de l'application, sombre, partie du fond de l'écran de lancement
 * (SPLASH_FOND, src/config/ios-launch) : on passe du lancement à l'application
 * sans à-coup.
 *
 * DES NOMS DE RÔLE, PAS DE TEINTE. Toute couleur de texte doit se lire sur
 * chacun des trois fonds : __tests__/theme.test.ts l'exige (4,5 au moins).
 */
export const couleurs = {
  fond: "#0d291b",
  surface: "#12352a",
  surfaceHaute: "#184233",
  bordure: "#1f4a38",
  texte: "#F2F7F4",
  texteSecondaire: "#A9C2B4",
  texteDiscret: "#8FB09E",
  primaire: "#34D399",
  /** Le libellé posé sur `primaire` : bouton plein, jour choisi, avatar. */
  surPrimaire: "#0d291b",
  direct: "#FC8181",
  accent: "#FBBF24",
  erreur: "#FCA5A5",
} as const;

/** Champs et boutons ; cartes. */
export const rayons = { champ: 10, carte: 14 } as const;
```

`texteDiscret` et `direct` sont plus clairs que dans le design (`#7FA08E` et `#F87171`). Sur `surfaceHaute`, ceux du design ne donnaient que 3,9 et 4,1. Le test exige toutes les paires : c'est plus simple que de retenir qu'une paire est interdite.

**Step 4 : le test passe**

Run: `npm --prefix mobile test`
Expected : `Tests: 9 failed, 773 passed` (750 + 23).

**Step 5 : remplacer les jetons retirés**

Run: `npm --prefix mobile run typecheck`
Expected : des erreurs sur `fondSecondaire`, `fondTertiaire`, `sombre` et `primaireClair`. Les remplacer ainsi :

| Fichier | Avant | Après |
|---|---|---|
| `app/(tabs)/index.tsx:115` (bandeau) | `fondTertiaire` | `surface` |
| `app/accueil.tsx:76` et `:118` | `sombre` | `fond` |
| `app/accueil.tsx:125` | `primaireClair` | `primaire` |
| `components/direct/EnTeteCompetition.tsx:46` | `fondSecondaire` | `fond` |
| `components/direct/LigneMatch.tsx:56` | `fondSecondaire` | `surfaceHaute` |
| `components/Ecusson.tsx:30` | `fondTertiaire` | `surfaceHaute` |
| `components/ReglagePush.tsx` (les deux `trackColor`) | `primaireClair` | `primaire` |

Run: `npm --prefix mobile run typecheck`, puis `npm --prefix mobile run lint`
Expected : aucune erreur.

**Step 6 : reporter les deux valeurs dans le design**

Dans le tableau de la palette du design :
- `texteDiscret` passe à `#8FB09E` ;
- `direct` passe à `#FC8181`.

Remplacer ensuite le paragraphe « Un test garde les contrastes » par :

> **Un test garde les contrastes.** `theme.test.ts` exige 4,5 au moins pour chaque couleur de texte sur chacun des trois fonds. Il a fait éclaircir `texteDiscret` et `direct`, qui ne faisaient que 3,9 et 4,1 sur `surfaceHaute`.

**Step 7 : commit**

```bash
git add mobile/src/theme.ts mobile/src/__tests__/theme.test.ts mobile/src/app mobile/src/components docs/plans/2026-09-25-app-mobile-ui-sombre-design.md
git commit -m "feat(mobile): la palette sombre, gardée par un test de contraste"
```

---

## Task 2 : le cadre — navigation, barre d'onglets, bouton, champ, croix

**Files:**
- Modify: `mobile/app.json`
- Modify: `mobile/src/app/_layout.tsx`
- Modify: `mobile/src/app/(tabs)/_layout.tsx`
- Modify: `mobile/src/components/Bouton.tsx`
- Modify: `mobile/src/components/Champ.tsx`
- Modify: `mobile/src/components/EcranAuth.tsx`
- Modify: `mobile/src/app/accueil.tsx:101` (retirer `sombre`)

**Step 1 : `app.json`**

`"userInterfaceStyle": "light"` devient `"userInterfaceStyle": "dark"`. Les alertes système et le clavier iOS suivent ce réglage. Il est appliqué à la compilation native : il sera visible avec le build de la Task 12, pas dans Expo Go.

**Step 2 : le thème de navigation, dans `mobile/src/app/_layout.tsx`**

Remplacer l'import d'`expo-router` (`couleurs` est déjà importé, pour les notifications) :

```tsx
import { DarkTheme, Stack, ThemeProvider, useRouter, type Theme } from "expo-router";
```

Sous `unstable_settings`, ajouter :

```tsx
/** Le fond des écrans et des transitions : sans lui, un éclair blanc entre deux écrans. */
const THEME_NAVIGATION: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: couleurs.primaire,
    background: couleurs.fond,
    card: couleurs.fond,
    text: couleurs.texte,
    border: couleurs.bordure,
    notification: couleurs.direct,
  },
};
```

Dans `RacineLayout`, le rendu devient :

```tsx
    <AuthProvider>
      <AccueilProvider>
        <ThemeProvider value={THEME_NAVIGATION}>
          <StatusBar style="light" />
          <Navigation policesPretes={policesPretes} />
        </ThemeProvider>
      </AccueilProvider>
    </AuthProvider>
```

**Step 3 : la barre d'onglets, dans `mobile/src/app/(tabs)/_layout.tsx`**

Ajouter `tabBarStyle` aux `screenOptions` :

```tsx
        tabBarStyle: { backgroundColor: couleurs.fond, borderTopColor: couleurs.bordure },
```

**Step 4 : `mobile/src/components/Bouton.tsx`, en entier**

```tsx
import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import { couleurs, polices, rayons } from "~/theme";

type Variante = "plein" | "contour" | "lien";

interface Props extends Omit<PressableProps, "children" | "style"> {
  titre: string;
  variante?: Variante;
  occupe?: boolean;
}

export function Bouton({ titre, variante = "plein", occupe = false, disabled, ...reste }: Props) {
  const inactif = disabled || occupe;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactif, busy: occupe }}
      disabled={inactif}
      style={({ pressed }) => [styles.base, styles[variante], inactif && styles.inactif, pressed && styles.presse]}
      {...reste}
    >
      {occupe ? (
        <ActivityIndicator color={variante === "plein" ? couleurs.surPrimaire : couleurs.primaire} />
      ) : (
        <Text style={[styles.libelle, libelles[variante]]}>{titre}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 48, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", borderRadius: rayons.champ },
  plein: { backgroundColor: couleurs.primaire },
  contour: { borderWidth: 1, borderColor: couleurs.bordure, backgroundColor: couleurs.surface },
  lien: { minHeight: 40 },
  inactif: { opacity: 0.5 },
  presse: { opacity: 0.8 },
  libelle: { fontSize: 15, fontFamily: polices.texteGras },
});

// Le plein porte le fond de l'écran sur le vert : le blanc n'y faisait que 3,8.
const libelles = StyleSheet.create({
  plein: { color: couleurs.surPrimaire },
  contour: { color: couleurs.texte },
  lien: { color: couleurs.primaire },
});
```

Le prop `sombre` disparaît : tout est sombre. Dans `mobile/src/app/accueil.tsx:101`, retirer `sombre` du `<Bouton … variante="lien" sombre …>`.

**Step 5 : `mobile/src/components/Champ.tsx`, en entier**

```tsx
import { useState } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { couleurs, polices, rayons } from "~/theme";

interface Props extends TextInputProps {
  etiquette: string;
  erreur?: string | null;
}

export function Champ({ etiquette, erreur, style, onFocus, onBlur, ...reste }: Props) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={styles.bloc}>
      <Text style={styles.etiquette}>{etiquette}</Text>
      <TextInput
        accessibilityLabel={etiquette}
        placeholderTextColor={couleurs.texteDiscret}
        selectionColor={couleurs.primaire}
        cursorColor={couleurs.primaire}
        keyboardAppearance="dark"
        onFocus={(e) => {
          setFocus(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          onBlur?.(e);
        }}
        style={[styles.champ, focus && styles.champFocus, erreur ? styles.champErreur : null, style]}
        {...reste}
      />
      {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: 6 },
  etiquette: { fontSize: 12, fontFamily: polices.texteGras, color: couleurs.texteSecondaire },
  champ: {
    borderWidth: 1, borderColor: couleurs.bordure, backgroundColor: couleurs.surface, borderRadius: rayons.champ,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: polices.texte, color: couleurs.texte,
  },
  champFocus: { borderColor: couleurs.primaire },
  champErreur: { borderColor: couleurs.erreur },
  erreur: { fontSize: 12, fontFamily: polices.texte, color: couleurs.erreur },
});
```

**Step 6 : la croix, dans `mobile/src/components/EcranAuth.tsx`**

Ajouter `import { Ionicons } from "@expo/vector-icons";`. La barre devient :

```tsx
      <View style={styles.barre}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fermer"
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => [styles.fermer, pressed && styles.fermerPresse]}
        >
          <Ionicons name="close" size={20} color={couleurs.texte} />
        </Pressable>
      </View>
```

Dans `styles`, remplacer `barre` et `fermer` :

```tsx
  barre: { paddingHorizontal: 16, paddingVertical: 8, alignItems: "flex-end" },
  fermer: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: couleurs.surface,
    alignItems: "center", justifyContent: "center",
  },
  fermerPresse: { backgroundColor: couleurs.surfaceHaute },
```

**Step 7 : vérifier**

Run :
- `npm --prefix mobile test` → `Tests: 9 failed, 773 passed`
- `npm --prefix mobile run lint` → aucune erreur
- `npm --prefix mobile run typecheck` → aucune erreur

**Step 8 : commit**

```bash
git add mobile/app.json mobile/src/app mobile/src/components
git commit -m "feat(mobile): le cadre sombre — navigation, onglets, bouton, champ, croix"
```

---

## Task 3 : `initiales`, pour l'écusson et l'avatar (TDD)

**Files:**
- Create: `mobile/src/lib/initiales.ts`
- Create: `mobile/src/__tests__/initiales.test.ts`
- Modify: `mobile/src/components/Ecusson.tsx`

**Step 1 : le test**

```ts
import { initiales } from "~/lib/initiales";

describe("initiales", () => {
  it("les deux premiers mots", () => {
    expect(initiales("AS Douane Lomé")).toBe("AD");
  });

  it("en majuscules", () => {
    expect(initiales("kossi mensah")).toBe("KM");
  });

  it("un accent décomposé reste sur sa lettre", () => {
    expect(initiales("E\u0301lodie")).toBe("É");
  });

  it("rien pour un nom vide", () => {
    expect(initiales("   ")).toBe("");
  });
});
```

**Step 2 : il échoue**

Run: `npm --prefix mobile test -- initiales`
Expected : FAIL, `Cannot find module '~/lib/initiales'`.

**Step 3 : la fonction**

`mobile/src/lib/initiales.ts` :

```ts
/**
 * « AS Douane Lomé » → « AD » : la première lettre des deux premiers mots,
 * pour un écusson ou un avatar sans image.
 *
 * NFC d'abord : un « É » saisi en deux caractères (E + accent) donnerait « E ».
 */
export function initiales(nom: string): string {
  return nom
    .normalize("NFC")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0]?.toUpperCase() ?? "")
    .join("");
}
```

**Step 4 : l'écusson s'en sert**

Dans `mobile/src/components/Ecusson.tsx` :
- ajouter `import { initiales } from "~/lib/initiales";` ;
- supprimer le calcul local `const initiales = nom.split(…)…join("");` ;
- afficher `{initiales(nom)}` dans le `<Text>`.

**Step 5 : vérifier**

Run: `npm --prefix mobile test` → `Tests: 9 failed, 777 passed`. Puis lint et typecheck, sans erreur.

**Step 6 : commit**

```bash
git add mobile/src/lib/initiales.ts mobile/src/__tests__/initiales.test.ts mobile/src/components/Ecusson.tsx
git commit -m "feat(mobile): initiales, partagées par l'écusson et bientôt l'avatar"
```

---

## Task 4 : la frise des jours, en logique pure (TDD)

**Files:**
- Modify: `mobile/src/lib/direct-tableau.ts`
- Modify: `mobile/src/__tests__/direct-tableau.test.ts`

**Step 1 : les tests**

Dans `mobile/src/__tests__/direct-tableau.test.ts`, ajouter `joursAvecMatchs` et `joursDeLaFrise` à l'import de `~/lib/direct-tableau`, puis à la fin du fichier :

```ts
describe("joursDeLaFrise", () => {
  it("quinze jours autour d'aujourd'hui", () => {
    const j = joursDeLaFrise("2026-09-24", "2026-09-24");
    expect(j).toHaveLength(15);
    expect(j[0]).toBe("2026-09-17");
    expect(j[14]).toBe("2026-10-01");
  });

  it("s'étend jusqu'au jour choisi quand il sort de la fenêtre", () => {
    const apres = joursDeLaFrise("2026-09-24", "2026-10-05");
    expect(apres[0]).toBe("2026-09-17");
    expect(apres[apres.length - 1]).toBe("2026-10-05");
    const avant = joursDeLaFrise("2026-09-24", "2026-09-10");
    expect(avant[0]).toBe("2026-09-10");
    expect(avant[avant.length - 1]).toBe("2026-10-01");
  });
});

describe("joursAvecMatchs", () => {
  it("les dates des matchs, sans les dates absentes", () => {
    const f: CompetitionFeed[] = [
      { competition: comp("x"), matches: [match("a"), match("b", { date: null }), match("c", { date: "2026-09-27" })] },
    ];
    expect([...joursAvecMatchs(f)].sort()).toEqual(["2026-09-24", "2026-09-27"]);
  });
});
```

**Step 2 : ils échouent**

Run: `npm --prefix mobile test -- direct-tableau`
Expected : FAIL, `joursDeLaFrise is not a function`.

**Step 3 : les deux fonctions**

Dans `mobile/src/lib/direct-tableau.ts`, ajouter `import { decalerDeJours } from "@/lib/dates";`, puis sous `jourLePlusProche` :

```ts
/** Les jours qui ont au moins un match : un point sous leur case dans la frise. */
export function joursAvecMatchs(feed: CompetitionFeed[]): Set<string> {
  return new Set(entreesDuFlux(feed).map((e) => e.match.date).filter((d): d is string => d != null));
}

/**
 * Les cases de la frise : une semaine de part et d'autre d'aujourd'hui,
 * élargie jusqu'au jour choisi s'il en sort. « Voir mardi 30 » depuis un jour
 * vide doit tomber sur une case visible.
 *
 * Les clés « 2026-09-24 » se comparent comme des chaînes.
 */
export function joursDeLaFrise(aujourdhui: string, choisi: string, rayon = 7): string[] {
  let debut = decalerDeJours(aujourdhui, -rayon);
  let fin = decalerDeJours(aujourdhui, rayon);
  if (choisi < debut) debut = choisi;
  if (choisi > fin) fin = choisi;
  const jours: string[] = [];
  for (let j = debut; j <= fin; j = decalerDeJours(j, 1)) jours.push(j);
  return jours;
}
```

Puis `jourLePlusProche` réutilise `joursAvecMatchs`. Sa première instruction devient :

```ts
  const dates = [...joursAvecMatchs(feed)].sort();
```

**Step 4 : vérifier**

Run: `npm --prefix mobile test` → `Tests: 9 failed, 780 passed`. Puis lint et typecheck.

**Step 5 : commit**

```bash
git add mobile/src/lib/direct-tableau.ts mobile/src/__tests__/direct-tableau.test.ts
git commit -m "feat(mobile): les jours de la frise et ceux qui ont des matchs"
```

---

## Task 5 : les vibrations

**Files:**
- Modify: `mobile/package.json`, `mobile/package-lock.json` (via `expo install`)
- Create: `mobile/src/lib/retour.ts`
- Modify: `mobile/src/hooks/useSuivi.ts`

**Step 1 : installer**

Run (depuis `mobile/`) : `npx expo install expo-haptics`

Puis vérifier qu'aucune copie imbriquée n'est apparue :

Run: `ls mobile/node_modules/expo-haptics/node_modules 2>/dev/null; npm --prefix mobile ls expo-modules-core`
Expected : pas de `node_modules` sous `expo-haptics`, une seule version d'`expo-modules-core` (dédoublonnée).

Run: `npm --prefix mobile test` → `Tests: 9 failed, 780 passed`. **« 0 total » : régénérer le fichier de verrouillage**, comme au lot 1 (commit ab4827c).

**Step 2 : `mobile/src/lib/retour.ts`**

```ts
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// Les vibrations de l'application, en un seul endroit. Un téléphone sans
// moteur de vibration rejette la promesse : on l'ignore, ce n'est qu'un
// agrément. Sur le web, rien.

/** Le choix d'un jour ou d'un filtre. */
export function retourSelection(): void {
  if (Platform.OS === "web") return;
  Haptics.selectionAsync().catch(() => {});
}

/** L'étoile d'une compétition. */
export function retourImpact(): void {
  if (Platform.OS === "web") return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
```

**Step 3 : l'étoile vibre**

Dans `mobile/src/hooks/useSuivi.ts` :
- ajouter `import { retourImpact } from "~/lib/retour";` ;
- faire de `retourImpact();` la première ligne du corps de `basculer`.

L'étoile du Direct et celle du Compte passent toutes deux par là.

**Step 4 : vérifier**

Lint et typecheck, sans erreur.

**Step 5 : commit**

```bash
git add mobile/package.json mobile/package-lock.json mobile/src/lib/retour.ts mobile/src/hooks/useSuivi.ts
git commit -m "feat(mobile): une vibration sur l'étoile (expo-haptics)"
```

---

## Task 6 : respiration, point en direct, squelettes, état vide

**Files:**
- Create: `mobile/src/hooks/useMouvementReduit.ts`
- Create: `mobile/src/hooks/useRespiration.ts`
- Create: `mobile/src/components/direct/PointDirect.tsx`
- Create: `mobile/src/components/direct/SqueletteDirect.tsx`
- Create: `mobile/src/components/EtatVide.tsx`

**Step 1 : `useMouvementReduit.ts`**

```ts
import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** Vrai quand le téléphone demande de réduire les animations. */
export function useMouvementReduit(): boolean {
  const [reduit, setReduit] = useState(false);
  useEffect(() => {
    let vivant = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (vivant) setReduit(v);
      })
      .catch(() => {});
    const abonnement = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduit);
    return () => {
      vivant = false;
      abonnement.remove();
    };
  }, []);
  return reduit;
}
```

**Step 2 : `useRespiration.ts`**

```ts
import { useEffect, useState } from "react";
import { Animated, Platform } from "react-native";
import { useMouvementReduit } from "~/hooks/useMouvementReduit";

/** Le pilote natif n'existe pas sur le web : React Native Web préviendrait à chaque boucle. */
const PILOTE_NATIF = Platform.OS !== "web";

/**
 * Une opacité qui respire, de 1 à 0,35 et retour : le point d'un match en
 * cours, les squelettes. Immobile quand le téléphone demande moins
 * d'animations.
 */
export function useRespiration(demiPeriode = 800): Animated.Value {
  const reduit = useMouvementReduit();
  // useState et non useRef : lire une ref pendant le rendu est interdit (règle `refs`).
  const [opacite] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduit) {
      opacite.setValue(1);
      return;
    }
    const boucle = Animated.loop(
      Animated.sequence([
        Animated.timing(opacite, { toValue: 0.35, duration: demiPeriode, useNativeDriver: PILOTE_NATIF }),
        Animated.timing(opacite, { toValue: 1, duration: demiPeriode, useNativeDriver: PILOTE_NATIF }),
      ]),
    );
    boucle.start();
    return () => boucle.stop();
  }, [reduit, demiPeriode, opacite]);
  return opacite;
}
```

**Step 3 : `components/direct/PointDirect.tsx`**

```tsx
import { Animated, StyleSheet } from "react-native";
import { useRespiration } from "~/hooks/useRespiration";
import { couleurs } from "~/theme";

/** Le point rouge d'un match en cours. Décoratif : la minute dit déjà tout. */
export function PointDirect({ taille = 6 }: { taille?: number }) {
  const opacite = useRespiration();
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[styles.point, { width: taille, height: taille, borderRadius: taille / 2, opacity: opacite }]}
    />
  );
}

const styles = StyleSheet.create({
  point: { backgroundColor: couleurs.direct },
});
```

**Step 4 : `components/direct/SqueletteDirect.tsx`**

```tsx
import { Animated, StyleSheet, View } from "react-native";
import { useRespiration } from "~/hooks/useRespiration";
import { couleurs, rayons } from "~/theme";

/** Deux compétitions, la première avec deux matchs, la seconde avec un. */
const GROUPES = [2, 1];

/** La forme du Direct, le temps du premier chargement. */
export function SqueletteDirect() {
  const opacite = useRespiration();
  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Chargement du Direct"
      style={{ opacity: opacite }}
    >
      {GROUPES.map((cartes, g) => (
        <View key={g}>
          <View style={styles.entete}>
            <View style={styles.rond} />
            <View style={styles.titre} />
          </View>
          {Array.from({ length: cartes }, (_, c) => (
            <View key={c} style={styles.carte} />
          ))}
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  rond: { width: 24, height: 24, borderRadius: 12, backgroundColor: couleurs.surfaceHaute },
  titre: { width: 140, height: 12, borderRadius: 6, backgroundColor: couleurs.surfaceHaute },
  carte: { height: 84, marginHorizontal: 12, marginBottom: 8, borderRadius: rayons.carte, backgroundColor: couleurs.surface },
});
```

**Step 5 : `components/EtatVide.tsx`**

```tsx
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { couleurs, polices } from "~/theme";

interface Props {
  icone: ComponentProps<typeof Ionicons>["name"];
  texte: string;
  /** De quoi repartir : un bouton, le plus souvent. */
  children?: ReactNode;
}

/** Une liste vide, un chargement raté : une icône, une phrase, et de quoi repartir. */
export function EtatVide({ icone, texte, children }: Props) {
  return (
    <View style={styles.bloc}>
      <Ionicons name={icone} size={36} color={couleurs.texteDiscret} />
      <Text style={styles.texte}>{texte}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { alignItems: "center", paddingHorizontal: 32, paddingVertical: 40, gap: 14 },
  texte: { fontFamily: polices.texte, fontSize: 14, color: couleurs.texteSecondaire, textAlign: "center" },
});
```

**Step 6 : vérifier**

Lint et typecheck sans erreur. Les tests restent à `780 passed` : rien n'est encore branché.

**Step 7 : commit**

```bash
git add mobile/src/hooks mobile/src/components
git commit -m "feat(mobile): point qui pulse, squelettes et état vide"
```

---

## Task 7 : la frise des jours, le composant

**Files:**
- Create: `mobile/src/components/direct/FriseDesJours.tsx`

**Step 1 : le composant**

```tsx
import { useCallback, useEffect, useRef } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { libelleDuJour } from "@/lib/dates";
import { couleurs, polices } from "~/theme";

const LARGEUR = 48;
const ECART = 6;
const MARGE = 12;

interface Props {
  jours: string[];
  jour: string;
  aujourdhui: string;
  /** Les jours qui ont au moins un match : un point sous leur case. */
  avecMatchs: ReadonlySet<string>;
  /** Faux sous « En direct » et « Favoris », où le jour ne filtre rien. */
  actif: boolean;
  onChange: (jour: string) => void;
}

function etiquette(cle: string, aujourdhui: string): { haut: string; bas: string } {
  const d = new Date(`${cle}T00:00:00`);
  return {
    haut: cle === aujourdhui ? "Auj." : d.toLocaleDateString("fr-FR", { weekday: "short" }),
    bas: String(d.getDate()),
  };
}

export function FriseDesJours({ jours, jour, aujourdhui, avecMatchs, actif, onChange }: Props) {
  const liste = useRef<FlatList<string>>(null);
  const index = jours.indexOf(jour);

  // Le jour choisi reste au centre : à l'arrivée (onLayout), puis à chaque choix.
  const centrer = useCallback(
    (anime: boolean) => {
      if (index >= 0) liste.current?.scrollToIndex({ index, viewPosition: 0.5, animated: anime });
    },
    [index],
  );
  useEffect(() => centrer(true), [centrer]);

  return (
    <FlatList
      ref={liste}
      horizontal
      data={jours}
      extraData={[jour, actif, avecMatchs]}
      keyExtractor={(j) => j}
      showsHorizontalScrollIndicator={false}
      scrollEnabled={actif}
      // flexGrow: 0, comme les filtres : une liste horizontale dans une
      // colonne prendrait sinon toute la hauteur libre.
      style={[styles.frise, !actif && styles.inactive]}
      contentContainerStyle={styles.rangee}
      getItemLayout={(_, i) => ({ length: LARGEUR + ECART, offset: MARGE + (LARGEUR + ECART) * i, index: i })}
      onLayout={() => centrer(false)}
      renderItem={({ item }) => {
        const choisi = item === jour;
        const aDesMatchs = avecMatchs.has(item);
        const { haut, bas } = etiquette(item, aujourdhui);
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={aDesMatchs ? `${libelleDuJour(item)}, des matchs` : libelleDuJour(item)}
            accessibilityState={{ selected: choisi, disabled: !actif }}
            disabled={!actif}
            onPress={() => onChange(item)}
            style={[styles.case, choisi && styles.caseChoisie]}
          >
            <Text style={[styles.haut, choisi && styles.surPrimaire]}>{haut}</Text>
            <Text style={[styles.bas, choisi && styles.surPrimaire]}>{bas}</Text>
            <View style={[styles.point, aDesMatchs && (choisi ? styles.pointChoisi : styles.pointPlein)]} />
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  frise: { flexGrow: 0 },
  inactive: { opacity: 0.4 },
  rangee: { paddingHorizontal: MARGE, paddingVertical: 8 },
  case: { width: LARGEUR, marginRight: ECART, paddingVertical: 8, borderRadius: 12, alignItems: "center", gap: 2 },
  caseChoisie: { backgroundColor: couleurs.primaire },
  haut: { fontFamily: polices.texteMoyen, fontSize: 11, color: couleurs.texteDiscret },
  bas: { fontFamily: polices.titreMoyen, fontSize: 17, color: couleurs.texte },
  surPrimaire: { color: couleurs.surPrimaire },
  point: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  pointPlein: { backgroundColor: couleurs.primaire },
  pointChoisi: { backgroundColor: couleurs.surPrimaire },
});
```

**Step 2 : vérifier**

Lint et typecheck, sans erreur.

**Step 3 : commit**

```bash
git add mobile/src/components/direct/FriseDesJours.tsx
git commit -m "feat(mobile): la frise des jours"
```

---

## Task 8 : la carte de match et l'en-tête de compétition

**Files:**
- Create: `mobile/src/components/direct/CarteMatch.tsx`
- Modify: `mobile/src/components/direct/EnTeteCompetition.tsx`

**Step 1 : `CarteMatch.tsx`**

```tsx
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FOOT } from "@/i18n/foot";
import { minuteDuDirect, type Entry } from "@/lib/direct-shared";
import { Ecusson } from "~/components/Ecusson";
import { PointDirect } from "~/components/direct/PointDirect";
import { couleurs, polices, rayons } from "~/theme";

/** Le vocabulaire du site : « MT », « TAB », « Fin », « Annulé ». */
const f = FOOT.fr;

/** « devant » en gras, à tout moment ; « derrière » estompé, une fois le match joué seulement. */
type Rang = "devant" | "derriere" | "egal";

function Camp({ nom, logo, score, rang }: { nom: string; logo: string | null; score: number | null; rang: Rang }) {
  return (
    <View style={styles.camp}>
      <Ecusson url={logo} nom={nom} taille={24} />
      <Text
        style={[styles.nom, rang === "devant" && styles.nomDevant, rang === "derriere" && styles.estompe]}
        numberOfLines={1}
      >
        {nom}
      </Text>
      <Text style={[styles.score, rang === "derriere" && styles.estompe]}>{score ?? ""}</Text>
    </View>
  );
}

// Écussons : la copie posée sur le match. Le site corrige par la fiche
// comp_teams et le club (useEcussons) ; pas dans ce lot — un écusson périmé
// retombe sur les initiales.
export function CarteMatch({ entree, onPress }: { entree: Entry; onPress: () => void }) {
  const { match } = entree;
  const enDirect = match.status === "live";
  const joue = match.status === "completed";
  const annule = match.status === "cancelled";
  const domicile = match.scoreHome;
  const exterieur = match.scoreAway;
  const aScore = domicile != null && exterieur != null;
  // « 13′ », « 45+2′ », « MT », « TAB » ; vide pour un match du monde, sans horloge.
  const minute = enDirect
    ? minuteDuDirect(entree, { pause: f.minutePause, avant: f.minuteAvant, interrompu: f.minuteInterrompu, tirs: f.minuteTirs })
    : "";

  const rang = (pour: number | null, contre: number | null): Rang => {
    if (pour == null || contre == null || pour === contre) return "egal";
    if (pour > contre) return "devant";
    return joue ? "derriere" : "egal";
  };

  const etat = enDirect
    ? `, en direct${minute ? `, ${minute}` : ""}`
    : joue ? ", terminé" : annule ? ", annulé" : match.time ? `, à ${match.time}` : "";
  const score = aScore ? `, ${domicile} à ${exterieur}` : "";

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${match.homeTeamName} contre ${match.awayTeamName}${score}${etat}`}
      onPress={onPress}
      style={({ pressed }) => [styles.carte, enDirect && styles.carteDirect, pressed && styles.presse]}
    >
      <View style={styles.temps}>
        {enDirect ? (
          <View style={styles.minute}>
            <PointDirect />
            <Text style={styles.minuteTexte}>{minute}</Text>
          </View>
        ) : (
          <Text style={joue || annule ? styles.fin : styles.heure}>
            {joue ? f.fin.toUpperCase() : annule ? f.annule.toUpperCase() : match.time ?? "—"}
          </Text>
        )}
      </View>
      <View style={styles.camps}>
        <Camp nom={match.homeTeamName} logo={match.homeTeamLogo} score={aScore ? domicile : null} rang={rang(domicile, exterieur)} />
        <Camp nom={match.awayTeamName} logo={match.awayTeamLogo} score={aScore ? exterieur : null} rang={rang(exterieur, domicile)} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  carte: {
    flexDirection: "row", alignItems: "center", marginHorizontal: 12, marginBottom: 8,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: rayons.carte, backgroundColor: couleurs.surface,
  },
  // Le filet rouge d'un match en cours ; la marge intérieure compense sa largeur.
  carteDirect: { borderLeftWidth: 3, borderLeftColor: couleurs.direct, paddingLeft: 11 },
  presse: { backgroundColor: couleurs.surfaceHaute },
  temps: { width: 56 },
  minute: { flexDirection: "row", alignItems: "center", gap: 5 },
  minuteTexte: { fontFamily: polices.texteGras, fontSize: 13, color: couleurs.direct },
  heure: { fontFamily: polices.texteMoyen, fontSize: 13, color: couleurs.texte },
  fin: { fontFamily: polices.texteGras, fontSize: 11, letterSpacing: 0.5, color: couleurs.texteDiscret },
  camps: { flex: 1, gap: 8 },
  camp: { flexDirection: "row", alignItems: "center", gap: 10 },
  nom: { flex: 1, fontFamily: polices.texte, fontSize: 15, color: couleurs.texte },
  nomDevant: { fontFamily: polices.texteGras },
  score: { minWidth: 24, textAlign: "right", fontFamily: polices.titreMoyen, fontSize: 20, color: couleurs.texte },
  estompe: { color: couleurs.texteSecondaire },
});
```

**Step 2 : `EnTeteCompetition.tsx`**

Il reçoit un `style` facultatif : l'onglet Compte le pose sur une carte (Task 10).
- Import : `import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";`
- Dans `Props`, ajouter :

  ```tsx
    /** La ligne de l'onglet Compte le pose sur une carte. */
    style?: StyleProp<ViewStyle>;
  ```

- Déstructurer `style` ; la vue racine devient `<View style={[styles.entete, style]}>`.
- Écusson en `taille={24}`, étoile en `size={22}`.
- Les styles deviennent :

```tsx
const styles = StyleSheet.create({
  // Fond plein : l'en-tête reste collé en haut pendant que les cartes défilent dessous.
  entete: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
    backgroundColor: couleurs.fond,
  },
  titre: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  textes: { flex: 1 },
  nom: { fontFamily: polices.texteGras, fontSize: 14, color: couleurs.texte },
  sousTitre: { fontFamily: polices.texte, fontSize: 12, color: couleurs.texteDiscret },
});
```

**Step 3 : vérifier**

Lint et typecheck, sans erreur.

**Step 4 : commit**

```bash
git add mobile/src/components/direct
git commit -m "feat(mobile): la carte de match façon tableau d'affichage"
```

---

## Task 9 : l'écran Direct

**Files:**
- Create: `mobile/src/lib/navigateur.ts`
- Modify: `mobile/src/app/_layout.tsx` (l'ouverture d'une notification)
- Modify: `mobile/src/app/(tabs)/index.tsx` (réécrit)
- Modify: `mobile/src/components/direct/FiltresDirect.tsx`
- Delete: `mobile/src/components/direct/SelecteurJour.tsx`, `mobile/src/components/direct/LigneMatch.tsx`

**Step 1 : `lib/navigateur.ts`**

La fonction sort de l'écran Direct parce que le Compte s'en sert aussi.

```ts
import * as WebBrowser from "expo-web-browser";
import { urlDuSite } from "~/lib/config";
import { couleurs } from "~/theme";

/** Une page du site dans le navigateur intégré, jusqu'aux fiches natives des lots suivants. */
export function ouvrirSurLeSite(chemin: string): void {
  void WebBrowser.openBrowserAsync(urlDuSite(chemin), { toolbarColor: couleurs.fond, controlsColor: couleurs.primaire });
}
```

**Step 1 bis : la notification touchée passe par là aussi**

Dans `mobile/src/app/_layout.tsx` :
- `void WebBrowser.openBrowserAsync(urlDuSite(lien), { … });` devient `ouvrirSurLeSite(lien);` ;
- retirer les imports devenus inutiles (`expo-web-browser`, `urlDuSite`) ;
- ajouter `import { ouvrirSurLeSite } from "~/lib/navigateur";`.

`couleurs` y reste importé pour le thème de navigation (Task 2).

**Step 2 : `FiltresDirect.tsx`**

Le nombre de matchs en direct passe dans la pastille de l'en-tête :
- le prop `enDirect` disparaît ;
- les puces deviennent une constante `PUCES` au niveau du module, avec les libellés « Tous », « En direct » et « Favoris » ;
- la signature devient `FiltresDirect({ filtre, onChange }: { filtre: FiltreDirect; onChange: (f: FiltreDirect) => void })`.

Les styles deviennent :

```tsx
const styles = StyleSheet.create({
  defilement: { flexGrow: 0 },
  rangee: { gap: 8, paddingHorizontal: 16, paddingBottom: 8, alignItems: "center" },
  puce: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1,
    borderColor: couleurs.bordure, backgroundColor: couleurs.surface,
  },
  puceActive: { backgroundColor: couleurs.primaire, borderColor: couleurs.primaire },
  libelle: { fontFamily: polices.texteMoyen, fontSize: 13, color: couleurs.texteSecondaire },
  libelleActif: { color: couleurs.surPrimaire },
});
```

**Step 3 : `app/(tabs)/index.tsx`, en entier**

```tsx
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { cleDuJour, libelleDuJour } from "@/lib/dates";
import { competitionHref, entryKey, matchHref, type Entry } from "@/lib/direct-shared";
import { FRIENDLY_COMP_ID } from "@/lib/friendlies-shared";
import { isWorldComp } from "@/lib/world-board-shared";
import type { Competition } from "@/types";
import { Bouton } from "~/components/Bouton";
import { CarteMatch } from "~/components/direct/CarteMatch";
import { EnTeteCompetition } from "~/components/direct/EnTeteCompetition";
import { FiltresDirect } from "~/components/direct/FiltresDirect";
import { FriseDesJours } from "~/components/direct/FriseDesJours";
import { PointDirect } from "~/components/direct/PointDirect";
import { SqueletteDirect } from "~/components/direct/SqueletteDirect";
import { EtatVide } from "~/components/EtatVide";
import { useDirect } from "~/hooks/useDirect";
import { useSuivi } from "~/hooks/useSuivi";
import {
  compterEnDirect, groupesDuTableau, jourLePlusProche, joursAvecMatchs, joursDeLaFrise, type FiltreDirect,
} from "~/lib/direct-tableau";
import { ouvrirSurLeSite } from "~/lib/navigateur";
import { retourSelection } from "~/lib/retour";
import { couleurs, polices, rayons } from "~/theme";

const heure = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

type Section = { key: string; competition: Competition; data: Entry[] };

const AUCUN_JOUR: ReadonlySet<string> = new Set();

export default function EcranDirect() {
  const { feed, majA, horsLigne, chargement, rafraichir } = useDirect();
  const suivi = useSuivi();
  const [aujourdhui] = useState(() => cleDuJour(new Date()));
  const [jour, setJour] = useState(aujourdhui);
  const [filtre, setFiltre] = useState<FiltreDirect>("tous");

  const sections = useMemo<Section[]>(
    () =>
      feed
        ? groupesDuTableau(feed, { jour, filtre, suivies: suivi.ids }).map((g) => ({
            key: g.competition.id,
            competition: g.competition,
            data: g.entries,
          }))
        : [],
    [feed, jour, filtre, suivi.ids],
  );
  const jours = useMemo(() => joursDeLaFrise(aujourdhui, jour), [aujourdhui, jour]);
  const avecMatchs = useMemo(() => (feed ? joursAvecMatchs(feed) : AUCUN_JOUR), [feed]);
  const enDirect = feed ? compterEnDirect(feed) : 0;
  const proche = feed && sections.length === 0 && filtre === "tous" ? jourLePlusProche(feed, jour) : null;

  function choisirJour(j: string) {
    if (j === jour) return;
    retourSelection();
    setJour(j);
  }

  function choisirFiltre(f: FiltreDirect) {
    if (f === filtre) return;
    retourSelection();
    setFiltre(f);
  }

  return (
    <SafeAreaView style={styles.ecran} edges={["top"]}>
      <View style={styles.entete}>
        <Text style={styles.titre}>Direct</Text>
        {enDirect > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${enDirect} en direct : voir les matchs en cours`}
            onPress={() => choisirFiltre("direct")}
            hitSlop={8}
            style={styles.pastille}
          >
            <PointDirect />
            <Text style={styles.pastilleTexte}>{enDirect} en direct</Text>
          </Pressable>
        ) : null}
      </View>
      <FriseDesJours
        jours={jours}
        jour={jour}
        aujourdhui={aujourdhui}
        avecMatchs={avecMatchs}
        actif={filtre === "tous"}
        onChange={choisirJour}
      />
      <FiltresDirect filtre={filtre} onChange={choisirFiltre} />
      {!feed ? (
        horsLigne ? (
          <EtatVide icone="cloud-offline-outline" texte="Impossible de charger le Direct.">
            <Bouton titre="Réessayer" variante="contour" onPress={rafraichir} occupe={chargement} />
          </EtatVide>
        ) : (
          <SqueletteDirect />
        )
      ) : (
        <>
          {horsLigne && majA ? (
            <View style={styles.bandeau}>
              <Ionicons name="cloud-offline-outline" size={16} color={couleurs.texteSecondaire} />
              <Text style={styles.bandeauTexte}>Pas de connexion — mis à jour à {heure(majA)}</Text>
            </View>
          ) : null}
          <SectionList<Entry, Section>
            sections={sections}
            keyExtractor={entryKey}
            stickySectionHeadersEnabled
            contentContainerStyle={styles.liste}
            renderSectionHeader={({ section }) => {
              const c = section.competition;
              return (
                <EnTeteCompetition
                  competition={c}
                  suivable={c.id !== FRIENDLY_COMP_ID && !isWorldComp(c.id)}
                  suivie={suivi.ids.has(c.id)}
                  onEtoile={() => void suivi.basculer(c.id)}
                  onPress={() => ouvrirSurLeSite(competitionHref(c))}
                />
              );
            }}
            renderItem={({ item }) => <CarteMatch entree={item} onPress={() => ouvrirSurLeSite(matchHref(item))} />}
            refreshControl={
              <RefreshControl
                refreshing={chargement}
                onRefresh={rafraichir}
                tintColor={couleurs.primaire}
                colors={[couleurs.primaire]}
                progressBackgroundColor={couleurs.surface}
              />
            }
            ListEmptyComponent={
              <EtatVide
                icone={filtre === "favoris" ? "star-outline" : filtre === "direct" ? "pulse-outline" : "calendar-outline"}
                texte={
                  filtre === "favoris"
                    ? "Touche l'étoile d'une compétition pour la retrouver ici."
                    : filtre === "direct"
                      ? "Aucun match en cours."
                      : "Aucun match ce jour-là."
                }
              >
                {proche ? (
                  <Bouton
                    titre={`Voir ${libelleDuJour(proche).toLowerCase()}`}
                    variante="contour"
                    onPress={() => choisirJour(proche)}
                  />
                ) : null}
              </EtatVide>
            }
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  entete: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8,
  },
  titre: { fontFamily: polices.titre, fontSize: 28, color: couleurs.texte },
  pastille: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, backgroundColor: couleurs.surface,
  },
  pastilleTexte: { fontFamily: polices.texteGras, fontSize: 12, color: couleurs.texte },
  bandeau: {
    flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 12, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: rayons.champ, backgroundColor: couleurs.surface,
  },
  bandeauTexte: { flex: 1, fontFamily: polices.texteMoyen, fontSize: 12, color: couleurs.texteSecondaire },
  liste: { paddingBottom: 24 },
});
```

**Step 4 : supprimer les anciens composants**

```bash
git rm mobile/src/components/direct/SelecteurJour.tsx mobile/src/components/direct/LigneMatch.tsx
```

**Step 5 : vérifier**

- `npm --prefix mobile test` → `Tests: 9 failed, 780 passed`
- lint et typecheck, sans erreur
- `grep -rn "SelecteurJour\|LigneMatch" mobile/src` → rien

**Step 6 : commit**

```bash
git add mobile/src
git commit -m "feat(mobile): le Direct sombre — frise, pastille en direct, cartes, squelettes"
```

---

## Task 10 : l'onglet Compte

**Files:**
- Modify: `mobile/src/lib/direct-firestore.ts`
- Create: `mobile/src/hooks/useCompetitionsSuivies.ts`
- Modify: `mobile/src/app/(tabs)/compte.tsx` (réécrit)
- Modify: `mobile/src/components/ReglagePush.tsx` (sur une carte)

**Step 1 : `lireCompetitions`, dans `lib/direct-firestore.ts`**

- Ajouter `getDoc` à l'import de `firebase/firestore`.
- Remplacer l'import des mappers par `import { toCompetition, toCompMatch } from "@/lib/competition-mappers";`.
- Remplacer l'import des types par `import type { Competition, CompMatch, FirestoreCompetition, FirestoreCompMatch } from "@/types";`.
- Le commentaire d'en-tête « Les trois lectures/écritures Firestore du lot » devient « Les lectures et écritures Firestore de l'application ».

Puis, à la fin du fichier :

```ts
/**
 * Des compétitions par identifiant, triées par nom. Une compétition supprimée
 * depuis qu'on la suit est ignorée. Un `getDoc` chacune : la lecture est
 * publique, et une requête `in` s'arrête à trente identifiants.
 */
export async function lireCompetitions(ids: readonly string[]): Promise<Competition[]> {
  const snaps = await Promise.all(ids.map((cid) => getDoc(doc(db, "competitions", cid))));
  return snaps
    .filter((s) => s.exists())
    .map((s) => toCompetition(s.id, s.data() as FirestoreCompetition))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
```

**Step 2 : `hooks/useCompetitionsSuivies.ts`**

```ts
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import type { Competition } from "@/types";
import { lireCompetitions } from "~/lib/direct-firestore";

/**
 * Les compétitions suivies, relues à chaque arrivée sur l'onglet.
 *
 * UNE COMPÉTITION QU'ON VIENT D'ARRÊTER DE SUIVRE RESTE AFFICHÉE, étoile
 * vide, jusqu'à ce qu'on quitte l'onglet : un appui raté se rattrape d'un
 * second appui. `garder` la retient ; la sortie de l'onglet l'oublie. Comme
 * elle reste dans la liste lue, l'arrêt du suivi ne déclenche aucune relecture.
 */
export function useCompetitionsSuivies(suivies: readonly string[]) {
  const [gardees, setGardees] = useState<ReadonlySet<string>>(() => new Set());
  const [competitions, setCompetitions] = useState<Competition[] | null>(null);
  const [erreur, setErreur] = useState(false);

  // Une chaîne : `suivies` change d'identité à chaque rendu, la liste non.
  const cle = useMemo(() => [...new Set([...suivies, ...gardees])].sort().join(","), [suivies, gardees]);

  useFocusEffect(
    useCallback(() => {
      let vivant = true;
      lireCompetitions(cle ? cle.split(",") : [])
        .then((lues) => {
          if (!vivant) return;
          setCompetitions(lues);
          setErreur(false);
        })
        .catch(() => {
          if (vivant) setErreur(true);
        });
      return () => {
        vivant = false;
      };
    }, [cle]),
  );

  // La sortie de l'onglet oublie les compétitions gardées.
  useFocusEffect(useCallback(() => () => setGardees(new Set()), []));

  const garder = useCallback((cid: string) => setGardees((g) => new Set(g).add(cid)), []);

  return { competitions, erreur, garder };
}
```

**Step 3 : `app/(tabs)/compte.tsx`, en entier**

```tsx
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Alert, Animated, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { competitionHref } from "@/lib/direct-shared";
import type { UserProfile } from "@/types";
import { Bouton } from "~/components/Bouton";
import { EnTeteCompetition } from "~/components/direct/EnTeteCompetition";
import { EtatVide } from "~/components/EtatVide";
import { ReglagePush } from "~/components/ReglagePush";
import { useCompetitionsSuivies } from "~/hooks/useCompetitionsSuivies";
import { useRespiration } from "~/hooks/useRespiration";
import { useSuivi } from "~/hooks/useSuivi";
import { useAuth } from "~/lib/auth";
import { initiales } from "~/lib/initiales";
import { ouvrirSurLeSite } from "~/lib/navigateur";
import { couleurs, polices, rayons } from "~/theme";

export default function EcranCompte() {
  const { utilisateur, profil, deconnexion } = useAuth();
  const router = useRouter();

  if (!utilisateur) {
    return (
      <SafeAreaView style={styles.ecran} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.contenu}>
          <Text style={styles.titre}>Compte</Text>
          <EtatVide icone="person-circle-outline" texte="Un compte pour suivre tes compétitions et les retrouver en tête du Direct.">
            <View style={styles.boutons}>
              <Bouton titre="Se connecter" onPress={() => router.push("/connexion")} />
              <Bouton titre="Créer un compte" variante="contour" onPress={() => router.push("/inscription")} />
            </View>
          </EtatVide>
        </ScrollView>
      </SafeAreaView>
    );
  }

  function seDeconnecter() {
    Alert.alert("Se déconnecter ?", undefined, [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: () => void deconnexion() },
    ]);
  }

  return (
    <SafeAreaView style={styles.ecran} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titre}>Compte</Text>
        {profil ? (
          <>
            <CarteProfil profil={profil} email={profil.email ?? utilisateur.email} />
            <CompetitionsSuivies suivies={profil.followedCompetitionIds ?? []} />
          </>
        ) : (
          <Text style={styles.texte}>Profil indisponible pour l&apos;instant. Vérifie ta connexion.</Text>
        )}
        <ReglagePush uid={utilisateur.uid} />
        <Bouton titre="Se déconnecter" variante="contour" onPress={seDeconnecter} />
      </ScrollView>
    </SafeAreaView>
  );
}

function CarteProfil({ profil, email }: { profil: UserProfile; email: string | null }) {
  const nom = `${profil.firstName} ${profil.lastName}`.trim();
  return (
    <View style={styles.carte}>
      {profil.profilePictureUrl?.startsWith("http") ? (
        <Image
          source={{ uri: profil.profilePictureUrl }}
          style={styles.avatar}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.avatar, styles.avatarVide]}>
          <Text style={styles.avatarTexte}>{initiales(nom)}</Text>
        </View>
      )}
      <View style={styles.identite}>
        <Text style={styles.nom} numberOfLines={1}>{nom}</Text>
        {email ? <Text style={styles.texte} numberOfLines={1}>{email}</Text> : null}
        {profil.locationCity ? (
          <View style={styles.ville}>
            <Ionicons name="location-outline" size={14} color={couleurs.texteDiscret} />
            <Text style={styles.texteDiscret}>{profil.locationCity}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function CompetitionsSuivies({ suivies }: { suivies: readonly string[] }) {
  const router = useRouter();
  const suivi = useSuivi();
  const { competitions, erreur, garder } = useCompetitionsSuivies(suivies);

  let contenu: ReactNode;
  if (competitions === null) {
    contenu = erreur ? (
      <Text style={styles.texte}>Impossible de charger tes compétitions. Vérifie ta connexion.</Text>
    ) : (
      <SqueletteLignes />
    );
  } else if (competitions.length === 0) {
    contenu = (
      <EtatVide icone="star-outline" texte="Aucune compétition suivie. Touche l'étoile d'une compétition dans le Direct.">
        <Bouton titre="Aller au Direct" variante="contour" onPress={() => router.navigate("/")} />
      </EtatVide>
    );
  } else {
    contenu = competitions.map((c) => (
      <EnTeteCompetition
        key={c.id}
        competition={c}
        suivable
        suivie={suivi.ids.has(c.id)}
        onEtoile={() => {
          if (suivi.ids.has(c.id)) garder(c.id);
          void suivi.basculer(c.id);
        }}
        onPress={() => ouvrirSurLeSite(competitionHref(c))}
        style={styles.ligne}
      />
    ));
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitre}>Compétitions suivies</Text>
      {contenu}
    </View>
  );
}

function SqueletteLignes() {
  const opacite = useRespiration();
  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Chargement des compétitions"
      style={[styles.squelette, { opacity: opacite }]}
    >
      <View style={styles.ligneSquelette} />
      <View style={styles.ligneSquelette} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  contenu: { paddingHorizontal: 16, paddingBottom: 32, gap: 20 },
  titre: { fontFamily: polices.titre, fontSize: 28, color: couleurs.texte, paddingTop: 8 },
  boutons: { alignSelf: "stretch", gap: 12 },
  carte: {
    flexDirection: "row", alignItems: "center", gap: 14, padding: 16,
    borderRadius: rayons.carte, backgroundColor: couleurs.surface,
  },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarVide: { backgroundColor: couleurs.primaire, alignItems: "center", justifyContent: "center" },
  avatarTexte: { fontFamily: polices.titreMoyen, fontSize: 20, color: couleurs.surPrimaire },
  identite: { flex: 1, gap: 2 },
  nom: { fontFamily: polices.titreMoyen, fontSize: 20, color: couleurs.texte },
  texte: { fontFamily: polices.texte, fontSize: 14, color: couleurs.texteSecondaire },
  ville: { flexDirection: "row", alignItems: "center", gap: 4 },
  texteDiscret: { fontFamily: polices.texte, fontSize: 13, color: couleurs.texteDiscret },
  section: { gap: 8 },
  sectionTitre: {
    fontFamily: polices.texteGras, fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase",
    color: couleurs.texteDiscret,
  },
  // paddingTop et paddingBottom, pas paddingVertical : en React Native, le
  // côté précis l'emporte sur le raccourci, quel que soit l'ordre des styles.
  ligne: { borderRadius: rayons.carte, backgroundColor: couleurs.surface, paddingTop: 12, paddingBottom: 12 },
  squelette: { gap: 8 },
  ligneSquelette: { height: 60, borderRadius: rayons.carte, backgroundColor: couleurs.surface },
});
```

**Step 3 bis : le réglage des notifications sur une carte**

Dans `mobile/src/components/ReglagePush.tsx`, seul le style `bloc` change. Les filets haut et bas deviennent une carte, comme le profil au-dessus :

```tsx
  bloc: { gap: 6, padding: 16, borderRadius: rayons.carte, backgroundColor: couleurs.surface },
```

Importer `rayons` avec `couleurs` et `polices`. Les deux `trackColor` sont passés à `primaire` en Task 1. Sur Android, ajouter aux deux `Switch` `thumbColor={couleurs.texte}`, sinon le curseur reste du gris système sur fond sombre.

**Step 4 : vérifier**

- `npm --prefix mobile test` → `Tests: 9 failed, 780 passed`
- lint et typecheck, sans erreur

**Step 5 : commit**

```bash
git add mobile/src
git commit -m "feat(mobile): l'onglet Compte — carte profil et compétitions suivies"
```

---

## Task 11 : vérifier chaque écran dans Chrome

**Step 1 : lancer la version web**

Lancer `npm --prefix mobile run web` en arrière-plan. Attendre « Web is waiting on http://localhost:8081 ».

**Step 2 : Chrome, en taille téléphone**

- Charger les outils Chrome (`tabs_context_mcp`, `navigate`, `computer`, `read_page`, `resize_window`, `javascript_tool`, `read_console_messages`).
- Ouvrir `http://localhost:8081` et passer la fenêtre en 390 × 844.

**Step 3 : les écrans, dans cet ordre**

1. **Accueil** : vider `localStorage` (`localStorage.clear()`) puis recharger. Vérifier que le bouton « Voir le direct » est vert avec un libellé sombre, et que le lien « J'ai déjà un compte » est vert.
2. **Direct, chargement** : les squelettes apparaissent avant les cartes. Si le réseau est trop rapide pour les voir, les laisser : ils se verront sur le téléphone.
3. **Direct, Tous** :
   - la frise est centrée sur « Auj. », avec des points sous les jours qui ont des matchs ;
   - les cartes sont arrondies ;
   - un match joué montre « FIN » et son perdant estompé.
4. **Direct, un jour vide** : l'état vide montre l'icône calendrier, et « Voir … » tombe sur une case visible de la frise.
5. **Direct, En direct et Favoris** : la frise est estompée et ne répond plus.
6. **Pastille « en direct »** : s'il y a un match en cours, elle est affichée, son point pulse, et la toucher active le filtre.
7. **Compte, sans connexion** : l'icône et les deux boutons.
8. **Connexion** (modale) : la croix dans un rond, et la bordure verte au focus d'un champ.
9. **Compte, connecté** : **demander à l'utilisateur de se connecter lui-même**. Vérifier la carte profil avec les initiales et la liste des compétitions suivies. Toucher une étoile : la ligne reste avec une étoile vide ; changer d'onglet puis revenir : la ligne a disparu.

**Step 4 : la console**

`read_console_messages` avec `onlyErrors` : aucune erreur nouvelle. L'avertissement `useNativeDriver` ne doit pas apparaître, puisque le web n'utilise pas le pilote natif.

**Step 5 : les preuves**

Faire une capture du Direct, de la frise en mode Favoris, du Compte connecté et de la connexion. Les envoyer à l'utilisateur avec `SendUserFile`.

**Step 6 : corriger, puis recommencer**

Chaque écart trouvé : corriger, relancer les tests, le lint et le typecheck, faire un commit `fix(mobile): …`, puis revérifier l'écran concerné.

---

## Task 12 : le build de développement EAS, puis le téléphone

`expo-haptics` et `userInterfaceStyle` sont natifs : **l'ancien build planterait au lancement**. `expo-notifications` est déjà dans l'application : le nouveau build le reprend tel quel.

**Step 1 : lancer le build**

Run (depuis `mobile/`) : `npx eas-cli build --profile development --platform android --non-interactive`

Le lancer en arrière-plan : il dure environ 15 minutes. Si le cache npx d'`eas-cli` est corrompu (déjà vu), supprimer le dossier concerné sous `_npx` et relancer.

**Step 2 : Metro**

Une fois le build prêt, lancer Metro en arrière-plan :

`REACT_NATIVE_PACKAGER_HOSTNAME=<IP LAN> npx expo start --dev-client --lan --port 8081`

Si un ancien Metro occupe le port 8081, l'arrêter d'abord.

**Step 3 : envoyer à l'utilisateur**

Lui envoyer le lien d'installation de l'APK. Lui demander de tester :
- les vibrations sur l'étoile, les jours et les filtres ;
- le point qui pulse ;
- le clavier et les alertes sombres ;
- l'absence d'éclair blanc entre deux écrans.

---

## Task 13 : documentation, puis PR (sur accord)

**Step 1 : le design**

Passer le statut à « Implémenté sur `claude/app-ui-sombre` », avec les écarts constatés pendant l'exécution.

**Step 2 : la mémoire**

Mettre à jour `app-mobile-expo.md` :
- l'identité sombre ;
- le nouveau build EAS ;
- la règle « un module natif ajouté = un nouveau build ».

**Step 3 : la PR, sur demande seulement**

Après l'accord de l'utilisateur :

```bash
git push -u origin claude/app-ui-sombre
gh pr create --base master --title "App mobile : identité sombre, frise des jours, Direct en cartes, Compte enrichi" --body-file <corps>
```

Le corps de la PR se termine par la ligne d'attribution Claude Code. **Ne pas fusionner sans demande explicite** : la fusion déploie en production.

---

## Révision du 2026-10-21 (voir le design, même titre)

Exécutée dans la session, après la Task 11 et avant le build EAS. Chaque tâche finit sur les tests, le lint `--no-cache` et le typecheck. La suite complète doit passer : les 9 échecs de master sont réparés sur `claude/reparer-tests-classement` ; sur cette branche, ils restent tant qu'elle n'est pas fusionnée.

- **R1, palette noire (TDD).** `theme.test.ts` lit le fond de lancement dans `app.json`. Les paires testées sont chaque texte sur `fond`, `surface` et `surfaceHaute`, plus le blanc sur `bouton`. Ensuite : les jetons de la révision, `app.json` (lancement en `#080d0b`), et la suppression de `surPrimaire` au profit de `bouton` / `surBouton` et des voiles `primaireVoile` / `directVoile`.
- **R2, typo.** Ajouter `DMSans_600SemiBold`, `DMSans_900Black` et `Outfit_900Black` à `useFonts`. Les polices passent à `titre: Outfit_900Black`, avec `texteDemi` et `texteNoir` en plus.
- **R3, socle carré.** `Bouton` : plein `#047857`, 11 px Black en capitales ; contour en filet ; lien de pied 10 px Black en capitales. `Champ` : étiquette 10 px Black en capitales, focus en `bordureForte`. `EcranAuth` : titre en Outfit Black capitales. `rayons` disparaît.
- **R4, Direct.** Pour le repli, TDD sur une fonction pure `sectionsDuDirect(groupes, replies)`, qui vide `data` d'une compétition repliée et garde son nombre de matchs. Ensuite : en-tête repliable, lignes au lieu de cartes, frise soulignée, pastilles du site, squelettes carrés.
- **R5, Compte.** Titre en capitales, carte profil carrée, avatar sur voile vert, titres de section en 10 px Black capitales, réglage push carré.
- **R6, accueil.** `login_side.jpg` devient `assets/accueil/fond.jpg` et les trois anciennes images sont supprimées. Image fixe, textes défilants, titres en Outfit Black capitales.
- **R7, vérification** dans le Chrome sans fenêtre (Metro `--clear`), captures, puis connexion de l'utilisateur pour le Compte.
