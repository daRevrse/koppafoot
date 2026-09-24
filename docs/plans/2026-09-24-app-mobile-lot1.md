# Application mobile, lot 1 — plan d'implémentation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal :** une application Expo (Android) qui s'ouvre sur trois écrans d'accueil, puis sur le Direct sans compte, avec connexion e-mail (puis Google) et suivi de compétition lié au compte.

**Architecture :** `koppafoot/mobile/` est un projet Expo autonome qui réutilise les modules sans SDK de `src/lib` via l'alias `@/` → `../src/`. Le web gagne une route `GET /api/direct` et deux modules partagés (`lib/direct-shared`, `lib/profil`). L'application lit Firestore en direct (écouteurs, suivi) et l'API pour le reste.

**Tech stack :** Expo SDK 57 (React Native 0.86, React 19.2.3), Expo Router 57, Firebase JS SDK 12, jest-expo 57, expo-web-browser, expo-image, `@react-native-google-signin/google-signin` 16 (partie C seulement).

**Design de référence :** [2026-09-24-app-mobile-lot1-design.md](2026-09-24-app-mobile-lot1-design.md)

---

## À lire d'abord

**Trois parties, deux PR.**
- **Partie A — web** : branche `claude/app-mobile` (déjà créée depuis `origin/master`, porte le design et ce plan). PR 1. **Ne pas pousser ni ouvrir la PR sans l'accord de l'utilisateur.**
- **Partie B — application** : après la fusion de la PR 1, nouvelle branche `claude/app-mobile-lot1` depuis `origin/master` à jour. PR 2.
- **Partie C — Google** : bloquée par des prérequis côté utilisateur (voir C0). Ne pas commencer sans eux.

**Vérifier la base avant d'écrire** (règle du projet) : `git fetch && git rev-list --left-right --count origin/master...HEAD`. La production est `origin/master`.

**Le web n'a pas de lanceur de tests.** Ne pas en inventer. Côté web, la vérification est : `npx tsc --noEmit`, `npm run lint`, `npm run build`, et le navigateur. Les tests automatiques vivent dans `mobile/` (jest-expo) ; ils couvrent aussi les deux modules web extraits, puisque l'application les importe.

**Next.js 16 : lire `node_modules/next/dist/docs/` avant d'écrire une route** (AGENTS.md). Ce projet n'active pas Cache Components : les options de segment (`dynamic`, `revalidate`) s'appliquent.

