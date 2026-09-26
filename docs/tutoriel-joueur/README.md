# Tutoriel joueur

Le guide pas à pas du joueur : du compte à la compétition, en passant par le profil, l'arrivée dans une équipe, les entraînements, les convocations, le jour du match et les statistiques.

**→ [Tutoriel-joueur-KoppaFoot.pdf](Tutoriel-joueur-KoppaFoot.pdf)** (A4, prêt à partager ou à imprimer)

| Chapitre | Contenu |
|---|---|
| 00 | Avant de commencer |
| 01 | Créer son compte de joueur (rôle, menu MySpace, onglet Espace sur téléphone) |
| 02 | Compléter son profil (poste, niveau, bio, fiche publique, carte KoppaFoot) |
| 03 | Rejoindre une équipe (mercato, candidature, invitation reçue) |
| 04 | La vie de son équipe (page du club, entraînements) |
| 05 | Ses convocations (répondre, historique, calendrier) |
| 06 | Le jour du match (suivre le match, pronostic, composition, résultat) |
| 07 | Ses statistiques (Mes statistiques, fiche publique) |
| 08 | Les compétitions (inscription de l'équipe, « Toi » dans l'effectif, suivre le tournoi) |
| + | Aide-mémoire « ta semaine de joueur », questions fréquentes |

Même univers que les guides [organisateur](../tutoriel-organisateur/) et [manager](../tutoriel-manager/) : on suit Kafui Mensah, qui rejoint l'« Avenir d'Adakpamé » d'Edem Amouzou. Toutes les captures viennent de l'application réelle, jouée de bout en bout sur les **émulateurs Firebase** avec des comptes fictifs. Aucune donnée de production n'a été lue ni écrite.

## Contenu du dossier

```
Tutoriel-joueur-KoppaFoot.pdf         le document final
source/
  tutoriel.html                       le texte et la mise en page (imprimé en PDF par Chromium)
  captures/                           les captures, réduites pour l'impression
  fonts/, couverture.jpg              Outfit, DM Sans, photo de couverture (public/branding/role_joueur.png)
outils/
  j0-decor.mjs                        le décor, sans capture : managers, clubs, coéquipiers
  j1-compte.mjs … j8-competition.mjs  le parcours du joueur, chapitre par chapitre (Playwright)
  run-all.sh                          enchaîne j0 → j8 sur des émulateurs vierges
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
cd docs/tutoriel-joueur/outils
npm install                 # playwright, firebase-tools
npx playwright install chromium
npm run pdf                 # → ../Tutoriel-joueur-KoppaFoot.pdf
npm run verifier            # doit afficher « débris : 0 »
```

## Refaire les captures (après un changement d'interface)

Prérequis : Node 20+, Java (émulateur Firestore), Python 3 avec Pillow et PyMuPDF (`pip install pillow pymupdf`).

1. **Brancher l'application sur les émulateurs** : ce réglage est local, ne jamais le commiter.
   ```bash
   git apply docs/tutoriel-joueur/outils/emulateurs/emulateurs.patch
   cp docs/tutoriel-joueur/outils/emulateurs/env.local.exemple .env.local
   # puis remplacer FIREBASE_PRIVATE_KEY par une clé jetable (openssl genrsa 2048)
   ```
2. **Lancer les émulateurs**, dans un terminal :
   ```bash
   cd docs/tutoriel-joueur/outils && npm run emulateurs
   ```
3. **Lancer l'application**, dans un autre terminal, à la racine :
   ```bash
   npm run build && npm start
   ```
4. **Jouer le parcours** (environ 20 minutes, les émulateurs doivent être vierges) :
   ```bash
   cd docs/tutoriel-joueur/outils
   npm run captures          # → captures-brutes/
   npm run reduire           # → ../source/captures/
   npm run pdf && npm run verifier
   ```
5. **Tout remettre en place** :
   ```bash
   git checkout -- src/lib/firebase.ts next.config.ts && rm .env.local
   ```

Bon à savoir pour les scripts :

- Kafui (le joueur) fait tout à l'écran. Les gestes des managers et de l'organisateur sont joués en coulisses, sans capture : à l'écran pour les inscriptions, les défis, les feuilles de match et le match lui-même ; côté émulateur (`admin.mjs`) pour les coéquipiers, les dossards, les séances d'entraînement et la compétition ouverte.
- Le match du chapitre 6 est joué dans la console live par le manager, sans capture : le chrono est avancé côté émulateur (`setClockAmical`), et le bouton « But » reste verrouillé une trentaine de secondes après chaque but, d'où les pauses dans `j6-match.mjs`.
- Les repères orange sont posés par `mark()` dans `lib.mjs`. Les captures « zone » (`region()`) agrandissent la fenêtre au lieu de coudre une capture pleine page ; les options `bas` et `depuis` bornent la capture sous ou au-dessus d'un élément donné.
- Chromium : celui de Playwright par défaut, ou `CHROMIUM_PATH=/chemin/vers/chromium`.
