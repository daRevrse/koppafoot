# Fiche de match native, PR A (le cœur) — plan d'implémentation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal :** toucher un match du Direct (compétition ou amical) ouvre un écran natif. Il porte l'en-tête du site, ses onglets, le Fil, les Compos et des Infos réduites, à jour en temps réel.

**Architecture :** deux extractions côté site (`lib/match-mappers`, `lib/fil-du-match`) rendent partageable ce que l'écran doit lire. Côté app, `lib/fiche-match` (pur, testé) convertit une rencontre de compétition ou un amical en une même **fiche**. Deux hooks l'alimentent en temps réel, et des composants à la DA du site la dessinent.

**Tech stack :** Expo SDK 57, Expo Router 57, Firebase JS 12, jest-expo. Modules du site importés par `@/` : `forme`, `buteurs`, `minute-du-match`, `tirs-au-but`, `competition-format`, `recit-du-match`, `terrain`, `formations`, `exhibition`, `audience`.

**Design de référence :** [2026-10-21-app-mobile-fiche-match-design.md](2026-10-21-app-mobile-fiche-match-design.md)

---

## À lire d'abord

**Branche :** `claude/app-fiche-match`, partie de `claude/app-ui-sombre`, qui n'est pas encore fusionnée. Ne pas pousser sans accord.

**Les tests** se lancent comme dans le plan de l'identité sombre : `npm --prefix mobile test`. Les 9 échecs de `classement` et `etat-de-forme` sont réparés sur `claude/reparer-tests-classement`. Ici, la barrière est donc « tout passe, sauf ces deux suites » : `--testPathIgnorePatterns classement etat-de-forme`.

**Côté site, après chaque extraction :**
- `npx tsc --noEmit` à la racine ;
- `npm run lint` ;
- **jamais `npm run build`**, qui consomme le quota API-Football.

**Vérifier dans le Chrome sans fenêtre** (script du scratchpad, Metro `--clear`, `--disable-web-security`). Pour un écran connecté, le navigateur intégré, où la session de l'utilisateur persiste.

**Granularité.** Les fonctions pures, les données et la navigation sont données en entier. Les composants d'écran sont des portages du site : chaque tâche cite le composant source et fixe les valeurs de la DA (tailles, graisses, couleurs). Le code s'écrit en relisant la source.

---

## Task 1 — A1 (site) : `toMatch` dans un module sans SDK (TDD)

**Files :** Create `src/lib/match-mappers.ts` · Modify `src/lib/firestore.ts` · Test `mobile/src/__tests__/match-mappers.test.ts`

**Step 1 : le test**

```ts
import { toMatch } from "@/lib/match-mappers";
import type { FirestoreMatch } from "@/types";

const brut = (p: Partial<FirestoreMatch> = {}) => ({
  home_team_id: "A", away_team_id: "B", home_team_name: "Alpha", away_team_name: "Beta",
  date: "2026-10-21", time: "16:00", status: "completed", score_home: 2, score_away: 1,
  ...p,
}) as FirestoreMatch;

const ligne = (id: string) => ({ player_id: id, name: id, number: "9", role: "starter", user_id: null, position: "attaquant" });

describe("toMatch", () => {
  it("lit la feuille, et retombe sur la compo d'avant (ghost) faute de feuille", () => {
    const m = toMatch("m1", brut({
      home_lineup: [ligne("p1")] as FirestoreMatch["home_lineup"],
      away_ghost_lineup: [ligne("g1")] as FirestoreMatch["away_ghost_lineup"],
    }));
    expect(m.homeLineup.map((e) => e.playerId)).toEqual(["p1"]);
    expect(m.awayLineup.map((e) => e.playerId)).toEqual(["g1"]);
  });

  it("garde le passeur et le statut VAR des faits de jeu", () => {
    const m = toMatch("m1", brut({
      live_state: {
        current_period: 4, timer_start_at: null, timer_offset: 0, is_timer_running: false,
        events: [{
          id: "e1", type: "goal", period: 1, minute: 12, team_id: "A", player_id: "p1", player_name: "Kossi",
          assist_player_id: "p2", assist_player_name: "Ama", var_status: "cancelled", created_at: "2026-10-21T16:12:00Z",
        }],
      } as unknown as FirestoreMatch["live_state"],
    }));
    expect(m.liveState!.events[0]).toMatchObject({ assistPlayerName: "Ama", varStatus: "cancelled", teamId: "A" });
  });
});
```