**Le contrat des modules partagés.** Un fichier de `src/lib` importé par l'application :
- n'importe ni `firebase/*`, ni `firebase-admin`, ni `next/*`, ni React, ni un autre module qui le fait ;
- s'importe entre modules en `@/lib/…` et `@/types` — l'application résout `@/` vers `../src/` ;
- n'importe aucun paquet npm, **à une exception près** : `lib/champs-valides` importe `yup`. L'application installe donc `yup` elle aussi. **Tout paquet importé depuis `../src` se résout comme depuis l'application** : c'est le `resolveRequest` de `mobile/metro.config.js` (B2), vérifié par une sonde (un module du site important `date-fns`, absent de l'application, fait échouer le build). Une seule copie de yup, et le même comportement en local que sur EAS, où seul `mobile/` est installé. Côté types, l'alias `"yup"` de `mobile/tsconfig.json` fait de même pour TypeScript — **mais Metro ne l'applique pas** (constaté en B2), d'où le `resolveRequest`. Par prudence, tester une erreur yup avec `ValidationError.isError(e)`, jamais `instanceof`.
- **Conséquence de ce même mécanisme** : un alias des `paths` est appliqué à l'exécution. Ne jamais y mettre un alias « pour les types seulement » (vers un `.d.ts`) : Metro chargerait le fichier de déclarations à la place du module.

**Pièges connus, à ne pas redécouvrir :**
- `getAuth()` ne persiste pas en React Native : `initializeAuth` + `getReactNativePersistence(AsyncStorage)`. À l'exécution, Metro choisit la version React Native de `@firebase/auth` (condition `react-native` de ses `exports`), qui exporte bien la fonction. Mais les types publics (`auth-public.d.ts`, condition `types`, lue en premier) ne la déclarent pas : un `@ts-expect-error` ciblé sur cet import, **pas** un alias des `paths` (voir le contrat ci-dessus).
- Google Sign-In ne tourne pas dans Expo Go : development build obligatoire (partie C).
- Un logo d'équipe peut être une chaîne qui n'est pas une URL (des initiales ont déjà été stockées comme URL, `GET /CA 404` sur le web) : n'afficher une image que si la valeur commence par `http`.
- Les visuels `public/branding/fan_*.png` sont des **JPEG** malgré l'extension : les copier en `.jpg`.
- Windows : `npx expo install … -- --save-dev` (le `--` est requis avant `--save-dev`).

---

# Partie A — Web (PR 1)

## Task A1 : `lib/direct-shared` — la minute, les liens et l'ordre du Direct

Ces fonctions vivent dans `DirectHomeV2.tsx` et l'application en a besoin telles quelles. On les **déplace** (pas de copie), avec leurs commentaires.

**Files :**
- Create : `src/lib/direct-shared.ts`
- Modify : `src/components/direct/DirectHomeV2.tsx` (retirer les définitions, importer)
- Modify : `src/lib/competition-admin.ts:88-92` (le type `CompetitionFeed` part dans le module partagé, réexporté ici)

**Step 1 : créer `src/lib/direct-shared.ts`**

```ts
// ============================================
// Le Direct, ce qui ne dépend d'aucun écran.
//
// La minute d'un match en cours, l'adresse de sa page, l'ordre des
// compétitions sur le tableau : trois règles qui vivaient dans DirectHomeV2
// et que l'application mobile doit appliquer À L'IDENTIQUE. Deux copies,
// c'est deux minutes différentes pour le même match le jour où l'une bouge.
//
// Module sans SDK : il se lit du serveur, du navigateur et de l'application
// (qui résout `@/` vers ce `src/`). N'y importer ni Firebase, ni Next, ni React.
// ============================================

import type { Competition, CompMatch } from "@/types";
import { FRIENDLY_COMP_ID } from "@/lib/friendlies-shared";
import { isWorldComp } from "@/lib/world-board-shared";

/** One competition with ALL its fixtures, the Direct feed reads across them. */
export interface CompetitionFeed {
  competition: Competition;
  matches: CompMatch[];
}

/** Un match et la compétition sous laquelle le tableau le range. */
export type Entry = { match: CompMatch; competition: Competition };

/**
 * Live minute off the shared live_state clock (same math as LiveMatchConsole).
 *
 * `maintenant` n'existe que pour les tests : l'horloge du match est celle du
 * serveur (`timerStartAt` + `timerOffset`), jamais un compteur local.
 */
export function liveMinute(m: CompMatch, maintenant: number = Date.now()): number {
  const ls = m.liveState;
  if (!ls) return 0;
  if (m.status === "live" && ls.isTimerRunning && ls.timerStartAt) {
    const elapsed = maintenant - new Date(ls.timerStartAt).getTime() + (ls.timerOffset || 0);
    return Math.floor(elapsed / 60000) + 1;
  }
  return Math.floor((ls.timerOffset || 0) / 60000) + 1;
}

/** Second line of a competition header, the "country" line of the model. */
export function competitionSubtitle(c: Competition): string {
  return c.venueCity ?? c.organizerName ?? "";
}

/**
 * Ou mene l'en-tete d'un groupe. Les amicaux n'ont pas de page de
 * competition : on renvoie vers leur liste.
 */
export function competitionHref(c: Competition): string {
  if (c.id === FRIENDLY_COMP_ID) return "/matches";
  // Une competition mondiale a sa propre page, quand le fournisseur nous a
  // donne son code ; sinon on renvoie vers l'annuaire.
  if (isWorldComp(c.id)) return c.slug ? `/competitions/monde/${c.slug}` : "/competitions";
  return `/c/${c.slug}`;
}

export function matchHref(e: Entry): string {
  // Un amical n'appartient a aucune competition : sa page est /matches/[id].
  // Le fanion vient de FRIENDLY_COMP_ID (voir friendlies-admin).
  if (e.competition.id === FRIENDLY_COMP_ID) return `/matches/${e.match.id}`;
  // Un match du fournisseur externe n'a pas de page detail chez nous : on n'a
  // ni sa feuille de match, ni ses buteurs, ni de console pour le suivre, et
  // une fiche vide vaut moins que la page de sa competition. Il se pronostique
  // en revanche depuis l'affiche du Direct, un pronostic ne demandant qu'un
  // identifiant de match. On renvoie donc vers sa competition.
  if (isWorldComp(e.competition.id)) return competitionHref(e.competition);
  return `/c/${e.competition.slug}/matches/${e.match.id}`;
}

export function entryKey(e: Entry): string {
  return `${e.competition.id}:${e.match.id}`;
}

/** Kickoff sort key, undated fixtures land last. */
export function kickoff(e: Entry): string {
  return `${e.match.date ?? "9999-99-99"}T${e.match.time ?? "99:99"}`;
}

/**
 * L'ORDRE DES COMPÉTITIONS, LE MÊME POUR LE CARROUSEL ET POUR LE TABLEAU.
 *
 * Ce qui se joue maintenant devant, puis LE FOOTBALL D'ICI avant le football
 * mondial, puis l'heure du coup d'envoi.
 *
 * La règle vivait dans le carrousel, dont le commentaire affirmait qu'elle
 * était « comme celle du tableau » — le tableau, lui, ne connaissait que le
 * direct et l'heure. Une soirée de Ligue 1 passait donc devant le tournoi du
 * quartier sur l'écran d'accueil d'un produit qui parle d'abord de lui. Une
 * seule fonction désormais, les deux surfaces ne peuvent plus diverger — et
 * l'application mobile est la troisième.
 */
export function ordreDesCompetitions(a: Entry[], b: Entry[]): number {
  const enCours = (f: Entry[]) => (f.some((e) => e.match.status === "live") ? 0 : 1);
  const dIci = (f: Entry[]) => (isWorldComp(f[0].competition.id) ? 1 : 0);
  return enCours(a) - enCours(b)
    || dIci(a) - dIci(b)
    || kickoff(a[0]).localeCompare(kickoff(b[0]));
}
```

**Step 2 : `src/lib/competition-admin.ts`** — remplacer l'interface `CompetitionFeed` (lignes 88-92, avec son commentaire) par :

```ts
// Le type vit dans lib/direct-shared, que l'application mobile lit aussi.
// Réexporté ici : DirectHome et les appelants existants l'importent d'ici.
import type { CompetitionFeed } from "@/lib/direct-shared";
export type { CompetitionFeed };
```

Placer l'`import type` avec les autres imports en tête de fichier, le `export type` à l'endroit de l'ancienne interface.

**Step 3 : `src/components/direct/DirectHomeV2.tsx`**
- Supprimer `type Entry = { match: CompMatch; competition: Competition };` (ligne 46).
- Supprimer les définitions de `liveMinute`, `competitionSubtitle`, `competitionHref`, `matchHref`, `entryKey`, `kickoff`, `ordreDesCompetitions` (lignes ~86-180) **et leurs commentaires**.
- Remplacer `import type { CompetitionFeed } from "@/lib/competition-admin";` par :

```ts
import {
  competitionHref, competitionSubtitle, entryKey, kickoff, liveMinute, matchHref,
  ordreDesCompetitions, type CompetitionFeed, type Entry,
} from "@/lib/direct-shared";
```

- Retirer les imports devenus inutiles s'il y en a (le lint les signale). `FRIENDLY_COMP_ID` et `isWorldComp` restent utilisés ailleurs dans le fichier.

**Step 4 : vérifier**

Run : `npx tsc --noEmit`
Expected : aucune erreur.

Run : `npm run lint`
Expected : aucune erreur nouvelle dans `DirectHomeV2.tsx`, `direct-shared.ts`, `competition-admin.ts`.

**Step 5 : commit**

```bash
git add src/lib/direct-shared.ts src/lib/competition-admin.ts src/components/direct/DirectHomeV2.tsx
git commit -m "refactor(direct): la minute, les liens et l'ordre sortent dans lib/direct-shared

L'application mobile doit les appliquer à l'identique : un module sans SDK
plutôt qu'une copie.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task A2 : `lib/profil` — la forme du document `users/{uid}`

Un compte créé depuis l'application doit avoir exactement la forme d'un compte créé sur le site.

**Files :**
- Create : `src/lib/profil.ts`
- Modify : `src/contexts/AuthContext.tsx` (retirer `firestoreToProfile` et `buildFirestoreUser`, importer ; `completeProfile` utilise `providersDepuisFirebase`)

**Step 1 : créer `src/lib/profil.ts`**

En-tête et helper nouveau :

```ts
// ============================================
// Le document `users/{uid}`, dans les deux sens.
//
// Sorti d'AuthContext pour que l'application mobile crée ses comptes avec
// EXACTEMENT la forme du site : un compte né sur le téléphone s'ouvre sur le
// site, et inversement. Deux constructeurs, c'est deux formes le jour où un
// champ s'ajoute d'un seul côté.
//
// Module sans SDK (ni Firebase, ni React) : voir lib/direct-shared.
// ============================================

import { formatDate } from "@/lib/dates";
import type { AuthProvider, FirestoreUser, SignupData, UserProfile } from "@/types";

/** L'identifiant de fournisseur Firebase, dans le vocabulaire du profil. */
const FOURNISSEURS: Record<string, AuthProvider> = {
  "google.com": "google",
  phone: "phone",
  password: "email",
};

/**
 * Les fournisseurs d'un compte Firebase (`user.providerData[].providerId`),
 * tels que `auth_providers` les range. Un compte sans fournisseur reconnu
 * compte comme e-mail, ce que faisait déjà `completeProfile`.
 */
export function providersDepuisFirebase(providerIds: string[]): AuthProvider[] {
  const providers = providerIds
    .map((id) => FOURNISSEURS[id])
    .filter((p): p is AuthProvider => !!p);
  return providers.length > 0 ? providers : ["email"];
}
```

Puis **couper-coller tels quels** depuis `AuthContext.tsx` les fonctions `firestoreToProfile` et `buildFirestoreUser` (corps et commentaires inchangés), en les préfixant de `export`.

**Step 2 : `src/contexts/AuthContext.tsx`**
- Supprimer les deux fonctions (déplacées).
- Ajouter : `import { buildFirestoreUser, firestoreToProfile, providersDepuisFirebase } from "@/lib/profil";`
- Dans `completeProfile`, remplacer le bloc `providerMap` / `providers` / `if (providers.length === 0) providers.push("email");` par :

```ts
    const providers = providersDepuisFirebase(
      auth.currentUser.providerData.map((p) => p.providerId),
    );
```

- Retirer les imports devenus inutiles (`formatDate`, et ce que `tsc`/lint signalent).

**Step 3 : vérifier**

Run : `npx tsc --noEmit` → aucune erreur.
Run : `npm run lint` → rien de nouveau.

**Step 4 : commit**

```bash
git add src/lib/profil.ts src/contexts/AuthContext.tsx
git commit -m "refactor(auth): la forme du profil sort dans lib/profil

Le constructeur et le lecteur de users/{uid} deviennent un module sans SDK,
pour que l'application mobile crée ses comptes à l'identique du site.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task A3 : `GET /api/direct`

La page d'accueil assemble le tableau côté serveur (SDK admin, jeton football-data). L'application ne peut pas en faire autant : on expose le même assemblage.

**Files :**
- Create : `src/lib/direct-admin.ts`
- Create : `src/app/api/direct/route.ts`
- Modify : `src/app/(scores)/page.tsx`

**Step 1 : créer `src/lib/direct-admin.ts`**

```ts
import { getDirectFeed } from "@/lib/competition-admin";
import { getPublicFriendlies } from "@/lib/friendlies-admin";
import { FRIENDLY_COMPETITION } from "@/lib/friendlies-shared";
import { getWorldBoard } from "@/lib/world-board";
import type { CompetitionFeed } from "@/lib/direct-shared";

/**
 * Le tableau du Direct : les compétitions de la plateforme, les amicaux, le
 * football mondial du jour.
 *
 * Une seule fonction pour la page d'accueil et pour GET /api/direct, que lit
 * l'application mobile : les deux ne peuvent pas montrer deux tableaux.
 *
 * Les amicaux entrent comme une compétition de plus, en fin de liste : un
 * tournoi qui se joue passe avant un match entre deux clubs, et le tri par
 * heure fait le reste. Les locales d'abord, c'est le sujet du produit.
 *
 * Les trois lectures sont indépendantes, donc lancées de front. Chacune
 * dégrade en liste vide de son côté (quota football-data atteint, Firestore
 * injoignable) sans emporter les autres.
 */
export async function getDirectBoard(): Promise<CompetitionFeed[]> {
  const [feed, friendlies, worldBoard] = await Promise.all([
    getDirectFeed(),
    getPublicFriendlies(),
    getWorldBoard(),
  ]);
  return [
    ...feed,
    ...(friendlies.length > 0 ? [{ competition: FRIENDLY_COMPETITION, matches: friendlies }] : []),
    ...worldBoard,
  ];
}
```

**Step 2 : `src/app/(scores)/page.tsx`** — remplacer les trois lectures et l'assemblage par `getDirectBoard()` :

```tsx
import DirectHomeV2 from "@/components/direct/DirectHomeV2";
import { getDirectBoard } from "@/lib/direct-admin";
import { getWorldCompetitions } from "@/lib/football-data";
import { lireClassements } from "@/lib/classement-admin";

// Public home: the live-score "Direct" board, inside the scores shell
// (ScoreShell) rather than the general app shell. Every public competition
// and its fixtures are server-fetched (ISR) for first paint and SEO/shares;
// DirectHomeV2 then attaches a real-time listener per competition client-side.
export const revalidate = 60;

export default async function Home() {
  // Le tableau s'assemble dans lib/direct-admin, que GET /api/direct lit
  // aussi. Le reste ne sert qu'au site : l'annuaire mondial, et le
  // classement, deja calcule, qu'on lit sans le refaire.
  const [board, world, classements] = await Promise.all([
    getDirectBoard(),
    getWorldCompetitions(),
    lireClassements(),
  ]);

  return (
    <DirectHomeV2
      initialFeed={board}
      worldCompetitions={world}
      topPerformances={classements.performances.slice(0, 5)}
    />
  );
}
```

**Step 3 : créer `src/app/api/direct/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getDirectBoard } from "@/lib/direct-admin";

/**
 * GET /api/direct, le tableau du Direct pour l'application mobile.
 *
 * Exactement ce que la page d'accueil affiche (voir lib/direct-admin) :
 * l'application ne peut pas le lire elle-même, les amicaux et le football
 * mondial passant par le SDK admin. Elle attache ensuite ses propres
 * écouteurs Firestore pour le temps réel, comme DirectHomeV2.
 *
 * Mis en cache 60 s, comme la page. Public, comme elle.
 *
 * Réponse : { board: CompetitionFeed[] }
 */

export const dynamic = "force-static";
export const revalidate = 60;

export async function GET() {
  const board = await getDirectBoard();
  return NextResponse.json({ board });
}
```

**Step 4 : vérifier**

Run : `npx tsc --noEmit` → aucune erreur.
Run : `npm run lint` → rien de nouveau.
Run : `npm run build`
Expected : build réussi ; dans le tableau des routes, `/api/direct` apparaît comme statique avec `Revalidate 1m`.

**Step 5 : vérifier la route et la page** (serveur de dev, pas de Bash pour le lancer : `preview_start`)

1. Purger `.next` si une route existante répond 404 (manifeste Turbopack périmé, voir la mémoire du projet).
2. `curl -s http://localhost:3000/api/direct | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const b=JSON.parse(s).board;console.log(b.length, b.map(f=>f.competition.id+':'+f.matches.length).join(' '))})"`
   Expected : un nombre de compétitions > 0, les identifiants `__amicaux__` et `__monde__…` présents si des matchs existent.
3. Ouvrir `/` dans le navigateur : le Direct est identique à la production (mêmes groupes, même ordre, minute en direct visible sur un match en cours s'il y en a). Aucune erreur console.

**Step 6 : commit**

```bash
git add src/lib/direct-admin.ts src/app/api/direct/route.ts "src/app/(scores)/page.tsx"
git commit -m "feat(api): GET /api/direct, le tableau du Direct pour l'application

La page d'accueil et la route lisent le même assemblage (lib/direct-admin).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task A4 : exclure `mobile/` du site

Le `tsconfig.json` racine inclut `**/*.ts` : sans exclusion, `next build` type-checkerait l'application avec les options du site.

**Files :**
- Modify : `tsconfig.json` (`"exclude"`)
- Modify : `eslint.config.mjs` (`globalIgnores`)

**Step 1 :** `tsconfig.json` : `"exclude": ["node_modules", "mobile"]`

**Step 2 :** `eslint.config.mjs`, dans `globalIgnores([...])`, après `"next-env.d.ts",` :

```js
    // L'application Expo a son propre lint (mobile/eslint.config.js).
    "mobile/**",
```

**Step 3 : vérifier** — `npx tsc --noEmit` et `npm run lint` passent.

**Step 4 : commit**

```bash
git add tsconfig.json eslint.config.mjs
git commit -m "chore: le site ignore mobile/, qui a son propre tsconfig et son lint

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task A5 : PR 1

**Step 1 :** `npm run build` une dernière fois. Expected : succès.

**Step 2 : demander à l'utilisateur** l'accord pour pousser `claude/app-mobile` et ouvrir la PR. Puis :

```bash
git push -u origin claude/app-mobile
gh pr create --base master --title "Application mobile, lot 1 : la partie web" --body "..."
```

Corps de la PR : le design, les quatre changements (A1–A4), la vérification (`build`, `/api/direct`, Direct identique). Terminer par la ligne d'attribution Claude Code.

**Step 3 :** après la fusion (Vercel déploie `master`), vérifier en production :
`curl -s https://www.koppafoot.com/api/direct | head -c 300` → un JSON `{"board":[...`.

---

# Partie B — Application (PR 2)

**Avant B1 :** la PR 1 est fusionnée. `git fetch && git switch -c claude/app-mobile-lot1 origin/master`, puis `git branch --unset-upstream` (la branche ne doit pas suivre `master`).

Toutes les commandes de la partie B se lancent **dans `mobile/`** sauf mention contraire.

## Task B1 : le projet Expo

**Files :** Create : `mobile/` (modèle `blank-typescript`, SDK 57)

**Step 1 : générer** (depuis la racine du dépôt)

```bash
npx create-expo-app@latest mobile --template blank-typescript@sdk-57
```

Si le générateur a créé `mobile/.git`, le supprimer : l'application vit dans le dépôt du site.

> **Constaté à l'exécution (SDK 57) :** le modèle ajoute `AGENTS.md`/`CLAUDE.md` (consignes Expo, gardées), une `LICENSE` au nom d'Expo (retirée) et un `.claude/settings.json` qui active un plugin (retiré, non demandé). Il installe TypeScript **6**. Et `npx expo install firebase …` échoue en `ERESOLVE` : npm résout la dépendance optionnelle `react-dom` en 19.3.0, qui exige React 19.3 — commencer par `npx expo install react-dom` (19.2.3). Depuis Git Bash, `-- --save-dev` n'est pas transmis : utiliser `npm install --save-dev <paquet>@<version d'Expo>`.

**Step 2 : Expo Router et les dépendances du lot**

```bash
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
npx expo install firebase @react-native-async-storage/async-storage expo-web-browser expo-image expo-font expo-splash-screen @expo/vector-icons @expo-google-fonts/outfit @expo-google-fonts/dm-sans yup
```

Vérifier que `yup` est en `^1.x`, comme le site.

**Step 3 : `mobile/package.json`**
- `"main": "expo-router/entry"`
- scripts : ajouter `"test": "jest"`, `"lint": "expo lint"`, `"typecheck": "tsc --noEmit"`.

**Step 4 : `mobile/app.json`** — dans `"expo"` :

```json
"name": "Koppafoot",
"slug": "koppafoot",
"scheme": "koppafoot",
"userInterfaceStyle": "light",
"experiments": { "typedRoutes": true }
```

Garder le reste du modèle (icône, splash) : l'identité visuelle de la fiche Play Store est un autre lot. **Ne pas** fixer `android.package` maintenant (décision en suspens, voir C0).

**Step 5 : supprimer `mobile/App.tsx` et `mobile/index.ts`** (remplacés par `expo-router/entry`), puis créer un écran minimal pour vérifier le routeur :

`mobile/src/app/_layout.tsx`
```tsx
import { Stack } from "expo-router";

export default function RacineLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

`mobile/src/app/index.tsx`
```tsx
import { Text, View } from "react-native";

export default function Accueil() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Koppafoot</Text>
    </View>
  );
}
```

**Step 6 : vérifier que le paquet se construit** (sans téléphone)

Run : `npx expo export --platform android --output-dir <scratchpad>/export-b1`
Expected : `Exported: …`, aucune erreur de résolution.

Run : `npx tsc --noEmit` → aucune erreur.

**Step 7 : commit** (depuis la racine)

```bash
git add mobile
git commit -m "feat(mobile): le projet Expo, SDK 57 et Expo Router

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Vérifier avant d'ajouter que `mobile/node_modules`, `mobile/.expo` et `mobile/.env*.local` sont bien ignorés (`.gitignore` du modèle).

---

## Task B2 : lire `src/` du site — alias, Metro, Babel, Jest

> **Écarts constatés à l'exécution, et appliqués (commit `4933345`) :** `tsconfig.json` sans `baseUrl` (TypeScript 6) et avec `"types": ["jest"]` (TypeScript 6 n'inclut plus les `@types` d'office) ; `metro.config.js` avec un `resolveRequest` qui résout tout paquet importé depuis `../src` comme depuis l'application (l'alias `yup` du tsconfig n'est pas appliqué par Metro), sans `nodeModulesPaths` ; `babel-preset-expo` installé explicitement en devDependency (il n'est qu'imbriqué sous `expo`). Le fichier fait foi, pas les extraits ci-dessous.

**Files :**
- Modify : `mobile/tsconfig.json`
- Create : `mobile/metro.config.js`
- Create : `mobile/babel.config.js`
- Modify : `mobile/package.json` (bloc `jest`)
- Test : `mobile/src/__tests__/direct-shared.test.ts`

**Step 1 : `mobile/tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "~/*": ["src/*"],
      "@/*": ["../src/*"],
      "yup": ["./node_modules/yup"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

`@/` : les modules du site s'importent entre eux en `@/lib/…` ; l'alias les fait se résoudre tels quels. `~/` : le code propre à l'application. `yup` : une seule copie, celle de l'application (voir « Le contrat des modules partagés »). Expo applique ces `paths` à Metro : ils valent pour l'exécution autant que pour les types. Si TypeScript signale `baseUrl` comme déprécié, le retirer : les `paths` restent relatifs au `tsconfig`.

**Step 2 : `mobile/metro.config.js`**

```js
// Metro ne regarde que le dossier de l'application. Les modules sans SDK du
// site vivent dans ../src : on les lui fait surveiller, et l'alias `@/` de
// tsconfig.json (lu par Expo) les résout.
//
// nodeModulesPaths : un paquet importé depuis ../src se chercherait d'abord
// dans koppafoot/node_modules, absent sur EAS où seul mobile/ est installé.
// Ce chemin-ci sert de repli. (yup, le seul cas aujourd'hui, est de toute
// façon forcé sur la copie de l'application par l'alias de tsconfig.json.)
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

config.watchFolders = [...(config.watchFolders ?? []), path.resolve(projectRoot, "../src")];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];

module.exports = config;
```

**Step 3 : `mobile/babel.config.js`** — explicite, pour que Jest transforme aussi les fichiers de `../src` (hors du dossier de l'application) :

```js
module.exports = function (api) {
  api.cache(true);
  return { presets: ["babel-preset-expo"] };
};
```

**Step 4 : Jest**

```bash
npx expo install jest-expo jest @types/jest -- --save-dev
```

Dans `mobile/package.json` :

```json
"jest": {
  "preset": "jest-expo",
  "moduleNameMapper": {
    "^~/(.*)$": "<rootDir>/src/$1",
    "^@/(.*)$": "<rootDir>/../src/$1",
    "^yup$": "<rootDir>/node_modules/yup"
  }
}
```

**Step 5 : le test** — `mobile/src/__tests__/direct-shared.test.ts`

```ts
import {
  competitionHref, kickoff, liveMinute, matchHref, ordreDesCompetitions, type Entry,
} from "@/lib/direct-shared";
import { FRIENDLY_COMPETITION } from "@/lib/friendlies-shared";
import type { Competition, CompMatch } from "@/types";

const comp = (id: string, slug = id): Competition => ({ id, slug, name: id } as Competition);
const match = (id: string, p: Partial<CompMatch> = {}): CompMatch =>
  ({ id, date: "2026-09-24", time: "15:00", status: "scheduled", liveState: null, ...p } as CompMatch);
const entree = (c: Competition, m: CompMatch): Entry => ({ competition: c, match: m });

const DEPART = "2026-09-24T15:00:00.000Z";
const T0 = new Date(DEPART).getTime();

describe("liveMinute", () => {
  it("compte depuis le coup d'envoi quand le chrono tourne", () => {
    const m = match("m", {
      status: "live",
      liveState: { currentPeriod: 1, timerStartAt: DEPART, timerOffset: 0, isTimerRunning: true, events: [] },
    } as Partial<CompMatch>);
    expect(liveMinute(m, T0 + 12 * 60_000 + 5_000)).toBe(13);
  });

  it("s'arrête sur le décalage quand le chrono est à l'arrêt", () => {
    const m = match("m", {
      status: "live",
      liveState: { currentPeriod: 1, timerStartAt: null, timerOffset: 45 * 60_000, isTimerRunning: false, events: [] },
    } as Partial<CompMatch>);
    expect(liveMinute(m, T0)).toBe(46);
  });

  it("vaut 0 sans état de direct", () => {
    expect(liveMinute(match("m"))).toBe(0);
  });
});

describe("liens", () => {
  it("un match de la plateforme mène à sa fiche", () => {
    expect(matchHref(entree(comp("c1", "coupe-lome"), match("m1")))).toBe("/c/coupe-lome/matches/m1");
  });

  it("un amical mène à /matches/[id]", () => {
    expect(matchHref(entree(FRIENDLY_COMPETITION, match("a1")))).toBe("/matches/a1");
  });

  it("un match mondial mène à sa compétition", () => {
    const monde = comp("__monde__PL", "PL");
    expect(matchHref(entree(monde, match("w1")))).toBe("/competitions/monde/PL");
    expect(competitionHref(comp("__monde__X", ""))).toBe("/competitions");
  });
});

describe("ordreDesCompetitions", () => {
  it("le direct d'abord, puis le football d'ici, puis l'heure", () => {
    const ici = [entree(comp("ici"), match("a", { time: "18:00" }))];
    const monde = [entree(comp("__monde__PL"), match("b", { time: "12:00" }))];
    const enDirect = [entree(comp("__monde__L1"), match("c", { status: "live", time: "20:00" }))];
    const tries = [monde, ici, enDirect].sort(ordreDesCompetitions);
    expect(tries.map((g) => g[0].competition.id)).toEqual(["__monde__L1", "ici", "__monde__PL"]);
  });

  it("une date absente passe en dernier", () => {
    expect(kickoff(entree(comp("c"), match("m", { date: null, time: null })))).toBe("9999-99-99T99:99");
  });
});
```

**Step 6 : lancer**

Run : `npx jest src/__tests__/direct-shared.test.ts`
Expected : PASS, 8 tests. (Les fonctions existent déjà côté web depuis A1 : ce test vérifie d'abord que l'application les atteint.)

Si Jest échoue avec `SyntaxError` sur un fichier de `../src` : c'est la transformation Babel. Vérifier que `babel.config.js` est bien à la racine de `mobile/` et relancer avec `--no-cache`.

**Step 7 : vérifier que Metro résout `@/` depuis `../src`** — dans `mobile/src/app/index.tsx`, provisoirement :

```tsx
import { libelleDuJour, cleDuJour } from "@/lib/dates";
// … <Text>{libelleDuJour(cleDuJour(new Date()))}</Text>
```

Run : `npx expo export --platform android --output-dir <scratchpad>/export-b2`
Expected : succès. Puis `npx tsc --noEmit` → aucune erreur. Retirer la modification provisoire.

**Step 8 : commit**

```bash
git add mobile
git commit -m "feat(mobile): l'application lit les modules sans SDK du site

Alias @/ vers ../src, Metro surveille ../src, Jest en place.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task B3 : le lint, et ce qu'on n'a pas le droit d'importer du site

**Files :** Create/Modify : `mobile/eslint.config.js`

**Step 1 :** `npx expo lint` (la première fois, il installe `eslint` et `eslint-config-expo` et crée `eslint.config.js`).

> **Constaté à l'exécution :** il ne le fait pas ici. Sans configuration dans `mobile/`, ESLint remonte à celle du site, qui ignore `mobile/**` — `expo lint` croit la configuration présente et échoue sur « all files are ignored ». Installer `eslint@^9` et `eslint-config-expo@~57.0.2` en devDependencies et écrire `mobile/eslint.config.js` à la main (`eslint-config-expo/flat`), commit `d5b6322`.

**Step 2 :** ajouter la règle à la fin du tableau de configuration généré :

```js
  {
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: [
            "@/lib/firebase", "@/lib/firebase-admin", "@/lib/firestore",
            "@/lib/competition-firestore", "@/lib/*-admin", "@/lib/fcm-*",
            "@/contexts/*", "@/components/*", "@/hooks/*", "@/app/*",
            "next", "next/*",
          ],
          message:
            "L'application n'importe du site que des modules sans SDK (voir docs/plans/2026-09-24-app-mobile-lot1-design.md).",
        }],
      }],
    },
  },
```

**Step 3 : vérifier que la règle mord** — ajouter provisoirement `import "@/lib/firestore";` dans `src/app/index.tsx`.
Run : `npm run lint` → Expected : erreur `no-restricted-imports` avec le message. Retirer la ligne ; `npm run lint` → aucune erreur.

Si le lint signale `import/no-unresolved` sur un `@/…` légitime, déclarer le résolveur TypeScript dans la configuration (`settings: { "import/resolver": { typescript: { project: "./tsconfig.json" } } }`) plutôt que de désactiver la règle.

**Step 4 : commit**

```bash
git add mobile
git commit -m "chore(mobile): le lint interdit d'importer du site ce qui touche Firebase ou Next

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task B4 : thème, polices, composants de base

**Files :**
- Create : `mobile/src/theme.ts`
- Create : `mobile/src/components/Bouton.tsx`, `Champ.tsx`, `Ecusson.tsx`

**Step 1 : `mobile/src/theme.ts`** — les jetons de `src/app/globals.css`, les polices du site (Outfit pour les titres, DM Sans pour le texte) :

```ts
/** Les couleurs du site (src/app/globals.css), sous les noms de l'application. */
export const couleurs = {
  primaire: "#059669",
  primaireFonce: "#047857",
  primaireClair: "#10b981",
  accent: "#F59E0B",
  erreur: "#C62828",
  direct: "#EF4444",
  texte: "#111827",
  texteSecondaire: "#4B5563",
  texteDiscret: "#9CA3AF",
  fond: "#FFFFFF",
  fondSecondaire: "#F9FAFB",
  fondTertiaire: "#F3F4F6",
  bordure: "#E5E7EB",
  sombre: "#0B1210",
} as const;

/** Les noms exportés par @expo-google-fonts, chargés dans le layout racine. */
export const polices = {
  titre: "Outfit_800ExtraBold",
  titreMoyen: "Outfit_700Bold",
  texte: "DMSans_400Regular",
  texteMoyen: "DMSans_500Medium",
  texteGras: "DMSans_700Bold",
} as const;
```

**Step 2 : `mobile/src/components/Bouton.tsx`**

```tsx
import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import { couleurs, polices } from "~/theme";

type Variante = "plein" | "contour" | "lien";

interface Props extends Omit<PressableProps, "children" | "style"> {
  titre: string;
  variante?: Variante;
  occupe?: boolean;
  /** Posé sur un fond sombre (l'accueil) : un libellé clair pour « contour » et « lien ». */
  sombre?: boolean;
}

export function Bouton({ titre, variante = "plein", occupe = false, sombre = false, disabled, ...reste }: Props) {
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
        <ActivityIndicator color={variante === "plein" ? "#fff" : couleurs.primaire} />
      ) : (
        <Text
          style={[
            styles.libelle,
            variante === "plein" || sombre ? styles.libellePlein : styles.libelleAutre,
          ]}
        >
          {titre}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 48, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
  plein: { backgroundColor: couleurs.primaire },
  contour: { borderWidth: 1, borderColor: couleurs.bordure, backgroundColor: couleurs.fond },
  lien: { minHeight: 40 },
  inactif: { opacity: 0.5 },
  presse: { opacity: 0.8 },
  libelle: { fontSize: 15, fontFamily: polices.texteGras },
  libellePlein: { color: "#fff" },
  libelleAutre: { color: couleurs.texte },
});
```

**Step 3 : `mobile/src/components/Champ.tsx`**

```tsx
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { couleurs, polices } from "~/theme";

interface Props extends TextInputProps {
  etiquette: string;
  erreur?: string | null;
}

export function Champ({ etiquette, erreur, style, ...reste }: Props) {
  return (
    <View style={styles.bloc}>
      <Text style={styles.etiquette}>{etiquette}</Text>
      <TextInput
        accessibilityLabel={etiquette}
        placeholderTextColor={couleurs.texteDiscret}
        style={[styles.champ, erreur ? styles.champErreur : null, style]}
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
    borderWidth: 1, borderColor: couleurs.bordure, backgroundColor: couleurs.fond,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: polices.texte, color: couleurs.texte,
  },
  champErreur: { borderColor: couleurs.erreur },
  erreur: { fontSize: 12, fontFamily: polices.texte, color: couleurs.erreur },
});
```

**Step 4 : `mobile/src/components/Ecusson.tsx`**

```tsx
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { couleurs, polices } from "~/theme";

