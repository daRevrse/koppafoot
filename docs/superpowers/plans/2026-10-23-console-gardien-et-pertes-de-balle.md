# Console : gardien désigné, pertes et gains de balle — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une case « Sans gardien » par match et un gardien désigné par feuille, avec des gants qui changent de main selon les règles du propriétaire. Deux actions, « Gain de balle » et « Perte de balle », qui suivent la possession et comptent dans la note.

**Architecture:** Un module pur `src/lib/gardiens.ts` répond seul à « qui est dans les cages ? », pour la console, la note, le classement et le retrait. Le marqueur de la nouvelle règle est `live_state.sans_gardien`, écrit au lancement. Trois nouveaux types d'événement passent par `lib/evenements` : `ball_won`, `ball_lost` et `gants`. Les matchs sans marqueur suivent l'ancien chemin, laissé intact.

**Tech Stack:** Next.js (App Router), React, TypeScript, Firestore (SDK client). Tests : `npx tsx scripts/test-*.ts` avec `node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-10-23-console-gardien-et-pertes-de-balle-design.md`

## Global Constraints

- Poids de la note : `ball_won` **+0,15**, `ball_lost` **−0,1** ; les autres poids ne changent pas.
- Libellés fr : « Gain de balle », « Perte de balle » ; lignes de stats « Ballons récupérés », « Ballons perdus », juste après « Passes ».
- Case : « Sans gardien de but (petits poteaux) », une par match, décochée par défaut.
- Un match **sans** `liveState.sansGardien` booléen garde exactement le comportement d'aujourd'hui (console, note, classement, penalty).
- Un ballon, une seule saisie : jamais de question sur l'autre joueur.
- Dépôt public : équipes et joueurs fictifs dans les tests.
- Code et commentaires au style du fichier touché : commentaires en français, en majuscules pour l'idée maîtresse, sans accents dans les `lib/` qui n'en ont pas.
- **Un seul commit**, à la fin (Task 7). Aucun commit par tâche.

## Review Focus

1. **Gardien expulsé puis rouge annulé** : le gardien revient, et la prise de gants qui avait suivi part avec le rouge (test en Task 4).
2. **Remplacement du dépanneur** : le joueur de champ qui a pris les gants est remplacé, et celui qui entre devient gardien (source `remplacement`, test en Task 2).
3. **But contre son camp** : il compte comme encaissé pour le gardien en place de l'équipe qui le concède, pas pour l'autre (test en Task 2).
4. **Personne n'a le ballon** (`possession.side === null`) : tous les joueurs ont « Gain », aucun « Perte » (test en Task 1).
5. **Feuille de l'adversaire hors plateforme** (`teamId` vide) : pas de gardien exigé, coup d'envoi possible (test en Task 2, sur `gardienExige`).

---

### Task 1 : Les trois événements, le ballon, les compteurs, le poids

**Files:**
- Modify: `src/lib/evenements.ts` (types, `MINEURS`, `COMPTABLES`, libellés fr/en, emojis)
- Modify: `src/lib/etat-du-jeu.ts` (`balleApres`, nouvelle `actionDeBallon`)
- Modify: `src/lib/stats-match.ts` (deux lignes ; `aDesStats` ignore `gants`)
- Modify: `src/lib/stats-competition.ts:80` (`ORDRE` : `"recuperations", "pertes"` après `"passes"`)
- Modify: `src/lib/notes.ts:70` (`POIDS`)
- Test: `scripts/test-pertes-de-balle.ts` (nouveau)

**Interfaces:**
- Produces : `TypeEvenement` et `TypeEvenementJoueur` gagnent `"ball_won" | "ball_lost" | "gants"`. `actionDeBallon(cote: Cote, ballon: Cote | null): "ball_won" | "ball_lost"` dans `lib/etat-du-jeu`. Clés de lignes `"recuperations"` et `"pertes"`.

