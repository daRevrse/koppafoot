# Design : Le genre, et des premiers pas guidés

**Date :** 2026-09-29
**Statut :** Livré. **À déployer : `firestore.rules` AVANT le code** : l'activation d'un rôle écrit désormais `gender` dans la même écriture, et les règles actuelles la refuseraient en bloc.

## Le problème

1. **Tout le monde était un homme.** Aucun champ de genre : une gardienne était « Gardien », une joueuse élue « Homme du match », une organisatrice « Organisateur », une arbitre « convoqué ». Et aucune catégorie d'équipe ou de compétition : un manager d'équipe féminine ne pouvait pas chercher de joueuses au mercato.
2. **Les nouveaux inscrits se perdaient.** Un compte naît spectateur et atterrit sur le Direct. Le guide « Pour bien démarrer » n'apparaissait qu'après avoir choisi un rôle, ne couvrait que joueur, manager et arbitre, et rien n'invitait à choisir ce rôle. Six tutoriels PDF existaient dans `docs/`, sans un lien depuis l'application.

## Décisions

### Le genre (`lib/genre.ts`)
- `users.gender` : `"male"` ou `"female"`, rien d'autre (règle `genreValide`). **Requis pour un rôle ou une casquette**, facultatif pour un spectateur.
- Demandé : à l'activation d'un rôle (`/roles`), à l'inscription quand on arrive avec un rôle (`/signup?role=`), au profil (qu'un compte à rôle ne peut plus vider), et par une modale « Une précision » aux comptes à rôle existants, à leur prochaine visite (« Plus tard » vaut pour la session).
- Public : il sort dans la projection du profil et dans `/api/public/photos` (qui renvoie maintenant photo **et** genre, en une requête), puisque la fiche l'exprime de toute façon par ses accords. Visible dans la fiche admin d'un compte.
- `accorder(genre, masculin, féminin)` : le masculin quand on ne sait pas, comme la langue. `genreDuJoueur` : le genre de la personne, sinon celui d'une équipe féminine (ses joueuses sans compte).

### Les catégories
- `teams.category` et `competitions.category` : `men` / `women` / `mixed`. Choisies à la création et en modification (manager, organisateur) ; une équipe d'avant est traitée comme masculine par les filtres.
- Badge « Féminin » ou « Mixte » (jamais « Masculin », ce que tout le monde suppose) : fiche du club, équipe en compétition, page et carte d'une compétition. La recherche de l'annuaire trouve « féminin » / « women ».
- Mercato : filtre joueurs / joueuses côté manager (**préréglé sur « joueuses » quand toutes ses équipes sont féminines**), filtre de catégorie côté joueur, badge sur les cartes d'équipe.
- Inscription en compétition : un avertissement si la catégorie de l'équipe diffère — **jamais un refus**, l'organisateur reste juge.

### Les accords
Rôles (« Joueuse », « Organisatrice », « Scoreuse ») sur la fiche publique, le menu, le fil et les guides ; postes (« Gardienne », « Défenseure », « Attaquante ») au profil, au formulaire de rôle, au mercato, sur les fiches, dans l'effectif par poste d'une équipe féminine ; « Joueuse du match », « Meilleure joueuse du tournoi » (fiche du match, compétition, console, saisie du résultat, écran de l'organisateur) ; « 3 joueuses » ; « Joueuse 1 » face à un adversaire hors plateforme ; notifications et e-mails (« Tu es modératrice », « Tu es inscrite »). Là où le genre n'est pas lu (convocation envoyée à tout un effectif, annonces), une tournure sans accord : « Ton équipe te convoque », « Des équipes recrutent près de chez toi ».

### Des guides pour tous (`lib/onboarding.ts`, `useGuidesDeDemarrage`)
- Un guide par profil : **spectateur** (suivre une compétition, installer l'app, activer les notifications, et la porte des rôles en bas, qui n'est pas une étape), joueur, manager, arbitre, **organisateur** (créer, inscrire les équipes, programmer, ouvrir au public, couvrir un match), **propriétaire de terrain** (référencer, photos, horaires, répondre à une demande), **scoreur** (profil, corps arbitral, premier match).
- Sur le Direct, tous les profils du compte (en onglets s'il y en a plusieurs d'inachevés) ; dans chaque espace, le sien (`/teams`, `/organizer`, `/mes-terrains`, `/designations`, `/live-ops`). Dans les deux langues, et chacun renvoie à son tutoriel. Il disparaît de lui-même une fois tout fait.

### Le centre de tutoriels (`/aide/tutoriels`, `lib/tutoriels.ts`)
- Une fiche par profil : l'essentiel en quelques étapes numérotées, chacune avec le bouton vers l'écran dont elle parle, et le PDF complet à télécharger. Spectateur et installation dans les deux langues ; les fiches des rôles en français, comme les outils qu'elles décrivent (un avis le dit en anglais).
- Public (on le lit avant de s'inscrire), dans le sitemap, en tête de `/aide`, dans le menu du compte (« Tutoriels »), et un « Comment faire ? » sous les écrans vides (pas d'équipe, pas de compétition, pas de terrain, pas de désignation, pas de match).
- Les PDF restent dans `docs/tutoriel-*/` ; `scripts/tutoriels.mjs` les copie dans `public/tutoriels/` (ignoré par git) avant chaque `dev` et `build`, pour ne pas versionner deux fois 25 Mo qui finiraient par diverger.

### En passant
- `/mercato` : l'onglet se fixait avant l'arrivée du profil ; un manager qui ouvrait la page directement (lien de notification, rechargement) tombait sur une page vide. Il se déduit maintenant du rôle.

## Vérifications

- `tsc` (site et mobile) ; lint des fichiers touchés sans avertissement nouveau.
- `mobile/src/__tests__/genre.test.ts` et `guides.test.ts` : accords, genre d'une ligne d'effectif, compatibilité, genre requis, postes au féminin (et relus), effectif d'une équipe féminine, profils d'un compte, guides spectateur / organisateur / terrain, chaque guide mène à un tutoriel existant, liens internes, PDF présents dans `docs/`. 179 tests passent.
- Règles sur l'émulateur (SDK du navigateur) : « other » refusé, « female » et `null` acceptés, activation d'un rôle avec le genre acceptée, écriture chez un autre refusée.
- Navigateur réel sur émulateurs : guide de la spectatrice sur le Direct (FR et EN), sans modale ; modale pour la joueuse d'avant, puis « Attaquante » sur sa fiche ; guide et « Comment faire ? » de l'organisatrice, catégorie à la création ; club féminin (badge, « 3 joueuses », « Gardienne », « Attaquante », « Ajouter une joueuse ») ; mercato de la coach ouvert sur les joueuses ; compétition féminine (badge, « Joueuse du match ») ; tutoriels FR et EN au format téléphone, PDF servi ; inscription avec rôle qui exige le genre.

## Suite possible
- La catégorie comme vrai filtre de l'annuaire des compétitions et du Direct (aujourd'hui : badge et recherche).
- Les accords restants des outils (console, écrans de gestion) quand ils seront traduits.
- Les fiches des rôles en anglais, avec la traduction des outils.
