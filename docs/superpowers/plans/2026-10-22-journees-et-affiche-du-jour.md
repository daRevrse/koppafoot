# Journées de compétition et affiche « Journée X / Matchs du jour » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner une journée aux matchs de poule, et permettre à l'organisateur de générer une affiche du programme (une journée, ou une ou plusieurs dates), résultats et matchs à venir.

**Architecture:** Toute la logique est dans des modules purs testés par des scripts `tsx` (lib/journees, lib/programme, ajouts à lib/calendrier-competition et lib/partenaires). Le serveur lit la compétition par son slug, réutilise `calendrierDeCompetition` pour ranger les matchs, et Satori dessine l'affiche dans la direction des flyers (lib/og-da, lib/og-flyer). L'organisateur pose et corrige les journées depuis son calendrier, qui écrit directement dans Firestore comme aujourd'hui.

**Tech Stack:** Next.js (lire `node_modules/next/dist/docs/` avant d'écrire une route : cette version diffère de la mémoire), Firebase (SDK client pour l'organisateur, admin pour les routes), Satori via `next/og`, tests en scripts `npx tsx` avec `node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-10-22-journees-et-affiche-du-jour-design.md`

## Global Constraints

- Branche de départ : `claude/tirage-partenaires` (elle porte `logoDe`, lib/partenaires), ou master une fois qu'elle y est fusionnée.
- Le champ s'appelle `journee` (`FirestoreCompMatch.journee?: number | null`, `CompMatch.journee: number | null`).
- Une journée n'existe que pour `stage === "group"`. Jamais pour `knockout` ni `exhibition`.
- La numérotation proposée n'écrit JAMAIS une journée déjà posée, et ne s'écrit qu'après acceptation de l'organisateur.
- Affiche : portrait 1080 × 1350 (`TAILLE_FLYER`), `Cadre`/`Surtitre`/`Titre` de lib/og-flyer, `Ecusson`/`EMERAUDE`/`GRIS` de lib/og-da. Satori : flexbox seulement, `display: "flex"` sur tout élément à plusieurs enfants.
- Titres exacts : `JOURNÉE {n}`, `MATCHS DU JOUR`, `AU PROGRAMME`. Mentions exactes : `FINAL`, `FORFAIT`, `EN COURS`, `VS`, `PRÉSENTÉ PAR`, intertitre `DATE À FIXER`.
- Trois matchs ou moins : présentation en face-à-face (maquette B) ; quatre et plus : une ligne par match. Douze matchs au plus par affiche.
- Route publique, `Cache-Control: public, max-age=60, s-maxage=60` (comme lib/og-phase-finale) ; 404 pour une compétition en brouillon ou un choix sans match.
- Français seulement sur l'affiche.
- Référence visuelle : `scripts/maquettes-journee.tsx` (jetable, ne pas importer).

## Review Focus

- Une journée dont certains matchs n'ont pas de date : ils paraissent à la fin, sous « DATE À FIXER » (test : Task 5, `selectionnerProgramme`).
- Une phase finale dont les équipes ne sont pas connues, sur une affiche de date : « À déterminer », sans écusson, jamais un trou (rendu : Task 6, cas `tableau-a-determiner`).
- Des noms d'équipe de 40 caractères : raccourcis d'une ellipse, jamais sous l'écusson voisin (rendu : Task 6, cas `noms-longs`).
- Des journées à trous (J1 et J3, J2 supprimée) : seules les journées qui ont des matchs sont proposées (test : Task 5, `journeesDisponibles`).
- Une adresse d'affiche bricolée (`?dates=hier`, `?journee=abc`, les deux à la fois) : 400, jamais une affiche vide ni une erreur 500 (test : Task 5, `lireChoix`).

---

### Task 1: La journée, en pur (lib/journees)

**Files:**
- Create: `src/lib/journees.ts`
- Modify: `src/lib/competition-firestore.ts:1113-1129` (`roundRobinPairs` délègue à `toursDuCercle`)
- Test: `scripts/test-journees.ts`

