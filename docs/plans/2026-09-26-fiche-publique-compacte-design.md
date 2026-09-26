# Design : La fiche publique en une carte, et le manager sur la feuille de match

**Date :** 2026-09-26
**Statut :** Livré. Aucune règle Firestore à déployer, aucune migration.

## Le problème

Sur la fiche publique d'un membre, l'onglet « Aperçu » répétait surtout la carte de bilan placée juste au-dessus : le taux de victoire du manager en plus grand, une « équipe principale » que les écussons montrent déjà, quatre tuiles pour quatre mensurations, une carte d'état de forme de deux colonnes. L'arbitre, lui, n'avait pas de carte de bilan du tout. Et sur la page d'un match, l'onglet Composition ne disait pas qui dirige chaque équipe.

## Décisions

1. **L'onglet « Aperçu » disparaît.** Tout ce qu'il portait tient dans la carte de bilan, sous l'affiche (`components/profile/BilanDuProfil`). Il reste les onglets Palmarès, Posts et Galerie. La fiche s'ouvre sur le Palmarès quand il y a des trophées, sur les Posts sinon : ouvrir sur « Aucun trophée », c'était poser un vide sous la carte.

2. **Une carte, trois rangées, dans l'ordre de lecture :**
   - les écussons des équipes et, pour un joueur, la forme : la condition déclarée, la pastille de forme et la frise des notes des cinq derniers matchs, chaque note menant à son match ;
   - les chiffres du rôle : matchs, buts, passes pour un joueur ; équipes, matchs, % de victoires (avec « 20 V sur 39 ») pour un manager ; matchs arbitrés, note des managers (avec le nombre d'avis) et années d'expérience pour un arbitre ;
   - le reste en une ligne : niveau, pied, taille, poids, âge pour un joueur ; licence et corps arbitral pour un arbitre ; société pour un propriétaire de terrain.

3. **Le rôle Évolution décide de la carte.** Un compte qui tient un second rôle (un manager dont le compte est un ancien compte joueur) le voit résumé dans la ligne du bas, pas dans une seconde carte. La forme d'un rôle second n'apparaît que s'il a joué.

4. **Retirés :** la phrase « équipe principale », la carte de taux de victoire du manager (le détail passe sous le pourcentage), le numéro de licence masqué de l'arbitre (« ABC*** » n'apprend rien à un visiteur), les textes explicatifs de la carte d'état de forme (le détail reste dans l'infobulle des pastilles, et la carte complète sur « Mon compte »).

5. **Le manager ferme la feuille de match.** Dans l'onglet Composition, sous le banc, une ligne « Manager » : photo, nom, lien vers sa fiche. Le manager seul, pas le staff. Les deux pages de match partagent le composant (`MatchLineups`) : l'amical lit les clubs sur le match, la compétition passe par le club qui a revendiqué l'équipe inscrite. Une équipe fantôme (l'adversaire hors KoppaFoot) ou non revendiquée n'a pas de ligne.

6. **Une route publique bornée** : `GET /api/public/team/[id]/manager`. La fiche publique d'une équipe ne publie ni `member_ids` ni `manager_id`, et c'est voulu. Le manager est l'exception, parce qu'il est le visage public de l'équipe et que sa propre fiche liste déjà ses équipes. On en publie ce que sa fiche montre à tout visiteur : nom, photo, identifiant du lien. Mise en cache cinq minutes, comme ses voisines ; côté page, une requête par club et par visite.

## Vérifications

Parcours joués sur les émulateurs Firebase avec Playwright, en visiteur :
- fiches d'un joueur complet, d'un joueur sans renseignements, d'un manager, d'un manager au compte de joueur, d'une arbitre notée avec son corps arbitral, sur ordinateur et téléphone, thème clair et sombre ;
- onglet d'ouverture sans trophée (Posts) ;
- composition d'un amical (les deux managers, avec et sans photo) et d'un match de compétition (équipe revendiquée : son manager ; équipe non revendiquée : rien) ;
- la route : manager trouvé, manager sans photo, équipe inconnue.
