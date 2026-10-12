# Vidéo de présentation KoppaFoot (YouTube)

Une vidéo de **2 min 50**, horizontale (1920 × 1080, 16:9, 30 images/s), pour la chaîne YouTube. Elle présente toute l'application en suivant **un week-end de l'Avenir d'Adakpamé**, du recrutement au palmarès. Le scénario et le texte de la voix off sont dans [scenario.md](scenario.md).

**→ [Presentation-KoppaFoot.mp4](Presentation-KoppaFoot.mp4)** (H.264, AAC 192 kb/s, son à -14 LUFS)
**→ [Presentation-KoppaFoot.fr.srt](Presentation-KoppaFoot.fr.srt)** (les sous-titres, à charger dans YouTube Studio)

| Temps | Chapitre | Ce qu'on voit |
|---|---|---|
| 0:00 | Intro | Un stade la nuit : « Chaque week-end, on joue. » Le lundi, les projecteurs s'éteignent : « Pas de score. Pas de trace. » Le logo rallume tout. |
| 0:15 | Le Direct | Elikem, le vendredi soir : les matchs du moment, son pronostic, le match qu'il suit ; la notification du but arrive. |
| 0:29 | Ton équipe | Edem crée l'Avenir d'Adakpamé, annonce son recrutement dans la Tribune, invite au mercato, accepte Dodzi, défie l'Olympique de Tokoin ; Yawo, le gérant, confirme le créneau. |
| 0:56 | Jour de match | La composition (un glisser-déposer, Ekoué déclaré blessé), la désignation de Komi, la console d'Afi (le réseau coupe, la saisie continue), l'écran verrouillé d'Elikem, le 2-0 final et l'homme du match. |
| 1:27 | La Tribune | Kafui publie sa victoire avec sa photo ; j'aime, commentaires, notification ; les publications officielles, l'annonce de recrutement, les Actus. |
| 1:46 | Ta fiche de joueur | Kafui déclare sa condition ; sa forme, « en progrès » ; le classement des joueurs, où il est premier. |
| 2:03 | Les compétitions | La Coupe des Quartiers 2026 : Edem inscrit son équipe, Kossi tire les poules et construit le calendrier ; le tableau, le classement et les buteurs sur la page publique. |
| 2:22 | Pour les terrains et les marques | L'annuaire des terrains, la fiche du Complexe sportif de Bè, la réservation confirmée, l'offre gratuite ; trois marques fictives dans le Direct, la Tribune et les Actus. |
| 2:37 | Rejoins KoppaFoot | Le stade se rallume : « Ton équipe. Tes matchs. Ton palmarès. », koppafoot.com. |

Ces temps sont les débuts des cartes de chapitre, notés par l'animation dans `outils/montage.json` à chaque rendu.

## Ce que montre la vidéo, et d'où ça vient

**Les écrans du téléphone sont de vraies captures de l'application**, jouées de bout en bout sur les **émulateurs Firebase** avec des comptes fictifs :

- les scènes `outils/p0-decor.mjs` à `outils/p9-pros.mjs` créent l'équipe, recrutent, défient, composent, jouent le match à la console, publient, organisent la coupe, comme le ferait chaque personnage, depuis l'interface ou ses routes d'API ;
- ce qui se passe hors champ est posé directement dans les émulateurs : les deux amicaux joués avant ce samedi (pour que Kafui ait une forme et une place au classement), les résultats des poules de la coupe, et le championnat qui remplit le Direct.

**Aucune donnée de production n'a été lue ni écrite.**

**Ce qui est fictif, et doit le rester :**