/**
 * Le blason d'une équipe, ou ses initiales.
 *
 * Une image seulement si la valeur est une URL : des initiales ont déjà été
 * rangées là où une adresse était attendue, et le site en a tiré des 404.
 */
export function Ecusson({ url, nom, taille = 22 }: { url: string | null; nom: string; taille?: number }) {
  const dimensions = { width: taille, height: taille, borderRadius: taille / 2 };
  if (url && url.startsWith("http")) {
    return <Image source={{ uri: url }} style={dimensions} contentFit="contain" accessibilityIgnoresInvertColors />;
  }
  const initiales = nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <View style={[styles.rond, dimensions]}>
      <Text style={[styles.initiales, { fontSize: Math.round(taille * 0.4) }]}>{initiales}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rond: { backgroundColor: couleurs.fondTertiaire, alignItems: "center", justifyContent: "center" },
  initiales: { fontFamily: polices.texteGras, color: couleurs.texteSecondaire },
});
```

**Step 5 : vérifier** — `npx tsc --noEmit` et `npm run lint` passent.

**Step 6 : commit** — `feat(mobile): le thème du site et trois composants de base`.

---

## Task B5 : Firebase et configuration

**Files :**
- Create : `mobile/src/lib/firebase.ts`, `mobile/src/lib/config.ts`
- Create : `mobile/.env.example` ; `mobile/.env.local` (non versionné)

**Step 1 : `mobile/.env.example`**

```bash
# Les mêmes valeurs que les NEXT_PUBLIC_FIREBASE_* du site : un seul projet Firebase.
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=

# Le site : l'API /api/direct et les pages ouvertes dans le navigateur intégré.
EXPO_PUBLIC_SITE_URL=https://www.koppafoot.com

# Facultatif : viser un `next dev` local pour l'API (adresse du PC sur le réseau).
# EXPO_PUBLIC_API_URL=http://192.168.1.10:3000
```

**Step 2 : `mobile/.env.local`** — générer depuis celui du site, sans afficher les valeurs (depuis la racine) :

```bash
sed -n 's/^NEXT_PUBLIC_FIREBASE_/EXPO_PUBLIC_FIREBASE_/p' .env.local > mobile/.env.local
```

Vérifier : `grep -c EXPO_PUBLIC_FIREBASE_ mobile/.env.local` → 6 (ou le nombre de clés Firebase du site). `git check-ignore mobile/.env.local` doit répondre le chemin.

**Step 3 : `mobile/src/lib/config.ts`**

```ts
const sansBarreFinale = (url: string) => url.replace(/\/+$/, "");

/** Le site : ses pages s'ouvrent dans le navigateur intégré. */
export const SITE_URL = sansBarreFinale(process.env.EXPO_PUBLIC_SITE_URL ?? "https://www.koppafoot.com");

/** L'API. Le site par défaut ; un `next dev` local si on le demande. */
export const API_URL = sansBarreFinale(process.env.EXPO_PUBLIC_API_URL ?? SITE_URL);

export function urlDuSite(chemin: string): string {
  return `${SITE_URL}${chemin}`;
}
```

**Step 4 : `mobile/src/lib/firebase.ts`**

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  // @ts-expect-error Exporté par la version React Native de @firebase/auth, que Metro
  // choisit à l'exécution ; absent des types publics. Si Firebase l'y ajoute un jour,
  // cette ligne cessera de compiler : retirer alors le commentaire.
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Le projet Firebase du site. Les EXPO_PUBLIC_* sont inlinés au build : ils
// doivent être lus un par un, en toutes lettres.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const premiere = getApps().length === 0;
export const app = premiere ? initializeApp(firebaseConfig) : getApp();

/**
 * LA SESSION DOIT SURVIVRE AU REDÉMARRAGE. `getAuth()` seul ne persiste rien
 * en React Native : l'utilisateur serait déconnecté à chaque lancement, et le
 * symptôme ressemble à un bug de règles.
 *
 * `initializeAuth` ne s'appelle qu'une fois par app : au rechargement à chaud
 * le module est réévalué, et un second appel lèverait auth/already-initialized.
 */
export const auth: Auth = premiere
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app);

export const db = getFirestore(app);
```

Si, sur téléphone, les écouteurs Firestore ne reçoivent jamais rien (flux WebChannel bloqué), remplacer `getFirestore(app)` par `initializeFirestore(app, { experimentalForceLongPolling: true })` et le noter ici.

**Step 5 : vérifier** — `npx tsc --noEmit` → aucune erreur (le `@ts-expect-error` est consommé). `npx expo export --platform android --output-dir <scratchpad>/export-b5` → succès. La preuve à l'exécution vient au premier lancement dans Expo Go (B12) : si `getReactNativePersistence is not a function` apparaît, Metro a pris la version navigateur de `@firebase/auth` — vérifier que `resolver.unstable_enablePackageExports` n'est pas désactivé dans la configuration Metro.

**Step 6 : commit** — `feat(mobile): Firebase avec la session persistée, et l'adresse du site` (ne pas ajouter `.env.local`).

---

## Task B6 : le tableau du Direct, en logique pure (TDD)