- [ ] **Step 1 : écrire `scripts/test-pertes-de-balle.ts`**, au modèle de `scripts/test-classement.ts` (`cas`, `echecs`, `process.exit(echecs ? 1 : 0)`) :
  - `actionDeBallon("home", "home") === "ball_lost"`, `actionDeBallon("home", "away") === "ball_won"`, `actionDeBallon("away", null) === "ball_won"`.
  - `balleApres("ball_lost", "home") === "away"`, `balleApres("ball_won", "home") === "home"`, `balleApres("gants", "home") === null`.
  - `estMineur` et `estStatistique` sont vrais pour les trois ; `LIBELLE_EVENEMENT.ball_won === "Gain de balle"` et `LIBELLE_EVENEMENT.ball_lost === "Perte de balle"`.
  - `lignesStats` avec deux `ball_won` A et un `ball_lost` B (A domicile, B extérieur, score 0-0, une possession de 12 passes à domicile, seuils 0) : la ligne `recuperations` vaut `{ label: "Ballons récupérés", home: 2, away: 0 }`, la ligne `pertes` vaut `{ label: "Ballons perdus", home: 0, away: 1 }`, et l'indice de `recuperations` est celui de `passes` plus un. Sans ces faits, ni `recuperations` ni `pertes` n'apparaissent.
  - `aDesStats([{ type: "gants", teamId: "A" }], null, false) === false`.
  - `notesDuCamp` sur un match chronométré (`liveState.timerOffset: 5_400_000`), sans `sansGardien`, durée 90, avec deux titulaires sans poste. Le premier a 6 `ball_won` et 3 `ball_lost` : sa note vaut `6.6` et ses `faits` valent `9`. Le second a 10 `ball_lost` : sa note vaut `5`.

- [ ] **Step 2 : lancer `npx tsx scripts/test-pertes-de-balle.ts`.** Attendu : échec à la compilation ou des `KO` (`actionDeBallon` est introuvable).

- [ ] **Step 3 : implémenter.**
  - `evenements` : ajouter les trois types aux deux unions, à `MINEURS` et à `COMPTABLES`. Libellés fr : `"Gain de balle"`, `"Perte de balle"`, `"Prend les gants"` ; en : `"Ball won"`, `"Ball lost"`, `"Takes the gloves"`. Emojis : `🛡️`, `💨`, `🧤`.
  - `etat-du-jeu` : dans `balleApres`, `ball_won` rend `cote` et `ball_lost` rend `autre(cote)`. `actionDeBallon` rend `"ball_lost"` quand `ballon === cote`, et `"ball_won"` sinon.
  - `stats-match` : `paire("recuperations", "Ballons récupérés", "ball_won")` et `paire("pertes", "Ballons perdus", "ball_lost")`, insérées juste après la ligne des passes. Dans `aDesStats`, exclure aussi `gants`.
  - `notes` : `ball_won: 0.15`, `ball_lost: -0.1` dans `POIDS`.
  - Suivre `npx tsc --noEmit -p .` pour les `switch` et les `Record` que le compilateur signale (par exemple `fil-du-match`). Les comptables n'y sont jamais racontés.

- [ ] **Step 4 : relancer le test.** Attendu : tous les cas `ok`, code de sortie 0.

### Task 2 : Le marqueur et « qui est dans les cages »

**Files:**
- Create: `src/lib/gardiens.ts`
- Modify: `src/types/index.ts` (`FirestoreMatch.live_state.sans_gardien?: boolean | null` ; `Match.liveState.sansGardien?: boolean | null`)
- Modify: les convertisseurs de `liveState` : `src/lib/match-mappers.ts:124`, `src/lib/competition-mappers.ts:157`, `src/lib/classement-admin.ts:202`, `src/lib/friendlies-shared.ts:86` (`sansGardien: d.live_state.sans_gardien ?? null`)
- Test: `scripts/test-gardiens.ts` (nouveau)

**Interfaces:**
- Produces (dans `lib/gardiens`) :
  - `interface FaitDeGardien { type: TypeEvenement; minute: number; teamId: string; playerId?: string; detail?: string; outPlayerId?: string | null }`
  - `type SourceDesGants = "feuille" | "remplacement" | "gants"` ; `interface GardienEnPlace { playerId: string; source: SourceDesGants }`
  - `interface BilanDuGardien { playerId: string; minutes: number; encaisses: number }`
  - `regleDuGardienDesigne(ls: { sansGardien?: boolean | null } | null | undefined): boolean` : vrai si `sansGardien` est un booléen.
  - `gardienDeDepart(lineup: LineupEntry[]): LineupEntry | null` : le premier **titulaire** au poste `goalkeeper`.
  - `gardienEnPlace(lineup: LineupEntry[], faits: FaitDeGardien[], teamId: string): GardienEnPlace | null`
  - `peutPrendreLesGants(enPlace: GardienEnPlace | null, playerId: string): boolean` : vrai si `enPlace === null`, ou si `enPlace.source === "gants" && enPlace.playerId !== playerId`.
  - `bilanDesGardiens(lineup: LineupEntry[], faits: FaitDeGardien[], teamId: string, dureeMatchMin: number): BilanDuGardien[]` : un bilan par joueur passé dans les cages, dans l'ordre d'arrivée.
  - `gardienPropose(titulaires: { id: string; position?: string | null }[], choisi: string | null | undefined): string | null` : `undefined` donne le premier titulaire au poste gardien ; `null` donne `null` ; un id hors des titulaires donne `null`.
  - `gardienExige(teamId: string | null | undefined, sansGardien: boolean): boolean` : `!sansGardien && !!teamId`.