**Step 2 :** `npm --prefix mobile test -- match-mappers` → FAIL, `Cannot find module '@/lib/match-mappers'`.

**Step 3 :** créer `src/lib/match-mappers.ts`.
- **Déplacer** `equipeArbitraleLue` et `toMatch` tels quels depuis `src/lib/firestore.ts`, avec leurs commentaires.
- **Imports** : `reservationDuMatch` (`@/lib/terrains`), `normaliserPoste` (`@/lib/postes`), `lireButeursRenseignes` (`@/lib/buteurs`), `versPossession` (`@/lib/possession`), `lireEmplacement` (`@/lib/terrain`), `formatDate` (`@/lib/dates`), et les types de `@/types`.
- **En-tête** : le contrat des modules partagés (sans SDK, voir `lib/direct-shared`).
- **Dans `firestore.ts`** : supprimer les deux définitions, ajouter `export { equipeArbitraleLue, toMatch } from "@/lib/match-mappers";`, et retirer les imports devenus inutiles (le compilateur les signale).

**Step 4 :**
- le test passe ;
- `npx tsc --noEmit` (site) et `npm --prefix mobile run typecheck` passent ;
- `npm run lint` (site) passe.

**Step 5 :** commit `refactor(matches): toMatch dans lib/match-mappers, sans SDK, pour l'application`.

---

## Task 2 — A2 (site) : la composition du fil dans `lib/fil-du-match` (TDD)

**Files :** Create `src/lib/fil-du-match.ts` · Modify `src/components/match/MatchTimeline.tsx` · Test `mobile/src/__tests__/fil-du-match.test.ts`

**Step 1 : le test**

```ts
import { composerFil, TEXTES_FIL, type Deroule } from "@/lib/fil-du-match";
import type { Match } from "@/types";

type Evt = NonNullable<Match["liveState"]>["events"][number];
const ev = (p: Partial<Evt>): Evt => ({ id: `${Math.random()}`, type: "goal", period: 1, minute: 10, teamId: "A", createdAt: "", ...p } as Evt);
const t = TEXTES_FIL.fr;
const fini: Deroule = { commence: true, termine: true, periode: 4, heure: "16:00", score: { home: 1, away: 1 }, tab: { home: 4, away: 3 } };

describe("composerFil", () => {
  it("pose le coup d'envoi, la mi-temps avec son score, et la fin avec les tirs au but", () => {
    const fil = composerFil([ev({ teamId: "A", period: 1 }), ev({ teamId: "B", period: 3, minute: 60 })], "A", fini, undefined, t);
    expect(fil.map((e) => (e.genre === "fait" ? "fait" : e.genre === "repere" ? e.cle : e.genre))).toEqual([
      "coup-d-envoi", "fait", "mi-temps", "fait", "fin",
    ]);
  });

  it("dit le fil vide d'un match commencé sans fait de jeu", () => {
    const fil = composerFil([], "A", { ...fini, termine: false, periode: 1, score: null, tab: null }, "Rien encore", t);
    expect(fil.at(-1)).toEqual({ genre: "note", texte: "Rien encore" });
  });
});
```

**Step 2 :** FAIL (module absent).

**Step 3 :** créer `src/lib/fil-du-match.ts`.
- **Déplacer** depuis `MatchTimeline.tsx` : le dictionnaire `T` (renommé `TEXTES_FIL`, exporté), le type `Textes` (exporté sous `TextesFil`), `Evt`, `Deroule`, le type d'élément (exporté sous `ElementDuFil`), `estRepere`, `libelle` (exporté sous `libelleDuFait`) et `composer` (exporté sous `composerFil`).
- **Imports** : `OWN_GOAL_DETAIL` vient de `@/lib/evenements`, pas de `competition-firestore`, qui embarque le SDK. Les autres sont inchangés (`evenements`, `recit-du-match`, `minute-du-match`, `i18n/textes`, `i18n/config`).
- **Dans `MatchTimeline.tsx`** :
  - importer ces noms et ré-exporter `type Deroule`, que les pages importent depuis le composant ;
  - remplacer `useTextes(T)` par `useTextes(TEXTES_FIL)` ;
  - aucun changement de rendu.