**Files :**
- Create : `mobile/src/lib/direct-tableau.ts`
- Test : `mobile/src/__tests__/direct-tableau.test.ts`

**Step 1 : écrire les tests**

```ts
import type { CompetitionFeed } from "@/lib/direct-shared";
import { FRIENDLY_COMP_ID, FRIENDLY_COMPETITION } from "@/lib/friendlies-shared";
import type { Competition, CompMatch } from "@/types";
import {
  appliquerEcoutes, compterEnDirect, fusionnerAmicaux, groupesDuTableau, jourLePlusProche, remplacerMatchs,
} from "~/lib/direct-tableau";

const comp = (id: string): Competition => ({ id, slug: id, name: id } as Competition);
const match = (id: string, p: Partial<CompMatch> = {}): CompMatch =>
  ({ id, date: "2026-09-24", time: "15:00", status: "scheduled", ...p } as CompMatch);

const JOUR = "2026-09-24";

const flux: CompetitionFeed[] = [
  { competition: comp("coupe"), matches: [
    match("c1", { time: "18:00" }),
    match("c2", { date: "2026-09-20", status: "live" }),
    match("c3", { date: "2026-09-27" }),
  ] },
  { competition: comp("__monde__PL"), matches: [match("w1", { time: "12:00" })] },
  { competition: comp("ligue"), matches: [match("l1", { date: "2026-09-10", status: "completed" })] },
];

describe("groupesDuTableau", () => {
  it("Tous : les matchs du jour, plus ceux en cours quelle que soit leur date", () => {
    const g = groupesDuTableau(flux, { jour: JOUR, filtre: "tous", suivies: new Set() });
    expect(g.map((x) => x.competition.id)).toEqual(["coupe", "__monde__PL"]);
    expect(g[0].entries.map((e) => e.match.id)).toEqual(["c2", "c1"]);
  });

  it("En direct : seulement les matchs en cours", () => {
    const g = groupesDuTableau(flux, { jour: JOUR, filtre: "direct", suivies: new Set() });
    expect(g.flatMap((x) => x.entries.map((e) => e.match.id))).toEqual(["c2"]);
  });

  it("Favoris : tous les matchs des compétitions suivies, sans filtre de jour", () => {
    const g = groupesDuTableau(flux, { jour: JOUR, filtre: "favoris", suivies: new Set(["ligue", "coupe"]) });
    expect(g.map((x) => x.competition.id)).toEqual(["coupe", "ligue"]);
    expect(g[0].entries.map((e) => e.match.id)).toEqual(["c2", "c1", "c3"]);
  });

  it("Favoris sans suivi : rien", () => {
    expect(groupesDuTableau(flux, { jour: JOUR, filtre: "favoris", suivies: new Set() })).toEqual([]);
  });
});

describe("jourLePlusProche", () => {
  it("préfère le prochain jour joué", () => {
    expect(jourLePlusProche(flux, "2026-09-25")).toBe("2026-09-27");
  });
  it("sinon le dernier jour joué", () => {
    expect(jourLePlusProche(flux, "2026-09-30")).toBe("2026-09-27");
    expect(jourLePlusProche(flux, "2026-10-01")).toBe("2026-09-27");
  });
  it("null sans aucune date", () => {
    expect(jourLePlusProche([], JOUR)).toBeNull();
  });
});

describe("temps réel", () => {
  it("remplacerMatchs ne touche que la compétition visée", () => {
    const suivant = remplacerMatchs(flux, "coupe", [match("c9")]);
    expect(suivant[0].matches.map((m) => m.id)).toEqual(["c9"]);
    expect(suivant[1]).toBe(flux[1]);
  });

  it("fusionnerAmicaux remplace les amicaux frais et garde les autres", () => {
    const avec: CompetitionFeed[] = [
      ...flux,
      { competition: FRIENDLY_COMPETITION, matches: [match("a1"), match("a2")] },
    ];
    const suivant = fusionnerAmicaux(avec, [match("a1", { status: "live" })]);
    const amicaux = suivant.find((f) => f.competition.id === FRIENDLY_COMP_ID)!;
    expect(amicaux.matches.map((m) => `${m.id}:${m.status}`)).toEqual(["a1:live", "a2:scheduled"]);
  });

  it("fusionnerAmicaux crée le groupe s'il n'existait pas", () => {
    const suivant = fusionnerAmicaux(flux, [match("a1", { status: "live" })]);
    expect(suivant.at(-1)?.competition.id).toBe(FRIENDLY_COMP_ID);
  });

  it("fusionnerAmicaux sans rien de neuf rend le même flux", () => {
    expect(fusionnerAmicaux(flux, [])).toBe(flux);
  });

  it("appliquerEcoutes préfère ce que les écouteurs ont dit à la réponse de l'API", () => {
    const ecoutes = new Map([["coupe", [match("c1", { status: "live", scoreHome: 1, scoreAway: 0 })]]]);
    const suivant = appliquerEcoutes(flux, ecoutes, null);
    expect(suivant[0].matches[0].scoreHome).toBe(1);
    expect(suivant[1]).toBe(flux[1]);
  });

  it("compterEnDirect", () => {
    expect(compterEnDirect(flux)).toBe(1);
  });
});
```

**Step 2 : lancer** — `npx jest src/__tests__/direct-tableau.test.ts` → FAIL (`Cannot find module '~/lib/direct-tableau'`).

**Step 3 : implémenter `mobile/src/lib/direct-tableau.ts`**

```ts
// ============================================
// Le tableau du Direct, sans écran : filtrer, grouper, fondre le temps réel.
//
// Les règles sont celles de DirectHomeV2, et ses briques viennent de
// lib/direct-shared (minute, ordre, clé de tri) : l'application n'en invente
// aucune. Ce qui diffère est assumé : le filtre Favoris lit les compétitions
// suivies PAR LE COMPTE, là où le site lit une liste rangée sur l'appareil
// (voir le design du lot 1).
// ============================================

import { kickoff, ordreDesCompetitions, type CompetitionFeed, type Entry } from "@/lib/direct-shared";
import { FRIENDLY_COMP_ID, FRIENDLY_COMPETITION } from "@/lib/friendlies-shared";
import type { Competition, CompMatch } from "@/types";

export type FiltreDirect = "tous" | "direct" | "favoris";

export interface GroupeDirect {
  competition: Competition;
  entries: Entry[];
}

export interface OptionsTableau {
  /** « 2026-09-24 », voir lib/dates. */
  jour: string;
  filtre: FiltreDirect;
  /** Les compétitions suivies par le compte. */
  suivies: ReadonlySet<string>;
}

export function entreesDuFlux(feed: CompetitionFeed[]): Entry[] {
  return feed.flatMap((f) => f.matches.map((match) => ({ match, competition: f.competition })));
}

/**
 * Les groupes à afficher.
 *
 * Le jour filtre, sauf deux exceptions reprises du site : UN MATCH EN COURS
 * ÉCHAPPE AU FILTRE DE JOUR (il se joue maintenant, quelle que soit la date
 * de sa fiche), et les favoris aussi (on suit une compétition sur toute sa
 * durée, un onglet vide un jour sans match ferait croire à une panne).
 */
export function groupesDuTableau(feed: CompetitionFeed[], { jour, filtre, suivies }: OptionsTableau): GroupeDirect[] {
  const toutes = entreesDuFlux(feed);
  let liste =
    filtre === "favoris"
      ? toutes.filter((e) => suivies.has(e.competition.id))
      : toutes.filter((e) => e.match.date === jour || e.match.status === "live");
  if (filtre === "direct") liste = liste.filter((e) => e.match.status === "live");
  liste = [...liste].sort((a, b) => kickoff(a).localeCompare(kickoff(b)));

  const parCompetition = new Map<string, GroupeDirect>();
  for (const e of liste) {
    const groupe = parCompetition.get(e.competition.id) ?? { competition: e.competition, entries: [] };
    groupe.entries.push(e);
    parCompetition.set(e.competition.id, groupe);
  }
  return [...parCompetition.values()].sort((a, b) => ordreDesCompetitions(a.entries, b.entries));
}

/**
 * Le jour joué le plus proche quand celui choisi est vide : un calendrier
 * amateur a des trous, et un tableau blanc a l'air cassé. Le prochain jour
 * l'emporte sur le dernier joué, comme sur le site.
 */
export function jourLePlusProche(feed: CompetitionFeed[], jour: string): string | null {
  const dates = [
    ...new Set(entreesDuFlux(feed).map((e) => e.match.date).filter((d): d is string => d != null)),
  ].sort();
  return dates.find((d) => d > jour) ?? [...dates].reverse().find((d) => d < jour) ?? null;
}

export function compterEnDirect(feed: CompetitionFeed[]): number {
  return entreesDuFlux(feed).filter((e) => e.match.status === "live").length;
}

/** Ce que l'écouteur d'une compétition vient de dire. */
export function remplacerMatchs(feed: CompetitionFeed[], cid: string, matches: CompMatch[]): CompetitionFeed[] {
  return feed.map((f) => (f.competition.id === cid ? { ...f, matches } : f));
}

/**
 * Les amicaux en cours, venus de l'écouteur. Ils vivent dans `matches`, pas
 * dans une sous-collection : l'écouteur par compétition ne les voit pas. On
 * remplace ceux dont il donne des nouvelles, on garde les autres (les amicaux
 * à venir de la réponse de l'API).
 */
export function fusionnerAmicaux(feed: CompetitionFeed[], frais: CompMatch[]): CompetitionFeed[] {
  const idsFrais = new Set(frais.map((m) => m.id));
  const groupe = feed.find((f) => f.competition.id === FRIENDLY_COMP_ID);
  const inchanges = (groupe?.matches ?? []).filter((m) => !idsFrais.has(m.id));
  const matches = [...frais, ...inchanges];
  if (matches.length === 0 || (frais.length === 0 && groupe)) return feed;
  return groupe
    ? feed.map((f) => (f.competition.id === FRIENDLY_COMP_ID ? { ...f, matches } : f))
    : [...feed, { competition: FRIENDLY_COMPETITION, matches }];
}

/**
 * La réponse de l'API, corrigée par ce que les écouteurs savent déjà.
 *
 * L'API est mise en cache 60 s ; un écouteur, lui, est à jour. Quand un
 * rafraîchissement revient APRÈS le premier instantané d'un écouteur (au
 * retour au premier plan, les deux partent ensemble), il écraserait un score
 * frais par un score vieux d'une minute — et l'écouteur ne redirait rien
 * avant le prochain but.
 */
export function appliquerEcoutes(
  board: CompetitionFeed[],
  parCompetition: ReadonlyMap<string, CompMatch[]>,
  amicaux: CompMatch[] | null,
): CompetitionFeed[] {
  const avecCompetitions = board.map((f) => {
    const matches = parCompetition.get(f.competition.id);
    return matches ? { ...f, matches } : f;
  });
  return amicaux ? fusionnerAmicaux(avecCompetitions, amicaux) : avecCompetitions;
}
```

**Step 4 : lancer** — `npx jest src/__tests__/direct-tableau.test.ts` → PASS.

**Step 5 : commit** — `feat(mobile): le tableau du Direct, filtré, groupé, fondu avec le temps réel`.

---

## Task B7 : l'étoile en attente (TDD)

L'étoile touchée sans compte ouvre la connexion ; une fois connecté, la compétition doit être suivie sans refaire le geste.

**Files :**
- Create : `mobile/src/lib/suivi-en-attente.ts`
- Test : `mobile/src/__tests__/suivi-en-attente.test.ts`

**Step 1 : tests**

```ts
import {
  appliquerSuiviEnAttente, mettreEnAttente, oublierEnAttente, prendreEnAttente,
} from "~/lib/suivi-en-attente";

const T0 = 1_000_000;

afterEach(() => oublierEnAttente());

it("rend la compétition en attente, une seule fois", () => {
  mettreEnAttente("coupe", T0);
  expect(prendreEnAttente(T0 + 1000)).toBe("coupe");
  expect(prendreEnAttente(T0 + 2000)).toBeNull();
});

it("expire après dix minutes", () => {
  mettreEnAttente("coupe", T0);
  expect(prendreEnAttente(T0 + 10 * 60_000 + 1)).toBeNull();
});

it("appliquerSuiviEnAttente suit la compétition une fois connecté", async () => {
  const suivre = jest.fn().mockResolvedValue(undefined);
  mettreEnAttente("coupe", T0);
  await expect(appliquerSuiviEnAttente("uid-1", suivre, T0 + 5000)).resolves.toBe(true);
  expect(suivre).toHaveBeenCalledWith("uid-1", "coupe", true);
});

it("appliquerSuiviEnAttente sans rien en attente ne fait rien", async () => {
  const suivre = jest.fn();
  await expect(appliquerSuiviEnAttente("uid-1", suivre, T0)).resolves.toBe(false);
  expect(suivre).not.toHaveBeenCalled();
});
```

**Step 2 : lancer** → FAIL (module absent).

**Step 3 : `mobile/src/lib/suivi-en-attente.ts`**

```ts
/**
 * L'étoile touchée sans compte.
 *
 * Elle ouvre la connexion ; si le compte naît ou s'ouvre dans la foulée, la
 * compétition est suivie sans que l'utilisateur ait à refaire le geste —
 * l'équivalent du `?next=` du site.
 *
 * Dix minutes de validité : assez pour une inscription, profil compris ; pas
 * assez pour qu'une étoile touchée hier et une fenêtre refermée aussitôt
 * ressurgissent à la connexion suivante.
 */

const VALIDITE_MS = 10 * 60_000;

let enAttente: { cid: string; depuis: number } | null = null;

export function mettreEnAttente(cid: string, maintenant: number = Date.now()): void {
  enAttente = { cid, depuis: maintenant };
}

export function prendreEnAttente(maintenant: number = Date.now()): string | null {
  const courant = enAttente;
  enAttente = null;
  if (!courant || maintenant - courant.depuis > VALIDITE_MS) return null;
  return courant.cid;
}

export function oublierEnAttente(): void {
  enAttente = null;
}

export async function appliquerSuiviEnAttente(
  uid: string,
  suivre: (uid: string, cid: string, oui: boolean) => Promise<void>,
  maintenant: number = Date.now(),
): Promise<boolean> {
  const cid = prendreEnAttente(maintenant);
  if (!cid) return false;
  await suivre(uid, cid, true);
  return true;
}
```

**Step 4 : lancer** → PASS.

**Step 5 : commit** — `feat(mobile): l'étoile touchée sans compte est suivie une fois connecté`.

---

## Task B8 : l'accueil montré une fois (TDD)

