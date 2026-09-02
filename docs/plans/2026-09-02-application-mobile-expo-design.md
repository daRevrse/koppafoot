# Design : application mobile Android (Expo)

**Date :** 2026-09-02
**Statut :** À approuver

## Contexte

La PWA existe déjà : service worker, invitation à l'installation (`PWAInstallPrompt`, `PWAInstallFloating`), push FCM, barre de navigation basse. Une application native n'a donc d'intérêt que si elle apporte ce que la PWA ne sait pas faire. Trois choses, et il faut les nommer avant d'écrire une ligne :

1. **Le push fiable.** Sur Android, une PWA reçoit les notifications tant que Chrome vit ; une application native passe par le système. Pour un produit dont l'événement central est « ça vient de commencer », c'est la différence entre être prévenu et l'apprendre plus tard.
2. **Le Play Store comme canal de découverte.** Le démarchage se fait en direct (voir la campagne d'affiches) ; un lien Play Store se partage dans un groupe WhatsApp, une adresse `koppafoot.com` beaucoup moins bien auprès d'un public qui installe des applications et ne visite pas de sites.
3. **La console live tenue au bord d'un terrain.** Écran allumé, réseau intermittent, une main. C'est l'usage le plus exigeant du produit, et le seul où le natif change vraiment quelque chose.

Ce qui **ne** justifie **pas** le chantier : « avoir une application ». Le web mobile est déjà responsive et installable.

---

## 1. Ce que l'application partage avec le web

C'est le point de départ, parce qu'il conditionne l'arborescence.

Une partie de `src/lib` est **déjà sans SDK** — ni Firebase client, ni admin, ni Next :

| Module | Ce qu'il porte |
|---|---|
| `lib/classement` | le calcul du classement, cinq derniers matchs |
| `lib/terrain` | la géométrie du terrain, dispositifs NvN |
| `lib/postes` | le vocabulaire des postes et son normaliseur |
| `lib/evenements` | les types d'événement, leurs libellés |
| `lib/competition-mappers` | Firestore snake_case → objets du domaine |
| `lib/friendlies-shared`, `lib/world-board-shared` | conversions et préfixes |
| `lib/push-categories`, `lib/champs-valides` | préférences push, validation de saisie |

Ces modules sont réutilisables **tels quels**. Ce n'est pas un hasard : ils ont été écrits sans SDK pour que le serveur puisse les lire, et cette contrainte paie une seconde fois ici.

Le reste (`lib/firestore`, `lib/competition-firestore`, `lib/*-admin`) est lié au SDK web ou au SDK admin et ne traverse pas.

### Arborescence proposée

**Ne pas monorepo-iser tout de suite.** Passer le dépôt en workspaces (`packages/noyau`, `apps/web`, `apps/mobile`) est un refactor qui touche chaque import de `@/`, la configuration Next, Vercel et les chemins des scripts — pour un bénéfice nul tant qu'il n'y a qu'un consommateur mobile.

À la place :

```
koppafoot/
  src/…                  ← le web, inchangé
  mobile/                 ← l'application Expo
    metro.config.js       ← watchFolders: ['../src/lib']
    tsconfig.json         ← paths: { "@noyau/*": ["../src/lib/*"] }
```

Metro sait résoudre hors du dossier de l'application via `watchFolders`. Les modules purs s'importent alors en `@noyau/classement`, et rien ne bouge côté web.

Le jour où le partage déborde des modules purs — un client Firestore commun, par exemple —, on passera aux workspaces. Pas avant.

---

## 2. Ce que l'application lit, et comment

C'est la question centrale, et elle n'a pas une réponse unique.

### 2.1 Firestore en direct

Le SDK web `firebase/firestore` **fonctionne en React Native**. Et surtout : **les règles Firestore font déjà l'autorisation**. Tout ce qu'un navigateur a le droit de lire et d'écrire, l'application l'a aussi, sans une ligne de serveur en plus.

Passent donc par Firestore directement :

- le tableau du Direct et ses compétitions (`onCompMatches`, `onCompetition`) ;
- **la console live** entière — feuille de match, chrono, événements. C'est du temps réel, et le refaire en HTTP serait un recul ;
- les pronostics (écriture), les favoris, le profil, les équipes.

### 2.2 Ce qui n'est PAS joignable, et qu'il faut exposer

Tout ce que le web sert depuis un composant serveur avec le SDK admin est **hors de portée** d'un client mobile. Aujourd'hui :

| Donnée | Où elle vit | Ce qu'il faut |
|---|---|---|
| Football mondial | `lib/world-board` (jeton football-data côté serveur) | `GET /api/direct/monde` |
| Classement des joueurs | `lib/classement-admin` (document admin-only) | `GET /api/rankings` |
| Fiche publique d'équipe, de profil, de terrain | routes existantes | rien à faire |
| Totaux de pronostics | `GET /api/matches/[mid]/predictions` | rien à faire |

Deux routes à écrire, donc. Elles servent aussi le web s'il en a besoin, et elles sont publiques comme les pages qu'elles alimentent.

**Point d'attention connu :** en développement, Turbopack renvoie 404 sur les routes dynamiques profondes tant qu'elles ne sont pas compilées (vérifié sur `/api/matches/[mid]/predictions` et sur `/c/[slug]/matches/[mid]`, qui fonctionnent en production). Ne pas conclure trop vite qu'une route est cassée.

---

## 3. L'authentification

Trois pièges, tous connus, tous coûteux si on les découvre tard.

### 3.1 La persistance

`getAuth()` ne persiste pas la session en React Native. Il faut :

```ts
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
```

Sans ça, l'utilisateur est déconnecté à chaque redémarrage — et le symptôme ressemble à un bug de règles, pas à un bug d'initialisation.

### 3.2 Google

Le `signInWithPopup` du web n'existe pas. Il faut `expo-auth-session` pour obtenir un jeton Google, puis `signInWithCredential`. Deux identifiants OAuth à créer côté Google Cloud (un pour Android, un pour le client web utilisé par Expo).

### 3.3 Le téléphone

**Ne pas faire dépendre le lancement mobile de l'authentification par téléphone.** Les SMS réels sont bloqués depuis un moment (code 39, piste `phoneEnforcementState=AUDIT` non appliquée), et le natif ajoute ses propres exigences (SafetyNet / Play Integrity). C'est un chantier à part, à mener sur le web d'abord puisque le blocage y est le même.

L'application se lance avec Google et e-mail. Le téléphone suit.

---

## 4. Les notifications

Le serveur sait déjà envoyer : `lib/fcm-server` pousse vers les jetons rangés dans `users/{uid}.fcm_tokens`, avec les préférences par catégorie de `lib/push-categories`. Rien à refaire côté envoi.

Côté application :

- `expo-notifications` avec un **development build** — Expo Go ne reçoit pas de push FCM, c'est une cause classique de journée perdue ;
- un compte de service FCM v1 à déposer dans le projet EAS ;
- le jeton natif s'enregistre dans le **même tableau** `fcm_tokens`. Les jetons web et natifs cohabitent : un même compte peut être sur les deux, et l'envoi doit tolérer un jeton mort sans faire échouer les autres (c'est déjà le cas).

À vérifier au premier envoi réel : les préférences par catégorie s'appliquent bien aux jetons natifs, et un `data` message ne réveille pas l'application pour un événement mineur — les arrêts, fautes et hors-jeu ne partent pas en push, par construction.

---

## 5. Ce qu'on ne porte PAS au premier lot

Le produit a beaucoup de surfaces. Les porter toutes, c'est ne rien livrer.

**Restent sur le web, et c'est très bien :**

- l'espace organisateur (création de compétition, calendrier, import TSV, codes staff) — usage de bureau, formulaires longs ;
- l'administration ;
- la rédaction d'articles, les campagnes e-mail.

**Reporté au deuxième lot :**

- la console live. C'est l'écran le plus complexe du produit — terrain, modale d'actions, chrono, remplacements — et il vient d'être refait sur le web. Le porter tout de suite, c'est maintenir deux consoles qui divergeront, exactement le problème qu'on vient de résoudre entre compétition et amical.

---

## 6. Les écrans du premier lot

1. **Direct** — le tableau des matchs du jour, l'affiche avec son pronostic, le raccourci vers le classement. C'est l'écran d'accueil, et celui qui justifie l'installation.
2. **Fiche de match** — score, composition sur le terrain, historique, pronostic.
3. **Compétition** — classement, calendrier, buteurs.
4. **Classement des joueurs** — `/top-players`, deux onglets.
5. **Compte** — connexion, profil, préférences de notification, suppression du compte.

La suppression du compte n'est pas une coquetterie : **le Play Store l'exige** pour toute application qui permet d'en créer un. La route existe (`/api/account/delete`), il faut l'exposer dans l'application.

---

## Modèle / lib

Côté dépôt web, le chantier est **petit** :

- `+ GET /api/direct/monde` — le football mondial, tel que `getWorldBoard` le rend.
- `+ GET /api/rankings` — le classement publié, tel que `lireClassements` le rend.
- Rien à changer aux règles Firestore : le mobile hérite de celles du web.
- Rien à changer au modèle de données.
- `+ mobile/` avec sa configuration Metro pointant sur `src/lib`.

---

## Lots

1. **Socle** — projet Expo, development build, Firebase initialisé avec la persistance RN, connexion Google + e-mail, navigation par onglets.
2. **Lecture** — les deux routes JSON côté web, puis les écrans Direct, fiche de match, compétition, classement.
3. **Compte et notifications** — profil, préférences, jeton FCM natif, suppression du compte.
4. **Publication** — fiche Play Store, politique de confidentialité, déclaration de sécurité des données, piste fermée puis ouverte.
5. **Plus tard** — la console live, et l'authentification par téléphone si elle est débloquée entre-temps.

---

## Ce qui n'est pas tranché

- **Le nom et l'icône** sur le Play Store, et si l'application s'appelle « KoppaFoot » ou porte le nom du produit côté supporter.
- **La cible Android minimale.** Expo suit les exigences du Play Store ; il faut décider si on soutient les Android anciens qui sont majoritaires sur le marché visé.
- **iOS.** Le plan ne le traite pas. Expo le rend possible presque gratuitement en code, mais pas en compte développeur ni en temps de revue.
- **Le mode hors-ligne.** Firestore a un cache local qui peut suffire ; en faire une promesse est un chantier à part.