- [ ] **Step 1 : écrire `scripts/test-gardiens.ts`** (même ossature). Fixtures fictives : domicile `"A"`, extérieur `"B"`, gardien `"gA"`, remplaçant `"gA2"`, joueurs de champ `"c1"`, `"c2"`. Cas :
  - `regleDuGardienDesigne(null) === false`, `({}) === false`, `({ sansGardien: false }) === true`, `({ sansGardien: true }) === true`.
  - `gardienDeDepart` : avec `gA2` remplaçant au poste gardien placé AVANT `gA` titulaire au poste gardien, il rend `gA`.
  - `gardienEnPlace` : sans fait, `{ playerId: "gA", source: "feuille" }`. Après une `substitution` A (`playerId: "gA2"`, `outPlayerId: "gA"`), `{ "gA2", "remplacement" }`. Après un `red_card` A sur `gA`, `null`. Après le rouge puis `gants` A sur `c1`, `{ "c1", "gants" }`. Puis une substitution A qui fait sortir `c1` pour `c2` donne `{ "c2", "remplacement" }` (Review Focus 2).
  - Une `sortie` de `gA` donne `null`. Un rouge sur `c1` laisse `gA` en place.
  - `peutPrendreLesGants(null, "c1") === true` ; avec `{ "c1", "gants" }`, vrai pour `"c2"` et faux pour `"c1"` ; avec `{ "gA", "feuille" }`, faux pour `"c1"`.
  - `bilanDesGardiens` (durée 90) : but B à 20′, remplacement `gA` par `gA2` à 50′, but `csc` porté par A à 70′, but `csc` porté par B à 80′. Résultat : `[{ gA, minutes: 50, encaisses: 1 }, { gA2, minutes: 40, encaisses: 1 }]`. Le csc de B ne compte pas pour A (Review Focus 3).
  - `bilanDesGardiens` : rouge sur `gA` à 30′, but B à 30′, `gants` sur `c1` à 31′, but B à 60′. Résultat : `gA` 30 minutes et 0 encaissé ; `c1` 59 minutes et 1 encaissé. Le but de la 30′ ne va à personne.
  - `gardienPropose([{ id: "c1" }, { id: "gA", position: "Gardien" }], undefined) === "gA"` ; avec `"c1"` → `"c1"` ; avec `null` → `null` ; avec `"x"` → `null`.
  - `gardienExige("", false) === false` (Review Focus 5) ; `gardienExige("A", true) === false` ; `gardienExige("A", false) === true`.

- [ ] **Step 2 : lancer `npx tsx scripts/test-gardiens.ts`.** Attendu : échec, le module est introuvable.

- [ ] **Step 3 : implémenter `lib/gardiens.ts`, les types et les quatre convertisseurs.**
  - Une seule marche privée sert à `gardienEnPlace` et à `bilanDesGardiens` : les faits sont triés de façon stable par minute, comme dans `computeMinutesPlayed`. Les bornes sont aussi les mêmes : `coupDeSifflet = max(dureeMatchMin, minute max)`. Les transitions pour le camp `teamId` :
    - `substitution` dont `outPlayerId` est le gardien en place : l'entrant devient gardien, source `remplacement` ;
    - `red_card` ou `sortie` du gardien en place : plus de gardien ;
    - `gants` : le joueur devient gardien, source `gants`.
  - Un but est encaissé par `teamId` quand il est porté par l'autre camp sans `detail === OWN_GOAL_DETAIL`, ou porté par `teamId` avec ce `detail`. Il va au gardien en place à ce moment-là, ou à personne.
  - `normaliserPoste` (`lib/postes`) lit les postes.
  - Le module n'importe ni `lib/notes` ni `lib/player-stats`, pour éviter un cycle.

