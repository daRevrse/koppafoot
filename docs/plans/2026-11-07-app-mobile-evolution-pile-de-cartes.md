# Écran Évolution en pile de cartes — plan d'exécution

> **Pour l'agent qui exécute :** SOUS-COMPÉTENCE REQUISE : superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans, tâche par tâche. Les étapes se cochent (`- [ ]`).

**But :** remplacer la liste de trois cartes de l'onglet Évolution (compte sans rôle) par une pile de cartes qu'on
feuillette, une affiche et un univers de couleurs par rôle, la carte se retournant pour le formulaire d'activation.

**Architecture :** une logique pure (`lib/pile-des-roles.ts` : ordre cyclique, glissé, couleurs, rôle retenu) testée sans
écran ; un dos de carte (`DosDeLaCarte`) qui reprend tel quel le formulaire et l'activation d'aujourd'hui ; une carte
qui se retourne (`CarteDuRole`) ; et `ChoixDuRole`, réécrit, qui tient la pile. Animations avec `Animated` et
`PanResponder` de React Native, rien d'autre.

**Technologies :** Expo SDK 58, React Native 0.88, Expo Router, `expo-image`, Jest 30 + `react-test-renderer` 19.3.

**Spec :** la section « Conception approuvée » ci-dessous (validée dans la conversation du 2026-11-07, sur le croquis de
l'utilisateur et la maquette « C · Une pile de cartes »).

## Conception approuvée

- En haut, le titre de l'onglet et la question **« Quel rôle veux-tu jouer ? »**.
- Au centre, la **pile** : la carte du rôle en cours devant, les rôles voisins qui dépassent à gauche et à droite, en
  retrait. On change de rôle en **faisant glisser** la carte ou avec les **flèches** ; la suivante vient devant avec un
  petit mouvement de paquet qu'on feuillette. Des **points** sous la pile disent où on en est.
- Chaque carte porte la **vraie affiche** du rôle (celles du site : `public/branding/role_joueur.png`,
  `role_manager.png`, `role_arbitre.png`). La **couleur du rôle** encadre sa carte, colore l'accroche, les points et le
  bouton : c'est « l'expérience visuelle différente » de chaque rôle.
- Sous la carte : l'**accroche** du rôle (celle du site), son **nom**, une ligne sur ce qu'on y fait, puis un seul
  bouton **« Devenir joueur »** qui suit le rôle affiché.
- Toucher « Devenir … » **retourne la carte** : au dos, les champs et l'activation d'aujourd'hui (genre ; poste et pied
  pour un joueur ; licence pour un arbitre ; équipe pour un manager, qui crée l'équipe ; ville), et un lien **« Retour »**.
- Les rôles de la pile : **joueur, manager, arbitre** (`ROLES` de `lib/roles.ts`, dans cet ordre).
- **Sans compte**, on feuillette ; « Devenir … » mène à la connexion, et **au retour la pile s'ouvre sur le rôle choisi**.
- L'écran ne sert qu'à un compte **sans rôle** ; ensuite l'onglet montre ce qu'il montre aujourd'hui.
- Choix de l'assistant, acceptés : animations sans nouveau module ; affiches **embarquées et compressées** ; couleurs
  **fixes dans les deux thèmes** ; **mouvement réduit** respecté ; travail par-dessus la branche du SDK 58.

## Contraintes globales

- **Branche :** partir de `claude/app-equipe-a-l-activation` (SDK 58 + création de l'équipe à l'activation) si elle
  n'est pas fusionnée ; sinon d'`origin/master` à jour. Nom : `claude/app-evolution-pile`. Copie de travail
  `C:\football-network\koppafoot-app-compte` (son `mobile/node_modules` est réel, pas une jonction).
- **Aucun nouveau paquet** (ni `react-native-reanimated`, ni `react-native-gesture-handler`) : l'appli doit s'ouvrir
  dans Expo Go SDK 58 sans build.
- Textes en français, tutoiement. Question : `Quel rôle veux-tu jouer ?`. Accroches (page `/roles` du site) :
  joueur `Tu joues, on tient le compte`, manager `Tu tiens l'effectif`, arbitre `Tu tiens le sifflet`. Ligne
  descriptive : `phrase` de `ROLES`. Bouton : `Devenir ` + le titre accordé au genre (`accorder`, masculin sans genre).
- **Couleurs des rôles** (identiques dans les deux thèmes) :

  | Rôle | `carte` | `profond` | `accentSombre` | `accentClair` | `bouton` |
  |---|---|---|---|---|---|
  | player | `#27500A` | `#173404` | `#C0DD97` | `#3B6D11` | `#3B6D11` |
  | manager | `#0C447C` | `#042C53` | `#B5D4F4` | `#185FA5` | `#185FA5` |
  | referee | `#444441` | `#2C2C2A` | `#FAC775` | `#854F0B` | `#2C2C2A` |

  `accentSombre` sert sur le thème sombre, `accentClair` sur le clair (accroche, points) ; texte du bouton `#FFFFFF`.
- **Affiches :** `mobile/assets/roles/{joueur,manager,arbitre}.jpg`, recadrées au centre en portrait 3:4, 720×960,
  JPEG, **150 000 octets au plus** chacune.
- **Mouvement réduit** (`useMouvementReduit()` de `~/hooks/useMouvementReduit`) : ni glissé animé ni retournement
  animé, l'état change d'un coup.
- **Activation inchangée :** `patchDActivation`, `equipeDeLActivation` (lib/roles), `activerLeRole`, puis
  `creerEquipe` pour un manager AVANT `rafraichirProfil` ; ville exigée quand un manager nomme son équipe.
- Styles par `creerStyles` / `useCouleurs` ; état d'accessibilité par props `aria-*` (React Native Web ignore
  `accessibilityState`) ; une nouvelle route typée exige de régénérer `.expo/types/router.d.ts` (aucune ici).