**Step 4 :** test vert ; `npx tsc --noEmit` et `npm run lint` (site) ; typecheck mobile.

**Step 5 :** commit `refactor(fil): la composition du fil dans lib/fil-du-match, partagée avec l'application`.

---

## Task 3 — A3 (app) : la fiche, en logique pure (TDD)

**Files :** Create `mobile/src/lib/fiche-match.ts` · Test `mobile/src/__tests__/fiche-match.test.ts`

**Le modèle :**

```ts
export type Onglet = "feed" | "tchat" | "infos" | "lineups" | "stats" | "standings" | "h2h";
export type StatutFiche = "scheduled" | "live" | "completed" | "cancelled";

export interface CampDeFiche {
  teamId: string | null;
  nom: string;
  logo: string | null;
  score: number | null;
  /** « V », « N », « D », du plus ancien au plus récent (forme : PR B). */
  forme: ("V" | "N" | "D")[];
  lineup: LineupEntry[];
  formation: string | null;
}

export interface Fiche {
  /** « competition » ou « amical » : seulement pour les liens et le partage. */
  genre: "competition" | "amical";
  id: string;
  statut: StatutFiche;
  domicile: CampDeFiche;
  exterieur: CampDeFiche;
  date: string | null;
  heure: string | null;
  lieu: { nom: string | null; ville: string | null };
  competition: { id: string; nom: string; logo: string | null; slug: string | null; sousTitre: string | null } | null;
  liveState: CompMatch["liveState"];
  penaltyHome: number | null;
  penaltyAway: number | null;
  mvp: { nom: string | null; playerId: string | null; userId: string | null; teamId: string | null };
  dureeMiTemps: number;
  dureeProlongation?: number;
  /** Le chemin de la page web, pour le partage et « Voir sur le site ». */
  lienSite: string;
}
```