**Files :**
- Create : `mobile/src/lib/accueil.tsx`
- Test : `mobile/src/__tests__/accueil.test.ts`

**Step 1 : tests**

```ts
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import { accueilDejaVu, marquerAccueilVu } from "~/lib/accueil";

beforeEach(() => AsyncStorage.clear());

it("un premier lancement n'a pas vu l'accueil", async () => {
  await expect(accueilDejaVu()).resolves.toBe(false);
});

it("une fois marqué, l'accueil est vu", async () => {
  await marquerAccueilVu();
  await expect(accueilDejaVu()).resolves.toBe(true);
});

it("une lecture qui échoue remontre l'accueil plutôt que de planter", async () => {
  jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("disque"));
  await expect(accueilDejaVu()).resolves.toBe(false);
});
```

**Step 2 : lancer** → FAIL.

**Step 3 : `mobile/src/lib/accueil.tsx`**

```tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Href } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const CLE = "kf:accueil:vu";

/** Une lecture qui échoue remontre l'accueil : trois écrans de trop valent mieux qu'un plantage. */
export async function accueilDejaVu(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CLE)) === "1";
  } catch {
    return false;
  }
}

export async function marquerAccueilVu(): Promise<void> {
  try {
    await AsyncStorage.setItem(CLE, "1");
  } catch {
    // Au pire, l'accueil se remontrera au prochain lancement.
  }
}

interface EtatAccueil {
  pret: boolean;
  vu: boolean;
  /** Où aller juste après l'accueil (« J'ai déjà un compte » → /connexion). */
  suite: Href | null;
  terminer: (suite?: Href) => void;
  oublierSuite: () => void;
}

const Contexte = createContext<EtatAccueil | null>(null);

export function AccueilProvider({ children }: { children: ReactNode }) {
  const [pret, setPret] = useState(false);
  const [vu, setVu] = useState(false);
  const [suite, setSuite] = useState<Href | null>(null);

  useEffect(() => {
    accueilDejaVu().then((v) => {
      setVu(v);
      setPret(true);
    });
  }, []);

  const terminer = useCallback((s?: Href) => {
    setSuite(s ?? null);
    setVu(true);
    void marquerAccueilVu();
  }, []);
  const oublierSuite = useCallback(() => setSuite(null), []);

  const valeur = useMemo(() => ({ pret, vu, suite, terminer, oublierSuite }), [pret, vu, suite, terminer, oublierSuite]);
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useAccueil(): EtatAccueil {
  const etat = useContext(Contexte);
  if (!etat) throw new Error("useAccueil hors d'AccueilProvider");
  return etat;
}
```

**Step 4 : lancer** → PASS. `npx jest` (tous) → PASS.

**Step 5 : commit** — `feat(mobile): l'accueil ne se montre qu'une fois`.

---

## Task B9 : Firestore et l'API, côté application

Couches fines, sans test unitaire (elles ne font que parler à Firebase et au réseau) : vérifiées sur téléphone en B17.

**Files :**
- Create : `mobile/src/lib/direct-firestore.ts`, `mobile/src/lib/direct-api.ts`

**Step 1 : `mobile/src/lib/direct-firestore.ts`**

```ts
import {
  arrayRemove, arrayUnion, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where,
  type Unsubscribe,
} from "firebase/firestore";
import { toCompMatch } from "@/lib/competition-mappers";
import { amicalVersCompMatch } from "@/lib/friendlies-shared";
import type { CompMatch, FirestoreCompMatch } from "@/types";
import { db } from "~/lib/firebase";

// Les trois lectures/écritures Firestore du lot. Les versions du site
// (lib/competition-firestore, lib/firestore) lisent l'initialisation du site
// et ne traversent pas ; celles-ci en sont la réplique exacte — même requête,
// même mapper partagé.

/** Les matchs d'une compétition, en direct. Même requête que `onCompMatches` du site. */
export function ecouterMatchsCompetition(cid: string, cb: (matches: CompMatch[]) => void): Unsubscribe {
  const q = query(collection(db, "competitions", cid, "comp_matches"), orderBy("date", "asc"));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => toCompMatch(d.id, d.data() as FirestoreCompMatch))),
    (erreur) => console.warn("[direct] écouteur de compétition", cid, erreur),
  );
}

/** Les amicaux en cours ou joués. Même requête que `onLiveFriendlies` du site. */
export function ecouterAmicauxEnCours(cb: (matches: CompMatch[]) => void): Unsubscribe {
  const q = query(collection(db, "matches"), where("status", "in", ["live", "completed"]));
  return onSnapshot(
    q,
    (snap) =>
      cb(
        snap.docs
          .map((d) => amicalVersCompMatch(d.id, d.data() as Record<string, unknown>))
          .filter((m): m is CompMatch => m != null),
      ),
    () => cb([]),
  );
}

/** Le suivi lié au compte, le même champ que le bouton « Suivre » du site. */
export async function suivreCompetition(uid: string, cid: string, suivre: boolean): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    followed_competition_ids: suivre ? arrayUnion(cid) : arrayRemove(cid),
    updated_at: serverTimestamp(),
  });
}
```

**Step 2 : `mobile/src/lib/direct-api.ts`**

```ts
import type { CompetitionFeed } from "@/lib/direct-shared";
import { API_URL } from "~/lib/config";

/** GET /api/direct : le tableau tel que la page d'accueil du site l'affiche. */
export async function chargerDirect(): Promise<CompetitionFeed[]> {
  const reponse = await fetch(`${API_URL}/api/direct`);
  if (!reponse.ok) throw new Error(`/api/direct : ${reponse.status}`);
  const json = (await reponse.json()) as { board?: CompetitionFeed[] };
  return json.board ?? [];
}
```

**Step 3 : vérifier** — `npx tsc --noEmit`, `npm run lint`.

**Step 4 : commit** — `feat(mobile): les écouteurs du Direct, le suivi, et l'appel à /api/direct`.

---

## Task B10 : `useDirect` — chargement, temps réel, premier plan

**Files :**
- Create : `mobile/src/hooks/usePremierPlan.ts`, `mobile/src/hooks/useDirect.ts`

**Step 1 : `mobile/src/hooks/usePremierPlan.ts`**

```ts
import { useEffect, useState } from "react";
import { AppState } from "react-native";

/**
 * Vrai tant que l'application est à l'écran.
 *
 * L'état initial peut valoir « unknown » au démarrage à froid sur Android :
 * seul « background » compte comme absent, sinon le premier chargement
 * attendrait un changement d'état qui ne viendrait pas.
 */
export function usePremierPlan(): boolean {
  const [actif, setActif] = useState(AppState.currentState !== "background");
  useEffect(() => {
    const abonnement = AppState.addEventListener("change", (etat) => setActif(etat === "active"));
    return () => abonnement.remove();
  }, []);
  return actif;
}
```

**Step 2 : `mobile/src/hooks/useDirect.ts`**

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CompetitionFeed } from "@/lib/direct-shared";
import { FRIENDLY_COMP_ID } from "@/lib/friendlies-shared";
import { isWorldComp } from "@/lib/world-board-shared";
import type { CompMatch } from "@/types";
import { chargerDirect } from "~/lib/direct-api";
import { ecouterAmicauxEnCours, ecouterMatchsCompetition } from "~/lib/direct-firestore";
import { appliquerEcoutes, fusionnerAmicaux, remplacerMatchs } from "~/lib/direct-tableau";
import { usePremierPlan } from "~/hooks/usePremierPlan";

/**
 * Le tableau du Direct : l'API au lancement, au glisser-pour-rafraîchir et au
 * retour au premier plan ; les écouteurs Firestore par-dessus, comme sur le
 * site.
 *
 * LES ÉCOUTEURS SE COUPENT EN ARRIÈRE-PLAN. Un tableau ouvert au fond d'une
 * poche, c'est de la batterie et du forfait pour personne — et pour ce public
 * le forfait compte. Ils se rebranchent au retour, avec un rafraîchissement.
 */
