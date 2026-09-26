# Tutoriel arbitre

Le guide pas à pas de l'arbitre : du compte à la fiche publique, en passant par le corps arbitral, les candidatures, les invitations des managers, l'équipe emmenée sur chaque match, le jour du match et les notes reçues.

**→ [Tutoriel-arbitre-KoppaFoot.pdf](Tutoriel-arbitre-KoppaFoot.pdf)** (A4, prêt à partager ou à imprimer)

| Chapitre | Contenu |
|---|---|
| 00 | Avant de commencer (avant, pendant, après : l'arbitre dirige, le scoreur tient la console) |
| 01 | Devenir arbitre (rôle, inscription, « Pour bien démarrer », licence) |
| 02 | Former son corps arbitral (créer, inviter arbitres et scoreurs, réponse de l'invité, retirer, dissoudre) |
| 03 | Trouver un match (Mes désignations, marché par ville, candidature, réponse du manager) |
| 04 | Répondre à une invitation (le manager cherche un arbitre, accepter ou décliner) |
| 05 | Emmener son équipe (assistants et scoreur par match, ce que voit chacun, fiche du match) |
| 06 | Le jour du match (feuilles de match, console en secours, désistement) |
| 07 | Après le match (notes des managers, historique, fiche publique) |
| 08 | Sur téléphone |
| + | Aide-mémoire « ta semaine d'arbitre », questions fréquentes |

Même univers que les guides [organisateur](../tutoriel-organisateur/), [manager](../tutoriel-manager/), [joueur](../tutoriel-joueur/), [gérant de terrain](../tutoriel-terrain/) et [installation](../tutoriel-installation/) : on suit Komi Adjovi, arbitre régional à Lomé, son corps arbitral « Les Sifflets du Golfe » (Yao Mensah, assistant, et Afi Lawson, scoreuse), et les managers Edem Amouzou (Avenir d'Adakpamé) et Kokou Tepe (Olympique de Tokoin). Toutes les captures viennent de l'application réelle, jouée de bout en bout sur les **émulateurs Firebase** avec des comptes fictifs. Aucune donnée de production n'a été lue ni écrite.

## Contenu du dossier

```
Tutoriel-arbitre-KoppaFoot.pdf        le document final
source/
  tutoriel.html                       le texte et la mise en page (imprimé en PDF par Chromium)
  captures/                           les captures, réduites pour l'impression
  fonts/, couverture.jpg              Outfit, DM Sans, photo de couverture (public/branding/role_arbitre.png)
outils/
  t0-decor.mjs                        le décor, sans capture : clubs, managers, membres du futur corps arbitral, matchs
  t1-inscription.mjs … t8-telephone.mjs  le parcours de l'arbitre, chapitre par chapitre (Playwright)
  run-all.sh                          enchaîne t0 → t8 sur des émulateurs vierges
  lib.mjs, admin.mjs, roster.mjs      outils communs, gestes joués en coulisses, personnes et matchs fictifs
  gen-assets.mjs                      écussons fictifs
  reduire-captures.py                 captures brutes → source/captures
  build-pdf.mjs                       source/tutoriel.html → PDF
  verifier-pdf.py, apercu-pdf.py      contrôles du PDF (débris en bas de page, planches d'aperçu)
  emulateurs/                         config des émulateurs, patch local, modèle de .env.local
```

## Modifier le texte

Éditer `source/tutoriel.html`, puis reconstruire le PDF :

```bash
cd docs/tutoriel-arbitre/outils
npm install                 # playwright, firebase-tools
npx playwright install chromium
npm run pdf                 # → ../Tutoriel-arbitre-KoppaFoot.pdf
npm run verifier            # doit afficher « débris : 0 »
```

## Refaire les captures (après un changement d'interface)

Prérequis : Node 20+, Java (émulateur Firestore), Python 3 avec Pillow et PyMuPDF (`pip install pillow pymupdf`).

1. **Brancher l'application sur les émulateurs** : ce réglage est local, ne jamais le commiter.
   ```bash
   git apply docs/tutoriel-arbitre/outils/emulateurs/emulateurs.patch
   cp docs/tutoriel-arbitre/outils/emulateurs/env.local.exemple .env.local
   # puis remplacer FIREBASE_PRIVATE_KEY par une clé jetable (openssl genrsa 2048)
   ```
2. **Lancer les émulateurs**, dans un terminal :
   ```bash
   cd docs/tutoriel-arbitre/outils && npm run emulateurs
   ```
3. **Lancer l'application**, dans un autre terminal, à la racine :
   ```bash
   npm run build && npm start
   ```
4. **Jouer le parcours** (environ 10 minutes, les émulateurs doivent être vierges) :
   ```bash
   cd docs/tutoriel-arbitre/outils
   npm run captures          # → captures-brutes/
   npm run reduire           # → ../source/captures/
   npm run pdf && npm run verifier
   ```
5. **Tout remettre en place** :
   ```bash
   git checkout -- src/lib/firebase.ts next.config.ts src/lib/terrains.ts && rm .env.local
   ```

Bon à savoir pour les scripts :

- Komi (l'arbitre) fait tout à l'écran : inscription, licence, corps arbitral, candidature, réponse à l'invitation, équipe du match, désistement. Edem et Kokou, les managers, jouent à l'écran ce que l'arbitre doit connaître d'eux (accepter une candidature, chercher un arbitre, noter l'arbitrage). Sont joués en coulisses, sans capture : la création des matchs, la réponse d'Afi à son invitation, le match lui-même (score posé puis fin du match par la vraie route `/api/matches/complete`, au nom d'Afi) et la note de Kokou (par `/api/matches/validation`).
- Afi est scoreuse validée (`is_scorer`) dès le décor : sa candidature de scoreuse n'est pas l'objet de ce guide.
- `run-all.sh` joue le chapitre 8 (téléphone) avant le 7 : le match du samedi doit être encore à venir.
- Les dates du guide sont fixées dans `roster.mjs` (samedi 3, dimanche 11 et samedi 17 octobre 2026) : les rejouer après ces dates demande de les avancer.
- Les repères orange sont posés par `mark()` dans `lib.mjs`. Les captures « zone » (`region()`) agrandissent la fenêtre au lieu de coudre une capture pleine page ; les options `bas` et `depuis` bornent la capture sous ou au-dessus d'un élément donné. `BUREAU` (1100 px) garde lisibles les pages pleine largeur.
- Chromium : celui de Playwright par défaut, ou `CHROMIUM_PATH=/chemin/vers/chromium`.
