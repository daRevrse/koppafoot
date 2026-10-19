# Joueur de la semaine — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** une page admin qui classe les joueurs d'une semaine (lundi–dimanche), puis fabrique l'affiche du joueur choisi (1080×1350 et 1080×1920) et sa vidéo verticale animée (MP4).

**Architecture:** un module pur classe la semaine à partir des matchs déjà lus pour le classement de la plateforme ; un module Satori dessine l'affiche entière ou calque par calque ; le serveur rend les PNG, le navigateur de l'admin anime les calques sur un canvas et encode le MP4 avec WebCodecs (mediabunny). Rien n'est enregistré.

**Tech Stack:** Next 16 (App Router), `next/og` (Satori), sharp (livré avec Next), firebase-admin, mediabunny 1.61.0 (nouvelle dépendance), scripts de test `npx tsx`.

**Spec:** `docs/superpowers/specs/2026-10-19-joueur-de-la-semaine-design.md`. Référence visuelle et timeline : `scripts/maquettes-joueur-semaine.tsx` (jetable, non commité).

## Global Constraints

- Semaine : lundi → dimanche, jours de Lomé (UTC+0) ; les `date` de match sont déjà des jours de Lomé.
- Jamais de ligne `dos-…` ni `ext-…` parmi les candidats (`estLigneHorsPlateforme`).
- Couleurs : blanc `#ffffff`, noir `#0b0b0b`, vert `#10b981`, vert de texte `#047857`, camouflage du bandeau `#0ea371` `#1fc58f` `#0b9a69` `#14b884`, bloc noir `#141414` + `#1f1f1f` `#0c0c0c` `#262626` `#2e2e2e`. Pas de grain. Polices Anton + Outfit (`chargerRessources`).
- Textes figés : « JOUEUR DE » / « LA SEMAINE », « MATCHS DE LA SEMAINE », « /// SEMAINE {n} », « MATCH AMICAL ». Pas de période datée.
- Formats : publication 1080×1350, vertical 1080×1920 ; vidéo 1080×1920, 30 i/s, 10 s, MP4 H.264, sans son.
- Vertical : tout le contenu entre y = 150 et y = 1480.
- Au plus 4 écussons, 4 lignes de matchs, 2 partenaires.
- Toute route sous `/api/admin/joueur-semaine` commence par `exigerSuperadmin(req)`.
- Les boutons de téléchargement et de vidéo sont désactivés tant que la case d'accord du joueur n'est pas cochée.
- Jamais de cadre « PARTENAIRE » vide dans un rendu.
- Satori : `display: "flex"` sur tout élément à plusieurs enfants, pas de `radial-gradient`, pas de WebP.

## Review Focus

