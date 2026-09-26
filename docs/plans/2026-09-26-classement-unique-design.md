# Design : Un seul classement, gardiens compris

**Date :** 2026-09-26
**Statut :** Livré. Aucune règle Firestore à déployer, aucune migration : le document `rankings/top_players` se recalcule tout seul à la première lecture s'il a encore l'ancienne forme.

## Le problème

La page Top performances avait deux onglets : les buts et les passes pour tout le monde, les arrêts par match pour les gardiens. Deux réponses à une seule question, « qui est en forme ? », et un gardien absent de la liste principale sauf s'il marquait. La carte de l'accueil recopiait la ligne de la page à quelques classes près.

## Décisions

1. **Tout le monde est classé sur sa note moyenne**, celle que la console calcule pendant le direct (`lib/notes`). Elle juge déjà chacun sur son poste : buts, passes et tirs pour un joueur de champ ; arrêts, but inviolé et buts encaissés pour un gardien. La moyenne est pondérée, les matchs récents comptent davantage : c'est `moyennePonderee`, le même calcul que l'état de forme, désormais partagé.

2. **Cinq derniers matchs, trois matchs notés minimum.** Une entrée en jeu de moins de 15 minutes n'est pas notée. En dessous de trois notes, le joueur n'apparaît pas dans le tri par note, mais il reste dans le tri par buts et passes.

3. **Les buts et les passes restent un tri** (« Buts + passes »), qui compte aussi les matchs renseignés après coup, sans note. À note égale, le tri par note départage sur les buts + passes, puis sur le nombre de matchs.

4. **Une seule liste publiée** (`joueurs`), où chaque ligne porte ses deux rangs et ses deux flèches de progression. Le document garde l'ordre des deux tris (`cles_note`, `cles_contribution`) pour calculer les flèches au passage suivant.

5. **Le gardien se distingue sans être mis à part** : une étiquette « Gardien » (« G » sur téléphone) et, sous le nom, ses arrêts et ses matchs sans but encaissé au lieu des buts et des passes. Le filtre Gardiens les montre entre eux, avec leur rang dans la liste commune.

6. **Une seule ligne dessinée** (`LigneDeClassement`), pour la page et pour la carte de l'accueil. Sur la page, une frise des cinq dernières notes aux couleurs de la console ; sur l'accueil et sur téléphone, ni frise ni club, qui n'y tiennent pas.

7. **L'accueil montre les cinq meilleures notes**, et les meilleurs buts + passes tant que personne n'a trois matchs notés : une carte vide se lit comme une panne.

## Au passage

Le compilateur de Next (SWC) mange l'espace de tête d'un texte JSX qui suit une balise ou une expression quand ce texte contient une entité (`&apos;`) et s'étend sur plusieurs lignes : « sa note moyennedes cinq… », « KoppaFootn'encaisse ». Seize textes touchés dans le site ; l'espace y est maintenant écrit `{" "}`, que le compilateur ne peut pas retirer.

## Vérifications

- `mobile/src/__tests__/classement.test.ts` : liste commune, égalité gardien/buteur, étiquette et statistiques du gardien, seuil de trois notes, but annulé par la VAR, match renseigné après coup, gardien reconnu à ses arrêts, rangs et flèches, ordre de chaque tri.
- Parcours joués sur les émulateurs Firebase avec Playwright : recalcul à la première lecture, tri par note et par buts + passes, filtre Gardiens, panneau de méthode, carte de l'accueil, téléphone en thème clair et sombre.
