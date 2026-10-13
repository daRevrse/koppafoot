# Vidéo propriétaires de terrains : réveille ton terrain

Une vidéo de 30 secondes, verticale (1080 × 1920, 9:16), pour donner envie aux propriétaires de terrains de référencer le leur sur KoppaFoot. Elle est faite pour les statuts WhatsApp, TikTok ou Reels, ou pour être envoyée directement à un gérant.

**→ [Terrains-KoppaFoot.mp4](Terrains-KoppaFoot.mp4)** (H.264, 30 images/s, sans son)

Contrairement aux autres vidéos du dossier `docs/`, celle-ci ne contient **aucune capture d'écran** : tout est dessiné et animé dans `source/animation.html`.

| Temps | Scène |
|---|---|
| 0 – 2,8 s | La nuit, un terrain vu de haut dont les lignes se tracent : « Ton terrain dort le soir ? » (« Mardi, 21 h ») |
| 2,8 – 4,4 s | Les projecteurs s'allument un à un, flash : « Réveille-le. » |
| 4,4 – 8,9 s | **1 · Les équipes te trouvent.** Une recherche « Terrain 5v5 à Lomé » ; la fiche du terrain sort en tête. |
| 8,9 – 15,4 s | **2 · Paiement mobile : réservé, frais payés.** L'équipe voit le tarif du terrain et les frais de réservation (« remboursés si le match a lieu »), puis paie les frais par mobile : « Paiement reçu ». Le propriétaire reçoit la réservation, frais payés, et la confirme ; son planning se remplit. |
| 15,4 – 21,9 s | **3 · Fini les lapins.** Les deux issues d'une réservation : le match a lieu, les frais sont remboursés à l'équipe ; l'équipe ne vient pas, les frais reviennent au propriétaire. « Ton créneau n'est plus bloqué pour rien. » |
| 21,9 – 26,6 s | **4 · Garde tout.** « 0 % de commission » ; le ticket : ton tarif, ce que KoppaFoot prend (0 FCFA), ce qui te revient. Les frais s'ajoutent au tarif. |
| 26,6 – 30 s | Fin : le stade allumé, logo, « Sans pelouse, pas de match. », « Référence ton terrain », koppafoot.com/terrains, « Ton premier terrain est gratuit » |

## Ce que l'application fait, et ce que la vidéo simplifie

La vidéo a été publiée avant la fonctionnalité. L'application fait ce qu'elle promet, à deux raccourcis près.

**Ce qui est vrai tel quel :**

- l'équipe paie des **frais de réservation** par **paiement mobile** ;
- si l'équipe ne vient pas, ils **reviennent au propriétaire** : « fini les lapins » ;
- KoppaFoot prend **0 % de commission**, et « ton prix reste ton prix » ;
- un terrain se référence gratuitement (`LIMITES_GRATUIT.terrains`, dans `lib/offre`).

**« Remboursés si le match a lieu » :** dans l'application, les frais font partie du prix. Si le match a lieu, ils sont déduits de ce que l'équipe règle sur place : pour elle, c'est le même argent. L'application reprend la formule de la vidéo et la précise : « Remboursés si le match a lieu : ils sont déduits de ce que tu règles sur place. »

**Les deux raccourcis :**

- la vidéo montre l'équipe **payer, puis le propriétaire confirmer**. Dans l'application c'est l'inverse : le propriétaire confirme, puis l'équipe paie. Un refus ne déplace ainsi aucun argent ;
- la vidéo prend **2 000 FCFA** en exemple (`FRAIS`, en haut du script de `source/animation.html`). Dans l'application, les frais valent **5 % du prix du créneau**.

Le reste du prix se règle en liquide chez le propriétaire, et un **ticket** (un code et un QR code) prouve sur place que les frais ont été payés. Le détail est dans `docs/plans/2026-10-13-paiement-terrains-design.md`.

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
