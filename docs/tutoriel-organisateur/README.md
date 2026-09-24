# Tutoriel organisateur

Le guide pas à pas de l'organisateur de compétitions, du compte à la finale, avec la console live.

**→ [Tutoriel-organisateur-KoppaFoot.pdf](Tutoriel-organisateur-KoppaFoot.pdf)** (59 pages, A4, prêt à partager ou à imprimer)

| Chapitre | Contenu |
|---|---|
| 00 | Avant de commencer |
| 01 | Créer son compte |
| 02 | Devenir organisateur (candidature, accès à l'espace) |
| 03 | Créer la compétition (infos, type, format, dates) |
| 04 | Ajouter les équipes et les joueurs (à la main, import depuis un tableur) |
| 05 | Composer les poules |
| 06 | Programmer le calendrier |
| 07 | S'entourer d'une équipe (codes d'accès, modérateurs) |
| 08 | Publier et partager (statuts, page publique) |
| 09 | Le jour du match : la console live |
| 10 | Saisir un score après coup, classements |
| 11 | La phase finale |
| 12 | Clôturer la compétition |
| + | Aide-mémoire du jour de match, questions fréquentes |

Toutes les captures viennent de l'application réelle, jouée de bout en bout sur les **émulateurs Firebase** avec un compte fictif (Kossi Mensah, « Coupe des Quartiers 2026 », 8 équipes inventées). Aucune donnée de production n'a été lue ni écrite.

## Contenu du dossier

```
Tutoriel-organisateur-KoppaFoot.pdf   le document final
source/
  tutoriel.html                       le texte et la mise en page (imprimé en PDF par Chromium)
  captures/                           les captures, réduites pour l'impression
  fonts/, couverture.jpg              Outfit, DM Sans, photo de couverture
outils/
  f1-compte.mjs … f9-cloture.mjs      le parcours, chapitre par chapitre (Playwright)
  run-all.sh                          enchaîne f1 → f9 sur des émulateurs vierges
  lib.mjs, admin.mjs, roster.mjs      outils communs, actions « équipe KoppaFoot », effectifs fictifs
  gen-assets.mjs                      logo, bannière et écussons fictifs
  reduire-captures.py                 captures brutes → source/captures
  build-pdf.mjs                       source/tutoriel.html → PDF
  verifier-pdf.py, apercu-pdf.py      contrôles du PDF (débris en bas de page, planches d'aperçu)
  emulateurs/                         config des émulateurs, patch local, modèle de .env.local
```

## Modifier le texte

Éditer `source/tutoriel.html`, puis reconstruire le PDF :

```bash
cd docs/tutoriel-organisateur/outils
npm install                 # playwright, firebase-tools
npx playwright install chromium
npm run pdf                 # → ../Tutoriel-organisateur-KoppaFoot.pdf
npm run verifier            # doit afficher « débris : 0 »
```

## Refaire les captures (après un changement d'interface)

Prérequis : Node 20+, Java (émulateur Firestore), Python 3 avec Pillow et PyMuPDF (`pip install pillow pymupdf`).

1. **Brancher l'application sur les émulateurs** : ce réglage est local, ne jamais le commiter.
   ```bash
   git apply docs/tutoriel-organisateur/outils/emulateurs/emulateurs.patch
   cp docs/tutoriel-organisateur/outils/emulateurs/env.local.exemple .env.local
   # puis remplacer FIREBASE_PRIVATE_KEY par une clé jetable (openssl genrsa 2048)
   ```
2. **Lancer les émulateurs**, dans un terminal :
   ```bash
   cd docs/tutoriel-organisateur/outils && npm run emulateurs
   ```
3. **Lancer l'application**, dans un autre terminal, à la racine :
   ```bash
   npm run build && npm start
   ```
4. **Jouer le parcours** (environ 30 minutes, les émulateurs doivent être vierges) :
   ```bash
   cd docs/tutoriel-organisateur/outils
   npm run captures          # → captures-brutes/
   npm run reduire           # → ../source/captures/
   npm run pdf && npm run verifier
   ```
5. **Tout remettre en place** :
   ```bash
   git checkout -- src/lib/firebase.ts next.config.ts && rm .env.local
   ```

Bon à savoir pour les scripts :

- Les repères orange sont posés par `mark()` dans `lib.mjs`. Les captures « zone » (`region()`) agrandissent la fenêtre au lieu de coudre une capture pleine page, pour que l'en-tête collant ne se retrouve pas au milieu de l'image.
- La console live est capturée en paysage (844 × 390) : c'est ainsi qu'elle se tient. Le chrono est avancé côté émulateur (`setClock` dans `admin.mjs`) pour obtenir des minutes réalistes sans attendre le match.
- La saisie de score « après coup » n'apparaît qu'une fois la date passée : `f7-resultats.mjs` fixe l'horloge de la page au 14 décembre 2026.
- La validation de la candidature (faite par un superadmin) passe par la vraie route `/api/organizer-applications/[id]`, avec un compte superadmin créé dans l'émulateur.
- Chromium : celui de Playwright par défaut, ou `CHROMIUM_PATH=/chemin/vers/chromium`.
