# Vidéo manager : du zéro au premier match

Une vidéo de 60 secondes, verticale (1080 × 1920, 9:16), pour les statuts WhatsApp, TikTok ou Reels : un manager crée son équipe, recrute au mercato, défie une équipe, et suit son premier match en direct jusqu'à la victoire.

**→ [Manager-premier-match-KoppaFoot.mp4](Manager-premier-match-KoppaFoot.mp4)** (H.264, 30 images/s, sans son)

| Temps | Scène |
|---|---|
| 0 – 3 s | « Manager ? Ton premier match en 60 s » |
| 3 – 13 s | 1. Crée ton équipe : le formulaire, le nom tapé lettre par lettre, la fiche avec son écusson |
| 13 – 25 s | 2. Recrute tes joueurs : mercato, sélection, invitation, les joueurs qui rejoignent, l'effectif |
| 25 – 36 s | 3. Défie une équipe : l'adversaire, la date, le terrain, le défi accepté |
| 36 – 51 s | 4. Le match en direct : la fiche du match suivie sur téléphone, trois buts, la victoire |
| 51 – 55 s | Ton palmarès se construit : la fiche de l'équipe après le match |
| 55 – 60 s | Fin : logo, « Ton équipe. Tes matchs. Ton palmarès. », appel à l'action |

Les écrans du téléphone sont de **vraies captures** de l'application, jouée de bout en bout sur les **émulateurs Firebase** avec des comptes fictifs (les mêmes personnes que le [guide manager](../tutoriel-manager/)). La console live n'apparaît pas : le match se joue en coulisses, et la vidéo montre ce que voient les joueurs et les supporters. Aucune donnée de production n'a été lue ni écrite.

La vidéo est **sans son** : sur téléphone, la plupart se regardent sans. Pour y ajouter une musique libre de droits :

```bash
ffmpeg -i Manager-premier-match-KoppaFoot.mp4 -i musique.mp3 -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -shortest -af "afade=t=out:st=57:d=3" avec-musique.mp4
```

## Contenu du dossier

```
Manager-premier-match-KoppaFoot.mp4   la vidéo
source/
  animation.html                      l'animation : une ligne de temps GSAP, image par image
  ecrans/                             les écrans filmés, réduits (900 px)
  cibles.js                           où se trouvaient les boutons touchés (généré)
  images/, fonts/                     logo, écussons fictifs, Outfit et DM Sans
outils/
  v0-decor.mjs … v5-apres.mjs         le tournage, scène par scène (Playwright, format téléphone)
  run-captures.sh                     enchaîne v0 → v5 sur des émulateurs vierges
  preparer-ecrans.py                  captures-brutes → source/ecrans + source/cibles.js
  rendu.mjs                           source/animation.html → MP4 (ou quelques images d'aperçu)
  lib.mjs, admin.mjs, roster.mjs      outils communs, gestes joués en coulisses, personnes fictives
  gen-assets.mjs                      écussons et bannière fictifs
  emulateurs/                         config des émulateurs, patch local, modèle de .env.local
```

## Retoucher l'animation

`source/animation.html` s'ouvre directement dans Chrome : elle se joue en temps réel, c'est l'aperçu. Tous les temps (en secondes) sont dans le script, scène par scène : `ecran()` montre un écran, `toucher()` pose un doigt sur un bouton retenu au tournage, `titre()`, `surgir()` et `but()` font le reste.

```bash
cd docs/video-manager/outils
npm install                                  # playwright, gsap, firebase-tools
pip install pillow imageio-ffmpeg            # ffmpeg avec x264, sans installation système
node rendu.mjs --apercu 5,12.5,40            # quelques images → apercu/
node rendu.mjs                               # → ../Manager-premier-match-KoppaFoot.mp4 (environ 5 min)
```

## Refaire le tournage (après un changement d'interface)

Prérequis : Node 20+, Java (émulateur Firestore), Python 3 avec Pillow.

1. **Brancher l'application sur les émulateurs** : ce réglage est local, ne jamais le commiter.
   ```bash
   git apply docs/video-manager/outils/emulateurs/emulateurs.patch
   cp docs/video-manager/outils/emulateurs/env.local.exemple .env.local
   # puis remplacer FIREBASE_PRIVATE_KEY par une clé jetable (openssl genrsa 2048)
   ```
2. **Lancer les émulateurs** : `cd docs/video-manager/outils && npm run emulateurs`
3. **Lancer l'application**, à la racine : `npm run build && npm start`
4. **Tourner, préparer, rendre** (émulateurs vierges, environ 15 minutes de tournage) :
   ```bash
   cd docs/video-manager/outils
   npm run captures && python3 preparer-ecrans.py && node rendu.mjs
   ```
5. **Tout remettre en place** : `git checkout -- src/lib/firebase.ts next.config.ts src/lib/terrains.ts && rm .env.local`

Bon à savoir :

- Edem (le manager) fait tout à l'écran, sur un téléphone (390 × 844). Sont joués en coulisses : les inscriptions des joueurs, Kokou qui accepte le défi, les feuilles de match et la console (buts, mi-temps, coup de sifflet final), comme dans le guide manager.
- Chaque toucher de la vidéo est posé là où se trouvait le bouton au moment de la capture (`cible()` dans `lib.mjs`, `cibles.json`) : si l'interface bouge, le doigt suit au prochain tournage.
- La date du match est fixée dans `roster.mjs` (dimanche 4 octobre 2026) : la rejouer après cette date demande de l'avancer.
- GSAP est gratuit, usage commercial compris.
