# Design : Console live, fiable sur un vrai terrain

**Date :** 2026-09-27
**Statut :** Livré. Aucune règle Firestore à déployer, aucune migration.

## Le problème

Un match complet joué dans la console, sur téléphone et sur ordinateur, a montré deux défauts qui faussent les données d'un vrai match, et quelques-uns qui ralentissent la saisie :

1. **Aucune erreur ne se corrigeait.** Un joueur touché par erreur, une faute en trop, un carton au mauvais : tout restait, et de là dans les statistiques, les notes, la forme et le classement. Seule la VAR sur le dernier but, en compétition, retirait quelque chose.
2. **Sans réseau, la console se figeait sans un mot.** Chaque saisie attendait l'accusé du serveur : dix-huit boutons grisés, impossible de toucher un autre joueur. « Mi-temps » arrêtait le chrono mais ne changeait jamais de période. Un rechargement perdait les saisies en attente, gardées en mémoire seulement.
3. Toucher le **nom** d'un joueur sélectionnait son voisin du dessous ; un maillot vert se fondait dans la pelouse ; la liste des passeurs ne tenait pas à l'écran en paysage ; l'historique était un panneau blanc sans le passeur ; l'ordinateur laissait deux bandes vides ; un bandeau orange occupait la hauteur tout le match.

## Décisions

### Corriger

- **« Annuler » quelques secondes après chaque saisie**, dans le message qui la confirme.
- **Une corbeille sur chaque ligne de l'historique**, avec confirmation, tant que le match tourne.
- **Un retrait emporte ce qui ne tient pas sans lui** (`lib/retrait-evenement`, pur et testé) : un but rend son point (sauf s'il a déjà été refusé par la VAR) ; un second jaune emporte l'exclusion qu'il a provoquée, et l'inverse ; un rouge rend le joueur à la pelouse ; un remplacement se défait (le sortant revient), mais il est refusé si la pelouse a bougé depuis.
- **L'écriture ne réécrit pas le tableau** : `arrayRemove` retire l'élément exact et `increment` corrige le score. Elle part hors ligne et n'efface pas ce qu'un autre appareil vient d'ajouter.

### Ne plus se figer

- **La console n'attend plus le serveur pour rendre la main.** L'identifiant d'un événement est tiré d'avance (`nouvelIdEvenement`) ; l'écriture part dans la file de Firestore ; la console compte ce qui n'est pas encore parti. Le chrono, la mi-temps et la reprise aussi.
- **Le cache de Firestore vit sur l'appareil** (IndexedDB, plusieurs onglets) : une saisie faite sans réseau survit à la fermeture de la page et part au lancement suivant. C'est un changement de toute l'application côté navigateur ; le rendu serveur garde l'instance ordinaire.
- **Les retouches attendent sur l'appareil** (`lib/retouches-en-attente`, pur et testé). Le passeur, la victime d'une faute et l'issue d'un penalty s'écrivent par transaction, et une transaction ne part pas hors ligne. On garde l'intention dans le stockage de l'appareil, on l'affiche tout de suite, et on la rejoue au retour du réseau, après les écritures de l'appareil (`waitForPendingWrites`).
- **Ce qui demande le réseau le dit** : le coup de sifflet final (qui passe par le serveur et ne doit pas partir avant les saisies en attente) et la VAR.
- **La bande du haut dit l'état du réseau** : « Hors ligne · 3 saisies en attente », ou « Réseau lent » quand l'envoi traîne. La consigne « Ne quitte pas cette page » ne s'affiche plus que vingt secondes à l'ouverture, et « Quitter » demande confirmation.

### Saisir juste

- **Les noms passent devant les pastilles et renvoient à leur joueur** ; couché, le rayon réserve la place des lettres qui descendent sous la ligne (un dixième de rayon en moins).
- **Un maillot qui se fond dans la pelouse reçoit un liseré clair** (`seFondDansLaPelouse`, seuil 35 : l'émeraude en est à 24), comme deux équipes du même ton. On ne recolore jamais une équipe.
- **Les passeurs en grille de maillots** : numéro et nom court, quatre par rangée, gardien en dernier. Dix joueurs tiennent en trois rangées, sans défiler.

### Relire

- **L'historique suit le fond sombre de la console**, nomme le passeur d'un but, et porte la corbeille.
- **Sur grand écran, il est posé sous les terrains**, avec les statistiques, au lieu d'un tiroir à ouvrir.

## Outils

Les patchs d'émulation des six tutoriels (`docs/*/outils/emulateurs/emulateurs.patch`) suivent le nouvel import de `firebase.ts`.

## Vérifications

- `mobile/src/__tests__/retrait-evenement.test.ts`, `retouches-en-attente.test.ts`, `couleurs-equipe.test.ts`.
- Le parcours organisateur du tutoriel, rejoué jusqu'au coup de sifflet final sur la console modifiée.
- Un scénario sur les émulateurs : chaque nom de la défense touché ouvre son joueur ; but puis « Annuler » (score et question du passeur) ; but ressaisi aussitôt, passeur écrit et visible dans l'historique ; second jaune retiré depuis l'historique (l'exclusion part, le joueur revient) ; remplacement annulé ; coupure réseau (bande, saisie qui rend la main, autre joueur touchable, passeur affiché), console fermée hors ligne puis rouverte avec le réseau (tout est arrivé, passeur compris) ; ordinateur (historique posé sous les terrains) ; une équipe en vert (liseré clair sur ses pastilles). Vingt contrôles, tous verts.