- [ ] **Step 4 : relancer le test, puis `npx tsc --noEmit -p .`.** Attendu : tous les cas `ok`, et aucune erreur de type.

### Task 3 : La note et le classement suivent les cages

**Files:**
- Modify: `src/lib/notes.ts:157` et `:205-216` (bloc du gardien)
- Modify: `src/lib/classement.ts:385-390` (matchs au but, sans encaisser)
- Test: `scripts/test-gardiens.ts` (cas ajoutés)

**Interfaces:**
- Consumes : `regleDuGardienDesigne`, `bilanDesGardiens` (Task 2).

- [ ] **Step 1 : ajouter les cas** (match chronométré, durée 90) :
  - Note avec `sansGardien: true`, `gA` titulaire au poste gardien, 2 buts encaissés : `gA` a `6` et `faits === 0`.
  - Note avec `sansGardien: false` : `gA` encaisse 2 buts avant d'être remplacé à 50′ par `gA2`, qui n'encaisse rien. `gA` a `5.3` ; `gA2` a `6` (40 minutes, sous `MINUTES_CLEAN_SHEET`, donc pas de prime). Avec `gA` seul, 90 minutes sans encaisser : `6.5`.
  - Note **sans marqueur** (ancienne règle) : `gA2` remplaçant au poste gardien est placé avant `gA` sur la feuille, et l'équipe encaisse 1 but. La note de `gA` reste `6`, comme aujourd'hui, parce que l'ancien chemin prend la première ligne au poste gardien.
  - `calculerClassements`, match avec `sansGardien: false` : `gA` titulaire au poste gardien, `gA2` remplaçant au poste gardien jamais entré, 0 encaissé. `gA` a `cleanSheets === 1`. `gA2` a `cleanSheets === 0` et n'est pas `gardien`.
  - `calculerClassements`, même match avec `gA` remplacé par `gA2` à 50′ et 0 encaissé : les deux ont `cleanSheets === 1`.
  - `calculerClassements` avec `sansGardien: true` : personne n'a de `cleanSheets`.

- [ ] **Step 2 : lancer `npx tsx scripts/test-gardiens.ts`.** Attendu : les nouveaux cas sont `KO`.

- [ ] **Step 3 : implémenter.**
  - Dans `notesDuCamp`, si `regleDuGardienDesigne(match.liveState)` est vrai, le bloc du gardien est remplacé. Sauf si `sansGardien` vaut `true` ou que `teamId` est nul, chaque `bilanDesGardiens(lineup, faits, teamId, dureeMatchMin ?? DUREE_MATCH_DEFAUT)` donne :
    - si le gardien a encaissé, `encaisses × POIDS_BUT_ENCAISSE` et autant de faits ;
    - sinon, si `minutes >= MINUTES_CLEAN_SHEET`, `PRIME_CLEAN_SHEET` et un fait.
  - Sinon, l'ancien code s'applique tel quel, compteur `butsEncaisses` compris.
  - Dans `calculerClassements`, même aiguillage par camp. Avec la nouvelle règle, `matchsAuBut += 1` pour chaque joueur présent dans le bilan, et `cleanSheets += 1` si son `encaisses === 0`. Sinon, l'ancien test du poste reste. `posteConnu` ne change pas.

- [ ] **Step 4 : relancer `scripts/test-gardiens.ts`, `scripts/test-classement.ts` et `scripts/test-joueur-semaine.ts`.** Attendu : tout est `ok`.

### Task 4 : Le rouge annulé emporte la prise de gants

**Files:**
- Modify: `src/lib/retrait-evenement.ts` (`planDuRetrait`, cas `red_card`, `sortie` et `yellow_card` avec rouge automatique)
- Test: `scripts/test-gardiens.ts` (cas ajoutés)

**Interfaces:**
- Consumes : `gardienEnPlace` (Task 2).
- Produces : le `contexte` de `planDuRetrait` gagne `lineups?: Record<"home" | "away", LineupEntry[]>`. Sans lui, rien ne change.