- **Les personnes et les clubs** : Edem Amouzou, Kafui Mensah, Komi Adjovi, Afi Lawson, Elikem Agbodjan, Yawo Agbeko, Kossi Mensah, l'Avenir d'Adakpamé, l'Olympique de Tokoin, les équipes du championnat et de la coupe. Ce sont ceux des guides et des autres vidéos du dossier `docs/`.
- **Les chiffres** : scores, notes, j'aime, frais d'inscription. Ce sont ceux du décor. La vidéo n'avance aucun chiffre d'utilisateurs ni de matchs.
- **Les Actus** : l'application y montre un vrai fil de presse. Sur les captures, ses titres, ses sources et ses photos sont remplacés par des contenus inventés (« Lomé Sport », « Le Journal du foot ») ; la mise en page reste celle de l'application (`actusFictives`, dans `outils/lib.mjs`).
- **Les marques** : Sika Jus, Novo Assurances et Mawuli Auto sont inventées. Ce sont les bannières de la [vidéo annonceurs](../video-annonceurs/).
- **Les écussons et la bannière** sont dessinés par `outils/gen-assets.mjs`. La photo publiée dans la Tribune est `public/branding/fan_terrain.png`.

**Ce que la vidéo ne montre pas** : le paiement mobile des réservations, qui n'est pas dans l'application. L'équipe demande un créneau, le gérant le confirme.

L'annuaire des terrains porte, en haut de l'écran, le nom de la vitrine terrains de KoppaFoot, **MyFields** (`src/config/vitrines.ts`) : c'est l'écran tel qu'il est.

Les titres, les puces, la carte de chaque chapitre, le stade, l'écran verrouillé d'Elikem et les bannières de notification sont dessinés dans `source/animation.html`. Les notifications reprennent le texte de celles de l'application.

## Le son

- **La voix off** : les neuf fichiers de `voix/`, un par scène, générés par une IA à partir du texte de [scenario.md](scenario.md). Chaque scène de l'image commence avec sa voix.
- **Les bruitages** : touchers, notifications, vibrations, glissés, coup de sifflet, foule. Ils sont synthétisés par ffmpeg dans `outils/mixage.mjs`, aux instants que l'animation a notés.
- **Pas de musique dans le fichier** : il faut une piste dont on a les droits. Pour en ajouter une, elle passe sous la voix et s'efface quand la voix parle :
  ```bash
  cd docs/video-presentation/outils
  MUSIQUE=/chemin/vers/musique.mp3 node mixage.mjs
  ```
  La bibliothèque audio de YouTube Studio propose aussi des musiques libres de droits, à poser au moment de la mise en ligne.

Le tout est ramené à **-14 LUFS**, crête à -1,5 dB, le niveau attendu par YouTube.

## Pour YouTube

**Titre** : KoppaFoot, l'application du foot amateur : un week-end avec l'Avenir d'Adakpamé

**Description** :

```
Crée ton équipe, recrute, défie, joue, et garde la trace de chaque match.
KoppaFoot, c'est l'application du foot amateur : le Direct, les équipes, la console du match, la Tribune, les fiches des joueurs, les compétitions, les terrains.

Les personnes, les équipes et les marques de cette vidéo sont fictives.

0:00 Intro
0:15 Le Direct
0:29 Ton équipe
0:56 Jour de match
1:27 La Tribune
1:46 Ta fiche de joueur
2:03 Les compétitions
2:22 Pour les terrains et les marques
2:37 Rejoins KoppaFoot

👉 https://koppafoot.com
```

YouTube affiche les chapitres s'ils sont au moins trois, si le premier est à 0:00 et si chacun dure au moins 10 secondes : c'est le cas ici.

**Sous-titres** : dans YouTube Studio, Sous-titres → Ajouter → Importer un fichier → `Presentation-KoppaFoot.fr.srt`, avec minutage. Le texte est celui du scénario ; le minutage vient de la voix, mot par mot.

## Contenu du dossier

