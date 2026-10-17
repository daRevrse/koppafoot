# Tutoriel vidéo : tenir la console d'un match

Une vidéo de 3 min 19 s, à l'horizontale (1920 × 1080), avec voix off et sous-titres, pour former un organisateur ou un membre de son staff à la console live : de la feuille de match au coup de sifflet final, avec un clin d'œil à l'ajout d'un modérateur.

**→ [Tutoriel-console-KoppaFoot.mp4](Tutoriel-console-KoppaFoot.mp4)** (H.264, 30 images/s, AAC)

**Vidéo privée.** La console ne se montre pas en public : la vidéo s'envoie directement à l'organisateur (WhatsApp), elle ne se publie pas.

| Chapitre | Contenu |
|---|---|
| 01 · Ouvrir la console | espace organisateur → la compétition → son calendrier → « Console live » ; les trois réflexes |
| 02 · Les feuilles de match | un appui titulaire, deux remplaçant, trois absent ; le compteur ; valider ; la feuille de secours au dossard |
| 03 · Avant le coup d'envoi | « Côtés », « Feuilles », l'équipe qui engage et le chrono qui part |
| 04 · Le ballon | la possession à l'appui sur l'herbe, les passes |
| 05 · Les actions | le joueur et ses actions, le passeur, les boutons d'équipe, l'arrêt de jeu, le « i » et le retrait d'un événement |
| 06 · Mi-temps et fin du match | « Mi-temps », la reprise, « Fin du match », l'homme du match |
| 07 · Un modérateur | « Staff », l'e-mail, « Ajouter » |
| 08 · Avant demain | le Match d'entraînement |

Les écrans sont des **enregistrements d'écran d'iPhone** de l'application en production, sur un Match d'entraînement (chapitres 2 à 6 et 8) et sur une vraie compétition (chapitres 1 et 7, sans rien y modifier). La voix off est une voix de synthèse, générée à partir de [voix-off.md](voix-off.md). Coupés au montage : la fenêtre « Égalité : tirs au but ? » et un but non commenté (chapitre 6), et le passage où le clavier proposait une adresse e-mail personnelle (chapitre 7).

## Contenu du dossier

```
Tutoriel-console-KoppaFoot.mp4   la vidéo
voix-off.md                      le texte de la voix off et les plans à filmer, chapitre par chapitre
outils/
  montage.py                     le montage : plans, cartons, sous-titres, cercles d'appui, zooms, voix
  texte.py, texte.json           les sous-titres, calés sur les pauses de la voix
  planches.py, reperes.py        des planches contact et des images quadrillées pour repérer les appuis
sources/                         (hors git) 01.MP4 … 08.MP4 et 01.mp3 … 08.mp3
```

## Refaire la vidéo

Il faut Python (Pillow, NumPy) et ffmpeg, et les rushs dans `sources/` : un enregistrement et un audio par chapitre, nommés `01` à `08`.

```bash
cd docs/tutoriel-console/outils
python texte.py          # recale les sous-titres si voix-off.md ou les audios changent
python montage.py 05     # un chapitre seul, dans rendu/ (environ 1 min 30)
python montage.py        # la vidéo entière (environ 8 min)
```

Les coupes, vitesses, cercles et zooms de chaque chapitre sont dans `plans()` de `montage.py`, en secondes des rushs. Les coordonnées des boutons sont celles de l'image source, redressée pour la console (elle est filmée téléphone couché).

Les sous-titres sont calés sur les pauses de la voix de synthèse, sans reconnaissance vocale : ils peuvent avoir une seconde d'écart par endroits.