**Interfaces:**
- Produces:
  - `toursDuCercle(equipes: string[]): [string, string][][]` — les tours de la méthode du cercle, exempts retirés ; même ordre de paires que l'actuel `roundRobinPairs`.
  - `rencontresAvecJournee(equipes: string[], allerRetour: boolean): { home: string; away: string; journee: number }[]` — aller : `journee = tour + 1` ; retour : domicile et extérieur inversés, `journee = tour + 1 + nombreDeToursAller`.
  - `journeesAttendues(nEquipes: number, allerRetour: boolean): number` — `n - 1` si n pair, `n` si impair, doublé en aller-retour.
  - `type MatchANumeroter = { id: string; stage: CompMatchStage; group: string | null; homeTeamId: string | null; awayTeamId: string | null; date: string | null; time: string | null; journee: number | null }`
  - `proposerJournees(matchs: MatchANumeroter[]): { journees: Map<string, number>; depassement: boolean }` — seulement les matchs de poule sans journée ; `depassement` vrai si une poule reçoit plus que `journeesAttendues` (aller-retour déduit : une paire rencontrée deux fois).

- [ ] **Step 1: Write the failing tests** in `scripts/test-journees.ts` (même harnais `cas()` que scripts/test-partenaires.ts, message final « Tout est bon. ») :

```ts
cas("toursDuCercle : 4 équipes, 3 tours de 2 matchs, chaque équipe une fois par tour", () => {
  const tours = toursDuCercle(["A", "B", "C", "D"]);
  assert.equal(tours.length, 3);
  for (const t of tours) assert.deepEqual(t.flat().sort(), ["A", "B", "C", "D"]);
});
cas("toursDuCercle : 5 équipes, 5 tours de 2 matchs (un exempt par tour)", () => {
  const tours = toursDuCercle(["A", "B", "C", "D", "E"]);
  assert.equal(tours.length, 5);
  assert.ok(tours.every((t) => t.length === 2));
});
cas("roundRobinPairs reste la mise à plat de toursDuCercle", () => {
  assert.deepEqual(roundRobinPairs(["A", "B", "C", "D", "E", "F"]), toursDuCercle(["A", "B", "C", "D", "E", "F"]).flat());
});
cas("rencontresAvecJournee : aller-retour sur 4 équipes, journées 1 à 6, le retour inverse les camps", () => {
  const r = rencontresAvecJournee(["A", "B", "C", "D"], true);
  assert.deepEqual([...new Set(r.map((x) => x.journee))].sort(), [1, 2, 3, 4, 5, 6]);
  const aller = r.find((x) => x.journee === 1)!;
  assert.ok(r.some((x) => x.journee === 4 && x.home === aller.away && x.away === aller.home));
});
cas("journeesAttendues", () => {
  assert.equal(journeesAttendues(4, false), 3);
  assert.equal(journeesAttendues(5, false), 5);
  assert.equal(journeesAttendues(4, true), 6);
});
cas("proposerJournees : les 720 ordres des 6 matchs d'une poule de 4 donnent 3 journées justes", () => {
  // Pour chaque permutation des six paires de K4, datées dans cet ordre :
  // trois journées, deux matchs chacune, aucune équipe deux fois par journée,
  // depassement === false.
});
cas("proposerJournees : ne touche jamais une journée déjà posée, et en tient compte", () => {
  // A-B déjà en J2 : C-D (daté avant) peut aller en J1, mais A-C ne va pas en J2.
});
cas("proposerJournees : les matchs sans date passent après les matchs datés", () => {});
cas("proposerJournees : aller-retour, les retours commencent après le dernier aller", () => {
  // Poule de 4 en aller-retour, retours datés entre deux allers : allers en J1..J3, retours en J4..J6.
});
cas("proposerJournees : ignore phase finale et exhibitions", () => {});
cas("proposerJournees : une poule de 6 mal datée qui déborde lève depassement", () => {});
```

- [ ] **Step 2: Run** `npx tsx scripts/test-journees.ts` — Expected: KO, `toursDuCercle is not a function` (ou import introuvable).

- [ ] **Step 3: Implement `src/lib/journees.ts`** (module pur, aucun SDK ; en-tête de commentaire dans le style du projet, qui cite la décision du 2026-10-22 : une journée est un tour, pas une date). `proposerJournees`, poule par poule :

