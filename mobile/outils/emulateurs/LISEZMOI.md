# Banc d'essai : les émulateurs Firebase

Pour jouer le vrai `firestore.rules` en local, sans rien écrire en production.

## Lancer les émulateurs

Depuis la racine du dépôt, avec Java 21 :

```bash
firebase emulators:start --only auth,firestore --project demo-koppafoot
```

C'est le `firebase.json` de la racine qui porte les règles : l'outil refuse des
règles placées hors du dossier de sa configuration. Un projet `demo-*` n'existe
pas chez Google, l'outil ne joint donc rien en ligne. Ports : Auth 9099,
Firestore 8080.

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
- `viderLaBase()` entre deux cas, `fermer()` en fin de fichier.

## L'application sur les émulateurs

`firebase-emulateurs.patch` branche `src/lib/firebase.ts` sur les émulateurs
quand `EXPO_PUBLIC_EMULATEURS=1`. **Il ne se commite jamais** :

```bash
git apply mobile/outils/emulateurs/firebase-emulateurs.patch
```

```bash
git apply -R mobile/outils/emulateurs/firebase-emulateurs.patch
```

Entre les deux, lancer l'application avec `EXPO_PUBLIC_EMULATEURS=1` et
`EXPO_PUBLIC_FIREBASE_PROJECT_ID=demo-koppafoot` définies dans le shell : les
fichiers `.env` n'écrasent pas une variable déjà définie. L'hôte par défaut,
`127.0.0.1`, convient à Expo web ; depuis l'émulateur Android, c'est `10.0.2.2`
(`EXPO_PUBLIC_EMULATEURS_HOTE`), et seulement sur un build de développement : un
APK de production refuse le `http` en clair.
