# Le calendrier public : aujourd'hui et la suite d'abord

Date : 2026-11-01. Demande du propriétaire du produit : sur la vue publique
d'une compétition, l'onglet Calendrier doit donner la priorité aux matchs
d'aujourd'hui et à venir.

## Le problème

L'onglet rangeait les journées de la plus ancienne à la plus récente. À
mi-parcours d'un tournoi (la G2 a commencé le 18 octobre), la page s'ouvrait
sur les résultats du premier dimanche, et les matchs du jour attendaient tout
en bas.

## Ce qui change

Deux parties, nommées quand il y en a deux :

1. **« Aujourd'hui et à venir »** : la journée du jour (matchs finis compris :
   c'est la journée en cours), puis les jours suivants dans l'ordre, puis les
   matchs dont la date reste à fixer. La journée du jour s'annonce
   « Aujourd'hui · Dimanche 1 novembre ».
2. **« Matchs joués »** : les jours passés, le plus récent d'abord.

Dans un jour, les matchs restent dans l'ordre de leur heure. Un match en direct
daté de la veille (un coup d'envoi tardif qui passe minuit) reste en tête. Une
compétition finie, ou pas encore commencée, n'a qu'une partie, sans titre. Le
filtre par poule s'applique avant, comme avant. Le jour se lit à Lomé
(`jourDeLome`).

## Où

- `src/lib/calendrier-public.ts` : `calendrierParPriorite`, pur, vérifié par
  `scripts/test-calendrier-public.ts`.
- `src/components/competition/tabs/CalendarTab.tsx` : les deux parties.

## Pas ici

L'onglet Calendrier de l'application Android (`mobile/src/lib/page-competition`,
`joursDuCalendrier`) garde l'ordre d'avant. Il peut reprendre la même fonction ;
il faudra une nouvelle version de l'application.