1. **Une semaine sans aucun match** (été, trêve) : la page dit « Aucun match cette semaine », sans planter ni proposer d'affiche. → test `semaine vide` (Tâche 2).
2. **Un nom ou une affiche de match très longs** (« ASSOCIATION SPORTIVE DES JEUNES DE BÈ-KPOTA 3–2 … ») : l'ellipse coupe, rien ne passe à la ligne ni ne déborde. → rendu de contrôle avec noms longs (Tâche 4).
3. **Un joueur sans photo, une équipe sans logo, une compétition sans partenaire** : initiales, rond vert, pied réduit au logo. → rendu de contrôle « tout manque » (Tâche 4).
4. **Un navigateur sans encodeur H.264** (Firefox, Safari, volet de l'outil) : message clair, l'affiche reste téléchargeable. → `videoPossible()` testé dans le navigateur (Tâche 7).
5. **Une photo envoyée trop lourde ou qui n'est pas une image** : refus net (« Image trop lourde » / « Format non pris en charge »), pas d'erreur 500. → test de `lirePhotoEnvoyee` (Tâche 5).

---

### Task 1: préalable — commits et branche

**Files:** aucun nouveau.

- [ ] **Step 1 : commiter les correctifs du classement** sur `claude/classement-apres-coup` : `src/lib/classement.ts`, `src/lib/classement-admin.ts`, `src/lib/classement-client.ts`, `src/lib/notes.ts`, `src/components/competition/MatchResultModal.tsx`, `src/components/competition/LiveMatchConsole.tsx`, `scripts/test-classement.ts`. Message : `fix(classement): les buteurs d'un score saisi après coup, et pas de note sans chrono`.
- [ ] **Step 2 : créer `claude/joueur-de-la-semaine`** depuis ce commit, et y commiter la spec et ce plan (`docs(joueur-semaine): conception et plan`). Ne pas commiter `scripts/maquettes-joueur-semaine.tsx`.

### Task 2: le classement de la semaine (module pur)

**Files:**
- Create: `src/lib/joueur-semaine.ts`
- Modify: `src/lib/classement.ts` (exporter `nommesSansFeuille` et le type `LigneDuCamp`)
- Test: `scripts/test-joueur-semaine.ts`

**Interfaces — Produces:**

```ts
export interface Semaine { lundi: string; dimanche: string; numero: number }  // numéro ISO
export function semaineDu(jour: string): Semaine;            // la semaine qui contient `jour`
export function semainePrecedente(jour: string): Semaine;     // la dernière semaine terminée avant `jour`
export function jourCourt(date: string): string;              // "2026-10-18" → "DIM. 18 OCT."
export function detailDePerformance(buts: number, passes: number): string; // "2 BUTS", "1 BUT · 1 PASSE", ""
export const AMICAUX = "friendly";                            // l'id de groupe des amicaux (= AMICAL de classement-admin)

export type MatchDeLaSemaine = MatchAClasser & { competitionNom: string; amical?: boolean };

export interface MatchDuJoueur {
  matchId: string; date: string; jour: string;
  competitionId: string; competition: string;                 // "MATCH AMICAL" pour un amical
  equipeId: string | null; equipe: string; ecusson: string | null;
  affiche: string;                                            // son équipe d'abord : "FC LION 4–0 PRAISE FC"
  buts: number; passes: number; note: number | null; homme: boolean;
}
export interface CandidatDeLaSemaine {
  cle: string; nom: string; uid: string | null;
  matchs: MatchDuJoueur[];                                    // du plus ancien au plus récent
  buts: number; passes: number; note: number | null; hommeDuMatch: number;
  ligneSansCompte: LigneSansCompte | null;                    // pour retrouver sa photo
}
export interface DossardEcarte { equipe: string; nom: string; buts: number; passes: number }
export interface CompetitionDeLaSemaine { id: string; nom: string; matchs: number }
export interface ClassementDeLaSemaine {
  semaine: Semaine; competitions: CompetitionDeLaSemaine[];   // toutes, écartées comprises
  candidats: CandidatDeLaSemaine[]; dossards: DossardEcarte[];
}
export function classerLaSemaine(
  matchs: MatchDeLaSemaine[], semaine: Semaine, ecartees: ReadonlySet<string>,
): ClassementDeLaSemaine;
```

Règles (spec, « A. Le classement de la semaine ») : matchs `completed`, `date` dans la semaine, sans `forfeitByTeamId`, compétition non écartée. Joueurs : feuille du camp ; camp sans feuille → `nommesSansFeuille` quand `comptesDesLignes` est présent ; amical renseigné → `contributionsDirectes`, rattachées au camp vérifié à l'étape 3. Lignes `dos-`/`ext-` → `dossards` (seulement s'ils ont but ou passe), jamais `candidats`. Clé : `uid:<compte>` sinon `nom:<nom en minuscules>|<equipeId>`. Buts hors csc et hors VAR annulée ; passes comme `calculerClassements`. Note : `notesDuCamp` sur les camps avec feuille, `null` sinon ; `note` du candidat = moyenne simple arrondie au dixième de ses notes non nulles. Tri : buts ↓, passes ↓, note ↓ (null en dernier), hommeDuMatch ↓, nom (`localeCompare` fr).