export function useDirect() {
  const actif = usePremierPlan();
  const [feed, setFeed] = useState<CompetitionFeed[] | null>(null);
  const [majA, setMajA] = useState<Date | null>(null);
  const [horsLigne, setHorsLigne] = useState(false);
  const [chargement, setChargement] = useState(false);

  // Ce que les écouteurs ont dit en dernier : plus frais que l'API (voir appliquerEcoutes).
  const ecoutes = useRef(new Map<string, CompMatch[]>());
  const amicaux = useRef<CompMatch[] | null>(null);

  const rafraichir = useCallback(async () => {
    setChargement(true);
    try {
      const board = await chargerDirect();
      setFeed(appliquerEcoutes(board, ecoutes.current, amicaux.current));
      setMajA(new Date());
      setHorsLigne(false);
    } catch {
      // On garde le tableau affiché ; l'écran dit qu'il date.
      setHorsLigne(true);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    if (actif) void rafraichir();
  }, [actif, rafraichir]);

  // Chaîne stable : le flux change à chaque score, la liste des compétitions non.
  const ids = useMemo(
    () =>
      (feed ?? [])
        .map((f) => f.competition.id)
        .filter((id) => id !== FRIENDLY_COMP_ID && !isWorldComp(id))
        .join(","),
    [feed],
  );

  useEffect(() => {
    if (!actif || !ids) return;
    const carte = ecoutes.current;
    const arrets = ids.split(",").map((cid) =>
      ecouterMatchsCompetition(cid, (matches) => {
        carte.set(cid, matches);
        setFeed((prev) => (prev ? remplacerMatchs(prev, cid, matches) : prev));
      }),
    );
    return () => {
      arrets.forEach((arret) => arret());
      carte.clear();
    };
  }, [actif, ids]);

  useEffect(() => {
    if (!actif) return;
    const arret = ecouterAmicauxEnCours((frais) => {
      amicaux.current = frais;
      setFeed((prev) => (prev ? fusionnerAmicaux(prev, frais) : prev));
    });
    return () => {
      arret();
      amicaux.current = null;
    };
  }, [actif]);

  // La minute avance seule entre deux écritures Firestore.
  const [, battre] = useState(0);
  useEffect(() => {
    if (!actif) return;
    const t = setInterval(() => battre((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, [actif]);

  return { feed, majA, horsLigne, chargement, rafraichir };
}
```

**Step 3 : vérifier** — `npx tsc --noEmit`, `npm run lint`.

**Step 4 : commit** — `feat(mobile): useDirect, l'API puis le temps réel, coupé en arrière-plan`.

---

## Task B11 : l'authentification

**Files :** Create : `mobile/src/lib/auth.tsx`

**Step 1 : `mobile/src/lib/auth.tsx`**

```tsx
import {
  createUserWithEmailAndPassword, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail,
  signInWithEmailAndPassword, signOut, type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { buildFirestoreUser, firestoreToProfile, providersDepuisFirebase } from "@/lib/profil";
import type { FirestoreUser, SignupData, UserProfile } from "@/types";
import { suivreCompetition } from "~/lib/direct-firestore";
import { auth, db } from "~/lib/firebase";
import { appliquerSuiviEnAttente } from "~/lib/suivi-en-attente";

export interface ChampsProfil {
  firstName: string;
  lastName: string;
  locationCity: string;
}

interface Etat {
  /** L'état initial n'est pas encore connu : on garde l'écran de lancement. */
  chargement: boolean;
  utilisateur: User | null;
  profil: UserProfile | null;
  /** Connecté, et le document users/{uid} n'existe pas : écran profil obligatoire. */
  profilManquant: boolean;
}

interface EtatAuth extends Etat {
  connexionEmail: (email: string, motDePasse: string) => Promise<void>;
  inscriptionEmail: (email: string, motDePasse: string) => Promise<void>;
  motDePasseOublie: (email: string) => Promise<void>;
  completerProfil: (champs: ChampsProfil) => Promise<void>;
  rafraichirProfil: () => Promise<void>;
  deconnexion: () => Promise<void>;
}

const Contexte = createContext<EtatAuth | null>(null);

async function lireProfil(u: User): Promise<{ profil: UserProfile | null; manquant: boolean }> {
  const snap = await getDoc(doc(db, "users", u.uid));
  if (!snap.exists()) return { profil: null, manquant: true };
  const profil = firestoreToProfile(u.uid, snap.data() as FirestoreUser);
  profil.emailVerified = u.emailVerified;
  return { profil, manquant: false };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<Etat>({ chargement: true, utilisateur: null, profil: null, profilManquant: false });

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        if (!u) {
          setEtat({ chargement: false, utilisateur: null, profil: null, profilManquant: false });
          return;
        }
        // UN SEUL setState, après la lecture du profil : poser l'utilisateur
        // d'abord ferait passer les gardes par « connecté avec profil » le
        // temps d'une lecture, et les onglets clignoteraient avant l'écran profil.
        try {
          const { profil, manquant } = await lireProfil(u);
          setEtat({ chargement: false, utilisateur: u, profil, profilManquant: manquant });
        } catch {
          // Profil illisible (réseau) : connecté, sans profil connu. Surtout ne
          // pas conclure qu'il manque — l'écran profil écraserait un compte existant.
          setEtat({ chargement: false, utilisateur: u, profil: null, profilManquant: false });
        }
      }),
    [],
  );

  const rafraichirProfil = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) return;
    const { profil, manquant } = await lireProfil(u);
    setEtat((e) => ({ ...e, utilisateur: u, profil, profilManquant: manquant }));
  }, []);

  // L'étoile touchée sans compte : suivie dès que le profil existe.
  const uid = etat.profil?.uid;
  useEffect(() => {
    if (!uid) return;
    appliquerSuiviEnAttente(uid, suivreCompetition)
      .then((fait) => (fait ? rafraichirProfil() : undefined))
      .catch((e) => console.warn("[auth] suivi en attente", e));
  }, [uid, rafraichirProfil]);

  const connexionEmail = useCallback(async (email: string, motDePasse: string) => {
    await signInWithEmailAndPassword(auth, email, motDePasse);
  }, []);

  const inscriptionEmail = useCallback(async (email: string, motDePasse: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, motDePasse);
    // Comme sur le site : l'e-mail de vérification part, sans bloquer l'accès.
    sendEmailVerification(cred.user).catch(() => {});
  }, []);

  const motDePasseOublie = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  const completerProfil = useCallback(
    async (champs: ChampsProfil) => {
      const u = auth.currentUser;
      if (!u) throw new Error("Non connecté");
      // Spectateur par défaut, comme /get-started : on n'est joueur que si on
      // l'a choisi, et ce choix-là vit sur le site.
      const data: SignupData = { ...champs, userType: "user", email: u.email ?? undefined };
      const providers = providersDepuisFirebase(u.providerData.map((p) => p.providerId));
      await setDoc(doc(db, "users", u.uid), {
        ...buildFirestoreUser(data, providers),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      await rafraichirProfil();
    },
    [rafraichirProfil],
  );

  const deconnexion = useCallback(async () => {
    await signOut(auth);
  }, []);

  const valeur = useMemo<EtatAuth>(
    () => ({ ...etat, connexionEmail, inscriptionEmail, motDePasseOublie, completerProfil, rafraichirProfil, deconnexion }),
    [etat, connexionEmail, inscriptionEmail, motDePasseOublie, completerProfil, rafraichirProfil, deconnexion],
  );
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useAuth(): EtatAuth {
  const etat = useContext(Contexte);
  if (!etat) throw new Error("useAuth hors d'AuthProvider");
  return etat;
}
```

**Step 2 : vérifier** — `npx tsc --noEmit`, `npm run lint`.

**Step 3 : commit** — `feat(mobile): l'authentification e-mail, et le profil à la forme du site`.

---

## Task B12 : le layout racine, les gardes, l'accueil

**Files :**
- Modify : `mobile/src/app/_layout.tsx`
- Delete : `mobile/src/app/index.tsx` (de B1)
- Create : `mobile/src/app/accueil.tsx`, `mobile/src/app/(tabs)/_layout.tsx`, `mobile/src/app/(tabs)/index.tsx` (provisoire, remplacé en B15), `mobile/src/app/(tabs)/compte.tsx` (provisoire, remplacé en B16)
- Create : `mobile/assets/accueil/scores.jpg`, `matchs.jpg`, `terrain.jpg`

**Step 1 : les visuels** (depuis la racine) — ce sont des JPEG :

```bash
mkdir -p mobile/assets/accueil
cp public/branding/fan_scores.png mobile/assets/accueil/scores.jpg
cp public/branding/fan_matchs.png mobile/assets/accueil/matchs.jpg
cp public/branding/fan_terrain.png mobile/assets/accueil/terrain.jpg
```

**Step 2 : `mobile/src/app/_layout.tsx`**

```tsx
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from "@expo-google-fonts/dm-sans";
import { Outfit_700Bold, Outfit_800ExtraBold, useFonts } from "@expo-google-fonts/outfit";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AccueilProvider, useAccueil } from "~/lib/accueil";
import { AuthProvider, useAuth } from "~/lib/auth";

void SplashScreen.preventAutoHideAsync();

// Les fenêtres de connexion s'ouvrent PAR-DESSUS les onglets.
export const unstable_settings = { anchor: "(tabs)" };

export default function RacineLayout() {
  const [policesPretes] = useFonts({
    Outfit_700Bold, Outfit_800ExtraBold, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold,
  });
  return (
    <AuthProvider>
      <AccueilProvider>
        <StatusBar style="dark" />
        <Navigation policesPretes={policesPretes} />
      </AccueilProvider>
    </AuthProvider>
  );
}

/**
 * QUI VOIT QUOI, EN TROIS GARDES.
 *
 * 1. L'accueil tant qu'il n'a pas été vu.
 * 2. L'écran profil, et lui seul, pour un compte sans document users/{uid} :
 *    sur le site un compte sans profil est une impasse, ici il ne peut pas exister.
 * 3. Sinon les onglets, et les fenêtres de connexion tant qu'on n'est pas connecté.
 *
 * Une garde qui tombe retire ses écrans de l'historique : une connexion réussie
 * referme donc la fenêtre toute seule, et l'on revient à l'onglet d'où l'on venait.
 */
function Navigation({ policesPretes }: { policesPretes: boolean }) {
  const { chargement, utilisateur, profilManquant } = useAuth();
  const accueil = useAccueil();
  const router = useRouter();
  const pret = policesPretes && !chargement && accueil.pret;

  useEffect(() => {
    if (pret) void SplashScreen.hideAsync();
  }, [pret]);

  // « J'ai déjà un compte » : la connexion s'ouvre une fois l'accueil retiré.
  // Le tour de boucle laisse d'abord la pile appliquer la garde.
  const { vu, suite, oublierSuite } = accueil;
  useEffect(() => {
    if (!vu || !suite) return;
    const t = setTimeout(() => {
      router.push(suite);
      oublierSuite();
    }, 0);
    return () => clearTimeout(t);
  }, [vu, suite, oublierSuite, router]);

  if (!pret) return null;

  const fenetre = { presentation: "modal" as const };
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!accueil.vu}>
        <Stack.Screen name="accueil" />
      </Stack.Protected>
      <Stack.Protected guard={accueil.vu && profilManquant}>
        <Stack.Screen name="profil" options={{ gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={accueil.vu && !profilManquant}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={accueil.vu && !profilManquant && !utilisateur}>
        <Stack.Screen name="connexion" options={fenetre} />
        <Stack.Screen name="inscription" options={fenetre} />
        <Stack.Screen name="mot-de-passe" options={fenetre} />
      </Stack.Protected>
    </Stack>
  );
}
```

**Step 3 : `mobile/src/app/accueil.tsx`**

```tsx
import { Image } from "expo-image";
import { useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bouton } from "~/components/Bouton";
import { useAccueil } from "~/lib/accueil";
import { couleurs, polices } from "~/theme";

// Le registre de la campagne d'affiches : montrer le match, cacher la
// machine. Et rien qui ne soit pas déjà dans l'application — donc pas encore
// de notifications.
const DIAPOS = [
  {
    cle: "direct",
    image: require("../../assets/accueil/scores.jpg"),
    titre: "Le football d'ici, en direct",
    texte: "Les matchs de ta ville, minute par minute.",
  },
  {
    cle: "suivre",
    image: require("../../assets/accueil/matchs.jpg"),
    titre: "Suis tes compétitions",
    texte: "Une étoile, et elles passent en tête.",
  },
  {
    cle: "monde",
    image: require("../../assets/accueil/terrain.jpg"),
    titre: "Le monde aussi",
    texte: "Le football mondial du jour, au même endroit.",
  },
];

export default function EcranAccueil() {
  const { terminer } = useAccueil();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const liste = useRef<FlatList<(typeof DIAPOS)[number]>>(null);
  const dernier = index === DIAPOS.length - 1;

  return (
    <View style={styles.ecran}>
      <FlatList
        ref={liste}
        data={DIAPOS}
        keyExtractor={(d) => d.cle}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={{ width }}>
            <Image source={item.image} style={styles.image} contentFit="cover" />
            <View style={styles.textes}>
              <Text style={styles.titre}>{item.titre}</Text>
              <Text style={styles.texte}>{item.texte}</Text>
            </View>
          </View>
        )}
      />

      <SafeAreaView edges={["bottom"]} style={styles.bas}>
        <View style={styles.points}>
          {DIAPOS.map((d, i) => (
            <View key={d.cle} style={[styles.point, i === index && styles.pointActif]} />
          ))}
        </View>
        {dernier ? (
          <>
            <Bouton titre="Voir le direct" onPress={() => terminer()} />
            <Bouton titre="J'ai déjà un compte" variante="lien" sombre onPress={() => terminer("/connexion")} />
          </>
        ) : (
          <Bouton titre="Suivant" onPress={() => liste.current?.scrollToIndex({ index: index + 1 })} />
        )}
      </SafeAreaView>

      <SafeAreaView edges={["top"]} style={styles.haut}>
        <Pressable accessibilityRole="button" onPress={() => terminer()} hitSlop={12}>
          <Text style={styles.passer}>Passer</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.sombre },
  image: { width: "100%", height: "62%" },
  textes: { paddingHorizontal: 24, paddingTop: 28, gap: 10 },
  titre: { fontFamily: polices.titre, fontSize: 30, lineHeight: 34, color: "#fff" },
  texte: { fontFamily: polices.texte, fontSize: 16, color: "rgba(255,255,255,0.75)" },
  bas: { paddingHorizontal: 24, paddingBottom: 12, gap: 8 },
  points: { flexDirection: "row", gap: 6, marginBottom: 12 },
  point: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.3)" },
  pointActif: { width: 18, backgroundColor: couleurs.primaireClair },
  haut: { position: "absolute", top: 0, right: 0, padding: 16 },
  passer: { fontFamily: polices.texteMoyen, fontSize: 14, color: "#fff" },
});
```

**Step 4 : les onglets** — `mobile/src/app/(tabs)/_layout.tsx`

```tsx
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { couleurs, polices } from "~/theme";

// Deux onglets aujourd'hui : on ne montre que ce qui existe. Compétitions et
// Tribune viendront avec leurs lots.
export default function OngletsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: couleurs.primaire,
        tabBarInactiveTintColor: couleurs.texteDiscret,
        tabBarLabelStyle: { fontFamily: polices.texteMoyen, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Direct", tabBarIcon: ({ color, size }) => <Ionicons name="football" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="compte"
        options={{ title: "Compte", tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
```

`(tabs)/index.tsx` et `(tabs)/compte.tsx` provisoires : un `<Text>` centré (« Direct », « Compte »), remplacés en B15 et B16. Créer aussi `connexion.tsx`, `inscription.tsx`, `mot-de-passe.tsx` et `profil.tsx` provisoires de la même façon, pour que les gardes trouvent leurs routes (remplacés en B13 et B14).

**Step 5 : vérifier**
- `npx tsc --noEmit`, `npm run lint`, `npx jest` → OK.
- `npx expo export --platform android --output-dir <scratchpad>/export-b12` → succès.
- Dans Expo Go (`npx expo start`, scanner le QR code) : premier lancement → accueil ; « Passer » → onglets ; relancer l'app → onglets directement. Effacer les données d'Expo Go pour revoir l'accueil.

**Step 6 : commit** — `feat(mobile): l'accueil, les onglets et les gardes de navigation`.

---

## Task B13 : connexion, inscription, mot de passe oublié

**Files :**
- Create : `mobile/src/components/EcranAuth.tsx`
- Modify : `mobile/src/app/connexion.tsx`, `inscription.tsx`, `mot-de-passe.tsx`

**Step 1 : `mobile/src/components/EcranAuth.tsx`** — le cadre commun aux trois fenêtres :

```tsx
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { couleurs, polices } from "~/theme";

export function EcranAuth({ titre, phrase, children }: { titre: string; phrase: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.ecran} edges={["top", "bottom"]}>
      <View style={styles.barre}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.fermer}>Fermer</Text>
        </Pressable>
      </View>
      <KeyboardAvoidingView style={styles.ecran} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
          <Text style={styles.titre}>{titre}</Text>
          <Text style={styles.phrase}>{phrase}</Text>
          <View style={styles.formulaire}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export const stylesAuth = StyleSheet.create({
  erreur: { fontFamily: polices.texte, fontSize: 13, color: couleurs.erreur },
  info: { fontFamily: polices.texte, fontSize: 14, color: couleurs.texteSecondaire },
});

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  barre: { paddingHorizontal: 20, paddingVertical: 12, alignItems: "flex-end" },
  fermer: { fontFamily: polices.texteMoyen, fontSize: 15, color: couleurs.texteSecondaire },
  contenu: { paddingHorizontal: 24, paddingBottom: 32 },
  titre: { fontFamily: polices.titre, fontSize: 26, color: couleurs.texte },
  phrase: { fontFamily: polices.texte, fontSize: 14, color: couleurs.texteDiscret, marginTop: 4, marginBottom: 28 },
  formulaire: { gap: 16 },
});
```

**Step 2 : `mobile/src/app/connexion.tsx`**

```tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { CONTEXTE_AUTH_DEFAUT } from "@/config/auth-contextes";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { Bouton } from "~/components/Bouton";
import { Champ } from "~/components/Champ";
import { EcranAuth, stylesAuth } from "~/components/EcranAuth";
import { useAuth } from "~/lib/auth";

export default function EcranConnexion() {
  const { raison } = useLocalSearchParams<{ raison?: string }>();
  const { connexionEmail } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function seConnecter() {
    if (!email.trim() || !motDePasse) {
      setErreur("Email et mot de passe requis");
      return;
    }
    setErreur(null);
    setOccupe(true);
    try {
      // Rien d'autre à faire : la garde referme la fenêtre une fois connecté.
      await connexionEmail(email.trim(), motDePasse);
    } catch (e) {
      setErreur(getAuthErrorMessage(e));
      setOccupe(false);
    }
  }

  return (
    <EcranAuth
      titre={CONTEXTE_AUTH_DEFAUT.titreConnexion}
      phrase={raison === "suivre" ? "Crée un compte pour suivre cette compétition." : CONTEXTE_AUTH_DEFAUT.phraseConnexion}
    >
      <Champ etiquette="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <Champ etiquette="Mot de passe" value={motDePasse} onChangeText={setMotDePasse} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={seConnecter} />
      {erreur ? <Text style={stylesAuth.erreur}>{erreur}</Text> : null}
      <Bouton titre="Se connecter" occupe={occupe} onPress={seConnecter} />
      <Bouton titre="Mot de passe oublié ?" variante="lien" onPress={() => router.replace("/mot-de-passe")} />
      <Bouton
        titre="Pas encore de compte ? Créer un compte"
        variante="lien"
        onPress={() => router.replace({ pathname: "/inscription", params: raison ? { raison } : {} })}
      />
    </EcranAuth>
  );
}
```

`router.replace` entre les trois fenêtres : une seule fenêtre ouverte à la fois, « Fermer » (`router.back()`) ramène toujours à l'onglet.

**Step 3 : `mobile/src/app/inscription.tsx`**

```tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { CONTEXTE_AUTH_DEFAUT } from "@/config/auth-contextes";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { Bouton } from "~/components/Bouton";
import { Champ } from "~/components/Champ";
import { EcranAuth, stylesAuth } from "~/components/EcranAuth";
import { useAuth } from "~/lib/auth";

export default function EcranInscription() {
  const { raison } = useLocalSearchParams<{ raison?: string }>();
  const { inscriptionEmail } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreurs, setErreurs] = useState<{ email?: string; motDePasse?: string }>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function creer() {
    // Les règles de /signup : un e-mail, six caractères au moins (le minimum de Firebase).
    const suivantes = {
      email: /^\S+@\S+\.\S+$/.test(email.trim()) ? undefined : "Email invalide",
      motDePasse: motDePasse.length >= 6 ? undefined : "Min. 6 caractères",
    };
    setErreurs(suivantes);
    if (suivantes.email || suivantes.motDePasse) return;
    setErreur(null);
    setOccupe(true);
    try {
      // La garde bascule ensuite sur l'écran profil.
      await inscriptionEmail(email.trim(), motDePasse);
    } catch (e) {
      setErreur(getAuthErrorMessage(e));
      setOccupe(false);
    }
  }

  return (
    <EcranAuth
      titre={CONTEXTE_AUTH_DEFAUT.titreInscription}
      phrase={raison === "suivre" ? "Crée un compte pour suivre cette compétition." : CONTEXTE_AUTH_DEFAUT.phraseInscription}
    >
      <Champ etiquette="Email" value={email} onChangeText={setEmail} erreur={erreurs.email} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <Champ etiquette="Mot de passe" value={motDePasse} onChangeText={setMotDePasse} erreur={erreurs.motDePasse} secureTextEntry autoComplete="new-password" textContentType="newPassword" onSubmitEditing={creer} />
      {erreur ? <Text style={stylesAuth.erreur}>{erreur}</Text> : null}
      <Bouton titre="Créer mon compte" occupe={occupe} onPress={creer} />
      <Bouton
        titre="Déjà un compte ? Se connecter"
        variante="lien"
        onPress={() => router.replace({ pathname: "/connexion", params: raison ? { raison } : {} })}
      />
    </EcranAuth>
  );
}
```

**Step 4 : `mobile/src/app/mot-de-passe.tsx`**

```tsx
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { Bouton } from "~/components/Bouton";
import { Champ } from "~/components/Champ";
import { EcranAuth, stylesAuth } from "~/components/EcranAuth";
import { useAuth } from "~/lib/auth";

export default function EcranMotDePasse() {
  const { motDePasseOublie } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function envoyer() {
    if (!email.trim()) {
      setErreur("Email requis");
      return;
    }
    setErreur(null);
    setOccupe(true);
    try {
      await motDePasseOublie(email.trim());
      setEnvoye(true);
    } catch (e) {
      setErreur(getAuthErrorMessage(e));
    } finally {
      setOccupe(false);
    }
  }

  return (
    <EcranAuth titre="Mot de passe oublié" phrase="On t'envoie un lien pour en choisir un nouveau.">
      {envoye ? (
        // Pas de « compte introuvable » : ce serait dire à n'importe qui quelles adresses ont un compte.
        <Text style={stylesAuth.info}>
          Si un compte existe pour cette adresse, un e-mail vient de partir. Pense à regarder dans les indésirables.
        </Text>
      ) : (
        <>
          <Champ etiquette="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" onSubmitEditing={envoyer} />
          {erreur ? <Text style={stylesAuth.erreur}>{erreur}</Text> : null}
          <Bouton titre="Envoyer le lien" occupe={occupe} onPress={envoyer} />
        </>
      )}
      <Bouton titre="Retour à la connexion" variante="lien" onPress={() => router.replace("/connexion")} />
    </EcranAuth>
  );
}
```

**Step 5 : vérifier** — `npx tsc --noEmit`, `npm run lint`. Dans Expo Go : onglet Compte provisoire → pas de lien encore ; tester la connexion en naviguant manuellement n'est pas utile ici, la vérification complète est en B17.

**Step 6 : commit** — `feat(mobile): connexion, inscription et mot de passe oublié`.

---

## Task B14 : l'écran profil

**Files :** Modify : `mobile/src/app/profil.tsx`

**Step 1 : `mobile/src/app/profil.tsx`**

```tsx
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as yup from "yup";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { nomPersonne, villeRequise } from "@/lib/champs-valides";
import { Bouton } from "~/components/Bouton";
import { Champ } from "~/components/Champ";
import { stylesAuth } from "~/components/EcranAuth";
import { useAuth, type ChampsProfil } from "~/lib/auth";
import { couleurs, polices } from "~/theme";

// Les règles du site, écrites une fois dans lib/champs-valides.
const schema = yup.object({
  firstName: nomPersonne("Prénom"),
  lastName: nomPersonne("Nom"),
  locationCity: villeRequise,
});

type Cle = keyof ChampsProfil;

export default function EcranProfil() {
  const { utilisateur, completerProfil, deconnexion } = useAuth();
  const [valeurs, setValeurs] = useState<ChampsProfil>({ firstName: "", lastName: "", locationCity: "" });
  const [erreurs, setErreurs] = useState<Partial<Record<Cle, string>>>({});
  const [erreurGenerale, setErreurGenerale] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  const changer = (cle: Cle) => (texte: string) => setValeurs((v) => ({ ...v, [cle]: texte }));

  async function continuer() {
    setErreurGenerale(null);
    let propres: ChampsProfil;
    try {
      propres = (await schema.validate(valeurs, { abortEarly: false })) as ChampsProfil;
      setErreurs({});
    } catch (e) {
      // `isError` et non `instanceof` : l'alias de tsconfig garantit une seule
      // copie de yup, mais ce test-là ne dépend pas de cette garantie.
      if (yup.ValidationError.isError(e)) {
        setErreurs(Object.fromEntries(e.inner.map((i) => [i.path, i.message])) as Partial<Record<Cle, string>>);
      }
      return;
    }
    setOccupe(true);
    try {
      // La garde bascule sur les onglets une fois le profil écrit.
      await completerProfil(propres);
    } catch (e) {
      setErreurGenerale(getAuthErrorMessage(e));
      setOccupe(false);
    }
  }

  function quitter() {
    Alert.alert("Se déconnecter ?", "Ton compte est créé ; tu compléteras ton profil à la prochaine connexion.", [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: () => void deconnexion() },
    ]);
  }

  return (
    <SafeAreaView style={styles.ecran} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.ecran} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
          <Text style={styles.titre}>Bienvenue !</Text>
          <Text style={styles.phrase}>{utilisateur?.email ?? "Complète ton profil pour continuer"}</Text>
          <View style={styles.formulaire}>
            <Champ etiquette="Prénom" value={valeurs.firstName} onChangeText={changer("firstName")} erreur={erreurs.firstName} autoComplete="given-name" textContentType="givenName" />
            <Champ etiquette="Nom" value={valeurs.lastName} onChangeText={changer("lastName")} erreur={erreurs.lastName} autoComplete="family-name" textContentType="familyName" />
            <Champ etiquette="Ta ville" value={valeurs.locationCity} onChangeText={changer("locationCity")} erreur={erreurs.locationCity} placeholder="Ta ville" textContentType="addressCity" onSubmitEditing={continuer} />
            {erreurGenerale ? <Text style={stylesAuth.erreur}>{erreurGenerale}</Text> : null}
            <Bouton titre="Continuer" occupe={occupe} onPress={continuer} />
            <Bouton titre="Se déconnecter" variante="lien" onPress={quitter} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  contenu: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32 },
  titre: { fontFamily: polices.titre, fontSize: 26, color: couleurs.texte },
  phrase: { fontFamily: polices.texte, fontSize: 14, color: couleurs.texteDiscret, marginTop: 4, marginBottom: 28 },
  formulaire: { gap: 16 },
});
```

**Step 2 : vérifier** — `npx tsc --noEmit`, `npm run lint`, `npx expo export --platform android` → succès.

**Step 3 : commit** — `feat(mobile): l'écran profil, obligatoire pour un compte sans profil`.

---

## Task B15 : l'écran Direct

**Files :**
- Create : `mobile/src/hooks/useSuivi.ts`
- Create : `mobile/src/components/direct/LigneMatch.tsx`, `EnTeteCompetition.tsx`, `SelecteurJour.tsx`, `FiltresDirect.tsx`
- Modify : `mobile/src/app/(tabs)/index.tsx`

**Step 1 : `mobile/src/hooks/useSuivi.ts`**

```ts
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useAuth } from "~/lib/auth";
import { suivreCompetition } from "~/lib/direct-firestore";
import { mettreEnAttente } from "~/lib/suivi-en-attente";

/**
 * Les compétitions suivies, et l'étoile qui les bascule.
 *
 * Optimiste : l'étoile change tout de suite, et revient si l'écriture échoue.
 * Sans compte, elle ouvre la connexion et se met en attente (voir
 * lib/suivi-en-attente).
 */
export function useSuivi() {
  const { profil, rafraichirProfil } = useAuth();
  const router = useRouter();
  const [enCours, setEnCours] = useState<ReadonlyMap<string, boolean>>(new Map());

  const ids = useMemo(() => {
    const s = new Set(profil?.followedCompetitionIds ?? []);
    for (const [cid, suivre] of enCours) {
      if (suivre) s.add(cid);
      else s.delete(cid);
    }
    return s;
  }, [profil, enCours]);

  const basculer = useCallback(
    async (cid: string) => {
      if (!profil) {
        mettreEnAttente(cid);
        router.push({ pathname: "/connexion", params: { raison: "suivre" } });
        return;
      }
      const suivre = !ids.has(cid);
      setEnCours((m) => new Map(m).set(cid, suivre));
      try {
        await suivreCompetition(profil.uid, cid, suivre);
        await rafraichirProfil();
      } catch {
        Alert.alert("Impossible de mettre à jour", "Vérifie ta connexion, puis réessaie.");
      } finally {
        setEnCours((m) => {
          const suivant = new Map(m);
          suivant.delete(cid);
          return suivant;
        });
      }
    },
    [profil, ids, router, rafraichirProfil],
  );

  return { ids, basculer };
}
```

**Step 2 : `mobile/src/components/direct/LigneMatch.tsx`**

```tsx
import { Pressable, StyleSheet, Text, View } from "react-native";
import { liveMinute, type Entry } from "@/lib/direct-shared";
import { Ecusson } from "~/components/Ecusson";
import { couleurs, polices } from "~/theme";

function Camp({ nom, logo, score, devant }: { nom: string; logo: string | null; score: number | null; devant: boolean }) {
  return (
    <View style={styles.camp}>
      <Ecusson url={logo} nom={nom} />
      <Text style={[styles.nom, devant && styles.gras]} numberOfLines={1}>{nom}</Text>
      <Text style={[styles.score, devant && styles.gras]}>{score ?? ""}</Text>
    </View>
  );
}

export function LigneMatch({ entree, onPress }: { entree: Entry; onPress: () => void }) {
  const { match } = entree;
  const enDirect = match.status === "live";
  const joue = match.status === "completed";
  const domicile = match.scoreHome;
  const exterieur = match.scoreAway;
  const aScore = domicile != null && exterieur != null;
  const domicileDevant = aScore && domicile > exterieur;
  const exterieurDevant = aScore && exterieur > domicile;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${match.homeTeamName} contre ${match.awayTeamName}`}
      onPress={onPress}
      style={({ pressed }) => [styles.ligne, pressed && styles.presse]}
    >
      <View style={styles.temps}>
        {enDirect ? (
          <Text style={styles.minute}>{liveMinute(match)}′</Text>
        ) : (
          <Text style={styles.heure}>{joue ? "Terminé" : match.time ?? "—"}</Text>
        )}
      </View>
      <View style={styles.camps}>
        <Camp nom={match.homeTeamName} logo={match.homeTeamLogo} score={aScore ? domicile : null} devant={domicileDevant} />
        <Camp nom={match.awayTeamName} logo={match.awayTeamLogo} score={aScore ? exterieur : null} devant={exterieurDevant} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ligne: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: couleurs.fond, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: couleurs.bordure,
  },
  presse: { backgroundColor: couleurs.fondSecondaire },
  temps: { width: 56 },
  minute: { fontFamily: polices.texteGras, fontSize: 13, color: couleurs.direct },
  heure: { fontFamily: polices.texteMoyen, fontSize: 12, color: couleurs.texteDiscret },
  camps: { flex: 1, gap: 6 },
  camp: { flexDirection: "row", alignItems: "center", gap: 8 },
  nom: { flex: 1, fontFamily: polices.texte, fontSize: 14, color: couleurs.texte },
  score: { minWidth: 20, textAlign: "right", fontFamily: polices.texteMoyen, fontSize: 14, color: couleurs.texte },
  gras: { fontFamily: polices.texteGras },
});
```

Écussons : l'application lit la copie posée sur le match. Le site corrige par la fiche `comp_teams` et le club (`useEcussons`) ; pas dans ce lot — un écusson périmé retombe sur les initiales.

**Step 3 : `mobile/src/components/direct/EnTeteCompetition.tsx`**

```tsx
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { competitionSubtitle } from "@/lib/direct-shared";
import type { Competition } from "@/types";
import { Ecusson } from "~/components/Ecusson";
import { couleurs, polices } from "~/theme";

interface Props {
  competition: Competition;
  /** Faux pour le football mondial et les amicaux : on ne les suit pas. */
  suivable: boolean;
  suivie: boolean;
  onEtoile: () => void;
  onPress: () => void;
}

export function EnTeteCompetition({ competition, suivable, suivie, onEtoile, onPress }: Props) {
  const sousTitre = competitionSubtitle(competition);
  return (
    <View style={styles.entete}>
      <Pressable accessibilityRole="link" onPress={onPress} style={styles.titre}>
        <Ecusson url={competition.logoUrl} nom={competition.name} taille={20} />
        <View style={styles.textes}>
          <Text style={styles.nom} numberOfLines={1}>{competition.name}</Text>
          {sousTitre ? <Text style={styles.sousTitre} numberOfLines={1}>{sousTitre}</Text> : null}
        </View>
      </Pressable>
      {suivable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={suivie ? "Ne plus suivre cette compétition" : "Suivre cette compétition"}
          accessibilityState={{ selected: suivie }}
          onPress={onEtoile}
          hitSlop={12}
        >
          <Ionicons name={suivie ? "star" : "star-outline"} size={20} color={suivie ? couleurs.accent : couleurs.texteDiscret} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  entete: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: couleurs.fondSecondaire, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: couleurs.bordure,
  },
  titre: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  textes: { flex: 1 },
  nom: { fontFamily: polices.texteGras, fontSize: 13, color: couleurs.texte },
  sousTitre: { fontFamily: polices.texte, fontSize: 11, color: couleurs.texteDiscret },
});
```

**Step 4 : `mobile/src/components/direct/SelecteurJour.tsx`**

```tsx
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { decalerDeJours, libelleDuJour } from "@/lib/dates";
import { couleurs, polices } from "~/theme";

export function SelecteurJour({ jour, onChange }: { jour: string; onChange: (jour: string) => void }) {
  return (
    <View style={styles.barre}>
      <Pressable accessibilityRole="button" accessibilityLabel="Jour précédent" onPress={() => onChange(decalerDeJours(jour, -1))} hitSlop={12}>
        <Ionicons name="chevron-back" size={20} color={couleurs.texte} />
      </Pressable>
      <Text style={styles.jour}>{libelleDuJour(jour)}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Jour suivant" onPress={() => onChange(decalerDeJours(jour, 1))} hitSlop={12}>
        <Ionicons name="chevron-forward" size={20} color={couleurs.texte} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  barre: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 },
  jour: { fontFamily: polices.titreMoyen, fontSize: 16, color: couleurs.texte },
});
```

`libelleDuJour` utilise `toLocaleDateString("fr-FR")` : sous Hermes, vérifier en B17 qu'un jour lointain s'affiche bien « sam. 27 sept. » et non la clé brute (le `catch` du site renvoie la clé si l'Intl manque).

**Step 5 : `mobile/src/components/direct/FiltresDirect.tsx`**

```tsx
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import type { FiltreDirect } from "~/lib/direct-tableau";
import { couleurs, polices } from "~/theme";