```
trier les matchs de la poule : date (sans date à la fin), puis heure, puis id
occupé[journée] = équipes déjà posées dans cette journée (journées existantes comprises)
pour chaque match sans journée, dans l'ordre :
  aller = première rencontre de la paire {home, away} dans l'ordre trié (en comptant les matchs déjà numérotés)
  plancher = aller ? 1 : (plus grande journée d'aller de la poule) + 1
  j = plus petite journée ≥ plancher où ni home ni away n'est occupé
```
Les retours se posent après tous les allers : faire deux passes (allers, puis retours). Puis dans `competition-firestore.ts`, `roundRobinPairs(ids)` devient `return toursDuCercle(ids).flat();`.

- [ ] **Step 4: Run** `npx tsx scripts/test-journees.ts` — Expected: « Tout est bon. » ; puis `npx tsc --noEmit -p .` sans sortie.

- [ ] **Step 5: Commit** — `git add src/lib/journees.ts src/lib/competition-firestore.ts scripts/test-journees.ts` ; message `feat(journees): calculer et proposer les journées de poule`.

---

### Task 2: Le champ `journee`, posé à la génération et par l'organisateur

**Files:**
- Modify: `src/types/index.ts` (`FirestoreCompMatch`, `CompMatch`)
- Modify: `src/lib/competition-mappers.ts:95` (`toCompMatch`)
- Modify: `src/lib/competition-firestore.ts:1146-1227` (`generateGroupFixtures`)
- Modify: `scripts/test-calendrier-competition.ts` (fabrique `match()` : `journee: null`)

**Interfaces:**
- Consumes: `rencontresAvecJournee` (Task 1).
- Produces:
  - `FirestoreCompMatch.journee?: number | null`, `CompMatch.journee: number | null` (mappé `d.journee ?? null`).
  - `poserJournees(cid: string, journees: Map<string, number>): Promise<void>` dans competition-firestore — un `writeBatch` qui ne met à jour que `journee` et `updated_at`.
  - `poserJournee(cid: string, mid: string, journee: number | null): Promise<void>` — la correction à la main d'un match.

- [ ] **Step 1:** Ajouter le champ aux deux types (commentaire : le tour où chaque équipe joue une fois, poules seulement, voir lib/journees) et au mapper.
- [ ] **Step 2:** Dans `generateGroupFixtures`, remplacer le calcul de `legs` par `rencontresAvecJournee(ids, competition.format.double_round)` et écrire `journee` dans chaque document.
- [ ] **Step 3:** Ajouter `poserJournees` et `poserJournee` (à côté de `updateCompMatch`). Pas de changement de firestore.rules : l'organisateur et son staff modifient déjà tout sauf `venue_booking`.
- [ ] **Step 4: Run** `npx tsc --noEmit -p .` (sans sortie), puis `npx tsx scripts/test-calendrier-competition.ts` et `npx tsx scripts/test-journees.ts` — « Tout passe. » / « Tout est bon. ».
- [ ] **Step 5: Commit** — `feat(journees): champ journee, posé à la génération des poules`.

---

### Task 3: La journée là où elle se lit (PDF, fiche, flyers, aperçu)

**Files:**
- Modify: `src/lib/calendrier-competition.ts` (`phaseDe`, `CampDuCalendrier`, `campDe`)
- Modify: `src/lib/match-public.ts:63-70, 205-216` (`CompMatchPublic.journee`)
- Modify: `src/app/(app)/c/[slug]/matches/[mid]/page.tsx:383-390` (`roundLabel`)
- Modify: `src/lib/og-flyer.tsx:183-192` (surtitre), `src/lib/og.tsx:273-276` (contexte)
- Test: `scripts/test-calendrier-competition.ts`