- [ ] **Step 1 : écrire les tests** dans `scripts/test-joueur-semaine.ts` (même harnais `cas()` que `scripts/test-classement.ts`) :
  - `semaineDu("2026-10-18")` → `{ lundi: "2026-10-12", dimanche: "2026-10-18", numero: 42 }` ; `semaineDu("2026-10-12")` idem ; `semainePrecedente("2026-10-19")` → lundi `"2026-10-12"` ; `semaineDu("2026-01-01").numero === 1` ; `semaineDu("2027-01-01").numero === 53`.
  - `jourCourt("2026-10-18") === "DIM. 18 OCT."`, `jourCourt("2026-02-03") === "MAR. 3 FÉVR."`.
  - `detailDePerformance(2, 0) === "2 BUTS"`, `(1, 1) === "1 BUT · 1 PASSE"`, `(0, 2) === "2 PASSES"`, `(0, 0) === ""`.
  - le cas G2 (fixture de `test-classement.ts`, avec `competitionNom: "G2 ÉDITION 2026"`) : AMEGAN premier, `buts === 2`, une ligne `affiche === "FC LION 4–0 PRAISE FC"` alors que FC LION jouait à l'extérieur, `competition === "G2 ÉDITION 2026"`, `note === null`.
  - un match du 11 octobre et un du 19 sont hors de la semaine du 12.
  - une compétition dans `ecartees` disparaît des candidats mais reste dans `competitions`.
  - un forfait ne compte pas.
  - un `dos-B-11` qui marque 4 fois est dans `dossards`, pas dans `candidats`.
  - deux « Kossi » sans compte dans deux équipes → deux candidats ; un même `userId` dans deux équipes → un candidat avec deux matchs, triés par date.
  - tri : 2 buts sans note devant 1 but noté 9,0 ; à buts et passes égaux, le noté devant le non noté.
  - **semaine vide** : `classerLaSemaine([], s, new Set())` → `candidats` et `competitions` vides.
- [ ] **Step 2 : lancer** `npx tsx scripts/test-joueur-semaine.ts` → échec (module absent).
- [ ] **Step 3 : vérifier dans `src/app/api/matches/record/route.ts`** de quel camp sont les buteurs déclarés d'un amical renseigné (celui de l'équipe qui renseigne : `home` ou selon le champ qui la désigne), et rattacher les `contributionsDirectes` à ce camp. Le noter en commentaire.
- [ ] **Step 4 : implémenter** `src/lib/joueur-semaine.ts` (exports ci-dessus) et exporter `nommesSansFeuille` / `LigneDuCamp` de `src/lib/classement.ts`.
- [ ] **Step 5 : lancer** les tests → `Tout passe.` ; relancer `npx tsx scripts/test-classement.ts` → `Tout passe.`
- [ ] **Step 6 : commit** `feat(joueur-semaine): le classement de la semaine`.

### Task 3: la lecture côté serveur, les photos, les partenaires

**Files:**
- Modify: `src/lib/classement-admin.ts` (champs ajoutés aux matchs ; exporter les photos)
- Modify: `src/lib/partenaires.ts` (emplacement + sélection)
- Create: `src/lib/joueur-semaine-admin.ts`
- Test: `scripts/test-joueur-semaine.ts` (sélection des partenaires)

**Interfaces:**
- Consumes: `classerLaSemaine`, `semaineDu` (Tâche 2).
- Produces:

```ts
// classement-admin : MatchDeLaPlateforme gagne `competitionNom: string` (nom de la
// compétition ; "MATCH AMICAL" pour un amical) ; un amical gagne aussi
// homeTeamLogo, awayTeamLogo, forfeitByTeamId, mvpPlayerId, mvpUserId.
export async function photosDesJoueurs(uids: string[]): Promise<Map<string, string>>;      // déjà là, exporté
export async function photosSansCompte(lignes: [string, LigneSansCompte][]): Promise<Map<string, string>>; // idem

// partenaires
EMPLACEMENTS += "affiche_semaine";  LIBELLE_EMPLACEMENT.affiche_semaine = "Affiche « Joueur de la semaine »";
export function partenairesDeLAffiche<P extends Pick<FirestorePartenariat, "competition_id" | "type" | "debut" | "actif" | "fin">>(
  candidats: P[], jour: string,
): P[];   // à l'affiche ce jour, competition_id vide, partenaires avant annonces, puis `debut` le plus récent ; tous (la page coupe à 2)

// joueur-semaine-admin
export interface PartenaireDAffiche { id: string; annonceur: string; imageUrl: string | null; format: FormatPartenaire }
export async function lireLaSemaine(lundi: string, ecartees: string[]): Promise<ClassementDeLaSemaine>;
export async function photoDuCandidat(c: CandidatDeLaSemaine): Promise<string | null>; // URL : profil, sinon ligne/fiche de club
export async function partenairesDuJour(): Promise<PartenaireDAffiche[]>;            // emplacement affiche_semaine, jourDeLome()
```