- Vérifier dans le volet navigateur : il reste masqué, `requestAnimationFrame` ne tourne pas, les animations ne
  s'achèvent pas ; remplir par `form_input`, toucher par `element.click()` (voir la mémoire « Vérifier dans le
  navigateur »). La vraie sensation se juge sur l'iPhone de l'utilisateur, dans Expo Go.

## Points à surveiller à la relecture

1. **Glissé vertical** sur un petit écran : faire défiler ne doit jamais changer de rôle → `estUnGlisseHorizontal`
   (tâche 2) et le `PanResponder` qui ne prend la main que sur un geste horizontal (tâche 4).
2. **Clavier sur « Ta ville »** au dos de la carte (Android bord à bord) : le champ doit rester visible → le dos défile
   dans un `DefilementClavier` (tâche 3) ; à voir sur téléphone.
3. **Toucher deux fois « Activer »** ou enchaîner les flèches pendant une animation : une seule activation, aucun saut
   de deux rôles → test « une seule activation » (tâche 3) et flèches ignorées pendant l'animation (tâche 4).
4. **Mouvement réduit** : la carte change sans animation → test avec `useMouvementReduit` simulé à `true` (tâche 4).
5. **Lisibilité en thème clair** des accroches et des points → test de contraste (tâche 2).

---

### Task 1 : les affiches embarquées

**Fichiers :**
- Créer : `scripts/generer-affiches-roles-mobile.mjs`, `mobile/assets/roles/joueur.jpg`, `manager.jpg`, `arbitre.jpg`,
  `mobile/src/components/evolution/affiches.ts`
- Test : `mobile/src/__tests__/affiches-roles.test.ts`

**Interfaces :**
- Produit : `AFFICHES: Record<EvolutionRole, number>` (les `require` des trois JPEG), dans `affiches.ts`.

- [ ] **Étape 1 : test** — `affiches-roles.test.ts` : pour `joueur`, `manager`, `arbitre`, le fichier
  `mobile/assets/roles/<nom>.jpg` existe et `fs.statSync(...).size <= 150_000` ; `AFFICHES` a une entrée pour chacun des
  rôles de `ROLES`.
