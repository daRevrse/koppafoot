# Design : application mobile — la fiche de match native

**Date :** 2026-10-21
**Statut :** Validé le 2026-10-21. PR A planifiée ([plan](2026-10-21-app-mobile-fiche-match-A.md)), B et C planifiées au moment de les attaquer.
**Prolonge :** [2026-09-02-application-mobile-expo-design.md](2026-09-02-application-mobile-expo-design.md) (lot 2, « Lecture ») et [2026-09-25-app-mobile-ui-sombre-design.md](2026-09-25-app-mobile-ui-sombre-design.md) (la DA).

## Le périmètre

Toucher un match du Direct ouvrait sa page web dans le navigateur intégré. Il ouvre désormais un écran natif qui reprend **toute** la fiche du site, pour les matchs de compétition **et** les amicaux.

| Ce qu'on reprend | Compétition | Amical |
|---|---|---|
| En-tête (score, chrono, buteurs, tirs au but, forme) | oui | oui |
| Onglets | Fil, Tchat, Infos, Compos, Stats, Classement, Face-à-face | Fil, Tchat, Infos, Stats, Compo |
| Joueur du match | oui | oui |
| Pronostic | oui | oui |
| Partage du lien | oui | oui |

Hors périmètre :
- les emplacements partenaires (publicité) ;
- les outils du staff sur un amical (validation, composition, modération) ;
- l'affiche image partagée avec le lien.

Les matchs du monde n'ont pas de fiche, comme sur le site : ils ouvrent la page de leur compétition.

## L'architecture

**Les routes.** `src/app/match/[cid]/[mid].tsx` pour une rencontre de compétition, `src/app/amical/[id].tsx` pour un amical. La ligne du Direct y mène ; un match du monde garde le lien web de sa compétition.

**Les données, en temps réel, avec les mêmes lectures que le site :**
- **Compétition :**
  - la compétition (`competitions/{cid}`) ;
  - le match (`comp_matches/{mid}`), en écoute ;
  - les autres matchs et les équipes, pour la forme, le classement et le face-à-face ;
  - écussons : la fiche de l'équipe d'abord, la copie du match ensuite, comme le site.
- **Amical :** `matches/{id}`, lu par `toMatch`. Ce convertisseur quitte `lib/firestore` (qui embarque le SDK) pour un module partagé, `lib/match-mappers`, que `lib/firestore` ré-exporte.

**Une seule forme pour l'écran.** Les deux sources se convertissent en une même **fiche** (`lib/fiche-match`, fonctions pures, testées). Les composants de l'écran ne savent pas s'ils montrent un amical.

**La logique du site, partagée et non recopiée :**
- **Déjà sans SDK** : `recit-du-match`, `buteurs`, `minute-du-match`, `tirs-au-but`, `notes`, `forme`, `stats-match`, `repartition`, `couleurs-equipe`, `exhibition`, `tchat`, `audience`, `terrain`, `formations`.
- **À extraire** : la composition du fil (`composer`, `Deroule`, les libellés) sort du composant `MatchTimeline` pour `lib/fil-du-match`, que le composant importe.
- **Réécrits** : les règles des onglets et du libellé de période vivent dans les deux pages du site. L'app les réécrit dans `lib/fiche-match`, avec un commentaire qui renvoie à la page d'origine.

**Les écritures :**
- le pronostic passe par Firestore, avec le compte ;
- le tchat passe par l'API du site (`/api/matches/[id]/tchat`), avec le jeton Firebase ;
- l'audience passe par Firestore ;
- le partage par la feuille de partage du téléphone.

**Le terrain** se dessine avec des vues, sans module natif de plus. Les places viennent de `disposerSurTerrain` (repère 100 × 104 du site), converties en pourcentages.

## Les écrans, à la DA du site

**L'en-tête est le bandeau noir de `MatchHero`.**
- **Barre du haut**, collante : retour, puis partage. Le score compact y apparaît au défilement.
- **Ligne de compétition** : point rouge si le match est en direct, nom en 13 px Black capitales, « · Poule A » ou le tour en 11 px gras capitales.
- **Trois colonnes :**
  - chaque équipe : écusson 48, nom en 11 px Black capitales, cinq pastilles de forme ;
  - au centre : le score en Outfit Black 36, puis la période et le chrono `mm:ss` en vert, et le temps additionnel en ambre. Avant le match : l'heure ; à défaut, « VS ».
- **Buteurs** : sous chaque camp, avec les minutes, le passeur et « (c.s.c.) ».
- **Tirs au but** : « Tirs au but · 4–3 ».

**Les onglets sont la bande collante de `MatchTabs`.**
- Libellés en 11 px Black capitales espacées. L'onglet actif est blanc et souligné de 2 px en vert ; les autres sont estompés.
- Ils n'apparaissent qu'avec quelque chose à montrer, selon les règles des pages du site.
- L'onglet par défaut suit le match : Infos avant le coup d'envoi, le Fil ensuite.

**Le contenu de chaque onglet :**
- **Fil :**
  - le joueur du match en tête ;
  - chaque fait de jeu du côté de son camp, avec la minute sur l'axe central ;
  - les repères de coup d'envoi, de mi-temps et de fin ;
  - un but annulé par la VAR, barré.
- **Compos :**
  - bascule Domicile / Extérieur ;
  - le terrain, avec les onze placés par poste, la photo ou le numéro, et les marques du match ;
  - les remplaçants dessous.
- **Infos :**
  - le pronostic (C) ;
  - la forme des deux équipes ;
  - le coup d'envoi, le terrain (lien Maps), la compétition et le tour.
- **Stats** : les barres de répartition aux couleurs des équipes.
- **Classement** : la poule du match, avec les deux équipes en avant.
- **Face-à-face** : les rencontres terminées entre les deux équipes dans la compétition.
- **Tchat** :
  - lecture sans compte ;
  - écriture avec compte pendant le direct, puis lecture seule après le match ;
  - suppression de son propre message, signalement de celui d'un autre.

## Le découpage

Trois PR empilées sur `claude/app-ui-sombre` :

- **A — le cœur.** Routes, données, la fiche, l'en-tête, les onglets, le Fil, les Compos et des Infos réduites (coup d'envoi, terrain, compétition). Côté site : `lib/match-mappers` et `lib/fil-du-match`.
- **B — le contexte.** Stats, Classement, Face-à-face, la forme (en-tête et Infos), le joueur du match.
- **C — l'interactif.** Pronostic, Tchat, audience.

## Tests et vérification

- **Fonctions pures, testées** (jest, `mobile/`) :
  - la conversion compétition → fiche et amical → fiche ;
  - les onglets visibles et l'onglet par défaut ;
  - le libellé de période ;
  - la composition du fil, une fois extraite.
- **Côté site** : `npx tsc --noEmit` et `npm run lint` après chaque extraction. Pas de `npm run build` : il consomme le quota API-Football.
- **Écrans** : vérifiés dans le Chrome de test sur un match joué, un match à venir et, si possible, un match en direct.
- **Sur le téléphone** : l'écriture dans le tchat (la version web se heurte à CORS).
