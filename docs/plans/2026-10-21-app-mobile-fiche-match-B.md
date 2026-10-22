# Fiche de match native, PR B (le contexte) — plan d'implémentation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal :** la fiche native ajoute les Stats, le Classement de la poule, le Face-à-face (H2H), la forme des deux équipes (dans l'en-tête et dans Infos), le joueur du match en tête du Fil, et les visages des joueurs sur le terrain.

**Architecture :** tout ce qui se calcule s'ajoute à la **fiche** (`lib/fiche-match`, pur, testé) :
- la forme et ses résultats ;
- la poule du match ;
- les rencontres du face-à-face et leur bilan ;
- les lignes de stats ;
- la note et le motif du joueur du match ;
- les couleurs des barres ;
- de quoi retrouver la photo de chaque ligne.

Pour cela, `ficheDepuisCompetition` reçoit en plus les autres matchs de la compétition, écoutés par `useFicheCompetition`. Les photos viennent de l'API du site (`/api/public/photos`), comme sur le site. Les composants sont des portages des composants du site cités.

**Design de référence :** [2026-10-21-app-mobile-fiche-match-design.md](2026-10-21-app-mobile-fiche-match-design.md) — PR A : [plan](2026-10-21-app-mobile-fiche-match-A.md).

---

## À lire d'abord

Mêmes règles que le plan A. Branche `claude/app-fiche-match`. Barrière jest sans `classement` ni `etat-de-forme`. Lint `--no-cache`, typecheck mobile. Côté site : `tsc --noEmit` et lint des fichiers touchés, jamais `build`. Vérification dans le Chrome sans fenêtre, Metro relancé avec `--clear`.

**Les sources du site :**

| Ce qu'on ajoute | Fichier du site |
|---|---|
| Stats | `components/match/MatchStats.tsx` |
| Barre de répartition | `components/match/BarreRepartition.tsx` |
| Classement | `components/match/MatchStandings.tsx` |
| Forme dans Infos | `components/match/MatchForme.tsx` |
| Forme dans l'en-tête | `PointsDeForme` dans `MatchHero.tsx` |
| Joueur du match | `components/match/MvpDuMatch.tsx` |
| Note du joueur | `PastilleNote` (`components/classement/LigneDeClassement.tsx`) et `FOND_NOTE` (`components/forme/badges.tsx`) |
| Face-à-face | onglet `h2h` de `app/(app)/c/[slug]/matches/[mid]/page.tsx`, l. 829-890 |
| Photos | `hooks/usePhotosDesComptes.ts` |

---

## Task 1 — B1 (site) : `pouleDuMatch` dans `lib/poules` (TDD)

**Pourquoi :** la fonction vit dans le composant `MatchStandings`, que l'app ne peut pas importer.

1. **Test d'abord** : `mobile/src/__tests__/poules.test.ts`.
   - `pouleDuMatch` rend la poule qui contient les deux équipes.
   - Elle rend `null` si une équipe manque, ou si les deux sont dans des poules différentes.
   - Les groupes du test sont construits à la main (`{ group: "A", rows: [{ team: { id } }] }`, casté en `GroupStanding`).
2. Le lancer : il échoue.
3. Déplacer `pouleDuMatch` dans `src/lib/poules.ts`. `MatchStandings` l'importe et la ré-exporte, puisque les pages l'importent depuis le composant.
4. Tests verts, puis `tsc` et lint du site, puis typecheck mobile. Commit `refactor(poules): pouleDuMatch dans lib/poules, partagé avec l'application`.

## Task 2 — B2 (app) : la fiche porte son contexte (TDD)

**Le modèle.** On ajoute à `Fiche` :

