# Vidéo joueur : « Tes buts t'attendent »

Une vidéo de 50 secondes, verticale (1080 × 1920, 9:16), pour les statuts WhatsApp, TikTok, Reels et Shorts. Elle s'adresse au joueur de quartier qui joue déjà dans une équipe suivie sur KoppaFoot, mais **sans compte** : ses buts sont sur les feuilles de match, à son nom, et ne mènent nulle part. Elle l'invite à créer son compte, à récupérer ses stats et à vivre l'expérience KoppaFoot, **tout de son point de vue** : on ne voit que ce qu'Ekoué voit sur son téléphone.

**→ [Tes-buts-t-attendent-KoppaFoot.mp4](Tes-buts-t-attendent-KoppaFoot.mp4)** (H.264, 30 images/s, 9,6 Mo ; bruitages en AAC à -14 LUFS, ni musique ni voix)

Le scénario, validé le 2026-11-04 puis resserré le 2026-11-05 sur le point de vue du joueur, est dans [scenario.md](scenario.md).

| Temps | Scène |
|---|---|
| 0 – 4 s | « Ce doublé, c'est le tien. » La fiche du match de dimanche dernier : Ekoué Bawa, deux buts, homme du match |
| 4 – 9 s | Au classement des joueurs, il est premier, mais sans photo, et sa ligne ne mène nulle part : « Mais personne ne sait que c'est toi. » |
| 9 – 11 s | Coup de sifflet, noir : « Récupère tes stats en 3 étapes » |
| 11 – 20 s | 1. Crée ton compte : le prénom et le nom tapés lettre par lettre, « Créer mon compte » |
| 20 – 27 s | 2. Rejoins ton équipe : la notification, l'invitation d'Edem, « Accepter » |
| 27 – 34 s | 3. Tes buts te suivent : sa fiche vide, puis avec 1 match, 2 buts, 1 passe |
| 34 – 41 s | Grimpe au classement : le même classement, avec sa photo, et sa ligne mène à sa fiche |
| 41 – 46 s | Le joueur de la semaine : la diapositive du Direct, « Partager », l'affiche prête pour un statut |
| 46 – 50 s | Fin : logo, « Tu joues déjà. Tes buts t'attendent. », « Crée ton compte », koppafoot.com |

## Ce que la vidéo dit, et pourquoi

- **Le joueur ne réclame pas sa ligne lui-même.** Le bouton « Rattacher » de l'effectif d'une compétition est réservé au superadmin (`RosterClaimList`). Ce sont les gestes du manager qui rendent les stats :
  - en amical : la fusion du joueur sans compte avec le compte qu'il vient de créer (« Fusionner un joueur », `/api/teams/merge-ghost`) ;
  - en compétition : le rapprochement des lignes à l'inscription ou par « Resynchroniser » (`lib/fusion-import`).

  La fusion se joue en coulisses, la vidéo restant du point de vue du joueur ; le sous-titre de l'étape 3 dit d'où viennent ses buts : « Ton manager confirme que c'est toi ».
- **Le classement se recalcule à la fusion** depuis la PR #182 : la vidéo le montre juste après.
- **Le joueur de la semaine** apparaît sur le Direct et dans Top performances depuis la PR #181, construite pour cette vidéo. La vidéo filme ces écrans-là.
- **Les passes en direct** n'atteignaient pas la carrière, et la fusion laissait les matchs d'avant à un second joueur au classement. C'est corrigé dans la PR #182, sur laquelle le tournage s'appuie.

Les écrans du téléphone sont de **vraies captures** de l'application (le site, au format téléphone), jouée de bout en bout sur les **émulateurs Firebase** avec des comptes fictifs. Ce sont les clubs et les joueurs de la [vidéo manager](../video-manager/) : l'Avenir d'Adakpamé contre l'Olympique de Tokoin.

Les photos de profil d'Ekoué et de Kafui sont des **illustrations** dessinées par `gen-assets.mjs`, pas des photos : personne de réel n'y figure. La console live, l'invitation, la fusion et la publication du joueur de la semaine se jouent en coulisses. Aucune donnée de production n'a été lue ni écrite.

Les éléments dessinés dans l'animation sont la frappe au clavier, les touchers, les titres et la fin.

## Contenu du dossier