- [ ] **Step 1 : tests de `partenairesDeLAffiche`** : un inactif, un hors dates et un de compétition sont écartés ; un « partenaire » passe devant une « annonce » plus récente ; deux partenaires → le `debut` le plus récent d'abord.
- [ ] **Step 2 : lancer** → échec.
- [ ] **Step 3 : implémenter** les ajouts ci-dessus. `lireLaSemaine` = `matchsDeLaPlateforme()` puis `classerLaSemaine(matchs, semaineDu(lundi), new Set(ecartees))`. Les partenaires se lisent comme dans `src/app/api/partenaires/route.ts` (`where("emplacements", "array-contains", "affiche_semaine")`).
- [ ] **Step 4 : lancer** les deux scripts de test → `Tout passe.` ; `npx tsc --noEmit -p .` sans erreur hors `.next/`.
- [ ] **Step 5 : commit** `feat(joueur-semaine): lecture des matchs, des photos et des partenaires`.

### Task 4: l'affiche (Satori)

**Files:**
- Create: `src/lib/og-joueur-semaine.tsx`
- Create: `scripts/rendu-joueur-semaine.tsx` (rendu de contrôle, commité)

**Interfaces:**
- Produces:

```ts
export type FormatAffiche = "publication" | "vertical";
export interface DonneesAffiche {
  nom: string;                       // tel que l'admin l'a validé, mis en capitales au rendu
  numeroSemaine: number;
  photo: string | null;              // data URI JPEG/PNG, déjà préparée ; null → initiales
  lignes: { jour: string; competition: string; equipe: string; ecusson: string | null; affiche: string; detail: string }[];
  ecussons: { equipe: string; logo: string | null }[];   // ≤ 4, le plus récent d'abord
  partenaires: { annonceur: string; image: string | null }[]; // ≤ 2, data URI
}
export const CALQUES_FIXES: readonly string[];  // ordre d'empilement : "fond","bande","blocHaut","semaine","ecusson-i","blocDroite","photo","bandeau","nom","label","ligne-i","pied"
export interface CalqueVideo { cle: string; png: string; left: number; top: number; w: number; h: number }
export async function afficheJoueurSemaine(d: DonneesAffiche, format: FormatAffiche): Promise<Buffer>; // PNG
export async function calquesJoueurSemaine(d: DonneesAffiche): Promise<CalqueVideo[]>;              // vertical, recadrés (sharp .trim())
export async function preparerPhoto(contenu: Buffer): Promise<string>; // resize 1000 px lanczos3, saturation 1.08, linear(1.12,-12), sharpen σ1.2, JPEG 92 → data URI
```