```ts
export interface ContexteDeFiche {
  /** Les cinq derniers résultats officiels de chaque camp, avant ce match (lib/forme). */
  formes: { domicile: ResultatDeForme[]; exterieur: ResultatDeForme[] };
  /** La poule des deux équipes, en phase de groupes seulement. */
  poule: GroupStanding | null;
  /** Les rencontres terminées entre les deux équipes, dans cette compétition, celle-ci exclue. */
  faceAFace: CompMatch[];
  bilanFaceAFace: { home: number; draw: number; away: number };
  /** Les lignes de stats (lib/stats-match), et s'il y a de quoi ouvrir l'onglet. */
  stats: LigneStat[];
  aDesStats: boolean;
  /** Chaque camp dans sa couleur, sur les barres (lib/couleurs-equipe, piste sombre). */
  couleurs: { home: string; away: string } | null;
}
```

Et sur `Fiche` :
- `contexte: ContexteDeFiche` ;
- `mvp.note: { valeur: number | null; faits: number } | null` ;
- `mvp.motif: string | null` ;
- `lignesPhoto: Record<string, LignePhoto>`, avec `LignePhoto = { id; user_id; photo_url; club_ghost_id; club }`. C'est ce que `photoDeLaLigne` lit.

**Le calcul :**
- **`ficheDepuisCompetition(match, competition, equipes, matchs = [])`** :
  - **formes** : `derniersResultats(matchsQuiComptent(matchs), teamId, match)` pour chaque camp, et `domicile.forme` / `exterieur.forme` = leurs lettres ;
  - **poule** : `stage === "group"` et un format → `pouleDuMatch(computeStandings(matchs, equipes, format), …)` ;
  - **face-à-face** : le filtre de la page (l. 490). Le bilan se lit du point de vue du domicile de **ce** match (l. 834) ;
  - **stats** : `lignesStats(…)` et `aDesStats(…)`, avec les mêmes arguments que la page ;
  - **couleurs** : `couleursDesBarres(couleurDomicile, couleurExterieur, couleurs.surfaceHaute)` ;
  - **joueur du match** :
    - note : `notesDuCamp(match, feuille du camp du joueur, events, mvpTeamId, matchDuration(format))` ;
    - motif : `motifDesMarques(marquesDesJoueurs(events)[mvpPlayerId], "fr")` ;
  - **lignes de photo** : pour chaque ligne des deux feuilles, la ligne d'effectif de l'équipe (`players.find`) donne `photo_url` et `club_ghost_id`, et `claimedByTeamId` donne le club.
- **`ficheDepuisAmical(match)`** :
  - **contexte** : `formes` vides, `poule` nulle, `faceAFace` vide. Les stats viennent des faits et les couleurs sont nulles ;
  - **joueur du match** : la note se calcule avec `DUREE_MATCH_DEFAUT`, comme sur la page amicale ;
  - **lignes de photo** : le compte seulement (`user_id`).
- **`ongletsDeLaFiche`** et **`ongletParDefaut`** lisent désormais `fiche.contexte`, et non plus des booléens passés de l'extérieur. Seul `tchatVisible` reste un argument, jusqu'à la PR C.

**Les tests** s'ajoutent à `fiche-match.test.ts` :
- **forme** : un camp a ses trois derniers résultats officiels, dans l'ordre, sans le match d'exhibition ni les matchs postérieurs ;
- **poule** : la poule du match est trouvée en phase de groupes, et nulle en phase finale ;
- **face-à-face** : deux rencontres, une à l'endroit et une à l'envers, donnent le bilan du point de vue du domicile actuel ;
- **onglets** : un match joué avec des faits a `stats` ; un match de poule a `standings` ; un face-à-face non vide donne `h2h` ;
- **amical** : jamais de `standings` ni de `h2h`.

Commit `feat(mobile): la fiche porte son contexte — forme, poule, face-à-face, stats`.

## Task 3 — B3 (app) : les matchs de la compétition et les photos

- **`useFicheCompetition`** écoute aussi `ecouterMatchsCompetition(cid, …)` (`direct-firestore`) et passe les matchs à `ficheDepuisCompetition`.
- **`hooks/usePhotos.ts`**, réplique de `usePhotosDesComptes` :
  - deux appels `fetch(${API_URL}/api/public/photos?uids=…)` et `?lignes=…`, avec un cache au niveau du module comme sur le site, et sans erreur bruyante ;
  - `usePhotosDeLaFiche(fiche)` rend `Record<playerId, string | null>` via `photoDeLaLigne`, plus la photo du joueur du match.
