# Vidéo annonceurs : ta marque au bord du terrain

Une vidéo de 30 secondes, verticale (1080 × 1920, 9:16), pour vendre l'offre partenaires et annonces aux marques locales. Elle est faite pour les statuts WhatsApp, TikTok, Reels, ou pour être envoyée directement à un commerçant.

**→ [Annonceurs-KoppaFoot.mp4](Annonceurs-KoppaFoot.mp4)** (H.264, 30 images/s, sans son)

| Temps | Scène |
|---|---|
| 0 – 3 s | « Annonceurs : ta marque au bord du terrain. » La bannière d'une marque surgit. |
| 3 – 12,5 s | **7 emplacements, partout où ça joue.** Un projecteur se pose sur la marque, à quatre endroits de l'application : le Direct, la fiche du match (« Présenté par »), la page de la compétition, puis la Tribune, où les annonces se relaient avec leur nom et leurs points. |
| 12,5 – 19 s | **Deux formules.** *Partenaire* : seul à l'affiche, « Présenté par » sur sa compétition. *Annonce* : une bannière en rotation, un prix plus doux. Le format demandé : une bannière 1200 × 300 ou un logo. |
| 19 – 25,5 s | **Chaque vue est comptée.** Une vue ne compte que si la marque est vraiment à l'écran. Le bilan s'anime : vues, clics, taux de clic. |
| 25,5 – 30 s | Fin : logo, « Le foot de quartier, ta vitrine. », « Deviens partenaire », koppafoot.com |

Tout ce que la vidéo affirme correspond au code (`lib/partenaires`, `components/partenaires/Emplacement`) :

- **Les sept emplacements** : `EMPLACEMENTS`.
- **Les deux formules** : `TYPES`.
- **La rotation** : une annonce toutes les 8 s.
- **Le format** : la bannière 4:1 conseillée en 1200 × 300.
- **Le comptage des vues** : une vue est comptée quand la marque est à moitié visible au moins, une fois par affichage.

## Les chiffres du bilan sont un exemple

12 480 vues et 437 clics ne viennent d'aucune campagne réelle, et la carte porte la mention **« Exemple »**. Pour une vidéo qui affiche de vrais résultats :

1. Relever les chiffres d'une campagne dans l'administration (Admin › Partenaires).
2. Les reporter dans `BILAN`, en haut du script de `source/animation.html`. Le taux de clic s'en déduit.
3. Retirer la mention `Exemple`.
4. Refaire le rendu (`node rendu.mjs`, environ une minute).

## Rien de réel à l'écran

- **Les marques sont inventées** : Sika Jus, Novo Assurances, Pharmacie de la Lagune, Mawuli Auto. Leurs bannières sont dessinées par `outils/visuels.mjs`. Aucune vraie marque ne se voit prêter une campagne qu'elle n'a pas achetée.
- **Les personnes et les équipes sont fictives**, celles des autres vidéos : l'Avenir d'Adakpamé contre l'Olympique de Tokoin, et Elikem, le supporter qui tient le téléphone.
- **Les écrans sont de vraies captures de l'application**, jouées sur les **émulateurs Firebase**. Aucune donnée de production n'a été lue ni écrite.
- La carte « Pour bien démarrer » d'Elikem est retirée de la capture : c'est un accompagnement propre à son compte.

## Ajouter une musique

La vidéo est muette exprès : sur TikTok, Reels ou dans un statut, la musique se choisit dans l'application au moment de publier. Pour l'intégrer au fichier :

```bash
ffmpeg -i Annonceurs-KoppaFoot.mp4 -i musique.mp3 -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -shortest -af "afade=t=out:st=27.5:d=2.5" avec-musique.mp4
```

## Contenu du dossier

```
Annonceurs-KoppaFoot.mp4      la vidéo
source/
  animation.html              l'animation : une ligne de temps GSAP, image par image
  ecrans/                     les pages filmées (entières, plus l'en-tête et la barre du bas à part)
  cibles.js                   où est la marque sur chaque page (généré)
  images/bannieres/           les visuels des marques fictives et l'affiche de la Coupe des Quartiers
  images/, fonts/             logo, écussons fictifs, Outfit et DM Sans
outils/
  visuels.mjs                 dessine les bannières (1200 × 300) et l'affiche
  decor.mjs                   pose le décor sur les émulateurs : compétition, match en direct,
                              Tribune, partenaires, annonces, Elikem
  tournage.mjs                filme les quatre pages sur un téléphone (390 × 844, ×3)
  preparer-ecrans.py          captures-brutes → source/ecrans + source/cibles.js
  rendu.mjs                   source/animation.html → MP4 (ou quelques images d'aperçu)
```

## Retoucher l'animation

`source/animation.html` s'ouvre directement dans Chrome : elle se joue en temps réel, c'est l'aperçu. Tous les temps (en secondes) sont dans le script, scène par scène :

- `montrer()` fait entrer une page, la fait défiler jusqu'à la marque et y allume le projecteur ;
- `relais()` fait se relayer des bannières ;
- `titre()` et `surgir()` gèrent le reste.

```bash
cd docs/video-annonceurs/outils
npm install                                  # playwright, gsap
pip install pillow imageio-ffmpeg            # ffmpeg avec x264, sans installation système
node rendu.mjs --apercu 4.6,11.4,16,23.5     # quelques images → apercu/
node rendu.mjs                               # → ../Annonceurs-KoppaFoot.mp4 (environ une minute)
```

## Refaire le tournage (après un changement d'interface)

Prérequis : Node 20+, Java (émulateur Firestore), Python 3 avec Pillow.

1. **Brancher l'application sur les émulateurs.** Ce réglage est local : ne jamais le commiter.
   ```bash
   git apply docs/tutoriel-organisateur/outils/emulateurs/emulateurs.patch
   cp docs/tutoriel-organisateur/outils/emulateurs/env.local.exemple .env.local
   # puis remplacer FIREBASE_PRIVATE_KEY par une clé jetable (openssl genrsa 2048)
   ```
2. **Lancer les émulateurs** : `cd docs/tutoriel-organisateur/outils && npm install && npm run emulateurs`
3. **Lancer l'application**, à la racine : `npm run dev`
4. **Dessiner, poser le décor, tourner, préparer, rendre** (quelques minutes en tout) :
   ```bash
   cd docs/video-annonceurs/outils
   node visuels.mjs && node decor.mjs && node tournage.mjs && python3 preparer-ecrans.py && node rendu.mjs
   ```
5. **Tout remettre en place** :
   ```bash
   git apply -R docs/tutoriel-organisateur/outils/emulateurs/emulateurs.patch && rm .env.local
   ```

Bon à savoir :

- Le match est posé **en direct, le jour même**, en seconde mi-temps (période 3), à la 67e minute. Le tournage doit suivre de près `decor.mjs` : l'horloge tourne.
- Les visuels sont rangés en `data:` URI dans Firestore. Pas de Storage à remplir.
- `tournage.mjs` mesure ce qui reste collé à l'écran (l'en-tête, la barre du bas) et le capture à part : la vidéo fait défiler la page dessous, comme dans l'application.
