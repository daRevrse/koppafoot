# Design : application mobile, lot 1 — accueil, authentification, Direct

**Date :** 2026-09-24
**Statut :** Livré le 2026-09-24 (#62 pour le web, #63 pour l'application), sauf la connexion Google. Testé sur iPhone ; Android reste à éprouver.
**Prolonge :** [2026-09-02-application-mobile-expo-design.md](2026-09-02-application-mobile-expo-design.md), dont ce document détaille et amende le premier lot.

## Le périmètre

Trois briques, et rien d'autre : **l'accueil** (premier lancement et complétion du profil), **l'authentification** (e-mail et Google), **le Direct** (le tableau des matchs du jour, en lecture, avec le suivi de compétition).

Hors lot : la fiche de match native, la console live, les pronostics, les notifications, la suppression du compte, le téléphone. Chacun a son lot dans le design du 2 septembre.

## Les décisions prises

1. **Le Direct s'ouvre sans compte.** Le compte n'est demandé qu'au moment où il sert. C'est ce que fait le site, et exiger un compte à l'ouverture fait repartir celui qui arrive par un lien WhatsApp.
2. **Le compte débloque le suivi de compétition**, et le filtre Favoris qui en découle.
3. **Toucher un match ouvre sa page web** dans un navigateur intégré à l'application. La fiche native la remplacera au lot suivant, sans rien changer au reste.
4. **L'étoile de l'application est le suivi lié au compte** (`users.followed_competition_ids`), celui du bouton « Suivre » de la page compétition du site — et celui que liront les notifications.

### Le site et l'application : un seul suivi

**À l'écriture de ce design, les deux divergeaient.** Le site avait deux mécanismes que leurs noms confondent : l'étoile du Direct (`DirectHomeV2`), **locale à l'appareil** (`localStorage`, clés `kf:direct:favs` et `kf:direct:compfavs`), que lisait seule le filtre Favoris ; et le suivi lié au compte, sur la page compétition, l'annuaire et la barre latérale. L'application ne reprenant que le second, une compétition suivie depuis le téléphone n'apparaissait pas dans les Favoris du Direct du site.

**Résolu par #61, le même jour.** Connecté, l'étoile d'une compétition du Direct du site écrit le suivi du compte, comme le bouton « Suivre » et comme l'application ; ses tuiles « Mes compétitions » et son filtre Favoris lisent le compte et l'appareil ensemble. Sans compte, l'étoile du site reste une préférence de l'appareil. Les étoiles locales posées avant la connexion restent affichées sans être versées dans le compte (un téléphone partagé porterait les choix de quelqu'un d'autre). L'étoile d'un match isolé reste locale : l'application n'en a pas.

---

## 1. Architecture et partage avec le web

### L'application

`koppafoot/mobile/` : Expo SDK 57, Expo Router, TypeScript. Android visé ; le code reste compatible iOS sans qu'on s'en occupe.

Le dossier voisin `FootballNetworkApp` (Expo, Supabase, Redux) est une application d'une autre lignée, sur un autre backend. On n'en reprend rien.

### Ce qui traverse depuis le web

Les modules sans SDK de `src/lib` et les types de `src/types`. Ils s'importent entre eux en `@/lib/…` et `@/types` : dans l'application, **`@/` pointe donc vers `../src/`**, pour qu'ils s'y résolvent tels quels. Le code propre à l'application prend le préfixe `~/`.

Une règle de lint (`no-restricted-imports`) interdit d'importer depuis le web ce qui touche Firebase client, Next ou React DOM : `@/lib/firebase`, `@/lib/firestore`, `@/lib/competition-firestore`, `@/lib/*-admin`, `@/contexts/*`, `@/components/*`. Sans elle, l'erreur ne se verrait qu'au lancement.

### Firebase côté application

Une initialisation propre, avec les mêmes valeurs que le site en `EXPO_PUBLIC_FIREBASE_*`, et l'authentification initialisée avec la persistance React Native (`initializeAuth` + `getReactNativePersistence(AsyncStorage)`). Sans elle, l'utilisateur est déconnecté à chaque redémarrage, et le symptôme ressemble à un bug de règles.

Les trois fonctions Firestore dont le lot a besoin sont réécrites dans l'application, en quelques lignes, sur les mappers partagés : écouter les matchs d'une compétition, écouter les amicaux en cours, suivre une compétition. Les versions du web lisent l'initialisation du site et ne traversent pas.

Il n'y a qu'un projet Firebase : en développement, l'application lit la production, comme le site en local.

### Les quatre changements côté web

1. **`GET /api/direct`** — le tableau que la page d'accueil calcule déjà côté serveur : compétitions de la plateforme, amicaux, football mondial, dans le même ordre. Aucune logique nouvelle : la page et la route appellent les mêmes fonctions. Mise en cache 60 s, comme la page. Nécessaire parce que les amicaux et le football mondial passent par le SDK admin, hors de portée d'un client.
2. **`src/lib/profil.ts`** — `buildFirestoreUser` et `firestoreToProfile` sortent d'`AuthContext`. Un compte créé depuis l'application a ainsi exactement la forme d'un compte créé sur le site. Pour le site, rien ne change.
3. **`src/lib/direct-shared.ts`** — `liveMinute`, `matchHref` et `competitionHref` sortent de `DirectHomeV2`. Sinon la minute d'un match existerait en deux exemplaires, et le jour où l'un bouge, le site et l'application n'affichent plus la même minute pour le même match.
4. **`mobile/` exclu** de la vérification TypeScript et du lint du site.

---

## 2. Parcours et écrans

### Premier lancement

Trois écrans d'accueil, montrés une fois (un drapeau sur l'appareil), qu'on peut passer. Registre de la campagne d'affiches — montrer le match, cacher la machine — et rien qui ne soit pas déjà dans l'application, donc pas de notifications :