- Lint et typecheck. Commit `feat(mobile): les matchs de la compétition et les visages des joueurs`.

## Task 4 — B4 (app) : les composants

À la DA du site, carrés, sur `couleurs.surface` avec des filets `bordure` :
- **`BarreRepartition`** (générique, réutilisée par le pronostic en PR C) :
  - segments de largeur proportionnelle (`flexGrow: pct`, minimum 76) ;
  - le segment en tête sur fond `#10b981` (texte `#04150d`) ;
  - en haut de chaque segment, 11 px gras ; en bas, Outfit Black 18 ;
  - `onChoisir` facultatif : le segment devient un bouton.
- **`StatsDuMatch`** :
  - par ligne : les deux nombres en 14 px Black, le libellé au centre en 11 px Black capitales `texteDiscret` ;
  - dessous, une barre de 6 px aux couleurs des camps, sur une piste `surfaceHaute` ;
  - une légende à pastilles en bas.
- **`ClassementDeLaPoule`** :
  - titre « POULE A » ;
  - colonnes : rang, écusson 18, équipe, J, Diff, Pts. Le site masque G, N et P sur téléphone ; les libellés viennent de `COLONNES_CLASSEMENT.fr` ;
  - les deux équipes du match sur `primaireVoile`, en Black.
- **`FaceAFace`** : `BarreRepartition` du bilan (libellé « Face-à-face, N rencontres », « V · 40 % », etc.), puis la liste des rencontres, une par ligne : équipe, score en Outfit Black, équipe.
- **`FormeDesEquipes`** :
  - deux colonnes, titre « DERNIERS RÉSULTATS » ;
  - par résultat : écusson 20, pastille V / N / D (V `#059669`, N `surfaceHaute` + `texteSecondaire`, D `#ef4444`), et un souligné sous le plus récent ;
  - une pastille ouvre la fiche de ce match (`/match/[cid]/[mid]`).
- **`PointsDeForme`** (en-tête) : pastilles de 14 px, V `#34d399` sur texte noir, N à 25 % de blanc, D `#ef4444`, souligné sous la dernière.
- **`JoueurDuMatch`** :
  - carte bordée `rgba(251,191,36,0.35)` sur fond `rgba(251,191,36,0.06)` ;
  - à gauche, la photo de 52 avec un petit trophée ambre en coin, ou un carré ambre avec trophée ;
  - au centre, « HOMME DU MATCH » (ou « JOUEUSE DU MATCH », selon `accorder`, féminine si la compétition l'est) en 11 px Black ambre, le nom en Outfit Black 18, puis « équipe · motif » en 12 px ;
  - à droite, la `PastilleNote` : fond selon `tonNote` (`FOND_NOTE` du site), note formatée par `formaterNote`.

Lint et typecheck. Commit `feat(mobile): stats, classement, face-à-face, forme et joueur du match`.

## Task 5 — B5 (app) : le branchement

- **`EcranFiche`** : les onglets visibles et l'onglet par défaut viennent de `fiche.contexte`. Les panneaux `stats`, `standings` et `h2h` sont branchés.
- **Fil** : `JoueurDuMatch` en tête, comme sur le site.
- **Infos** : `FormeDesEquipes` au-dessus des Détails (compétition seulement).
- **En-tête** : `PointsDeForme` sous le nom de chaque camp.
- **Compos** : les photos de `usePhotosDeLaFiche` sur le terrain, et une petite photo de 20 devant chaque remplaçant.

Commit `feat(mobile): le contexte du match dans la fiche`.

## Task 6 — B6 : vérifier

- Tests, lint et typecheck.
- Le Chrome sans fenêtre (Metro `--clear`), sur :
  - un match de poule joué de Dékawowo : stats, classement, forme dans l'en-tête et dans Infos, H2H s'il existe ;
  - un amical : stats, homme du match s'il y en a un.
- Une planche pour l'utilisateur.
- Le ledger (`.superpowers/sdd/2026-10-21-app-mobile-fiche-match-B/`) et la mémoire.