export function FiltresDirect({ filtre, enDirect, onChange }: { filtre: FiltreDirect; enDirect: number; onChange: (f: FiltreDirect) => void }) {
  const puces: { cle: FiltreDirect; libelle: string }[] = [
    { cle: "tous", libelle: "Tous" },
    { cle: "direct", libelle: enDirect > 0 ? `En direct (${enDirect})` : "En direct" },
    { cle: "favoris", libelle: "Favoris" },
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rangee}>
      {puces.map((p) => {
        const actif = p.cle === filtre;
        return (
          <Pressable key={p.cle} accessibilityRole="tab" accessibilityState={{ selected: actif }} onPress={() => onChange(p.cle)} style={[styles.puce, actif && styles.puceActive]}>
            <Text style={[styles.libelle, actif && styles.libelleActif]}>{p.libelle}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rangee: { gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  puce: { paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: couleurs.bordure, backgroundColor: couleurs.fond },
  puceActive: { backgroundColor: couleurs.texte, borderColor: couleurs.texte },
  libelle: { fontFamily: polices.texteMoyen, fontSize: 13, color: couleurs.texteSecondaire },
  libelleActif: { color: "#fff" },
});
```

**Step 6 : `mobile/src/app/(tabs)/index.tsx`**

```tsx
import * as WebBrowser from "expo-web-browser";
import { useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { cleDuJour, libelleDuJour } from "@/lib/dates";
import { competitionHref, entryKey, matchHref, type Entry } from "@/lib/direct-shared";
import { FRIENDLY_COMP_ID } from "@/lib/friendlies-shared";
import { isWorldComp } from "@/lib/world-board-shared";
import type { Competition } from "@/types";
import { Bouton } from "~/components/Bouton";
import { EnTeteCompetition } from "~/components/direct/EnTeteCompetition";
import { FiltresDirect } from "~/components/direct/FiltresDirect";
import { LigneMatch } from "~/components/direct/LigneMatch";
import { SelecteurJour } from "~/components/direct/SelecteurJour";
import { useDirect } from "~/hooks/useDirect";
import { useSuivi } from "~/hooks/useSuivi";
import { urlDuSite } from "~/lib/config";
import { compterEnDirect, groupesDuTableau, jourLePlusProche, type FiltreDirect } from "~/lib/direct-tableau";
import { couleurs, polices } from "~/theme";

/** La page web, dans le navigateur intégré, jusqu'à la fiche native du lot suivant. */
function ouvrirSurLeSite(chemin: string) {
  void WebBrowser.openBrowserAsync(urlDuSite(chemin), { toolbarColor: couleurs.fond, controlsColor: couleurs.primaire });
}

const heure = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export default function EcranDirect() {
  const { feed, majA, horsLigne, chargement, rafraichir } = useDirect();
  const suivi = useSuivi();
  const [jour, setJour] = useState(() => cleDuJour(new Date()));
  const [filtre, setFiltre] = useState<FiltreDirect>("tous");

  const sections = useMemo(
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
  const proche = feed && sections.length === 0 && filtre === "tous" ? jourLePlusProche(feed, jour) : null;

  if (!feed) {
    return (
      <SafeAreaView style={[styles.ecran, styles.centre]}>
        {horsLigne ? (
          <>
            <Text style={styles.vide}>Impossible de charger le Direct.</Text>
            <Bouton titre="Réessayer" variante="contour" onPress={rafraichir} occupe={chargement} />
          </>
        ) : (
          <ActivityIndicator color={couleurs.primaire} />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.ecran} edges={["top"]}>
      <Text style={styles.titre}>Direct</Text>
      <SelecteurJour jour={jour} onChange={setJour} />
      <FiltresDirect filtre={filtre} enDirect={compterEnDirect(feed)} onChange={setFiltre} />
      {horsLigne && majA ? (
        <Text style={styles.bandeau}>Pas de connexion — mis à jour à {heure(majA)}</Text>
      ) : null}
      <SectionList<Entry, { key: string; competition: Competition; data: Entry[] }>
        sections={sections}
        keyExtractor={entryKey}
        stickySectionHeadersEnabled
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
        renderItem={({ item }) => <LigneMatch entree={item} onPress={() => ouvrirSurLeSite(matchHref(item))} />}
        refreshControl={<RefreshControl refreshing={chargement} onRefresh={rafraichir} colors={[couleurs.primaire]} />}
        ListEmptyComponent={
          <View style={styles.centre}>
            <Text style={styles.vide}>
              {filtre === "favoris"
                ? "Touche l'étoile d'une compétition pour la retrouver ici."
                : filtre === "direct"
                  ? "Aucun match en cours."
                  : "Aucun match ce jour-là."}
            </Text>
            {proche ? (
              <Bouton titre={`Voir ${libelleDuJour(proche).toLowerCase()}`} variante="contour" onPress={() => setJour(proche)} />
            ) : null}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  titre: { fontFamily: polices.titre, fontSize: 28, color: couleurs.texte, paddingHorizontal: 16, paddingTop: 8 },
  bandeau: {
    fontFamily: polices.texteMoyen, fontSize: 12, color: couleurs.texteSecondaire,
    backgroundColor: couleurs.fondTertiaire, paddingHorizontal: 16, paddingVertical: 6,
  },
  vide: { fontFamily: polices.texte, fontSize: 14, color: couleurs.texteSecondaire, textAlign: "center" },
});
```

**Step 7 : vérifier** — `npx tsc --noEmit`, `npm run lint`, `npx jest`, `npx expo export --platform android` → OK. Dans Expo Go : le tableau s'affiche, les jours défilent, les filtres filtrent, toucher un match ouvre sa page.

**Step 8 : commit** — `feat(mobile): l'écran Direct, le suivi par l'étoile, la page web au toucher`.

---

## Task B16 : l'onglet Compte

**Files :** Modify : `mobile/src/app/(tabs)/compte.tsx`

**Step 1 :**

```tsx
import { useRouter } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bouton } from "~/components/Bouton";
import { useAuth } from "~/lib/auth";
import { couleurs, polices } from "~/theme";

export default function EcranCompte() {
  const { utilisateur, profil, deconnexion } = useAuth();
  const router = useRouter();

  if (!utilisateur) {
    return (
      <SafeAreaView style={styles.ecran} edges={["top"]}>
        <Text style={styles.titre}>Compte</Text>
        <View style={styles.bloc}>
          <Text style={styles.texte}>Un compte pour suivre tes compétitions et les retrouver en tête du Direct.</Text>
          <Bouton titre="Se connecter" onPress={() => router.push("/connexion")} />
          <Bouton titre="Créer un compte" variante="contour" onPress={() => router.push("/inscription")} />
        </View>
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
      <Text style={styles.titre}>Compte</Text>
      <View style={styles.bloc}>
        {profil ? (
          <>
            <Text style={styles.nom}>{profil.firstName} {profil.lastName}</Text>
            <Text style={styles.texte}>{profil.email ?? utilisateur.email}</Text>
            {profil.locationCity ? <Text style={styles.texte}>{profil.locationCity}</Text> : null}
          </>
        ) : (
          <Text style={styles.texte}>Profil indisponible pour l'instant. Vérifie ta connexion.</Text>
        )}
        <Bouton titre="Se déconnecter" variante="contour" onPress={seDeconnecter} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  titre: { fontFamily: polices.titre, fontSize: 28, color: couleurs.texte, paddingHorizontal: 16, paddingTop: 8 },
  bloc: { padding: 16, gap: 12 },
  nom: { fontFamily: polices.titreMoyen, fontSize: 20, color: couleurs.texte },
  texte: { fontFamily: polices.texte, fontSize: 14, color: couleurs.texteSecondaire },
});
```

**Step 2 : vérifier** — `npx tsc --noEmit`, `npm run lint`.

**Step 3 : commit** — `feat(mobile): l'onglet Compte`.

---

## Task B17 : vérification sur un vrai téléphone, puis PR 2

**Step 1 : automatique** — dans `mobile/` : `npx jest`, `npx tsc --noEmit`, `npm run lint`, `npx expo export --platform android` → tout passe. À la racine : `npx tsc --noEmit`, `npm run lint` → le site ignore bien `mobile/`.

**Step 2 : sur un téléphone Android avec Expo Go** (`npx expo start`, même Wi-Fi). Dérouler, et noter le résultat de chaque ligne :

1. Premier lancement → les trois écrans d'accueil ; « Passer » et « Voir le direct » mènent au Direct ; relancer → Direct directement.
2. Le Direct : groupes dans l'ordre du site (en cours, ici, monde), minute qui avance sur un match en cours (30 s), « Aucun match ce jour-là » + bouton du jour le plus proche sur un jour vide, libellé « sam. 27 sept. » sur un jour lointain.
3. Toucher un match → sa page web dans le navigateur intégré ; toucher un en-tête → la page de la compétition.
4. Étoile sans compte → fenêtre « Crée un compte pour suivre cette compétition. » → inscription e-mail → écran profil (impossible à fermer, « Jean2 » refusé en prénom) → Continuer → retour au Direct, **la compétition est étoilée**, et Favoris la montre.
5. Sur le site (`www.koppafoot.com`, même compte) : la compétition apparaît comme suivie sur sa page et dans la barre latérale.
6. Tuer l'application, la relancer → toujours connecté (la session persiste).
7. Se déconnecter depuis Compte → l'étoile redevient vide. Se reconnecter → elle revient ; la fenêtre se ferme seule.
8. Mot de passe oublié → le message s'affiche, l'e-mail arrive.
9. Mode avion avec un tableau affiché → tirer pour rafraîchir → bandeau « Pas de connexion — mis à jour à … ». Premier lancement en mode avion → « Impossible de charger le Direct » + Réessayer.
10. Mettre l'application en arrière-plan pendant un match en cours, revenir → le score est à jour.

Tout écart : `superpowers:systematic-debugging` avant de corriger.

**Step 3 : demander à l'utilisateur** l'accord pour pousser `claude/app-mobile-lot1` et ouvrir la PR 2 (corps : ce qui est livré, la liste ci-dessus avec ses résultats, ce qui reste — Google en partie C).

---

# Partie C — Google (bloquée)

## Task C0 : prérequis, côté utilisateur

Ne pas commencer C1 sans les cinq :

1. **L'identifiant Android décidé** (proposé : `com.koppafoot.app`). Définitif dès la première publication.
2. Un **compte Expo**, et `eas login` sur le poste.
3. Dans la console Firebase, **une application Android** déclarée avec cet identifiant, et l'**empreinte SHA-1** de la clé de signature du development build (`eas credentials` l'affiche une fois la clé générée).
4. Le fichier **`google-services.json`** de cette application, déposé dans `mobile/` (et versionné ou non : le décider avec l'utilisateur ; il ne contient pas de secret, mais la règle du projet est de ne rien publier qu'on n'a pas lu).
5. L'**identifiant client OAuth de type Web** du projet (console Google Cloud → Identifiants, celui que Firebase a créé), dans `mobile/.env.local` sous `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.

## Task C1 : la connexion Google

**Files :**
- Modify : `mobile/app.json`, `mobile/src/lib/auth.tsx`, `mobile/src/app/connexion.tsx`, `mobile/src/app/inscription.tsx`
- Create : `mobile/eas.json`

**Step 1 : dépendances et configuration**

```bash
npx expo install @react-native-google-signin/google-signin expo-dev-client
```

`app.json` : `"android": { "package": "<identifiant décidé>", "googleServicesFile": "./google-services.json" }` et `"plugins": [..., "@react-native-google-signin/google-signin"]`.

`npx eas build:configure` crée `eas.json` ; garder le profil `development` (`developmentClient: true`, `distribution: "internal"`).

**Step 2 : `mobile/src/lib/auth.tsx`** — ajouter :

```ts
import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";

GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID });
```

Et dans le provider :

```ts
  /**
   * `signInWithPopup` n'existe pas en natif : la bibliothèque obtient le
   * jeton Google, Firebase le reçoit en `signInWithCredential`. Un nouveau
   * compte tombe ensuite sur l'écran profil, comme par e-mail.
   * Rend faux si l'utilisateur a annulé.
   */
  const connexionGoogle = useCallback(async (): Promise<boolean> => {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const reponse = await GoogleSignin.signIn();
    if (!isSuccessResponse(reponse)) return false;
    const { idToken } = reponse.data;
    if (!idToken) throw new Error("Jeton Google absent");
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    return true;
  }, []);
```

`deconnexion` : appeler aussi `GoogleSignin.signOut().catch(() => {})` avant `signOut(auth)`, sinon le compte Google reste choisi d'office à la connexion suivante. Exposer `connexionGoogle` dans le contexte.

**Step 3 : les écrans** — en tête de `connexion.tsx` et `inscription.tsx`, avant les champs : `<Bouton titre="Continuer avec Google" variante="contour" onPress={...} />` puis un séparateur « ou ». Google en tête, comme sur le site : c'est le chemin le plus court, pas le seul. Erreurs : `getAuthErrorMessage(e)` ; `statusCodes.PLAY_SERVICES_NOT_AVAILABLE` → « Les services Google ne sont pas disponibles sur ce téléphone. Utilise ton e-mail. »

**Step 4 : build et vérification**

```bash
eas build --profile development --platform android
```

Installer l'APK, `npx expo start --dev-client`. Vérifier : nouveau compte Google → écran profil → Direct ; compte Google existant du site → Direct directement, profil intact ; se déconnecter puis « Continuer avec Google » → le sélecteur de compte réapparaît ; annuler le sélecteur → aucune erreur affichée.

**Step 5 : commit**, puis PR (avec accord).
