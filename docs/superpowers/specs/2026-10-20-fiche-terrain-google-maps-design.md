# Fiche de terrain : l'emplacement sur Google Maps

Date : 2026-10-20. Une équipe qui réserve un terrain pour la première fois
doit le trouver. La fiche publique ne donnait qu'une adresse écrite à la main
(« Rue, quartier »), et aucun lien vers une carte.

## Le problème

À Lomé, l'adresse d'un terrain s'écrit « derrière la station, Agoè ». Elle
dit le quartier, pas le portail : l'équipe tourne dans le quartier en
appelant le gardien. Le propriétaire, lui, sait exactement où est son
terrain, et tout le monde sait suivre un itinéraire Google Maps.

## Ce qu'on fait

- **Une épingle par terrain** : `venues.position = { lat, lng }`, ou `null`.
  On ne garde que les coordonnées, arrondies à six décimales : un lien Maps
  change de forme, un couple de nombres non.
- **Le propriétaire la pose dans « Mes terrains »**, champ « Emplacement sur
  la carte » (optionnel), de deux façons :
  - il colle le lien du bouton « Partager » de Google Maps, ou des
    coordonnées (décimales ou degrés-minutes-secondes) ;
  - sur place, il touche « Je suis sur le terrain », qui prend la position
    du téléphone. Au-delà de 100 m d'imprécision, on le lui dit.

  Dans les deux cas, il voit la carte avant d'enregistrer : une épingle
  posée à côté se repère à l'œil. Une fiche sans épingle compte
  « l'emplacement sur la carte » parmi ce qui lui manque.
- **La fiche publique** montre, si l'épingle est posée, une rubrique
  « Y aller » : la carte intégrée et un bouton « Itinéraire avec Google
  Maps ». À côté de l'adresse, un lien « Itinéraire » mène à l'épingle, ou
  à défaut à l'adresse écrite.

## Comment

- `src/lib/carte.ts`, pur et partagé : lire un point dans un texte collé,
  reconnaître un lien court, fabriquer les liens de carte et d'itinéraire.
  Testé dans `mobile/src/__tests__/carte.test.ts`.
- **Aucune clé d'API.** La carte est l'intégration sans clé
  (`maps.google.com/maps?q=lat,lng&output=embed`), l'itinéraire le lien
  universel `google.com/maps/dir/?api=1&destination=…`, qui ouvre
  l'application Maps sur un téléphone.
- **Les liens courts** (`maps.app.goo.gl/…`) ne portent pas de coordonnées
  et un navigateur ne peut pas suivre leurs redirections. Le serveur le fait
  (`POST /api/venues/position`) : compte requis, HTTPS, hôtes de Google
  seulement, cinq sauts au plus. Il lit le point dans les adresses
  traversées et n'écrit rien.

## Ce qu'on ne fait pas

- **Deviner un point à partir d'un nom.** Un lien vers une recherche
  (`?q=Stade de Kégué`) ne donne pas de point : la page qu'il ouvre
  n'annonce que le centre par défaut de Maps (le milieu des États-Unis).
  On redemande plutôt que de placer le terrain au Kansas.
- **Une carte sans épingle.** Centrée sur une recherche d'adresse, elle
  montrerait un endroit où le terrain n'est peut-être pas ; seul le lien
  d'itinéraire part alors de l'adresse.
- **L'itinéraire depuis la page d'un match ou le calendrier** : le calendrier
  garde son lien de recherche par adresse. On pourra y brancher l'épingle
  plus tard.