- [ ] **Step 1 : ajouter les cas.**
  - Événements A : `red_card` sur `gA` (id `r1`), puis `gants` sur `c1` (id `g1`). Retirer `r1` avec des `lineups` : `plan.ids` contient `r1` et `g1`, et `gA` revient sur la pelouse.
  - Même chose avec le rouge sur `c2`, joueur de champ : `plan.ids` vaut `["r1"]`.
  - Même chose sans `lineups` : `plan.ids` vaut `["r1"]`.
  - Second jaune de `gA`, rouge automatique, puis `gants` sur `c1` : retirer le jaune emporte aussi `g1`.

- [ ] **Step 2 : lancer le test.** Attendu : `KO`.

- [ ] **Step 3 : implémenter.** On vérifie si l'exclu était le gardien en place juste avant son exclusion : `gardienEnPlace(lineup du camp, events avant l'exclusion, teamId)?.playerId === playerId`. Si oui, tous les `gants` de son camp posés après l'exclusion rejoignent `plan.ids`.

- [ ] **Step 4 : relancer.** Attendu : `ok`.

### Task 5 : L'écriture du marqueur

**Files:**
- Modify: `src/lib/competition-firestore.ts:1383` (`initLiveCompMatch(cid, mid, sansGardien: boolean)`, écrit `sans_gardien` dans `live_state`) et nouvelle `setCompSansGardien(cid: string, mid: string, v: boolean): Promise<void>` (`"live_state.sans_gardien": v`, `updated_at`)
- Modify: `src/lib/firestore.ts:2585` (`initLiveMatch(matchId, sansGardien: boolean)`) et nouvelle `setMatchSansGardien(matchId: string, v: boolean): Promise<void>`
- Modify: `src/lib/console-pilote.ts` (interface et les deux pilotes)

**Interfaces:**
- Produces : `PiloteConsole.lancer(surLeTerrain: { home: string[]; away: string[] }, sansGardien: boolean): Promise<void>` ; `PiloteConsole.poserSansGardien(v: boolean): Promise<void>`.

- [ ] **Step 1 : implémenter** sur le modèle de `setCompPossession` et `setMatchPossession`. Chercher les autres appelants de `initLiveCompMatch` et `initLiveMatch` avec `grep -rn "initLive" src` (par exemple le bac à sable `/api/live-training`) et leur passer `false`.
- [ ] **Step 2 : `npx tsc --noEmit -p .`.** Attendu : seule l'erreur d'appel de `pilote.lancer` dans `LiveMatchConsole` reste, et la Task 6 la corrige.

### Task 6 : La console

**Files:**
- Modify: `src/components/competition/LiveMatchConsole.tsx`
- Modify: `src/components/competition/TerrainConsole.tsx` seulement si la fenêtre d'actions doit afficher un nouveau ton (sinon rien)

**Interfaces:**
- Consumes : tout ce qui précède.

- [ ] **Step 1 : la case et les gants sur l'écran des feuilles.**
  - Un état `caseSansGardien: boolean | null`. La valeur effective est `caseSansGardien ?? match.liveState?.sansGardien ?? false`.
  - La case s'affiche sous la ligne du format, en avant-match. Le libellé est exact : « Sans gardien de but (petits poteaux) ».
  - Un état `gardiensChoisis: Record<Side, string | null | undefined>`, ensemencé à chaque changement de feuille enregistrée : le `gardienDeDepart` de la feuille si elle est non vide, `undefined` sinon.
  - `LineupBuilder` reçoit `gardienId` (via `gardienPropose`, avec les titulaires du brouillon et leur poste d'effectif), `avecGardien` et `onGardien(playerId)`. Avec gardien, chaque ligne titulaire porte un bouton 🧤 distinct de la ligne, `aria-label` « Désigner gardien ». Le bouton actif est plein, les autres sont estompés.
- [ ] **Step 2 : valider une feuille.**
  - Si `gardienExige(teamId du camp, sansGardien)` est vrai et qu'aucun gardien n'est désigné parmi les titulaires : `toast.error("Désigne le gardien 🧤 parmi les titulaires")`, et la feuille n'est pas validée.
  - Le gardien désigné reçoit `position: "goalkeeper"`. Les autres titulaires au poste gardien reçoivent `position: null`. Les remplaçants gardent leur poste. En mode sans gardien, les postes restent ceux d'aujourd'hui.
- [ ] **Step 3 : l'écran « Les deux feuilles sont validées » et le coup d'envoi.**
  - Chaque carte affiche « 🧤 <nom> », ou « Gardien à désigner » quand `gardienExige` est vrai et que `gardienDeDepart` est nul.
  - « Aller au coup d'envoi » est désactivé tant qu'un camp exigé n'a pas de gardien. Le message « Désigne le gardien de chaque équipe, ou coche « Sans gardien ». » s'affiche alors.
  - `handleLaunch` passe la valeur effective de la case à `pilote.lancer`.
- [ ] **Step 4 : les actions du joueur (`actionsPour`).**
  - Sans marqueur, `actionsPour` reste inchangée.
  - Avec marqueur, l'action « Arrêt » ne va qu'au gardien en place (`gardienEnPlace` sur `match.liveState.events`), et jamais en mode sans gardien. « Tir », « Tir cadré » et « Hors-jeu » vont à tous les autres.
  - « 🧤 Prendre les gants » (clé `gants`, jamais verrouillée) apparaît quand le marqueur est posé, que la case est décochée, que le camp a un `teamId` et que `peutPrendreLesGants` est vrai.
  - Pour tout joueur sur le terrain, `deJeu(actionDeBallon(side, possession.side), …)` s'insère après « Tir ». C'est l'unique action de ballon de la fenêtre.
  - Dans `enregistrerAction`, `ball_won` et `ball_lost` passent par la branche générique : l'événement, « Annuler », puis `balleApres` et la bascule. Le nouveau cas `gants` pose l'événement et « Annuler », sans toucher au ballon.
- [ ] **Step 5 : « Qui prend les gants ? ».**
  - Un état `gantsAPrendre: { side: Side; sortant: string } | null`. Il se pose après un rouge (direct ou second jaune) ou une sortie du gardien en place, quand le marqueur est posé et que la case est décochée.
  - Un `PlayerPickerModal` affiche le titre « Qui prend les gants ? », les joueurs de `onPitchEntries(side)` sauf le sortant, et `ignorer="Un remplaçant va entrer"`. Choisir un joueur pose l'événement `gants`.
  - Le retrait qui emporte l'événement ferme la question, comme pour la victime.
- [ ] **Step 6 : le penalty arrêté, le retrait, le menu ⋯.**
  - Pour un penalty « Arrêté » avec marqueur, l'arrêt va au `gardienEnPlace` du camp qui défend, et à personne en mode sans gardien. Sans marqueur, le code d'aujourd'hui reste.
  - `retirerEvenement` passe `lineups: { home: m.homeLineup, away: m.awayLineup }`. Quand le plan emporte un `gants`, la confirmation ajoute « La prise de gants qui avait suivi part aussi. »
  - Le menu ⋯ affiche « Sans gardien : non » ou « Sans gardien : oui ». Un toucher appelle `pilote.poserSansGardien(!effectif)` puis annonce le toast « Match sans gardien » ou « Match avec gardien ».
- [ ] **Step 7 : `npx tsc --noEmit -p .` et `npx eslint src/components/competition/LiveMatchConsole.tsx`.** Attendu : aucune erreur.

### Task 7 : Vérifier, commiter, proposer la PR

- [ ] **Step 1 : lancer toute la suite** avec `for f in scripts/test-*.ts; do case $f in *registration-flow*) continue;; esac; npx tsx "$f" || echo "ECHEC $f"; done`. Attendu : aucune ligne `ECHEC`.
- [ ] **Step 2 : `npx tsc --noEmit -p .`, puis `npx eslint` sur chaque fichier touché.** Attendu : aucune erreur.
- [ ] **Step 3 : vérifier sur le banc d'essai.** Créer `src/app/banc-console/page.tsx`, jamais commité, qui monte la console avec un `PiloteConsole` en mémoire (voir la mémoire console-live-vrai-match). Postes canoniques. Parcourir :
  - petits poteaux : la case cochée, aucune action « Arrêt » ;
  - avec gardien : le 🧤 obligatoire, puis le remplacement du gardien ;
  - le gardien expulsé, « Qui prend les gants ? », puis le rouge annulé ;
  - une perte, puis un gain, avec la possession qui bascule et les deux lignes de stats.

  Ensuite, supprimer la page.
- [ ] **Step 4 : un commit** sur `claude/gardien-pertes-de-balle`, avec la spec, le plan, le code et les tests (`git add` fichier par fichier, jamais `-A`). Le message est en français, au format `feat(console): …`, et se termine par la ligne `Co-Authored-By`.
- [ ] **Step 5 : proposer la PR au propriétaire, sans la créer.**