1. « Le football d'ici, en direct » — les matchs de ta ville, minute par minute.
2. « Suis tes compétitions » — une étoile, et elles passent en tête.
3. « Le monde aussi » — le football mondial du jour, au même endroit.

Le dernier se termine sur **Voir le direct** (principal) et **J'ai déjà un compte**. Visuels tirés de `branding/` et `public/branding/` ; les textes s'ajustent à l'implémentation.

### Les onglets

**Direct** et **Compte**. Favoris est un filtre du Direct, pas un onglet. Compétitions et Tribune viendront avec leurs lots : deux onglets aujourd'hui, c'est peu, mais on ne montre que ce qui existe.

### L'authentification, en fenêtre

Connexion, inscription, mot de passe oublié s'ouvrent en modale par-dessus l'application, depuis trois endroits : l'onglet Compte, le dernier écran d'accueil, et l'étoile touchée sans compte (« Crée un compte pour suivre cette compétition »).

À la réussite, la modale se ferme et on revient où l'on était. Si c'est l'étoile qui l'a ouverte, **la compétition est suivie dans la foulée** — l'équivalent du `?next=` du site. Sans ça, l'utilisateur aurait à refaire le geste qu'il venait de tenter.

### L'inscription, en deux temps

1. Les identifiants : e-mail et mot de passe, ou Google.
2. Le profil : prénom, nom, ville, comme `/get-started`.

**Tout utilisateur authentifié sans document `users/{uid}` atterrit sur l'écran de profil, et ne peut pas le fermer.** Google et l'e-mail partagent ainsi la même étape, et un compte sans profil — une impasse sur le site — ne peut pas exister dans l'application. Le compte naît `userType: "user"`, comme sur `/get-started`.

L'e-mail de vérification part, sans bloquer l'accès, comme sur le site.

### L'onglet Compte

Sans compte : Se connecter, Créer un compte. Connecté : nom, e-mail, ville, Se déconnecter.

---

## 3. Le Direct

### Les données

`GET /api/direct` au lancement, au glisser-pour-rafraîchir, et au retour de l'application au premier plan.

Par-dessus, le temps réel, comme `DirectHomeV2` : un écouteur Firestore par compétition de la plateforme, un sur les amicaux en cours. Le football mondial n'a pas de temps réel sur le site non plus ; il suit le rafraîchissement.

