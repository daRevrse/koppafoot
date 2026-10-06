# Vidéo YouTube #1 : suivre son match sans être au stade

« Et si tu pouvais suivre ton match… même à distance ? » Une vidéo de 48 secondes, verticale (1080 × 1920, 9:16), pour les Shorts, TikTok et Reels. Elle ouvre la série de lancement de la chaîne KoppaFoot.

**→ [Suivre-son-match-KoppaFoot.mp4](Suivre-son-match-KoppaFoot.mp4)** (H.264, 30 images/s, son AAC à -14 LUFS)

| Temps | Scène |
|---|---|
| 0 – 5 s | Le terrain, en vrai : « Ton équipe joue. » L'image se floute : « Mais tu n'es pas au stade. » |
| 5 – 12 s | Le groupe des supporters s'impatiente : « Le match a commencé ? », « C'est combien ? », « Qui a marqué ?? » |
| 12 – 15 s | Coup de sifflet, noir : « Et si tu pouvais suivre ton match… même à distance ? » |
| 15 – 20 s | Sur KoppaFoot : la fiche du match, la cloche, « Tu suis ce match » |
| 20 – 30 s | L'écran verrouillé se remplit : coup d'envoi, but (23'), mi-temps, but (67'), score final |
| 30 – 34 s | La fiche du match s'ouvre : tout le fil, le carton jaune (37') compris |
| 34 – 38 s | La réponse au groupe : « 2 – 0 ! » « T'es au terrain ?? » « Non. Je le suis sur KoppaFoot 😎 » |
| 38 – 43 s | Le but de Gilles : « Le foot amateur mérite aussi d'être suivi. » |
| 43 – 48 s | Fin : logo, « Le foot amateur en temps réel. », « Suis le prochain match », koppafoot.com |

Trois sources d'images :

- **Deux plans réels**, filmés au bord du terrain par Gilles (iPhone, vertical, 60 images/s), avec leur son d'origine. Le découpage est dans `outils/montage.mjs`.
- **Les écrans de l'application**, de vraies captures, jouées sur les **émulateurs Firebase** avec les comptes fictifs de la [vidéo manager](../video-manager/) (Avenir d'Adakpamé contre l'Olympique de Tokoin). Elikem, le supporter, suit le match depuis son téléphone. La console se tient en coulisses. Aucune donnée de production n'a été lue ni écrite.
- **Le reste est dessiné** : le groupe de discussion, l'écran verrouillé et la fin. Les notifications reprennent mot pour mot ce que la console envoie aux abonnés d'un match (voir `LiveMatchConsole`). Le carton jaune n'en envoie pas (« un jaune ne sonne pas ») : la vidéo le montre sur la fiche, pas sur l'écran verrouillé.

Pas de musique : le son est celui du terrain, plein quand on le voit, étouffé quand on n'y est pas, plus les bruitages de l'interface (bulles, toucher, notifications, vibration), synthétisés par ffmpeg. Pour ajouter une piste de la bibliothèque audio YouTube, mieux vaut le faire dans YouTube Studio, sous le son d'origine.

## Les plans d'origine ne sont pas dans le dépôt

Ils pèsent 100 Mo et portent la **position GPS du tournage**. Le dépôt ne garde que la vidéo finale, sans métadonnées, et le fond de l'écran verrouillé (une image tirée d'un plan, sans métadonnées). Pour refaire la vidéo, il faut les deux fichiers d'origine, sous ces noms :

```
outils/rushes/but.mov      « plan qui finit sur un but de Gilles »  (27,2 s)
outils/rushes/faute.mov    « plan qui finit sur une faute sifflée »  (20,5 s)
```

## Contenu du dossier

```
Suivre-son-match-KoppaFoot.mp4    la vidéo
source/
  animation.html                  l'animation : une ligne de temps GSAP, image par image
  ecrans/                         les écrans filmés, réduits (900 px)
  cibles.js                       où se trouvaient les boutons touchés (généré)
  plans/                          les morceaux des plans réels et leurs images (générés, non versionnés)
  images/, fonts/                 logo, écussons fictifs, fond de l'écran verrouillé, Outfit et DM Sans
outils/
  montage.mjs                     le découpage des plans réels : quel morceau, à quel moment, quel son
  preparer-plans.mjs              rushes/ → source/plans/ (morceaux sans métadonnées, images, plans.js)
  s0-decor.mjs, s1-supporter.mjs  le tournage des écrans (Playwright, format téléphone)
  run-captures.sh                 enchaîne s0 → s1 sur des émulateurs vierges
  preparer-ecrans.py              captures-brutes → source/ecrans + source/cibles.js
  rendu.mjs                       source/animation.html → vidéo muette (ou quelques images d'aperçu), puis le son
  mixage.mjs                      le son : plans réels, coup de sifflet, bruitages, -14 LUFS
  lib.mjs, admin.mjs, roster.mjs  outils communs, gestes joués en coulisses, personnes fictives
  gen-assets.mjs                  écussons fictifs
  emulateurs/                     config des émulateurs, patch local, modèle de .env.local
```

## Retoucher l'animation

`source/animation.html` s'ouvre directement dans Chromium : elle se joue en temps réel, c'est l'aperçu. Les temps sont dans le script, scène par scène ; ceux des plans réels dans `outils/montage.mjs`.

```bash
cd docs/video-suivre-match/outils
npm install                                  # playwright, gsap, firebase-tools
pip install pillow imageio-ffmpeg            # ffmpeg avec x264, sans installation système
node preparer-plans.mjs                      # une fois, avec les plans dans rushes/ (environ 3 min)
node rendu.mjs --apercu 1,9.5,24             # quelques images → apercu/
node rendu.mjs                               # → ../Suivre-son-match-KoppaFoot.mp4 (environ 5 min)
```

Les emojis viennent de la police du système (Noto Color Emoji sous Linux).

## Refaire les écrans (après un changement d'interface)

Prérequis : Node 20+, Java (émulateur Firestore), Python 3 avec Pillow.

1. **Brancher l'application sur les émulateurs** : ce réglage est local, ne jamais le commiter.
   ```bash
   git apply docs/video-suivre-match/outils/emulateurs/emulateurs.patch
   cp docs/video-suivre-match/outils/emulateurs/env.local.exemple .env.local
   # puis remplacer FIREBASE_PRIVATE_KEY par une clé jetable (openssl genrsa 2048)
   ```
2. **Lancer les émulateurs** : `cd docs/video-suivre-match/outils && npm run emulateurs`
3. **Lancer l'application**, à la racine : `npm run build && npm start`
4. **Tourner, préparer, rendre** (émulateurs vierges, environ 10 minutes de tournage) :
   ```bash
   cd docs/video-suivre-match/outils
   npm run captures && python3 preparer-ecrans.py && node rendu.mjs
   ```
5. **Tout remettre en place** : `git checkout -- src/lib/firebase.ts next.config.ts src/lib/terrains.ts && rm .env.local`

Bon à savoir :

- Le chrono de la console est posé à 22, 36 et 66 minutes écoulées : elle note alors la 23e, la 37e et la 67e minute, celles des notifications dessinées.
- La date du match est fixée dans `roster.mjs` (dimanche 4 octobre 2026) : la rejouer après cette date demande de l'avancer.
- Chromium : celui de Playwright par défaut, ou `CHROMIUM_PATH=/chemin/vers/chromium`.
- GSAP est gratuit, usage commercial compris.
