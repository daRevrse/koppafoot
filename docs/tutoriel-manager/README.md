# Tutoriel manager

Le guide pas à pas du manager d'équipe : du compte à l'inscription en compétition, en passant par le recrutement, l'effectif, les matchs amicaux et la feuille de match.

**→ [Tutoriel-manager-KoppaFoot.pdf](Tutoriel-manager-KoppaFoot.pdf)** (A4, prêt à partager ou à imprimer)

| Chapitre | Contenu |
|---|---|
| 00 | Avant de commencer |
| 01 | Créer son compte de manager (rôle, menu MySpace, onglet Espace sur téléphone) |
| 02 | Créer son équipe (fiche, écusson, bannière, onglets) |
| 03 | Recruter ses joueurs (mercato, sélection, invitations, candidatures) |
| 04 | Gérer son effectif (dossards, joueurs sans compte, fusion, staff, réglages) |
| 05 | Préparer la saison (composition type, créneaux et séances d'entraînement) |
| 06 | Organiser un match amical (défi, adversaire hors KoppaFoot, match déjà joué) |
| 07 | Avant le match : la feuille de match |
| 08 | Après le match (validation du résultat, statistiques, notes des joueurs) |
| 09 | Inscrire son équipe à une compétition |
| + | Aide-mémoire « un match amical de A à Z », questions fréquentes |

La console live n'est pas couverte ici : elle est décrite dans le [guide de l'organisateur](../tutoriel-organisateur/).

Toutes les captures viennent de l'application réelle, jouée de bout en bout sur les **émulateurs Firebase** avec des comptes fictifs (Edem Amouzou et l'« Avenir d'Adakpamé », Kokou Tepe et l'« Olympique de Tokoin », six joueurs inventés). Aucune donnée de production n'a été lue ni écrite.

## Contenu du dossier

```
Tutoriel-manager-KoppaFoot.pdf        le document final
source/
  tutoriel.html                       le texte et la mise en page (imprimé en PDF par Chromium)
  captures/                           les captures, réduites pour l'impression
  fonts/, couverture.jpg              Outfit, DM Sans, photo de couverture (public/branding/role_manager.png)
outils/
  g1-compte.mjs … g10-competition.mjs le parcours, chapitre par chapitre (Playwright)
  g8-match-joue.mjs                   joue le match amical en coulisses, sans capture
  run-all.sh                          enchaîne g1 → g10 sur des émulateurs vierges
  lib.mjs, admin.mjs, roster.mjs      outils communs, décor posé côté émulateur, personnes et clubs fictifs
  gen-assets.mjs                      écussons et bannière fictifs
  reduire-captures.py                 captures brutes → source/captures
  build-pdf.mjs                       source/tutoriel.html → PDF
  verifier-pdf.py, apercu-pdf.py      contrôles du PDF (débris en bas de page, planches d'aperçu)
  emulateurs/                         config des émulateurs, patch local, modèle de .env.local
```

## Modifier le texte

Éditer `source/tutoriel.html`, puis reconstruire le PDF :

```bash
cd docs/tutoriel-manager/outils
npm install                 # playwright, firebase-tools
npx playwright install chromium
npm run pdf                 # → ../Tutoriel-manager-KoppaFoot.pdf
npm run verifier            # doit afficher « débris : 0 »
```

## Refaire les captures (après un changement d'interface)

Prérequis : Node 20+, Java (émulateur Firestore), Python 3 avec Pillow et PyMuPDF (`pip install pillow pymupdf`).

1. **Brancher l'application sur les émulateurs** : ce réglage est local, ne jamais le commiter.
   ```bash
   git apply docs/tutoriel-manager/outils/emulateurs/emulateurs.patch
   cp docs/tutoriel-manager/outils/emulateurs/env.local.exemple .env.local
   # puis remplacer FIREBASE_PRIVATE_KEY par une clé jetable (openssl genrsa 2048)
   ```
2. **Lancer les émulateurs**, dans un terminal :
   ```bash
   cd docs/tutoriel-manager/outils && npm run emulateurs
   ```
3. **Lancer l'application**, dans un autre terminal, à la racine :
   ```bash
   npm run build && npm start
   ```
4. **Jouer le parcours** (environ 25 minutes, les émulateurs doivent être vierges) :
   ```bash
   cd docs/tutoriel-manager/outils
   npm run captures          # → captures-brutes/
   npm run reduire           # → ../source/captures/
   npm run pdf && npm run verifier
   ```
5. **Tout remettre en place** :
   ```bash
   git checkout -- src/lib/firebase.ts next.config.ts && rm .env.local
   ```

Bon à savoir pour les scripts :

- Le décor passe par l'émulateur (`admin.mjs`) quand il ne fait pas partie du parcours du manager : les joueurs déjà inscrits, neuf des dix joueurs sans compte (le dixième est ajouté à l'écran), l'effectif adverse, la compétition ouverte de l'organisateur et sa réponse à l'inscription (par la vraie route `/api/competitions/registrations`).
- Tout le reste est joué à l'écran, par les comptes fictifs : Edem (manager), Kokou (manager adverse), Kafui, Selom, Dodzi et Enyonam (joueurs).
- Le match amical du chapitre 8 est joué par `g8-match-joue.mjs`, sans capture : le chrono est avancé côté émulateur (`setClockAmical`) pour obtenir des minutes réalistes sans attendre le match.
- Les repères orange sont posés par `mark()` dans `lib.mjs`. Les captures « zone » (`region()`) agrandissent la fenêtre au lieu de coudre une capture pleine page ; l'option `bas` arrête la capture sous un élément donné.
- Chromium : celui de Playwright par défaut, ou `CHROMIUM_PATH=/chemin/vers/chromium`.