- [ ] **Étape 2 : lancer** `cd mobile && npx jest affiches-roles` → échec (fichiers absents).
- [ ] **Étape 3 : écrire le script** (sharp 0.34, présent dans le `node_modules` de la racine) : lit
  `public/branding/role_<nom>.png` (1024×1024), recadre au centre en 768×1024, réduit à 720×960, écrit en JPEG
  `quality: 72, mozjpeg: true` ; puis le lancer depuis la racine (`node scripts/generer-affiches-roles-mobile.mjs`) et
  écrire `affiches.ts` (`player` → `joueur.jpg`, `manager` → `manager.jpg`, `referee` → `arbitre.jpg`). Si une image
  dépasse 150 000 octets, baisser `quality` jusqu'à 60, pas au-delà.
- [ ] **Étape 4 : relancer** → au vert ; noter les tailles obtenues dans le message de commit.
- [ ] **Étape 5 : commit** `feat(app): les affiches des rôles embarquées dans l'appli`.

### Task 2 : la logique de la pile, sans écran

**Fichiers :**
- Créer : `mobile/src/lib/pile-des-roles.ts`
- Test : `mobile/src/__tests__/pile-des-roles.test.ts`

**Interfaces :**
- Consomme : `ROLES` (lib/roles), `contraste` (`@/lib/couleurs-equipe`), `palettes` (`~/theme`).
- Produit :
  - `type CouleursDuRole = { carte: string; profond: string; accentSombre: string; accentClair: string; bouton: string }`
  - `PRESENTATION: Record<EvolutionRole, { accroche: string; couleurs: CouleursDuRole }>` (valeurs des contraintes)
  - `voisins(index: number, n: number): { precedent: number; suivant: number }` (cyclique)
  - `estUnGlisseHorizontal(dx: number, dy: number): boolean` (vrai si `|dx| > 8` et `|dx| > |dy|`)
  - `apresGlisse(index: number, dx: number, n: number, seuil = 40): number` (`dx < -seuil` → suivant, `dx > seuil` →
    précédent, sinon le même)
  - `retenirLeRoleVise(role: EvolutionRole): void`, `prendreLeRoleVise(): EvolutionRole | null` (rend puis oublie)
  - `indexInitial(role: EvolutionRole | null): number` (position du rôle dans `ROLES`, 0 sinon)

- [ ] **Étape 1 : tests** — `voisins(0, 3)` → `{ precedent: 2, suivant: 1 }`, `voisins(2, 3)` → `{ precedent: 1,
  suivant: 0 }` ; `apresGlisse(0, -60, 3)` → 1, `apresGlisse(0, 60, 3)` → 2, `apresGlisse(1, 30, 3)` → 1 ;
  `estUnGlisseHorizontal(40, 10)` vrai, `(10, 40)` faux, `(6, 0)` faux ; `retenirLeRoleVise("manager")` puis
  `prendreLeRoleVise()` → `"manager"`, puis de nouveau → `null` ; `indexInitial("referee")` → 2, `indexInitial(null)` → 0 ;
  pour chaque rôle de `ROLES` : une présentation existe, son accroche est celle des contraintes,
  `contraste(accentClair, palettes.clair.fond) >= 4.5`, `contraste(accentSombre, palettes.sombre.fond) >= 4.5`,
  `contraste("#FFFFFF", bouton) >= 4.5`.
- [ ] **Étape 2 : lancer** `npx jest pile-des-roles` → échec (module absent).
- [ ] **Étape 3 : écrire** `pile-des-roles.ts` (le rôle visé vit dans une variable du module : il doit survivre au
  démontage des onglets pendant la création du profil).
- [ ] **Étape 4 : relancer** → au vert.
- [ ] **Étape 5 : commit** `feat(app): la logique de la pile des rôles`.

### Task 3 : le dos de la carte et la carte qui se retourne

