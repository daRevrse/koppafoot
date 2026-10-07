# Vidéo propriétaires de terrains : réveille ton terrain

Une vidéo de 30 secondes, verticale (1080 × 1920, 9:16), pour donner envie aux propriétaires de terrains de référencer le leur sur KoppaFoot. Elle est faite pour les statuts WhatsApp, TikTok ou Reels, ou pour être envoyée directement à un gérant.

**→ [Terrains-KoppaFoot.mp4](Terrains-KoppaFoot.mp4)** (H.264, 30 images/s, sans son)

Contrairement aux autres vidéos du dossier `docs/`, celle-ci ne contient **aucune capture d'écran** : tout est dessiné et animé dans `source/animation.html`.

| Temps | Scène |
|---|---|
| 0 – 3 s | La nuit, un terrain vu de haut dont les lignes se tracent : « Ton terrain dort le soir ? » (« Mardi, 21 h ») |
| 3 – 4,6 s | Les projecteurs s'allument un à un, flash : « Réveille-le. » |
| 4,6 – 10,5 s | **1 · Les équipes te trouvent.** Une recherche « Terrain 5v5 à Lomé » ; la fiche du terrain sort en tête, avec son format, sa surface, ses équipements, son tarif et sa note. |
| 10,5 – 18,6 s | **2 · Tu confirmes en un geste.** Une demande de créneau arrive ; un doigt touche « Confirmer » ; le planning de la semaine se remplit. |
| 18,6 – 23,7 s | **3 · Garde tout.** « 0 % de commission » ; le ticket : ton tarif, ce que KoppaFoot prend (0 FCFA), ce qui te revient. |
| 23,7 – 26,7 s | « Ton premier terrain » : le tampon « Gratuit ». L'équipe KoppaFoot valide la fiche, puis le terrain entre dans l'annuaire. |
| 26,7 – 30 s | Fin : le stade allumé, logo, « Sans pelouse, pas de match. », « Référence ton terrain », koppafoot.com/terrains |

Ce que la vidéo promet est dans le produit :

- **L'annuaire est filtrable** par ville, format et surface (page `/terrains`).
- **La demande de créneau** arrive chez le propriétaire, qui la confirme ou la refuse.
- **Aucune commission** : « La plateforme n'encaisse rien », et le règlement se fait entre le propriétaire et l'équipe.
- **Le premier terrain est gratuit** : l'offre gratuite permet d'en référencer un (`LIMITES_GRATUIT.terrains`, dans `lib/offre`).
- **Une candidature est relue** par l'équipe avant d'entrer dans l'annuaire (`/terrains/candidature`).

Le terrain des Cocotiers, son tarif, sa note et les équipes du planning sont fictifs. L'Avenir d'Adakpamé et l'Olympique de Tokoin sont ceux des autres vidéos.

## Ajouter une musique

La vidéo est muette exprès : sur TikTok, Reels ou dans un statut, la musique se choisit dans l'application au moment de publier. Pour l'intégrer au fichier :

```bash
ffmpeg -i Terrains-KoppaFoot.mp4 -i musique.mp3 -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -shortest -af "afade=t=out:st=27.5:d=2.5" avec-musique.mp4
```

## Retoucher et rendre

`source/animation.html` s'ouvre directement dans Chrome : elle se joue en temps réel, c'est l'aperçu. Tous les temps (en secondes) sont dans le script, scène par scène. Le texte de la recherche est dans `RECHERCHE`, et les créneaux du planning dans `CRENEAUX` (jour, heure, durée, couleur, écusson, instant d'apparition).

```bash
cd docs/video-terrains/outils
npm install                                  # playwright, gsap
pip install imageio-ffmpeg                   # ffmpeg avec x264, sans installation système
node rendu.mjs --apercu 4.1,9,16.8,20.3      # quelques images → apercu/
node rendu.mjs                               # → ../Terrains-KoppaFoot.mp4 (environ trois minutes)
```

Le terrain en perspective et ses projecteurs sont faits en CSS (`#stade`, `.mat`). Comme il est flouté pendant les scènes 1 à 4, le rendu de chaque image est un peu plus lent que pour les autres vidéos.
