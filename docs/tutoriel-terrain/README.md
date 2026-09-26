# Tutoriel gérant de terrain

Le guide pas à pas du gérant de terrain (MyFields) : de la candidature à la gestion des créneaux, en passant par la fiche du terrain, les demandes des équipes, les matchs programmés sur le terrain et les créneaux bloqués.

**→ [Tutoriel-terrain-KoppaFoot.pdf](Tutoriel-terrain-KoppaFoot.pdf)** (A4, prêt à partager ou à imprimer)

| Chapitre | Contenu |
|---|---|
| 00 | Avant de commencer |
| 01 | Référencer son terrain (vitrine MyFields, compte, candidature, demande en examen : modifier ou retirer) |
| 02 | La réponse de KoppaFoot (terrain publié, refus avec motif et nouveau dépôt) |
| 03 | Compléter sa fiche (espace terrain, photo, tarif, équipements, horaires, contact montré aux équipes, fiche publique) |
| 04 | Répondre aux demandes (notifications, contact de l'équipe, confirmer, chevauchement, refuser en proposant un autre créneau, annuler) |
| 05 | Les matchs programmés sur son terrain (demande née d'un match, réponse vue par le manager) |
| 06 | Bloquer ses créneaux (habitués chaque semaine, série, vue Semaine, ce que voient les équipes) |
| 07 | Gérer ses terrains (en ajouter un, fermer pour travaux, retirer) |
| 08 | Sur téléphone |
| + | Aide-mémoire « ta semaine de gérant », questions fréquentes |

Même univers que les guides [organisateur](../tutoriel-organisateur/), [manager](../tutoriel-manager/), [joueur](../tutoriel-joueur/) et [installation](../tutoriel-installation/) : on suit Yawo Agbeko, gérant du « Complexe sportif de Bè », à qui l'Avenir d'Adakpamé d'Edem Amouzou et l'Olympique de Tokoin de Kokou Tepe demandent des créneaux. Toutes les captures viennent de l'application réelle, jouée de bout en bout sur les **émulateurs Firebase** avec des comptes fictifs. Aucune donnée de production n'a été lue ni écrite.

## Contenu du dossier

```
Tutoriel-terrain-KoppaFoot.pdf        le document final
source/
  tutoriel.html                       le texte et la mise en page (imprimé en PDF par Chromium)
  captures/                           les captures, réduites pour l'impression
  fonts/, couverture.jpg              Outfit, DM Sans, photo de couverture (public/branding/role_proprietaire.png)
outils/
  t0-decor.mjs                        le décor, sans capture : les deux clubs et leurs managers
  t1-candidature.mjs … t8-telephone.mjs  le parcours du gérant, chapitre par chapitre (Playwright)
  run-all.sh                          enchaîne t0 → t8 sur des émulateurs vierges
  lib.mjs, admin.mjs, roster.mjs      outils communs, gestes joués en coulisses, personnes et terrain fictifs
  gen-assets.mjs                      écussons fictifs
  reduire-captures.py                 captures brutes → source/captures
  build-pdf.mjs                       source/tutoriel.html → PDF
  verifier-pdf.py, apercu-pdf.py      contrôles du PDF (débris en bas de page, planches d'aperçu)
  emulateurs/                         config des émulateurs, patch local, modèle de .env.local
```

## Modifier le texte

Éditer `source/tutoriel.html`, puis reconstruire le PDF :

```bash
cd docs/tutoriel-terrain/outils
npm install                 # playwright, firebase-tools
npx playwright install chromium
npm run pdf                 # → ../Tutoriel-terrain-KoppaFoot.pdf
npm run verifier            # doit afficher « débris : 0 »
```

## Refaire les captures (après un changement d'interface)

Prérequis : Node 20+, Java (émulateur Firestore), Python 3 avec Pillow et PyMuPDF (`pip install pillow pymupdf`).

1. **Brancher l'application sur les émulateurs** : ce réglage est local, ne jamais le commiter.
   ```bash
   git apply docs/tutoriel-terrain/outils/emulateurs/emulateurs.patch
   cp docs/tutoriel-terrain/outils/emulateurs/env.local.exemple .env.local
   # puis remplacer FIREBASE_PRIVATE_KEY par une clé jetable (openssl genrsa 2048)
   ```
   Le patch de ce guide ajoute une ligne à `src/lib/terrains.ts` : la fiche publique n'affiche que les photos servies en HTTPS par Firebase Storage, et celles de l'émulateur local (`http://127.0.0.1:9199`) doivent passer.
2. **Lancer les émulateurs**, dans un terminal :
   ```bash
   cd docs/tutoriel-terrain/outils && npm run emulateurs
   ```
3. **Lancer l'application**, dans un autre terminal, à la racine :
   ```bash
   npm run build && npm start
   ```
4. **Jouer le parcours** (environ 7 minutes, les émulateurs doivent être vierges) :
   ```bash
   cd docs/tutoriel-terrain/outils
   npm run captures          # → captures-brutes/
   npm run reduire           # → ../source/captures/
   npm run pdf && npm run verifier
   ```
5. **Tout remettre en place** :
   ```bash
   git checkout -- src/lib/firebase.ts next.config.ts src/lib/terrains.ts && rm .env.local
   ```

Bon à savoir pour les scripts :

- Yawo (le gérant) fait tout à l'écran, candidature comprise. Sont joués en coulisses, sans capture et par les vraies routes de l'API (`api()` dans `admin.mjs`) : la décision de l'équipe KoppaFoot sur les candidatures, les demandes de créneau des deux clubs, et Kokou qui prend le créneau proposé. Edem programme son amical à l'écran (chapitre 5).
- Les dates du guide sont fixées dans `roster.mjs` (samedi 3 octobre 2026, jeudis jusqu'au 17 décembre) : les rejouer après ces dates demande de les avancer.
- La photo du terrain est `public/branding/fan_terrain.png`.
- Les repères orange sont posés par `mark()` dans `lib.mjs`. Les captures « zone » (`region()`) agrandissent la fenêtre au lieu de coudre une capture pleine page ; les options `bas` et `depuis` bornent la capture sous ou au-dessus d'un élément donné.
- Chromium : celui de Playwright par défaut, ou `CHROMIUM_PATH=/chemin/vers/chromium`.
