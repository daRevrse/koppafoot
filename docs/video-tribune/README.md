# Vidéo Tribune : le foot de quartier a sa tribune

Une vidéo de 30 secondes, verticale (1080 × 1920, 9:16), pour faire connaître la Tribune, le fil où joueurs, managers et supporters racontent leurs matchs. Elle est faite pour les statuts WhatsApp, TikTok ou Reels.

**→ [Tribune-KoppaFoot.mp4](Tribune-KoppaFoot.mp4)** (H.264, 30 images/s, sans son)

| Temps | Scène |
|---|---|
| 0 – 3,8 s | Une tribune de stade, la nuit : la foule fait la ola. « La Tribune : le foot de quartier a sa tribune. » Des bulles surgissent de la foule : « Quel but ! », « On remet ça samedi ? »… |
| 3,8 – 10,6 s | **1 · Raconte ton match.** Kafui tape sa publication (« Victoire 3-1 ce soir à Bè ! Doublé pour moi… »), ajoute sa photo, publie. « Publié, avec ta photo ». |
| 10,6 – 17,2 s | **2 · Ta tribune s'enflamme.** Des cœurs s'envolent du bouton J'aime ; les compteurs montent (48 j'aime, 3 commentaires) ; les commentaires sortent du téléphone en grandes bulles. |
| 17,2 – 23,6 s | **3 · Les résultats tombent ici.** Le fil défile et le projecteur se pose sur les publications du compte officiel KoppaFoot : un résultat, l'ouverture des inscriptions, un vainqueur. |
| 23,6 – 26,8 s | « Joueurs, managers, supporters : tout le foot de quartier, au même endroit. » |
| 26,8 – 30 s | Fin : logo, « Ta tribune t'attend. », « Rejoins la Tribune », koppafoot.com |

Ce que la vidéo montre est dans le produit :

- **La publication avec une photo** et sa confirmation (« Publication réussie avec photo ») : `feed/page`.
- **Les réactions** : j'aime, commentaires, badges Joueur et Manager (`components/feed/PostCard`, `CommentSection`).
- **Le compte officiel** publie les résultats, l'ouverture des inscriptions et le vainqueur d'une compétition avec les textes exacts du serveur (`lib/tribune-server`, `announcementFor`).

La vidéo ne parle ni de la notification de commentaire, ni de l'annonce de recrutement signée du manager : elle a été tournée avant que le produit les ait. La [vidéo de présentation](../video-presentation/scenario.md) les montre.

**Les écrans du téléphone sont de vraies captures**, jouées sur les **émulateurs Firebase** : Kafui publie vraiment, et les réactions sont posées par `decor.mjs reactions`. Les personnes et les équipes sont fictives, celles des autres vidéos. La photo publiée vient de `public/branding/fan_terrain.png`. La foule, les cœurs, les bulles et les titres sont dessinés dans `source/animation.html`. Aucune donnée de production n'a été lue ni écrite.

## Ajouter une musique

La vidéo est muette exprès : sur TikTok, Reels ou dans un statut, la musique se choisit dans l'application au moment de publier. Pour l'intégrer au fichier :

```bash
ffmpeg -i Tribune-KoppaFoot.mp4 -i musique.mp3 -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -shortest -af "afade=t=out:st=27.5:d=2.5" avec-musique.mp4
```

## Contenu du dossier

```
Tribune-KoppaFoot.mp4         la vidéo
source/
  animation.html              l'animation : la foule (canevas), les états du téléphone, une ligne de temps GSAP
  ecrans/                     les cinq états filmés (vide, texte, photo, publié, réactions), en entier
  cibles.js                   où sont la zone de saisie, les boutons, la publication, les publications officielles (généré)
  images/, fonts/             logo, symbole, Outfit et DM Sans
outils/
  decor.mjs                   pose la Tribune sur les émulateurs ; « reactions » ajoute les j'aime et les commentaires
  tournage.mjs                filme les cinq états sur un téléphone (390 × 844, ×3) et note les positions
  preparer-ecrans.py          captures-brutes → source/ecrans + source/cibles.js
  rendu.mjs                   source/animation.html → MP4 (ou quelques images d'aperçu)
```

## Retoucher et rendre

`source/animation.html` s'ouvre directement dans Chrome : elle se joue en temps réel, c'est l'aperçu. Tous les temps (en secondes) sont dans le script, scène par scène :

- `montrer()` fait passer un état devant le précédent ;
- `defiler()` fait défiler la page ;
- `projecteur()` éclaire une publication ;
- `toucher()` pose un doigt ;
- `dessinerFoule(t)` dessine la tribune à l'instant `t`, la même image quel que soit l'ordre du rendu.

```bash
cd docs/video-tribune/outils
npm install                                  # playwright, gsap
pip install pillow imageio-ffmpeg            # ffmpeg avec x264, sans installation système
node rendu.mjs --apercu 2.2,9.3,11.9,18.7    # quelques images → apercu/
node rendu.mjs                               # → ../Tribune-KoppaFoot.mp4 (environ trois minutes)
```

## Refaire le tournage (après un changement d'interface)

1. **Brancher l'application sur les émulateurs.** Ce réglage est local : ne jamais le commiter.
   ```bash
   git apply docs/tutoriel-organisateur/outils/emulateurs/emulateurs.patch
   cp docs/tutoriel-organisateur/outils/emulateurs/env.local.exemple .env.local
   # puis remplacer FIREBASE_PRIVATE_KEY par une clé jetable (openssl genrsa 2048)
   ```
2. **Lancer les émulateurs** : `cd docs/tutoriel-organisateur/outils && npm install && npm run emulateurs`
3. **Lancer l'application**, à la racine : `npm run dev`
4. **Poser le décor, tourner, préparer, rendre** :
   ```bash
   cd docs/video-tribune/outils
   node decor.mjs && node tournage.mjs && python3 preparer-ecrans.py && node rendu.mjs
   ```
   `tournage.mjs` appelle lui-même `decor.mjs reactions` entre la publication et les réactions.
5. **Tout remettre en place** :
   ```bash
   git apply -R docs/tutoriel-organisateur/outils/emulateurs/emulateurs.patch && rm .env.local
   ```
