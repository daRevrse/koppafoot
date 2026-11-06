# Gérer son équipe, lot 1 : l'effectif du club — plan

> **Pour les agents :** exécuter avec superpowers:executing-plans (pas de sous-agents dans cette session). Étapes en
> cases à cocher.

**Objectif :** l'onglet Évolution d'un manager devient « Mon club » : effectif (titulaires, dossards, retirer un
membre, joueurs sans compte), candidatures, invitations, et la création du club quand il n'en a pas.

**Architecture :** l'application lit et écrit Firestore directement (mêmes règles que le site), et passe par les
routes du site pour créer une équipe, chercher un joueur et notifier. Les mappeurs du site sortent de
`lib/firestore.ts` dans un module sans SDK que les deux partagent. Chaque écriture est éprouvée contre les
émulateurs Firebase, règles réelles appliquées.

**Pile :** Expo SDK 57, Expo Router, firebase JS 12, jest-expo ; Next 16 côté routes.

**Conception :** `docs/plans/2026-11-06-app-mobile-gerer-son-equipe-design.md` (section « Lot 1 »).

## Contraintes globales

- Toute surface de gestion s'ouvre selon `peutGererEquipe(team, uid)` de `src/lib/team-access.ts`.
- Champs Firestore exacts : `squad_numbers`, `lineup_ids`, `member_ids`, `staff`, `staff_manager_ids`,
  `teams/{id}/ghost_players/{gid}` (`first_name`, `last_name`, `position`, `squad_number`, `goals`, `assists`,
  `matches_played`, `created_at`, `updated_at` en chaînes ISO), `join_requests` (`status` `accepted`/`rejected`),
  `invitations` (`status: "pending"`), `notifications` (types autorisés par les règles : `invitation`,
  `join_request`).
- Un dossard : chiffres seuls, trois au plus.
- Postes d'un joueur sans compte : `goalkeeper`, `defender`, `midfielder`, `forward`.
- Styles : `creerStyles((couleurs) => ({…}))` + `useStyles()`, `useCouleurs()` ; écrans à champs dans
  `DefilementClavier`.
- Rien du branchement sur les émulateurs ne part dans `mobile/src/lib/firebase.ts` commité : c'est un correctif.
- Le site garde ses imports : `lib/firestore.ts` réexporte ce qui sort de lui.

## Points à surveiller

- **Un délégué retire un membre du staff.** Les règles interdisent au délégué de toucher au staff : le retrait doit
  réussir et le staff rester tel quel (le site fait deux écritures pour ça). Test : Task 3.
- **Deux appareils modifient les dossards.** L'enregistrement écrit le brouillon entier : le dernier gagne, comme sur
  le site. Le brouillon se recale sur l'équipe quand elle change et qu'on n'a rien en cours. Test : Task 4.
- **Un membre accepté que la route publique ne connaît pas encore.** Son nom vient de la candidature, à défaut
  « Joueur ». Jamais d'identifiant brut à l'écran. Test : Task 4.
- **Le plafond de l'offre gratuite à la création.** La route répond 403 ou 402 avec un message : il s'affiche tel
  quel. Test : Task 3.
- **Un compte qui ne gère pas le club.** Aucun bouton de gestion, et les règles refusent l'écriture. Test : Tâches 3
  et 6.

---

### Task 1 : les mappeurs d'équipe partagés