**Les fonctions** (reprises des pages du site, avec la ligne d'origine en commentaire) :
- **`ficheDepuisCompetition(match, competition, equipes)`.**
  - **Écussons** : la fiche de l'équipe d'abord, la copie du match ensuite.
  - **Sous-titre** :
    - `f.matchExhibition` pour un match d'exhibition ;
    - sinon `f.tour(round)` ;
    - sinon `Poule ${group}`.
  - **Durées** : celles du format (`halfDuration`, `extraTimeDuration`) ; sans format, 45 min et pas de prolongation.
  - **`lienSite`** : `/c/${slug}/matches/${id}`.
- **`ficheDepuisAmical(match: Match)`.**
  - **Statut** : `live`, `completed` et `cancelled` sont gardés ; tout le reste devient `scheduled`.
  - **Compétition** : aucune.
  - **Mi-temps** : 45 min.
  - **`lienSite`** : `/matches/${id}`.
- **`ongletsDeLaFiche(fiche, { tchatVisible, hasStats, hasStandings, hasH2H })`.**
  - **Compétition** (page `c/[slug]/matches/[mid]`, l. 580) :
    - `feed` si le match a commencé ou porte des faits ;
    - `tchat` si `tchatVisible` ;
    - `infos` et `lineups` toujours ;
    - `stats` si `hasStats` ;
    - `standings` si `hasStandings` ;
    - `h2h` si `hasH2H`.
  - **Amical** (page `matches/[id]`, l. 1105) : `feed` toujours, `tchat` si visible, `infos`, `stats` si stats, `lineups`.
- **`ongletParDefaut(fiche, hasStats)`.**
  - **Compétition** : `feed` si le match est en direct, a des stats ou un joueur du match ; sinon `infos`.
  - **Amical** : `feed` si le match est en direct, terminé ou a un joueur du match ; sinon `infos`.
- **`ongletAffiche(choix, onglets, parDefaut)`** : le choix de l'utilisateur s'il est encore visible, sinon l'onglet par défaut.
- **`libellePeriode(fiche, maintenant?)`**, reprise de la l. 352 :
  - « Terminé » ;
  - « Coup d'envoi imminent » ;
  - « Match interrompu » ;
  - « Tirs au but · 4-3 » ;
  - sinon la période, de « 1ère Mi-temps » à « Tirs au but ».
- **`chronoAffiche(fiche, maintenant)`** : le `mm:ss` du chrono qui tourne, ou du chrono figé. `null` avant le coup d'envoi et pendant les tirs au but.
- **`additionnelEnCours(fiche)`** : le temps additionnel de la mi-temps en cours.
- **`derouleDeLaFiche(fiche)`** : le `Deroule` de `lib/fil-du-match`.

**Step 1 : les tests**, un par règle :
- **Conversions** :
  - compétition : écusson de l'équipe préféré à la copie, sous-titre « Poule A », durées du format, lien ;
  - amical : `upcoming` devient `scheduled`, compétition nulle, lien `/matches/id`.
- **Onglets** :
  - un match de compétition à venir sans données n'a que `infos` et `lineups` ;
  - le même en direct gagne `feed` ;
  - un amical à venir a `feed`, `infos` et `lineups` ;
  - l'onglet par défaut est `infos` avant le coup d'envoi et `feed` en direct ;
  - un choix devenu invisible retombe sur l'onglet par défaut.
- **Période** : chacun des cinq cas, avec `liveState` fabriqué et `maintenant` fixé.
- **Chrono** : 12 min 05 s écoulées donnent `12:05` ; un chrono figé à 47 min donne `47:00`.

**Step 2 :** FAIL. **Step 3 :** implémenter. **Step 4 :** vert, puis lint et typecheck. **Step 5 :** commit `feat(mobile): la fiche de match, une forme pour la compétition et l'amical`.

---

## Task 4 — A4 (app) : les données en temps réel

**Files :** Create `mobile/src/lib/fiche-firestore.ts`, `mobile/src/hooks/useFiche.ts`

`fiche-firestore.ts` reprend les mêmes lectures que le site (`competition-firestore` : `onCompMatch`, `onCompTeams` ; page amicale : `onSnapshot(doc(db, "matches", id))`) :

```ts
export function ecouterMatchCompetition(cid: string, mid: string, cb: (m: CompMatch | null) => void): Unsubscribe
// onSnapshot(doc(db, "competitions", cid, "comp_matches", mid)) → toCompMatch, ou null s'il n'existe pas
export function ecouterEquipesCompetition(cid: string, cb: (equipes: CompTeam[]) => void): Unsubscribe
// query(collection(db, "competitions", cid, "comp_teams"), orderBy("name", "asc")) → toCompTeam(id, cid, data)
export async function lireCompetition(cid: string): Promise<Competition | null>
// getDoc → toCompetition
export function ecouterAmical(id: string, cb: (m: Match | null) => void): Unsubscribe
// onSnapshot(doc(db, "matches", id)) → toMatch (lib/match-mappers)
```

`useFiche.ts` :
- **`useFicheCompetition(cid, mid)`** : renvoie `{ fiche, chargement, introuvable }`.
  - La compétition se lit une fois, puis le match et les équipes s'écoutent.
  - Les écoutes se coupent en arrière-plan (`usePremierPlan`, comme `useDirect`).
  - **Les autres matchs de la compétition** viennent de `ecouterMatchsCompetition` (déjà dans `direct-firestore`). Ils servent à la forme, au classement et au face-à-face : à brancher en PR B seulement, pas maintenant.
- **`useFicheAmical(id)`** : même forme de retour.
- **`useMaintenant(actif)`** : un `Date.now()` qui avance chaque seconde tant que `actif` est vrai, pour le chrono (`setInterval` dans l'effet, `setState` dans le rappel).

Pas de test jest : ce sont des écoutes. La vérification se fait à l'écran (A11). Lint et typecheck. Commit `feat(mobile): les données d'une fiche de match, en temps réel`.

---

## Task 5 — A5 (app) : les routes, et le Direct qui y mène

**Files :** Create `mobile/src/app/match/[cid]/[mid].tsx`, `mobile/src/app/amical/[id].tsx` · Modify `mobile/src/app/_layout.tsx`, `mobile/src/app/(tabs)/index.tsx`, `mobile/src/lib/navigateur.ts`

- **`_layout.tsx`** : sous la garde `accueil.vu && !profilManquant`, à côté de `(tabs)`, déclarer `<Stack.Screen name="match/[cid]/[mid]" />` et `<Stack.Screen name="amical/[id]" />`. C'est une présentation en pile normale, pas une fenêtre.
- **Les deux routes** lisent leurs paramètres (`useLocalSearchParams`), appellent le hook et rendent `<EcranFiche fiche=… />` (A7). Avant les données : `SqueletteDirect`. Pour un match introuvable : `EtatVide` (« Match introuvable », bouton retour).
- **`lib/navigateur.ts`** : `routeDuMatch(entree: Entry): Href | null`.
  - Amical (`FRIENDLY_COMP_ID`) : `/amical/[id]`.
  - Match du monde : `null`.
  - Sinon : `/match/[cid]/[mid]`.
  - Test dans `direct-tableau.test.ts` ou un nouveau `navigateur.test.ts`, en TDD.
- **Direct** : `LigneMatch onPress` → `const r = routeDuMatch(item); r ? router.push(r) : ouvrirSurLeSite(matchHref(item))`.

Commit `feat(mobile): toucher un match ouvre sa fiche native`.

---

## Task 6 — A6 (app) : l'en-tête, le bandeau noir du site

**Files :** Create `mobile/src/components/fiche/EnTeteMatch.tsx` · **Source :** `src/components/match/MatchHero.tsx`

- **Fond** `#000` (le bandeau du site est noir dans les deux thèmes), texte blanc. `SafeAreaView edges={["top"]}`.
- **Barre**, hauteur 56 :
  - à gauche, retour : rond de 36, filet `rgba(255,255,255,0.15)`, `chevron-back` ;
  - à droite, partage : `share-outline`. `Share.share({ message })`, où le message suit l'état (`partageAVenir`, `partageDirect`, `partageFinal` du site) et se termine par le lien `urlDuSite(avecVia(lienSite, "partage"))`, `avecVia` venant de `lib/audience`.
  - **Score compact au défilement** : `onScroll` de l'écran → `compact` (le score est sorti de la vue) → les deux écussons de 20 et le score s'affichent au centre de la barre, en fondu (`Animated`, pas de pilote natif sur le web).
- **Ligne de compétition**, centrée :
  - `PointDirect` si le match est en direct ;
  - le nom en 13 px DM Sans Black capitales, `letterSpacing` 0,06 em. Touché, il ouvre la compétition sur le site (écran natif : lot suivant) ;
  - « · » puis le sous-titre en 11 px gras capitales, 0,14 em, à 50 % d'opacité.
- **Trois colonnes :**
  - **Équipe** : `Ecusson` de 48, puis le nom en 11 px Black capitales (deux lignes au plus), puis les pastilles de forme (PR B ; ici rien si la forme est vide).
  - **Centre, avec un score** : Outfit Black 36, chiffres alignés, le tiret à 30 % d'opacité.
  - **Centre, en direct** : sous le score, la période en 10 px Black capitales vert `#34d399`, puis le chrono `mm:ss` en 14 px Black vert, suivi de « +N » en ambre `#FCD34D`.
  - **Centre, avant le match** : l'heure en Outfit Black 28 ; à défaut, « VS ».
  - **Centre, terminé** : la période « TERMINÉ » en 10 px Black, blanc à 50 %.
  - **Centre, annulé** : « ANNULÉ » en rouge.
- **Buteurs** : `buteursDuMatch(events, homeTeamId, undefined, dureeMiTemps)` pour une compétition ; pour un amical saisi après coup (`recordedAt`), `buteursRenseignes`. La grille a trois colonnes (domicile aligné à droite, icône ballon au centre, extérieur aligné à gauche), en 11 px gras, blanc à 75 %. Chaque buteur porte ses minutes à 45 %, « (c.s.c.) » et une ligne « passe de … » en 10 px.
- **Tirs au but**, si présents : « Tirs au but · 4–3 » en 10 px Black capitales.

Commit `feat(mobile): l'en-tête de la fiche, le tableau d'affichage du site`.

---

## Task 7 — A7 (app) : les onglets et l'écran

**Files :** Create `mobile/src/components/fiche/OngletsFiche.tsx`, `mobile/src/components/fiche/EcranFiche.tsx` · **Source :** `MatchTabs.tsx`

- **`OngletsFiche`** :
  - `ScrollView` horizontal, `flexGrow` et `flexShrink` à 0, fond `#000`, filet bas `rgba(255,255,255,0.1)`, `gap` 24, marges latérales 16 ;
  - chaque onglet : `paddingVertical` 14, libellé en 11 px Black capitales, `letterSpacing` 1,1 ;
  - actif : blanc, filet bas de 2 px en `#34d399` ; inactif : blanc à 45 % ;
  - `accessibilityRole="tab"` ;
  - libellés du site : Fil, Tchat, Infos, Compos, Stats, Classement, Face-à-face ; « Compo » pour un amical.
- **`EcranFiche`** :
  - un `ScrollView` vertical. L'en-tête défile avec la page, la barre du haut reste ; les onglets sont collants (`stickyHeaderIndices` sur l'enfant des onglets) ;
  - `choix` dans un `useState` ; l'onglet affiché vient de `ongletAffiche` ;
  - dessous, le panneau de l'onglet (A8 à A10) sur `couleurs.fond` ;
  - en PR A, `tchat`, `stats`, `standings` et `h2h` ne sont pas encore visibles : `hasStats`, `hasStandings`, `hasH2H` et `tchatVisible` valent `false`.

Commit `feat(mobile): les onglets de la fiche`.

---

## Task 8 — A8 (app) : le Fil

**Files :** Create `mobile/src/components/fiche/FilDuMatch.tsx` · **Source :** `MatchTimeline.tsx`

- **Les éléments** : `composerFil(events, homeTeamId, derouleDeLaFiche(fiche), vide, TEXTES_FIL.fr)`, affichés du plus récent au plus ancien.
- **Les textes vides** du site :
  - « Aucun fait de jeu enregistré sur ce match » ;
  - « En attente du premier fait de jeu » ;
  - « Le fil s'ouvre au coup d'envoi ».
- **L'axe central** : un filet de 1 px `couleurs.bordure` derrière la colonne des minutes.
- **Repère** : deux filets, le texte entre eux en 11 px Black capitales, 0,12 em, `texteSecondaire`.
- **Note** : centrée, en 11 px Black capitales `texteDiscret`.
- **Fait** : trois colonnes (1fr, 44, 1fr).
  - Le camp domicile à gauche, aligné à droite ; l'extérieur à droite.
  - Au centre, la minute en 11 px Black `texteSecondaire`, sur fond `couleurs.fond` pour masquer l'axe : `libelleMinute(period, minute, dureeMiTemps, "'", dureeProlongation)`, ou « · » sans minute.
- **Le contenu d'un fait** :
  - le repère `Marqueur`, en Ionicons et carrés :
    - but `football` vert `#34d399` ;
    - jaune, carré 10 × 14 `#FBBF24` ;
    - rouge, carré `#f87171` ;
    - changement `swap-horizontal` bleu `#60a5fa` ;
    - arrêt `hand-left` vert ;
    - faute `warning` orange `#fb923c` ;
    - hors-jeu `flag` `texteDiscret` ;
    - tir `locate` vert ;
  - le joueur en 13 px Black `texte`, et le libellé `libelleDuFait` en 11 px gras `texteDiscret` ;
  - pour un changement, deux lignes, entrant (flèche verte) et sortant (flèche rouge), via `joueursDuRemplacement` ;
  - un but annulé par la VAR : nom barré, repère gris.

Commit `feat(mobile): le fil du match`.

---

## Task 9 — A9 (app) : les Compos et le terrain

**Files :** Create `mobile/src/components/fiche/Compos.tsx`, `mobile/src/components/fiche/Terrain.tsx` · **Sources :** `MatchLineups.tsx`, `TerrainCompo.tsx`

- **`Compos`** :
  - **Bascule** : deux boutons carrés côte à côte, filet `bordure`. L'actif est sur fond `texte` avec le libellé `fond`, l'inactif en `texteDiscret`. Chacun porte le nom du camp en 11 px Black capitales et la formation à 50 %.
  - **Côté par défaut** : comme le site, l'extérieur si le domicile n'a pas de feuille.
  - **Contenu** : le `Terrain` des titulaires, puis « REMPLAÇANTS » (10 px Black capitales 0,15 em, `texteDiscret`) et leur liste : numéro, nom, marques du match.
  - **Sans feuille** : `EtatVide` (« La composition n'est pas encore publiée »).
- **`Terrain`** :
  - **Placement** : `disposerSurTerrain(titulaires, undefined, "haut", versFormation(formation))`, rayon `rayonPastille(ecart, Math.min(4.2, RAYON_MAX_RANGS))`.
  - **Repère** : le site dessine dans `viewBox 0 0 100 104`. Une vue de ratio 100/104 sert de cadre, et chaque place se pose en `left: ${x}%`, `top: ${y / 1.04}%`, décalée de son rayon.
  - **Pelouse** : fond `#0f3d2a`, bandes alternées `rgba(255,255,255,0.03)`, lignes `rgba(255,255,255,0.18)` (bordure, médiane, rond central, surfaces).
  - **Pastille** : rond aux couleurs de l'équipe (`couleursDesBarres`, sinon `#eef3f0`) ; la photo du compte si elle existe (`expo-image`), sinon le numéro en Black.
  - **Sous la pastille** : `nomCourt(nom)` (déplacé de `TerrainCompo` vers `lib/terrain` si ce n'est pas déjà un module pur ; sinon recopié avec renvoi) en 10 px Black blanc.
  - **Marques** (`marquesDesJoueurs`) : petit ballon pour un but, carré jaune ou rouge, étoile de l'homme du match.

Commit `feat(mobile): les compositions, sur le terrain`.

---

## Task 10 — A10 (app) : des Infos réduites

**Files :** Create `mobile/src/components/fiche/InfosMatch.tsx` · **Source :** `MatchInfoList.tsx`

Une liste de lignes carrées (fond `surface`, filets `bordure`). Chaque ligne a son icône Ionicons, son étiquette en 10 px Black capitales `texteDiscret` et sa valeur en 13 px gras `texte`.
- **Coup d'envoi** : `libelleDuJour(date)` et l'heure.
- **Terrain** : nom et ville. La ligne se touche et ouvre Google Maps (`Linking.openURL("https://www.google.com/maps/search/?api=1&query=…")`).
- **Compétition** : écusson de 20, nom et sous-titre. La ligne ouvre la compétition sur le site.

Commit `feat(mobile): les infos du match`.

---

## Task 11 — A11 : vérifier, puis rendre compte

1. Tests, lint et typecheck mobile ; `npx tsc --noEmit` et `npm run lint` côté site.
2. Metro `--clear`, puis le Chrome sans fenêtre :
   - un match de compétition joué (Fil, Compos, buteurs dans l'en-tête) ;
   - un match à venir (Infos par défaut, heure au centre) ;
   - un amical joué ;
   - un match en direct s'il y en a un (chrono qui avance, point rouge).
3. Envoyer une planche à l'utilisateur.
4. Mettre le ledger à jour (`.superpowers/sdd/2026-10-21-app-mobile-fiche-match-A/progress.md`) et la mémoire `app-mobile-expo`.