**Les écouteurs se coupent quand l'application passe en arrière-plan** et se rebranchent au retour. Un tableau ouvert au fond d'une poche, c'est de la batterie et du forfait pour personne, et pour ce public le forfait compte.

### L'écran

- Le choix du jour (hier, aujourd'hui, demain) et les filtres **Tous / En direct / Favoris**.
- Les matchs groupés par compétition : celles d'ici d'abord, le monde derrière, comme sur le site.
- Une ligne : l'heure ou la minute en direct, les deux équipes avec leurs écussons, le score, le badge « en direct ».
- L'étoile sur l'en-tête des compétitions de la plateforme. Le football mondial ne se suit pas, comme sur le site.
- Toucher un match ouvre sa page web (`matchHref`) dans le navigateur intégré ; toucher un en-tête, la page de la compétition (`competitionHref`).

### Le suivi

L'étoile écrit `followed_competition_ids` sur `users/{uid}` — le champ du site, déjà autorisé par les règles au propriétaire du document. Mise à jour optimiste, annulée si l'écriture échoue.

Favoris montre tous les matchs des compétitions suivies. Pas d'étoile sur un match isolé dans ce lot.

---

## 4. Les erreurs

- **Authentification** : `src/lib/auth-errors.ts` est pur et traverse ; les messages sont ceux du site, mot pour mot.
- **Réseau** : si un rafraîchissement échoue alors qu'un tableau est affiché, on le garde, avec un bandeau « Pas de connexion — mis à jour à 14 h 32 ». Si rien n'a jamais chargé, un état vide avec « Réessayer ». Pas de mode hors-ligne : c'est un chantier à part, et le design du 2 septembre le dit déjà.
- **Étoile, profil** : un message, et retour à l'état d'avant. Jamais d'état qui laisse croire que c'est fait.

## 5. Les tests

- **Automatiques** (jest-expo, dans `mobile/`), sur la logique : la minute et les liens de `direct-shared`, le tri et le filtrage du tableau par jour et par favoris, l'étoile en attente qui doit être suivie une fois connecté, l'accueil montré une seule fois.
- **Côté web** : `build` et `lint` ; `/api/direct` renvoie le même tableau que la page d'accueil ; la page d'accueil est inchangée après l'extraction.
- **Sur un vrai téléphone Android**, une liste de parcours : premier lancement ; inscription e-mail → profil → Direct ; redémarrage en restant connecté ; étoile sans compte → inscription → compétition suivie ; compte sans profil bloqué sur le profil ; un match en direct qui bouge.

## 6. La livraison

1. **La partie web d'abord, dans sa propre PR.** Une fois fusionnée, `/api/direct` est en production et l'application peut viser `www.koppafoot.com`, sans passer par un `next dev` exposé sur le réseau local à travers le pare-feu Windows.
2. **L'application dans Expo Go** : accueil, e-mail, profil, Direct, suivi. Tout se teste sans build.
3. **Google en dernier.** `signInWithPopup` n'existe pas en natif : `@react-native-google-signin/google-signin` fournit le jeton, `signInWithCredential` le présente à Firebase. La bibliothèque demande un development build (EAS), donc un compte Expo, et l'application Android déclarée dans la console Firebase avec l'empreinte SHA-1 de sa clé de signature.

## Ce qui n'est pas tranché

- **L'identifiant Android.** Proposé : `com.koppafoot.app`. Il est **définitif** dès la première publication sur le Play Store. À fixer avant le premier development build.

## Ce qui change par rapport au design du 2 septembre

- Le Direct passe du lot 2 au lot 1 ; la fiche de match, la compétition et le classement des joueurs restent au lot 2.
- Une seule route, `GET /api/direct`, au lieu de `GET /api/direct/monde` et `GET /api/rankings` : le lot n'affiche pas le classement, et le Direct a aussi besoin des amicaux.
- Google passe par `@react-native-google-signin/google-signin` plutôt que par `expo-auth-session`.
- Deux extractions côté web qu'il ne prévoyait pas : `lib/profil` et `lib/direct-shared`.
