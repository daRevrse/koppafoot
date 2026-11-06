# Banc d'essai : les émulateurs Firebase

Pour jouer le vrai `firestore.rules` en local, sans rien écrire en production.

## Lancer les émulateurs

Depuis la racine du dépôt, avec Java 21 :

```bash
firebase emulators:start --only auth,firestore --project demo-koppafoot --config firebase.emulateurs.json
```

`firebase.emulateurs.json` est à la racine parce que l'outil refuse des règles
placées hors du dossier de sa configuration ; il ne sert qu'aux émulateurs (le
`firebase.json` du déploiement n'a pas de bloc `emulators`, et sans lui l'Auth
ne démarre pas). Un projet `demo-*` n'existe pas chez Google : l'outil ne joint
rien en ligne. Ports : Auth 9099, Firestore 8080.

## Les tests qui s'en servent

```bash
cd mobile
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx jest equipe-regles equipe-firestore
```

Sans `FIRESTORE_EMULATOR_HOST`, ces suites sont ignorées : `npm test` reste au
vert sans émulateur. Les aides sont dans `src/test-aides/emulateur.ts` :

- `connecterEnTantQue(uid)` : la base vue par ce compte, règles appliquées ;
- `connecterEnAdmin()` : la base sans règles, pour préparer un cas ou relire ce
  qu'il a laissé ;
- `viderLaBase()` entre deux cas, `fermer()` après chaque cas qui écoute.

**Ces suites vident toute la base** à chaque cas : ne les lancez pas pendant un
essai de bout en bout, elles effaceraient les graines.

## L'essai de bout en bout

1. Les graines (comptes et clubs de test, dans l'émulateur seulement ; les
   e-mails et le mot de passe sont dans le script) :

   ```bash
   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 node mobile/outils/emulateurs/graines.cjs
   ```

2. Le site local sur les émulateurs : un `.env.development.local` jetable à la
   racine, qui remplace **toutes** les valeurs de production de `.env.local` —
   `FIREBASE_PROJECT_ID=demo-koppafoot`, une clé de service générée sur place
   (jamais la vraie), `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`,
   et les clés externes vidées (API-Football, football-data, FedaPay, Resend).
   Puis `next dev --webpack`.

3. L'application : `git apply mobile/outils/emulateurs/firebase-emulateurs.patch`
   (il branche `firebase.ts` et `firebase.web.ts` sur les émulateurs quand
   `EXPO_PUBLIC_EMULATEURS=1`, et **ne se commite jamais**), et un
   `mobile/.env.development.local` jetable : `EXPO_PUBLIC_EMULATEURS=1`,
   `EXPO_PUBLIC_FIREBASE_PROJECT_ID=demo-koppafoot`, des `EXPO_PUBLIC_FIREBASE_*`
   de démo, `EXPO_PUBLIC_API_URL` vers le site local. Expo charge ce fichier
   avant `.env.local`.

4. En version web, le navigateur exige des en-têtes CORS que le site n'envoie
   pas (l'application native n'en a pas besoin) : un petit relais local qui les
   ajoute, entre l'appli et le site. Sur le web, `Alert` ne fait rien : les
   confirmations passent par `confirmer` (lib/confirmer.web.ts).

5. À la fin : `git apply -R mobile/outils/emulateurs/firebase-emulateurs.patch`,
   supprimer les deux `.env.development.local`, `git status` propre.

Depuis l'émulateur Android, l'hôte est `10.0.2.2`
(`EXPO_PUBLIC_EMULATEURS_HOTE`), et seulement sur un build de développement : un
APK de production refuse le `http` en clair.