**Interfaces:**
- Consumes: `CompMatch.journee` (Task 2).
- Produces:
  - `phaseDe` rend `"Poule B · Journée 2"` quand le match a une journée (sinon inchangé).
  - `CampDuCalendrier.logo: string | null` — l'adresse brute de l'écusson (`homeTeamLogo`/`awayTeamLogo`), `null` pour un camp en attente. Le PDF l'ignore ; l'affiche (Task 7) la télécharge.
  - `CompMatchPublic.journee: number | null` ; `etape` NE CHANGE PAS (la page d'une équipe, l'administration et la liste des matchs d'un club le réutilisent).

- [ ] **Step 1: Write the failing tests** dans `scripts/test-calendrier-competition.ts` :

```ts
cas("la journée suit la poule", () => {
  const c = calendrierDeCompetition([match("m", { journee: 2, group: "B" })], 45);
  assert.equal(c.jours[0].lignes[0].phase, "Poule B · Journée 2");
});
cas("sans journée, la poule seule", () => {
  assert.equal(calendrierDeCompetition([match("m", { group: "B" })], 45).jours[0].lignes[0].phase, "Poule B");
});
cas("chaque camp garde l'adresse de son écusson, un camp en attente n'en a pas", () => {
  const c = calendrierDeCompetition([match("m", { homeTeamLogo: "https://x/h.png" })], 45);
  assert.equal(c.jours[0].lignes[0].domicile.logo, "https://x/h.png");
  assert.equal(c.jours[0].lignes[0].exterieur.logo, null);
});
```

- [ ] **Step 2: Run** `npx tsx scripts/test-calendrier-competition.ts` — Expected: KO sur les trois nouveaux cas.
- [ ] **Step 3:** Implémenter dans calendrier-competition ; puis `journee` dans match-public (lu `typeof d.journee === "number" ? d.journee : null`, seulement pour `stage === "group"`) ; puis « · Journée N » après l'étape dans la fiche (`roundLabel`), le surtitre du flyer et le contexte de l'aperçu de lien.
- [ ] **Step 4: Run** le test (« Tout passe. »), `npx tsc --noEmit -p .`, `npx eslint` sur les fichiers touchés ; ouvrir la fiche d'un match de poule numéroté dans le volet (serveur `koppafoot-dev`) et lire l'en-tête : « Poule A · Journée 2 ».
- [ ] **Step 5: Commit** — `feat(journees): la journée dans le PDF, la fiche et les images d'un match`.

---

### Task 4: Le calendrier de l'organisateur : journée, filtre, « Numéroter les journées »

**Files:**
- Modify: `src/app/(organizer)/organizer/competitions/[cid]/schedule/page.tsx` (ligne de match `renderMatchRow` ~777, barre des blocs ~1225, barre d'outils ~1140)
- Create: `src/components/competition/NumeroterJournees.tsx`

**Interfaces:**
- Consumes: `proposerJournees`, `journeesAttendues` (Task 1) ; `poserJournees`, `poserJournee`, `CompMatch.journee` (Task 2).
- Produces: `NumeroterJournees({ cid, matchs, onFini }: { cid: string; matchs: CompMatch[]; onFini: () => void })` — une modale qui montre la proposition, poule par poule (« Lions FC – AS Bè → Journée 2 »), l'avertissement si `depassement`, et « Appliquer » qui appelle `poserJournees`.

- [ ] **Step 1:** Sur chaque ligne d'un match de poule : un `<select>` « Journée » (vide, 1 … max existante + 1) qui appelle `poserJournee` au changement, avec un toast d'erreur en cas d'échec. Rien sur les lignes de phase finale ni d'exhibition.
- [ ] **Step 2:** Sous la barre des blocs, un filtre par journée (« Toutes » puis J1, J2… seulement celles qui existent) qui restreint les matchs affichés de `visibleSections` ; il s'efface quand on choisit un bloc de phase finale.
- [ ] **Step 3:** Le bouton « Numéroter les journées », visible tant qu'un match de poule a `journee == null`, ouvre `NumeroterJournees`. Le texte de la modale dit qu'aucune journée déjà posée ne sera changée.
- [ ] **Step 4: Verify** : `npx tsc --noEmit -p .`, `npx eslint` sur les deux fichiers ; dans le volet, sur la compétition d'essai de l'organisateur (`getSandboxCompetition`, jamais une vraie compétition) : générer les poules → chaque ligne montre sa journée ; vider une journée à la main → le bouton apparaît, la modale propose, « Appliquer » la remplit. Si le volet n'est pas connecté, le dire et demander qu'on s'y connecte plutôt que de sauter l'étape.
- [ ] **Step 5: Commit** — `feat(journees): poser et numéroter les journées dans le calendrier`.

---

### Task 5: Le programme, en pur (lib/programme) et le partenaire de l'affiche

**Files:**
- Create: `src/lib/programme.ts`
- Modify: `src/lib/partenaires.ts` (ajout de `partenairesDuProgramme`)
- Test: `scripts/test-programme.ts`, `scripts/test-partenaires.ts`

**Interfaces:**
- Consumes: `CompMatch.journee` (Task 2) ; `JourDuCalendrier` (lib/calendrier-competition) ; `aLAffiche`, `logoDe`, `typeDe` (lib/partenaires).
- Produces:
  - `type ChoixDuProgramme = { journee: number } | { dates: string[] }`
  - `lireChoix(params: URLSearchParams): ChoixDuProgramme | null` — `journee` entier ≥ 1, OU `dates` = 1 à 14 dates `AAAA-MM-JJ` valides (`jourValide`), jamais les deux ; `null` sinon.
  - `selectionnerProgramme(matchs: CompMatch[], choix: ChoixDuProgramme): CompMatch[]` — journée : les matchs de poule de cette journée ; dates : tous les matchs de ces dates (phase finale et exhibitions comprises). Les annulés sont retirés plus tard par `calendrierDeCompetition`.
  - `titreDuProgramme(choix: ChoixDuProgramme): string` — `JOURNÉE {n}` / `MATCHS DU JOUR` (une date) / `AU PROGRAMME` (plusieurs).
  - `journeesDisponibles(matchs: CompMatch[]): { journee: number; dates: string[] }[]` — triées, sans trou inventé, dates triées sans doublon.
  - `datesDisponibles(matchs: CompMatch[]): string[]`
  - `paginer(jours: JourDuCalendrier[], max = 12): JourDuCalendrier[][]` — au plus `max` lignes par page ; coupe entre deux jours quand le jour suivant tient entier sur une page neuve, sinon au milieu du jour (le jour se répète en tête de la page suivante).
  - `partenairesDuProgramme<P>(candidats: P[], cid: string, jour: string): P[]` dans lib/partenaires — `competition_id === cid`, `typeDe === "partenaire"`, `aLAffiche`, `logoDe(p) !== null`, plus récent `debut` d'abord, deux au plus.

- [ ] **Step 1: Write the failing tests** (`scripts/test-programme.ts`, même fabrique `match()` que scripts/test-calendrier-competition.ts, recopiée) :

```ts
cas("lireChoix", () => {
  assert.deepEqual(lireChoix(new URLSearchParams("journee=2")), { journee: 2 });
  assert.deepEqual(lireChoix(new URLSearchParams("dates=2026-10-25,2026-11-01")), { dates: ["2026-10-25", "2026-11-01"] });
  for (const q of ["journee=abc", "journee=0", "dates=hier", "journee=2&dates=2026-10-25", "", "dates="]) {
    assert.equal(lireChoix(new URLSearchParams(q)), null, q);
  }
});
cas("une journée : ses seuls matchs de poule, y compris ceux sans date", () => {});
cas("des dates : tous les matchs de ces dates, phase finale comprise", () => {});
cas("titreDuProgramme", () => {
  assert.equal(titreDuProgramme({ journee: 3 }), "JOURNÉE 3");
  assert.equal(titreDuProgramme({ dates: ["2026-10-25"] }), "MATCHS DU JOUR");
  assert.equal(titreDuProgramme({ dates: ["2026-10-25", "2026-10-26"] }), "AU PROGRAMME");
});
cas("journeesDisponibles : J1 et J3 sans J2 inventée, dates dédoublonnées", () => {});
cas("paginer : 12 lignes une page, 13 deux pages, coupe entre deux jours quand c'est possible", () => {});
```

et dans `scripts/test-partenaires.ts` : `partenairesDuProgramme` écarte l'annonce, le partenaire général, celui d'une autre compétition, celui sans logo, celui hors dates ; garde deux au plus, le plus récent d'abord.

- [ ] **Step 2: Run** les deux scripts — Expected: KO, fonctions introuvables.
- [ ] **Step 3:** Implémenter `src/lib/programme.ts` (pur) et `partenairesDuProgramme`.
- [ ] **Step 4: Run** `npx tsx scripts/test-programme.ts` et `npx tsx scripts/test-partenaires.ts` — « Tout est bon. ».
- [ ] **Step 5: Commit** — `feat(programme): choisir, titrer et paginer le programme d'une affiche`.

---

### Task 6: L'affiche (lib/og-programme) et son script de rendu

**Files:**
- Create: `src/lib/og-programme.tsx`
- Create: `scripts/rendu-programme.tsx`

**Interfaces:**
- Consumes: `JourDuCalendrier`, `LigneDuCalendrier` (avec `domicile.logo`, Task 3) ; `Cadre`, `Surtitre`, `Titre`, `TAILLE_FLYER`, `LARGEUR_UTILE` (lib/og-flyer) ; `Ecusson`, `EMERAUDE`, `GRIS`, `chargerRessources` (lib/og-da).
- Produces:
  - `interface DonneesProgramme { titre: string; surtitre: string; logoCompetition: string | null; jours: JourDuCalendrier[]; page: { n: number; total: number } | null; partenaires: { annonceur: string; logo: string }[] }` — les `logo` des camps et des partenaires sont déjà des data URI (Task 7 les télécharge).
  - `afficheDuProgramme(d: DonneesProgramme): Promise<ImageResponse>` — avec `Cache-Control: public, max-age=60, s-maxage=60`.

- [ ] **Step 1: Write the render script** `scripts/rendu-programme.tsx <dossier>` (équipes fictives ; le dépôt est public) qui écrit un PNG par cas : `1-match`, `2-matchs`, `3-matchs`, `4-matchs`, `6-matchs-3-dates`, `12-matchs`, `13-matchs-page-1`, `13-matchs-page-2`, `noms-longs` (40 caractères), `tableau-a-determiner`, `date-a-fixer`, `tab-forfait-en-cours`, `avec-partenaires`, `sans-logo-competition`.
- [ ] **Step 2: Run** `npx tsx --tsconfig tsconfig.json scripts/rendu-programme.tsx <scratchpad>/programme` — Expected: échec à l'import de `afficheDuProgramme`.
- [ ] **Step 3: Implement** `og-programme.tsx`, d'après les maquettes : face-à-face pour ≤ 3 lignes (écussons 130 px), lignes au-delà (hauteur `min(104, place / n)`) ; à gauche l'heure en vert (rien pour un match sans heure : `VS` seul au centre) ou `FINAL`/`FORFAIT`/`EN COURS` en gris, la `phase` dessous tant que la ligne fait au moins 70 px ; au centre le score en Anton ou `VS`, les tirs au but en petit dessous ; un camp `enAttente` en gris sans écusson ; intertitres de date (`titre` du jour en capitales, `DATE À FIXER` pour `date === null`) dès qu'il y a plusieurs jours ; « 1/2 » près du titre quand `page` ; au pied, si `partenaires` n'est pas vide, `PRÉSENTÉ PAR` et leurs logos à côté de l'adresse. Noms raccourcis d'une ellipse avant Satori, comme `raccourcir` (lib/og-phase-finale), la longueur bornée selon la hauteur de ligne.
- [ ] **Step 4: Verify** : relancer le script, puis REGARDER chaque PNG (outil Read) : rien ne déborde, rien ne mord l'adresse, aucun nom sous l'écusson voisin. Corriger et relancer jusqu'à ce que les 14 rendus soient propres. `npx tsc --noEmit -p .` et `npx eslint` sur les deux fichiers.
- [ ] **Step 5: Commit** — `feat(programme): l'affiche Journée X / Matchs du jour`.

---

### Task 7: La route publique de l'affiche

**Files:**
- Create: `src/lib/programme-public.ts` (serveur seulement)
- Create: `src/app/api/c/[slug]/affiche/programme/route.tsx`

**Interfaces:**
- Consumes: `lireChoix`, `selectionnerProgramme`, `titreDuProgramme`, `paginer` (Task 5) ; `partenairesDuProgramme` (Task 5) ; `calendrierDeCompetition` (lib/calendrier-competition) ; `afficheDuProgramme` (Task 6) ; `imageDistante` (lib/og-da) ; `toCompetition`, `toCompMatch` ; `halfDuration`, `DEFAULT_HALF_DURATION` (lib/competition-format) ; `jourDeLome`.
- Produces: `GET /api/c/[slug]/affiche/programme?journee=N | ?dates=A,B[&page=P]` → PNG ; `programmePublic(slug: string, choix: ChoixDuProgramme, page: number): Promise<DonneesProgramme | null>`.

- [ ] **Step 1:** `programmePublic` : même lecture que `phaseFinalePublique` (slug validé `^[a-z0-9-]{1,120}$`, `null` pour un brouillon) ; les matchs → `selectionnerProgramme` → `calendrierDeCompetition` → `paginer` ; `null` si la sélection est vide ou la page hors bornes. Sur une affiche de journée, la `phase` de chaque ligne perd son « · Journée N » : le titre le dit déjà. Surtitre : nom de la compétition si elle n'a pas de logo lisible, puis l'étape (« PHASE DE POULES » pour une journée) ; pour une seule date, la date en toutes lettres, et le terrain si tous ses matchs s'y jouent. Écussons téléchargés une fois par adresse (`imageDistante(a, 256)`, comme lib/phase-finale-publique), logos des partenaires (`partenairesDuProgramme(…, jourDeLome())` puis `imageDistante(logoDe(p), 600)`, écartés s'ils ne se téléchargent pas).
- [ ] **Step 2:** La route : `runtime = "nodejs"` ; `lireChoix` → 400 si `null` ; `page` entier ≥ 1 (1 par défaut) ; `programmePublic` → 404 `no-store` si `null` ; sinon `afficheDuProgramme`.
- [ ] **Step 3: Verify** avec le serveur `koppafoot-dev` (lecture seule, aucune vue comptée) : `?journee=abc` → 400 ; un slug inconnu → 404 ; sur la compétition d'essai ou une compétition terminée (Dékawowo Sportfest, 12 matchs le 2026-10-17) : `?dates=2026-10-17` → PNG, regardé ; `?dates=2026-10-16,2026-10-18` → « AU PROGRAMME ». `npx tsc --noEmit -p .`, `npx eslint`.
- [ ] **Step 4: Commit** — `feat(programme): route publique de l'affiche du programme`.

---

### Task 8: Le bouton « Affiche » du calendrier

**Files:**
- Create: `src/components/competition/AfficheProgramme.tsx`
- Modify: `src/app/(organizer)/organizer/competitions/[cid]/schedule/page.tsx` (barre d'outils, à côté de « PDF »)

**Interfaces:**
- Consumes: `journeesDisponibles`, `datesDisponibles` (Task 5) ; la route (Task 7) ; le partage de fichier tel que `components/competition/AffichesPhaseFinale.tsx` le fait.
- Produces: `AfficheProgramme({ slug, matchs, onFermer }: { slug: string; matchs: CompMatch[]; onFermer: () => void })`.

- [ ] **Step 1:** La modale : deux onglets, « Une journée » (liste de `journeesDisponibles`, « Journée 2 — 18 oct., 25 oct., 1er nov. ») et « Des dates » (cases de `datesDisponibles`) ; l'onglet « Une journée » n'existe pas si aucune journée n'est posée. Aperçu `<img>` de la route ; si elle coupe en plusieurs pages, les pages côte à côte (demander `page=2…` jusqu'au 404). « Télécharger » et « Partager », comme AffichesPhaseFinale.
- [ ] **Step 2:** Le bouton « Affiche » (icône `Image` de lucide-react) à côté de « PDF », désactivé sans match ; il ouvre la modale avec `competition.slug`.
- [ ] **Step 3: Verify** dans le volet, sur la compétition d'essai : choisir une journée → aperçu, titre « JOURNÉE N » ; choisir une date → « MATCHS DU JOUR » ; deux dates → « AU PROGRAMME » ; télécharger produit un PNG. `npx tsc --noEmit -p .`, `npx eslint`.
- [ ] **Step 4:** Relancer tous les scripts de test du dépôt (`for f in scripts/test-*.ts; do npx tsx $f; done`) — chacun finit par « Tout est bon. » ou « Tout passe. » ; signaler tout échec, même étranger au chantier.
- [ ] **Step 5: Commit** — `feat(programme): bouton Affiche dans le calendrier de l'organisateur`.
