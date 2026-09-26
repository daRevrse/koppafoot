# Tutoriel installation

Le guide pas à pas pour installer KoppaFoot comme une application (PWA) sur un téléphone Android, un iPhone ou un ordinateur, puis activer les notifications.

**→ [Tutoriel-installation-KoppaFoot.pdf](Tutoriel-installation-KoppaFoot.pdf)** (A4, prêt à partager ou à imprimer)

| Chapitre | Contenu |
|---|---|
| 00 | Avant de commencer (pourquoi installer, quel chapitre lire, captures et schémas) |
| 01 | Sur un téléphone Android (carte « Installer KoppaFoot », menu de l'avatar, page de connexion, menu de Chrome) |
| 02 | Sur un iPhone (Safari → Partager → Sur l'écran d'accueil → Ajouter) |
| 03 | Sur un ordinateur (Chrome ou Edge : carte, menu de l'avatar, barre d'adresse) |
| 04 | Activer les notifications (Paramètres → Sur cet appareil → Oui → Autoriser ; cas de l'iPhone dans Safari, notifications bloquées) |
| + | Aide-mémoire « l'installation en 30 secondes », questions fréquentes |

Même univers que les guides [organisateur](../tutoriel-organisateur/), [manager](../tutoriel-manager/) et [joueur](../tutoriel-joueur/) : on suit Kafui Mensah, compte fictif. Aucune donnée de production n'a été lue ni écrite.

## Captures et schémas

- **Captures** : tout ce que KoppaFoot affiche (la carte « Mettez KoppaFoot sur l'écran d'accueil », la partie « Application » du menu de l'avatar, le bloc de la page de connexion, le bloc « Notifications » des Paramètres) vient de l'application réelle, sur les **émulateurs Firebase**. Ce qu'un navigateur piloté ne fait pas de lui-même est rejoué au plus près dans `i1-captures.mjs` : l'évènement `beforeinstallprompt` de Chrome, l'identité de Safari sur iPhone, l'application ouverte depuis l'écran d'accueil (`display-mode: standalone`) et la réponse à la demande d'autorisation.
- **Schémas** : les fenêtres du navigateur et du téléphone (« Installer l'application ? » de Chrome, menu de Chrome, bouton et feuille Partager de Safari, écran d'accueil, demande d'autorisation) ne sont pas des pages web et changent d'une version à l'autre. Elles sont dessinées par `schemas.mjs`, avec la vraie icône de KoppaFoot, et portent l'étiquette **SCHÉMA**. L'écran de lancement de l'iPhone est l'image réelle `public/splash/splash-1170x2532.jpg`.

## Contenu du dossier

```
Tutoriel-installation-KoppaFoot.pdf   le document final
source/
  tutoriel.html                       le texte et la mise en page (imprimé en PDF par Chromium)
  captures/                           captures et schémas, réduits pour l'impression
  fonts/, couverture.jpg              Outfit, DM Sans, photo de couverture (public/branding/fan_scores.png)
outils/
  schemas.mjs                         les écrans du navigateur, dessinés
  i1-captures.mjs                     les écrans de KoppaFoot : Android, iPhone, ordinateur (Playwright)
  run-all.sh                          enchaîne schemas → i1-captures
  lib.mjs, admin.mjs                  outils communs, compte fictif posé côté émulateur
  reduire-captures.py                 captures brutes → source/captures
  build-pdf.mjs                       source/tutoriel.html → PDF
  verifier-pdf.py, apercu-pdf.py      contrôles du PDF (débris en bas de page, planches d'aperçu)
  emulateurs/                         config des émulateurs, patch local, modèle de .env.local
```

## Modifier le texte

Éditer `source/tutoriel.html`, puis reconstruire le PDF :

```bash
cd docs/tutoriel-installation/outils
npm install                 # playwright, firebase-tools
npx playwright install chromium
npm run pdf                 # → ../Tutoriel-installation-KoppaFoot.pdf
npm run verifier            # doit afficher « débris : 0 »
```

## Refaire les captures (après un changement d'interface)

Prérequis : Node 20+, Java (émulateur Firestore), Python 3 avec Pillow et PyMuPDF (`pip install pillow pymupdf`).

1. **Brancher l'application sur les émulateurs** : ce réglage est local, ne jamais le commiter.
   ```bash
   git apply docs/tutoriel-installation/outils/emulateurs/emulateurs.patch
   cp docs/tutoriel-installation/outils/emulateurs/env.local.exemple .env.local
   # puis remplacer FIREBASE_PRIVATE_KEY par une clé jetable (openssl genrsa 2048)
   ```
   Le modèle contient une clé VAPID factice (`NEXT_PUBLIC_FCM_VAPID_KEY`) : sans elle, le bloc « Notifications » ne s'affiche pas. Aucune notification n'est envoyée.
2. **Lancer les émulateurs**, dans un terminal :
   ```bash
   cd docs/tutoriel-installation/outils && npm run emulateurs
   ```
3. **Lancer l'application**, dans un autre terminal, à la racine :
   ```bash
   npm run build && npm start
   ```
4. **Prendre les captures** (environ 3 minutes) :
   ```bash
   cd docs/tutoriel-installation/outils
   npm run captures          # → captures-brutes/
   npm run reduire           # → ../source/captures/
   npm run pdf && npm run verifier
   ```
   `SEULEMENT=iphone,ordinateur node i1-captures.mjs` ne refait que ces parties (`android`, `android-refus`, `iphone`, `iphone-app`, `ordinateur`).
5. **Tout remettre en place** :
   ```bash
   git checkout -- src/lib/firebase.ts next.config.ts && rm .env.local
   ```

Bon à savoir pour les scripts :

- `open(profil, appareil, { proposition: true })` laisse KoppaFoot proposer l'installation ; sans l'option, la carte est mise en sourdine (clé `koppafoot:install-repousse`), comme dans les autres guides.
- Le Chromium qui joue l'iPhone émettrait `beforeinstallprompt` de lui-même : `commeSafari()` l'arrête avant KoppaFoot, pour obtenir l'état « iPhone » (`ios-manuel`).
- Les repères orange des captures sont posés par `mark()` dans `lib.mjs` ; ceux des schémas par `data-n` / `data-cote` dans `schemas.mjs`.
- Chromium : celui de Playwright par défaut, ou `CHROMIUM_PATH=/chemin/vers/chromium`.