**Fichiers :**
- Créer : `mobile/src/components/evolution/DosDeLaCarte.tsx`, `mobile/src/components/evolution/CarteDuRole.tsx`
- Modifier : `mobile/src/components/evolution/ChoixDuRole.tsx` (le formulaire et `activer` / `creerLEquipeNommee` en
  sortent vers `DosDeLaCarte`, sans changement de comportement)
- Test : `mobile/src/__tests__/dos-de-la-carte.test.tsx` (reprend les 5 cas de `choix-du-role.test.tsx`)

**Interfaces :**
- Consomme : `AFFICHES` (tâche 1), `PRESENTATION` (tâche 2).
- Produit :
  - `DosDeLaCarte({ role, onRetour }: { role: EvolutionRole; onRetour: () => void })` : titre `formulaire` du rôle,
    « Tout se modifie plus tard dans ton profil. », les champs du rôle, le bouton « Activer mon espace … », le lien
    « Retour » ; défile dans un `DefilementClavier`.
  - `CarteDuRole({ role, retournee, mouvementReduit, dos }: { role: EvolutionRole; retournee: boolean;
    mouvementReduit: boolean; dos: ReactNode })` : face = l'affiche (`expo-image`, `contentFit="cover"`) sur fond
    `couleurs.carte`, cadre de 2 px `accentSombre`, coins 12 ; dos = `dos`. Retournement par `rotateY` (0 → 180°,
    450 ms), `backfaceVisibility: "hidden"` ; la face cachée est retirée de l'accessibilité
    (`accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`). Libellé de la face :
    `Affiche du rôle ` + `titre[0]` en minuscules (`joueur`, `manager`, `arbitre` : le rôle, pas la personne).

- [ ] **Étape 1 : tests** — `dos-de-la-carte.test.tsx` rend `DosDeLaCarte` avec `role="manager"` (mêmes simulations que
  `choix-du-role.test.tsx` : `activerLeRole`, `creerEquipe`, `equipesQueJeGere`, `prevenir`, `useAuth`) et vérifie les
  5 cas existants : équipe créée après l'activation et avant la relecture (ordre `activer`, `creer`, `rafraichir`) ;
  rien sans nom ; pas de doublon ; ville exigée avant d'activer (« Ta ville est nécessaire pour créer ton équipe. ») ;
  rôle gardé et `prevenir("Ton rôle est activé, pas ton équipe", …)` si la création échoue. Plus : **toucher deux fois
  « Activer »** → `activerLeRole` appelé une fois ; toucher « Retour » appelle `onRetour`. Et une `CarteDuRole` rendue
  avec `retournee: true` cache la face à l'accessibilité.
- [ ] **Étape 2 : lancer** → échec (composants absents).
- [ ] **Étape 3 : écrire** les deux composants ; `ChoixDuRole` utilise provisoirement `DosDeLaCarte` à la place de son
  formulaire (la pile arrive à la tâche 4), pour que l'appli marche à chaque commit.
- [ ] **Étape 4 : relancer** `npx jest dos-de-la-carte choix-du-role` → au vert ; adapter `choix-du-role.test.tsx` si
  l'écran provisoire a changé ses libellés, sans rien retirer de ses assertions.
- [ ] **Étape 5 : commit** `feat(app): la carte du rôle se retourne sur son formulaire`.

### Task 4 : la pile