**Fichiers :**
- Créer : `src/lib/equipe-mappers.ts`
- Modifier : `src/lib/firestore.ts` (retirer `formatDate`, `toGhostPlayer`, `toTeam`, `toInvitation`,
  `toJoinRequest`, `toCompositionsTypes` ; les importer, réexporter les trois qui l'étaient)
- Test : `mobile/src/__tests__/equipe-mappers.test.ts`

**Interfaces :**
- Produit : `formatDate(date: unknown): string`, `toTeam(id, d: FirestoreTeam): Team`,
  `toGhostPlayer(id, teamId, d: FirestoreGhostPlayer): GhostPlayer`, `toInvitation(id, d): Invitation`,
  `toJoinRequest(id, d): JoinRequest`, `toCompositionsTypes(d)`.

- [ ] **Étape 1 : test** — `toTeam` lit `member_ids`, `squad_numbers`, `lineup_ids`, `staff_manager_ids` (absents
  → `[]`/`{}`) ; `toGhostPlayer` rend `squadNumber: undefined` pour `squad_number: null` ; `toJoinRequest` garde
  `status`.
- [ ] **Étape 2 : lancer** `npx jest src/__tests__/equipe-mappers.test.ts` (dans `mobile/`) → échec, module absent.
- [ ] **Étape 3 : déplacer** les six fonctions telles quelles, sans en changer le corps.
- [ ] **Étape 4 : lancer** le test, puis `npx tsc --noEmit -p tsconfig.json` à la racine → 0 erreur.
- [ ] **Étape 5 : commit** `refactor(equipes): les mappeurs d'équipe sortent de lib/firestore`.

### Task 2 : le banc d'essai des émulateurs

**Fichiers :**
- Créer : `mobile/outils/emulateurs/firebase.json` (auth 9099, firestore 8080, règles `../../../firestore.rules`),
  `mobile/outils/emulateurs/firebase-emulateurs.patch` (branche `mobile/src/lib/firebase.ts` sur
  `EXPO_PUBLIC_EMULATEURS=1`), `mobile/outils/emulateurs/LISEZMOI.md`
- Créer : `mobile/src/test-aides/emulateur.ts`
- Test : `mobile/src/__tests__/equipe-regles.test.ts`

**Interfaces :**
- Produit (`test-aides/emulateur.ts`, projet `demo-koppafoot`) : `const EMULATEUR: boolean` (vrai si
  `FIRESTORE_EMULATOR_HOST` est défini) ; `viderLaBase(): Promise<void>` ;
  `ecrireEnAdmin(chemin: string, data: Record<string, unknown>): Promise<void>` (REST, `Authorization: Bearer
  owner`) ; `connecterEnTantQue(uid: string): Promise<{ db: Firestore; auth: Auth }>` (une app Firebase par compte,
  jeton du simulateur d'Auth).
- Les suites qui s'en servent sont ignorées sans émulateur (`(EMULATEUR ? describe : describe.skip)`).

- [ ] **Étape 1 : test** — avec une équipe `t1` (`manager_id: "m"`, `staff_manager_ids: ["d"]`) : `m` met à jour
  `squad_numbers` → permis ; `x` (inconnu) → refusé ; `d` met à jour `staff` → refusé ; `d` met à jour
  `squad_numbers` → permis.
- [ ] **Étape 2 : lancer** sans émulateur → suite ignorée ; puis
  `firebase emulators:start --only auth,firestore --project demo-koppafoot --config mobile/outils/emulateurs/firebase.json`
  et `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npx jest src/__tests__/equipe-regles.test.ts`
  → échec, aides absentes.
- [ ] **Étape 3 : écrire** les aides et le correctif (le correctif s'applique par `git apply`, se retire par
  `git apply -R`).
- [ ] **Étape 4 : relancer** → 4 cas au vert ; sans émulateur → ignorée, suite complète au vert.
- [ ] **Étape 5 : commit** `test(app): un banc d'essai sur les émulateurs Firebase`.

### Task 3 : lire et écrire l'équipe

**Fichiers :**
- Créer : `mobile/src/lib/equipe-firestore.ts`, `mobile/src/lib/equipe-api.ts`
- Test : `mobile/src/__tests__/equipe-firestore.test.ts` (contre l'émulateur), `mobile/src/__tests__/equipe-api.test.ts`

**Interfaces :**
- Consomme : Tasks 1 et 2.
- Produit (`equipe-firestore.ts`) :
  - `equipesQueJeGere(uid: string): Promise<Team[]>` (propriétaire + `staff_manager_ids`, sans équipe fantôme)
  - `ecouterEquipe(teamId, cb: (t: Team | null) => void): Unsubscribe`
  - `ecouterFantomes(teamId, cb: (g: GhostPlayer[]) => void): Unsubscribe`
  - `ecouterCandidatures(teamId, managerId, cb: (d: JoinRequest[]) => void): Unsubscribe`
  - `ecouterInvitationsEnvoyees(uid, cb: (i: Invitation[]) => void): Unsubscribe`
  - `enregistrerEffectif(teamId, b: Brouillon): Promise<void>` (une écriture : `squad_numbers`, `lineup_ids`)
  - `retirerMembre(team: Team, uid: string, appelant: string): Promise<void>` (le staff n'est nettoyé que si
    l'appelant est le propriétaire)
  - `creerFantome(teamId, f: ChampsFantome): Promise<string>`, `modifierFantome(teamId, gid, f: ChampsFantome)`,
    `supprimerFantome(teamId, gid)`
  - `repondreCandidature(d: JoinRequest, acceptee: boolean): Promise<void>`
  - `inviterJoueur(e: { team: Team; expediteur: { uid: string; nom: string }; joueur: JoueurTrouve; message: string }): Promise<string>`
  - `annulerInvitation(id: string): Promise<void>`
  - `type ChampsFantome = { prenom: string; nom: string; poste: "goalkeeper" | "defender" | "midfielder" | "forward"; dossard: string }`
  - `type Brouillon = { dossards: Record<string, string>; titulaires: string[] }`
- Produit (`equipe-api.ts`, jeton du compte) :
  - `creerEquipe(u: User, c: ChampsEquipe): Promise<string>` (`POST /api/teams` ; lève avec le message de la route)
  - `chercherJoueurs(u: User, f: { texte?: string; ville?: string }): Promise<JoueurTrouve[]>`
    (`GET /api/membres/recherche?role=joueur`)
  - `notifierActiviteEquipe(u: User, e: { teamId: string; event: "member_joined" | "member_left"; playerId: string }): void`
  - `notifierCompte(u: User, n: { userId: string; type: "invitation" | "join_request"; title: string; body: string; link: string }): Promise<void>`
    (document `notifications` signé `from_uid`, puis `POST /api/notifications/push { notificationId }`, sans lever)
  - `type ChampsEquipe = { name; city; level; category: Categorie | null; color; description }`
  - `type JoueurTrouve` = ce que rend la route (`uid`, nom, photo, ville, poste, niveau).

- [ ] **Étape 1 : tests émulateur** — le manager enregistre dossards et titulaires d'un coup ; retire un membre (et du
  staff) ; un délégué retire un membre du staff : `member_ids` change, `staff` non, sans erreur ; accepter une
  candidature ajoute le joueur et passe la demande à `accepted` ; refuser la passe à `rejected` sans toucher
  l'équipe ; créer, modifier, supprimer un joueur sans compte ; inviter crée un document `pending` lisible par le
  joueur ; un inconnu ne peut rien de tout ça.
- [ ] **Étape 2 : tests API** (fetch simulé) — `creerEquipe` rend l'identifiant ; sur 403/402, lève avec `error` de
  la route ; `chercherJoueurs` passe `role=joueur`, `texte`, `ville` et le jeton.
- [ ] **Étape 3 : lancer** → échecs, modules absents.
- [ ] **Étape 4 : écrire** les deux modules, en reprenant la logique de `lib/firestore.ts` (sauf l'invitation en
  double, voir la conception).
- [ ] **Étape 5 : relancer** avec et sans émulateur → au vert.
- [ ] **Étape 6 : commit** `feat(app): lire et écrire l'effectif d'un club`.

### Task 4 : la logique de l'écran, sans écran

**Fichiers :**
- Créer : `mobile/src/lib/mon-club.ts`
- Test : `mobile/src/__tests__/mon-club.test.ts`

**Interfaces :**
- Consomme : `Team`, `GhostPlayer`, `JoinRequest`, `Invitation` ; `Brouillon`, `ChampsFantome` (Task 3).
- Produit :
  - `type IdentiteMembre = { nom: string; photo: string | null; poste: Poste | null }`
  - `type LigneEffectif = { genre: "compte" | "fantome"; id: string; nom: string; photo: string | null; poste: Poste | null; dossard: string; titulaire: boolean; manager: boolean }`
  - `lignesParPoste(team, identites: Map<string, IdentiteMembre>, fantomes, b: Brouillon, nomsDeSecours: Map<string, string>): { poste: Poste | null; titre: string; lignes: LigneEffectif[] }[]`
    (manager en tête, puis Gardiens, Défenseurs, Milieux, Attaquants, Sans poste ; groupes vides absents)
  - `brouillonDe(team): Brouillon`, `aDesChangements(team, b): boolean`, `nettoyerDossard(v: string): string`,
    `basculerTitulaire(b, uid): Brouillon`
  - `candidaturesParEtat(d: JoinRequest[]): { enAttente: JoinRequest[]; passees: JoinRequest[] }`
  - `invitationsEnAttente(i: Invitation[], teamId: string): Invitation[]`
  - `erreursFantome(f: ChampsFantome): Partial<Record<keyof ChampsFantome, string>>` (prénom et nom requis, 40
    caractères au plus)
  - `erreursEquipe(c: ChampsEquipe): Partial<Record<keyof ChampsEquipe, string>>` (nom et ville requis, 80 au plus)

- [ ] **Étape 1 : tests** — `nettoyerDossard("1a23x4")` → `"123"` ; un membre sans identité prend le nom de secours,
  sinon « Joueur » ; un membre sans poste va dans « Sans poste » ; `aDesChangements` faux sur le brouillon initial,
  vrai après `basculerTitulaire`, faux s'il est rebasculé ; candidatures en attente les plus récentes d'abord.
- [ ] **Étape 2 : lancer** → échec. **Étape 3 : écrire.** **Étape 4 : relancer** → au vert.
- [ ] **Étape 5 : commit** `feat(app): la logique de l'écran Mon club`.

### Task 5 : l'écran Mon club, onglet Effectif

**Fichiers :**
- Créer : `mobile/src/hooks/useMonClub.ts`, `mobile/src/components/mon-club/EcranMonClub.tsx`,
  `mobile/src/components/mon-club/OngletEffectif.tsx`
- Modifier : `mobile/src/app/(tabs)/evolution.tsx` (`MonClub` → `EcranMonClub` ; sans club : « Créer mon équipe »
  ouvre `/creer-equipe`)

**Interfaces :**
- Consomme : Tasks 3 et 4, `useFicheDuClub` (identités des membres par la route publique).
- Produit : `useMonClub(uid: string): { equipes: Team[] | null; equipe: Team | null; choisir(id: string): void; fantomes: GhostPlayer[]; candidatures: JoinRequest[]; invitations: Invitation[]; identites: Map<string, IdentiteMembre>; peutGerer: boolean; proprietaire: boolean }`.

- [ ] **Étape 1 : écrire** le crochet et l'écran : en-tête du club, pastilles s'il y a plusieurs clubs, onglets
  Effectif / Candidatures (nombre en attente) / Invitations, lien « Voir la fiche du club ».
- [ ] **Étape 2 : onglet Effectif** — groupes de `lignesParPoste` ; dossard en champ numérique, titulaire en bascule,
  « Retirer » (membre, confirmation `Alert`) et « Modifier » (joueur sans compte → `/joueur-sans-compte`) ; barre
  « Enregistrer » visible seulement si `aDesChangements` ; « Ajouter un joueur sans compte ». Sans `peutGerer`, rien
  de tout ça.
- [ ] **Étape 3 : vérifier** `npx tsc --noEmit` et `npx jest` au vert.
- [ ] **Étape 4 : commit** `feat(app): l'onglet Évolution d'un manager gère son effectif`.

### Task 6 : joueur sans compte, candidatures, invitations, création

**Fichiers :**
- Créer : `mobile/src/app/joueur-sans-compte.tsx` (paramètres `teamId`, `ghostId?`),
  `mobile/src/app/inviter-joueur.tsx` (paramètre `teamId`), `mobile/src/app/creer-equipe.tsx`,
  `mobile/src/components/mon-club/OngletCandidatures.tsx`, `mobile/src/components/mon-club/OngletInvitations.tsx`
- Modifier : `mobile/src/app/_layout.tsx` (les trois écrans en fenêtre, sous la garde « connecté avec profil »)

- [ ] **Étape 1 : joueur sans compte** — prénom, nom, poste (quatre pastilles), dossard ; Enregistrer ; Supprimer en
  modification (confirmation). Erreurs de `erreursFantome`.
- [ ] **Étape 2 : candidatures** — en attente : photo, nom, poste, ville, niveau, message, Accepter / Refuser ; les
  réponses passées repliées.
- [ ] **Étape 3 : invitations** — en attente, chacune annulable ; « Inviter un joueur » → recherche (texte, ville),
  résultats, message prérempli « {manager} t'invite à rejoindre {équipe}. », Envoyer.
- [ ] **Étape 4 : créer mon équipe** — nom, ville, niveau, catégorie, couleur, description ; Créer ; l'erreur de la
  route affichée telle quelle ; au succès, retour à l'onglet, qui montre le club.
- [ ] **Étape 5 : vérifier** types, lint, `npx jest` au vert.
- [ ] **Étape 6 : commit** `feat(app): candidatures, invitations, joueurs sans compte et création du club`.

### Task 7 : la vérification de bout en bout

- [ ] **Étape 1 :** émulateurs lancés ; le site en local branché dessus (`.env.development.local` jetable, projet
  `demo-koppafoot`) ; graines : un manager, un délégué, deux membres, un candidat, un joueur à inviter, un club.
- [ ] **Étape 2 :** l'appli en version web branchée sur les émulateurs (correctif appliqué, `EXPO_PUBLIC_API_URL` du
  site local) ; dérouler : dossard + titulaire enregistrés, membre retiré, joueur sans compte créé puis supprimé,
  candidature acceptée, invitation envoyée puis annulée, club créé ; chaque résultat relu dans la base.
- [ ] **Étape 3 :** captures à la largeur d'un téléphone, clair et sombre.
- [ ] **Étape 4 :** correctif retiré, `git status` propre ; suite complète, types et lint au vert ; PR.