```
Tes-buts-t-attendent-KoppaFoot.mp4   la vidéo
scenario.md                          le scénario validé
source/
  animation.html                     l'animation : une ligne de temps GSAP, image par image
  ecrans/                            les écrans filmés, réduits (900 px)
  cibles.js                          où se trouvaient les boutons touchés (généré)
  images/, fonts/                    logo, écussons fictifs, Outfit et DM Sans
outils/
  j0-decor.mjs … j4-apres.mjs        le tournage, scène par scène (Playwright, format téléphone)
  decor.mjs, classement.mjs          les gestes communs : défi, feuilles, console ; le classement
  run-captures.sh                    enchaîne j0 → j4 sur des émulateurs vierges
  preparer-ecrans.py                 captures-brutes → source/ecrans + source/cibles.js
  rendu.mjs                          source/animation.html → MP4 (ou quelques images d'aperçu)
  mixage.mjs                         les bruitages, synthétisés, à -14 LUFS (gain mesuré, puis limiteur à -1,5 dB)
  lib.mjs, admin.mjs, roster.mjs     outils communs, gestes joués en coulisses, personnes fictives
  gen-assets.mjs                     écussons et portraits fictifs (illustrations)
  emulateurs/                        config des émulateurs, patch local, modèle de .env.local
```

## Retoucher l'animation

`source/animation.html` s'ouvre directement dans Chromium : elle se joue en temps réel, c'est l'aperçu. Tous les temps (en secondes) sont dans le script, scène par scène :
- `ecran()` montre un écran ;
- `toucher()` pose un doigt sur un bouton retenu au tournage ;
- `cadre()` entoure une ligne ;
- `frappe()` tape un texte dans un champ vide ;
- `titre()` fait le reste.

```bash
cd docs/video-recupere-tes-stats/outils
npm install                                  # playwright, gsap, firebase-tools
pip install pillow imageio-ffmpeg            # ffmpeg avec x264, sans installation système
node rendu.mjs --apercu 2,7,30,37,43         # quelques images → apercu/
node rendu.mjs                               # → ../Tes-buts-t-attendent-KoppaFoot.mp4 (environ 3 min)
```

Les emojis viennent de la police du système (Noto Color Emoji sous Linux).

## Refaire le tournage (après un changement d'interface)

Prérequis : Node 20+, Java (émulateur Firestore), Python 3 avec Pillow.

1. **Brancher l'application sur les émulateurs.** Ce réglage est local : ne jamais le commiter.
   ```bash
   git apply docs/video-recupere-tes-stats/outils/emulateurs/emulateurs.patch
   cp docs/video-recupere-tes-stats/outils/emulateurs/env.local.exemple .env.local
   # puis remplacer FIREBASE_PRIVATE_KEY par une clé jetable (openssl genrsa 2048, sur une ligne avec des \n)
   ```
   Le patch reprend celui des autres vidéos. Il laisse aussi l'affiche du joueur de la semaine lire les photos de l'émulateur Storage (`lib/image-sure`).
2. **Lancer les émulateurs** : `cd docs/video-recupere-tes-stats/outils && npm run emulateurs`
3. **Lancer l'application**, à la racine : `npm run build && npm start`
4. **Tourner, préparer, rendre.** Il faut des émulateurs vierges ; le tournage prend environ 20 minutes.
   ```bash
   cd docs/video-recupere-tes-stats/outils
   npm run captures && python3 preparer-ecrans.py && node rendu.mjs
   ```
5. **Tout remettre en place** : `git checkout -- src/lib/firebase.ts next.config.ts src/lib/terrains.ts src/lib/image-sure.ts && rm .env.local`

Bon à savoir :

- **Les dates se calculent depuis le jour du tournage** (`roster.mjs`) :
  - le match tombe le dimanche de la semaine passée ;
  - le joueur de la semaine est celui de cette semaine-là, que la page admin propose d'elle-même.
- **Le formulaire de défi refuse une date passée.** Le défi naît donc à la date du jour, puis il est rangé au dimanche dernier, en coulisses.
- **La console a changé depuis les vidéos précédentes** (`decor.mjs`) :
  - le coup d'envoi se donne par « Donner le ballon à … » ;
  - après un but ou la mi-temps, il faut toucher « Engagement · … ».
- **Les navigateurs du tournage bloquent le service worker de l'application** (`lib.mjs`). Gardé dans un profil d'une scène à l'autre, il bloquait la navigation suivante.
- **Le classement se régénère au plus toutes les 60 s** (ISR) : `classement.mjs` recharge la page jusqu'à y voir ce qu'il attend.
- GSAP est gratuit, usage commercial compris.