Mise en page : celle de `Collage` et `gabarit()` du script de maquettes (positions, tailles, couleurs, `/// SEMAINE n`, colonne d'écussons, bloc noir qui s'arrête avec le nom, lignes de 66 px en publication et 70 px en vertical, photo qui grandit de 45 / 60 px par ligne manquante). En plus : ellipse sur `affiche` (≈ 34 caractères à 26 px), sur la compétition, et sur le nom (taille 44 réduite jusqu'à 32 avant ellipse) ; « + N AUTRES MATCHS » en 4e ligne au-delà de 4 ; sans photo, initiales en Anton blanc sur `#2b2b2b` ; le pied : logo KoppaFoot à gauche, partenaires à droite (un seul → place de droite), rien d'autre.

- [ ] **Step 1 : écrire `scripts/rendu-joueur-semaine.tsx`** qui rend dans un dossier passé en argument : (a) AMEGAN réel (fixture locale), publication + vertical ; (b) « tout manque » (pas de photo, équipes sans logo, aucun partenaire) ; (c) noms longs et 6 matchs ; (d) le vertical avec les zones TikTok en surimpression (y < 150, y > 1480).
- [ ] **Step 2 : implémenter** `src/lib/og-joueur-semaine.tsx`.
- [ ] **Step 3 : lancer** `npx tsx --tsconfig tsconfig.json scripts/rendu-joueur-semaine.tsx <dossier>` et **regarder chaque PNG** : (a) identique aux maquettes validées hors cadres « PARTENAIRE » ; (b) initiales, ronds verts, pied réduit au logo ; (c) aucune ligne à la ligne ni hors cadre, « + 3 AUTRES MATCHS » ; (d) rien d'important dans les zones roses.
- [ ] **Step 4 : commit** `feat(joueur-semaine): l'affiche, en publication et en vertical`.

### Task 5: les routes d'API

**Files:**
- Create: `src/app/api/admin/joueur-semaine/route.ts` (GET)
- Create: `src/app/api/admin/joueur-semaine/affiche/route.ts` (POST → PNG)
- Create: `src/app/api/admin/joueur-semaine/calques/route.ts` (POST → JSON)
- Create: `src/lib/joueur-semaine-requete.ts` (lecture et validation du corps, pure)
- Test: `scripts/test-joueur-semaine.ts`

**Interfaces:**
- Consumes: `lireLaSemaine`, `photoDuCandidat`, `partenairesDuJour` (Tâche 3) ; `afficheJoueurSemaine`, `calquesJoueurSemaine`, `preparerPhoto` (Tâche 4).
- Produces:

```ts
// GET ?lundi=AAAA-MM-JJ&ecartees=cid,cid  (lundi absent → semainePrecedente(jourDeLome()))
// → { classement: ClassementDeLaSemaine (30 premiers candidats + tous pour la recherche : nom, cle, buts, passes, note, hommeDuMatch, equipes, aPhoto),
//     partenaires: PartenaireDAffiche[] }
// POST corps commun :
export interface DemandeAffiche {
  lundi: string; ecartees: string[]; cle: string;   // le candidat
  nom: string;                                      // 1–40 caractères après trim
  photo: string | null;                             // data URL image/jpeg|png, ≤ 2 Mo décodés
  partenaires: string[];                            // ids retenus, ≤ 2
  format?: FormatAffiche;                           // affiche seulement
}
export function lireDemande(corps: unknown): DemandeAffiche | { erreur: string };
export function lirePhotoEnvoyee(dataUrl: string): Buffer | { erreur: "Image trop lourde" | "Format non pris en charge" };
// /affiche → image/png, Content-Disposition attachment ; /calques → { calques: CalqueVideo[] }
```

Le serveur recalcule la semaine et retrouve le candidat par `cle` (404 « Joueur introuvable cette semaine ») : il ne fait confiance au corps que pour le nom affiché, la photo et le choix parmi les partenaires du jour.

- [ ] **Step 1 : tests de `lireDemande` / `lirePhotoEnvoyee`** : corps sans `cle` → erreur ; nom vide ou de 41 caractères → erreur ; 3 partenaires → erreur ; data URL `image/gif` → « Format non pris en charge » ; 2,5 Mo → « Image trop lourde » ; un petit PNG valide → `Buffer`.
- [ ] **Step 2 : lancer** → échec.
- [ ] **Step 3 : implémenter** le module de requête puis les trois routes (`export const dynamic = "force-dynamic"`, `exigerSuperadmin` en tête, `console.error` + 500 « L'affiche n'a pas pu être générée » en cas d'échec, comme `api/admin/audience`).
- [ ] **Step 4 : lancer** les tests → `Tout passe.` ; `tsc` propre.
- [ ] **Step 5 : commit** `feat(joueur-semaine): les routes d'administration`.

### Task 6: la timeline de la vidéo (module pur)

**Files:**
- Create: `src/lib/video-joueur-semaine.ts`
- Test: `scripts/test-joueur-semaine.ts`

**Interfaces — Produces:**

```ts
export const FPS = 30;
export const DUREE = 10;
export interface EtatCalque { dx: number; dy: number; opacite: number; devoile: number; zoom: number }
export function etatDuCalque(c: Pick<CalqueVideo, "cle" | "left" | "top" | "w" | "h">, t: number, largeur: number): EtatCalque;
```

Valeurs : le tableau « C. La vidéo » de la spec, et les courbes de `etat()` du script de maquettes (cubique, « back » c1 = 1.70158, « bounce » n = 7.5625 / d = 2.75).

- [ ] **Step 1 : tests** : à `t = DUREE` tous les calques sont au repos (`dx = dy = 0`, `opacite = 1`, `devoile = 1`) sauf `photo` dont `zoom ≈ 1.045` ; à `t = 0` le bandeau est entièrement hors champ à gauche (`left + dx + w ≤ 0`) et la photo a `devoile = 0` ; `ecusson-1` commence 0,2 s après `ecusson-0` ; `ligne-2` est invisible à `t = 2.9` et visible à `t = 3.8`.
- [ ] **Step 2 : lancer** → échec. **Step 3 : implémenter.** **Step 4 : lancer** → `Tout passe.`
- [ ] **Step 5 : commit** `feat(joueur-semaine): la timeline de la vidéo`.

### Task 7: la page admin et l'encodage dans le navigateur

**Files:**
- Modify: `package.json` (`"mediabunny": "1.61.0"`, version exacte)
- Create: `src/lib/video-joueur-semaine-client.ts`
- Create: `src/app/(admin)/admin/joueur-semaine/page.tsx`
- Modify: `src/components/layout/AdminSidebar.tsx` (groupe « Communication » : `{ href: "/admin/joueur-semaine", label: "Joueur de la semaine", Icone: Award }`)

**Interfaces:**
- Consumes: routes (Tâche 5), `etatDuCalque`, `FPS`, `DUREE` (Tâche 6).
- Produces:

```ts
export async function videoPossible(): Promise<boolean>; // VideoEncoder.isConfigSupported avc 1080×1920
export async function fabriquerLaVideo(calques: CalqueVideo[], onProgres: (part: number) => void): Promise<Blob>; // video/mp4
```

`fabriquerLaVideo` : charge chaque calque en `ImageBitmap`, puis pour n de 0 à FPS·DUREE−1 : t = n / FPS, dessine sur un `OffscreenCanvas` 1080×1920 (fond, puis chaque calque transformé : décalage, `globalAlpha`, dévoilement par `drawImage` de la bande basse, zoom centré pour la photo), puis l'ajoute à la piste mediabunny (`Output` + `Mp4OutputFormat` + `BufferTarget` + `CanvasSource` codec `avc`) avec l'horodatage t. **Jamais `requestAnimationFrame`.** Lire les types de mediabunny dans `node_modules/mediabunny` avant d'écrire.

La page (kit `components/admin/ui`, appels avec `firebaseUser.getIdToken()` comme /admin/partenaires) :
1. sélecteur de semaine (précédente / suivante, « Semaine 42 · 12–18 oct. ») ;
2. compétitions de la semaine en cases à cocher (« Matchs amicaux » groupés) ;
3. les 30 premiers (+ recherche par nom) : nom, équipes, matchs, buts, passes, note, homme du match, photo oui/non ; un clic choisit ; le premier est choisi par défaut ;
4. sous la liste : « N joueurs au dossard écartés » et leurs chiffres ;
5. réglages de l'affiche : nom (prérempli en capitales), photo (fichier → réduit à 1200 px JPEG dans le navigateur), partenaires du jour (cochés, deux au plus) ;
6. aperçu (PNG de la route `/affiche`, format vertical) ;
7. la case « J'ai l'accord du joueur, ou de ses parents s'il est mineur, pour publier son image » ; puis « Télécharger la publication », « Télécharger le vertical », « Générer la vidéo » (barre de progression), tous désactivés sans la case ; la vidéo désactivée avec un message quand `videoPossible()` est faux.

- [ ] **Step 1 : `npm install mediabunny@1.61.0 --save-exact`** ; lire ses `.d.ts` (`Output`, `Mp4OutputFormat`, `BufferTarget`, `CanvasSource`).
- [ ] **Step 2 : implémenter** `video-joueur-semaine-client.ts`, la page et l'entrée de la barre latérale.
- [ ] **Step 3 : `npx tsc --noEmit -p .` et `npx eslint` sur les fichiers touchés** → propres.
- [ ] **Step 4 : commit** `feat(joueur-semaine): la page d'administration et la vidéo`.

### Task 8: vérification de bout en bout et ménage

- [ ] **Step 1 : lancer le serveur de dev** (`preview_start koppafoot-dev`), ouvrir `/admin/joueur-semaine` connecté en superadmin, semaine du 12 octobre : Dékawowo décochée → AMEGAN premier ; aucun « N°… » dans la liste.
- [ ] **Step 2 : télécharger la publication et le vertical** ; les ouvrir : conformes aux rendus de la Tâche 4.
- [ ] **Step 3 : générer la vidéo** si le navigateur le permet (sinon vérifier le message), et lire le MP4 obtenu (`ffprobe` : 1080×1920, 30 i/s, 10 s, h264).
- [ ] **Step 4 : partenaires** : dans /admin/partenaires, l'emplacement « Affiche « Joueur de la semaine » » existe. Ne créer aucun partenariat en prod pour tester : la sélection est couverte par les tests.
- [ ] **Step 5 : relancer tous les scripts de test**, `tsc`, `eslint` ; supprimer `scripts/maquettes-joueur-semaine.tsx`.
- [ ] **Step 6 : commit** si quelque chose a changé ; ne pas pousser sans demande.