**Fichiers :**
- Modifier : `mobile/src/components/evolution/ChoixDuRole.tsx` (réécrit),
  `mobile/src/app/(tabs)/evolution.tsx` (plus de sous-titre « TON RÔLE SUR KOPPAFOOT », plus de `DefilementClavier`
  autour de `ChoixDuRole` : la pile tient l'écran, le dos défile seul)
- Test : `mobile/src/__tests__/choix-du-role.test.tsx` (réécrit pour la pile)

**Interfaces :**
- Consomme : tâches 1 à 3, `useMouvementReduit`, `retourSelection` (`~/lib/retour`), `accorder` / `nomDuRole`.
- Produit : `ChoixDuRole()` (même export, même place dans `evolution.tsx`).

Comportement : état `index` (initialisé par `indexInitial(prendreLeRoleVise())`) et `retournee`. Les cartes voisines
(`voisins`) dépassent à gauche et à droite (échelle 0,86, décalées de ±62 % de la largeur, opacité 0,55, derrière).
`PanResponder` actif seulement si `estUnGlisseHorizontal` et carte non retournée ; au relâché, `apresGlisse` ; la carte
suit le doigt puis sort (250 ms) et la suivante vient devant ; `retourSelection()` à chaque changement. Flèches
(`aria-label` « Rôle précédent » / « Rôle suivant ») ignorées pendant une animation. La pile est un élément
`accessibilityRole="adjustable"` avec les actions `increment` / `decrement`. Points : actif en `accentSombre` (sombre)
ou `accentClair` (clair). Sous la pile : accroche (texte noir 11, espacé, couleur d'accent du thème), nom
(`nomDuRole`, police titre 28), `phrase` (texte 14, secondaire), puis le bouton « Devenir … » (fond `bouton`, texte
`#FFFFFF`, carré, capitales espacées comme `Bouton`). Retournée, la carte s'agrandit sur la place de la description et
du bouton (qui s'effacent). Sans compte : « Devenir … » appelle `retenirLeRoleVise(role)` puis
`router.push({ pathname: "/connexion", params: { raison: "role" } })`.

- [ ] **Étape 1 : tests** — la carte de devant est `Affiche du rôle joueur` au départ ; « Rôle suivant » → celle du
  manager, « Rôle précédent » deux fois → celle de l'arbitre ; l'action d'accessibilité `increment` fait comme
  « Rôle suivant » ; « Devenir manager » (connecté) retourne la carte et montre « Activer mon espace manager »,
  « Retour » la remet à l'endroit ; sans compte, « Devenir manager » pousse `/connexion` avec `raison: "role"` et
  `prendreLeRoleVise()` rend `"manager"` ; une pile montée après `retenirLeRoleVise("referee")` s'ouvre sur l'arbitre ;
  avec `useMouvementReduit` simulé à `true`, « Rôle suivant » change la carte de devant tout de suite.
  Le parcours d'activation complet (choisir le manager, retourner, nommer l'équipe, activer) passe toujours :
  `activer`, `creer`, `rafraichir`, dans cet ordre.
- [ ] **Étape 2 : lancer** → échec.
- [ ] **Étape 3 : écrire** `ChoixDuRole` et retoucher `evolution.tsx`.
- [ ] **Étape 4 : relancer** `npx jest choix-du-role` → au vert ; puis `npx tsc --noEmit` et `npx eslint` sur les
  fichiers touchés.
- [ ] **Étape 5 : commit** `feat(app): l'onglet Évolution, une pile de cartes à feuilleter`.

### Task 5 : la vérification

- [ ] **Étape 1 :** `npx tsc --noEmit`, `npx jest` (toute la suite) et `npx expo lint` au vert depuis `mobile/`.
- [ ] **Étape 2 :** Expo web (configuration `compte-mobile-web` du `.claude/launch.json`), à 390 px, sans compte : la
  pile, les flèches, les trois affiches et leurs couleurs, en clair et en sombre ; captures. Le retournement connecté se
  voit sur les émulateurs Firebase (recette dans `mobile/outils/emulateurs/LISEZMOI.md`), jamais avec un compte de prod.
- [ ] **Étape 3 :** Metro pour l'iPhone de l'utilisateur dans l'onglet Terminal (mode Expo Go :
  `npx expo start --lan --port 8081 --go`, `REACT_NATIVE_PACKAGER_HOSTNAME` = l'adresse Wi-Fi du moment, `ipconfig`
  avant chaque QR) : le glissé, le retournement, le mouvement réduit se jugent là.
- [ ] **Étape 4 :** pousser et ouvrir la PR, empilée sur celle de la branche de base si elle n'est pas fusionnée ;
  ne pas fusionner sans demande explicite.