```
Presentation-KoppaFoot.mp4       la vidéo
Presentation-KoppaFoot.fr.srt    les sous-titres
scenario.md                      le scénario, la voix off, la description YouTube
voix/                            la voix off, un fichier par scène
source/
  animation.html                 l'animation : une ligne de temps GSAP calée sur la voix
  voix.js                        le minutage de la voix, mot par mot (généré par transcrire.py)
  ecrans/                        les écrans filmés (générés par preparer-ecrans.py)
  cibles.js                      où étaient les boutons touchés à l'écran (généré)
  images/, fonts/                logo, symbole, écussons, Outfit et DM Sans
outils/
  roster.mjs                     les personnes, les clubs et les dates du film
  p0-decor.mjs … p9-pros.mjs     le tournage, scène par scène
  tournage.sh                    toutes les scènes dans l'ordre, avec une sauvegarde après chacune
  emulateurs.sh                  les émulateurs du tournage (repart de la dernière sauvegarde)
  preparer-ecrans.py             captures-brutes → source/ecrans et source/cibles.js
  transcrire.py                  voix/*.mp3 → source/voix.js (faster-whisper)
  rendu.mjs                      source/animation.html → vidéo muette, puis mixage.mjs
  mixage.mjs                     voix, bruitages, musique en option → Presentation-KoppaFoot.mp4
  sous-titres.py                 scenario.md + voix.js → Presentation-KoppaFoot.fr.srt
```

## Retoucher et rendre

`source/animation.html` s'ouvre dans Chrome : elle se joue en temps réel, sans le son. Chaque scène y est un bloc. Les instants y sont donnés par les mots de la voix : `mot("04-match", "coutiflet")` est l'instant où la voix dit « coup de sifflet » (la transcription l'a entendu ainsi).

- `montrer()` fait passer un écran devant le précédent, en fondu ou en glissé ;
- `toucher()` et `glisser()` posent un doigt ;
- `projecteur()` éclaire une zone de l'écran ;
- `panneau()` gère les titres et les puces de gauche ;
- `banniere()` et `empiler()` gèrent les notifications.

```bash
cd docs/video-presentation/outils
npm install                                   # playwright, gsap, firebase-tools
pip install pillow imageio-ffmpeg             # ffmpeg avec x264, sans installation système
node rendu.mjs --apercu 20,62.5,99            # quelques images → apercu/
node rendu.mjs                                # la vidéo (une quinzaine de minutes), avec le son
python3 sous-titres.py                        # les sous-titres, recalés sur le montage
```

**Après une nouvelle voix off** (un bloc refait, une autre voix) :

```bash
python3 -m venv stt && stt/bin/pip install faster-whisper imageio-ffmpeg
stt/bin/python -I transcrire.py               # → source/voix.js
node rendu.mjs && python3 sous-titres.py
```

Les chapitres de la description sont alors à recopier depuis `montage.json` (`chapitres`, en secondes).

## Refaire le tournage (après un changement d'interface)

1. **Brancher l'application sur les émulateurs.** Ce réglage est local : il ne faut jamais le commiter.
   ```bash
   git apply docs/tutoriel-organisateur/outils/emulateurs/emulateurs.patch
   cp docs/tutoriel-organisateur/outils/emulateurs/env.local.exemple .env.local
   # puis remplacer FIREBASE_PRIVATE_KEY par une clé jetable (openssl genrsa 2048)
   ```
2. **Lancer les émulateurs**, depuis des données vierges :
   ```bash
   cd docs/video-presentation/outils && npm install
   rm -rf emulateurs/donnees      # sinon emulateurs.sh repart de la dernière sauvegarde
   npm run emulateurs
   ```
3. **Lancer l'application**, à la racine : `npm run dev`.
4. **Tourner, préparer, rendre** :
   ```bash
   cd docs/video-presentation/outils
   ./tournage.sh                  # environ 45 minutes ; les captures vont dans captures-brutes/
   python3 preparer-ecrans.py
   node rendu.mjs && python3 sous-titres.py
   ```
   Après chaque scène, `tournage.sh` sauvegarde l'état des émulateurs dans `emulateurs/donnees`. Si une scène échoue, il faut la corriger, relancer les émulateurs (ils repartent de cette sauvegarde), puis reprendre à la scène qui a échoué, par exemple `./tournage.sh p6-tribune`.
5. **Tout remettre en place** :
   ```bash
   git apply -R docs/tutoriel-organisateur/outils/emulateurs/emulateurs.patch && rm .env.local
   ```
