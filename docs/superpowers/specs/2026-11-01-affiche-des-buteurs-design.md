# L'affiche des meilleurs buteurs, après chaque journée

Date : 2026-11-01. Demande du propriétaire du produit : sortir l'affiche des
meilleurs buteurs après chaque journée d'une compétition.

## Où on la trouve

Dans le calendrier de l'organisateur, le bouton « Affiche » ouvre la fenêtre
des affiches. Un troisième onglet, « Buteurs », rejoint « Une journée » et
« Des dates ». On y choisit :

- **après la journée N**, pour chaque journée commencée (au moins un match
  joué ou en direct). La dernière est choisie d'avance ;
- **à ce jour** : tous les matchs, phase finale comprise. C'est le seul choix
  d'une compétition sans journées.

Télécharger et Partager, comme pour l'affiche du programme. L'adresse est
publique et stable : `/api/c/[slug]/affiche/buteurs?journee=2` ou
`?a-ce-jour=1`.

## Ce qu'elle compte

Le classement de l'onglet Buteurs de la page publique
(`computeTopScorers`). L'affiche et le site comptent donc pareil :

- sans les buts contre son camp ;
- sans les buts annulés par la VAR ;
- sans les dossards sans nom ;
- sans les matchs d'exhibition.

« Après la journée N » compte les matchs de poule des journées 1 à N : une
journée n'existe qu'en phase de poules (`lib/journees`).

**Dix buteurs au plus.** Deux joueurs à égalité de buts partagent le rang
(1, 2, 2, 4). Entre eux, l'ordre reste celui du nom, comme sur le site. Pas
d'affiche sans buteur : la fenêtre le dit (« un but compte quand son buteur est
nommé dans la console »).

## À quoi elle ressemble

La direction des autres affiches (`lib/og-programme`, `lib/og-flyer`) :

- cadre d'éclats, carte nuit, portrait 1080 × 1350 ;
- en tête, le logo de la compétition, puis le surtitre « APRÈS LA JOURNÉE 2 » ;
  le surtitre est précédé du nom de la compétition quand elle n'a pas de logo ;
- le titre fendu « MEILLEURS BUTEURS » ;
- une ligne par buteur : rang, écusson de l'équipe, nom, nom de l'équipe et
  buts. Le premier est en vert. Peu de buteurs, et les lignes grandissent ;
- les partenaires et l'adresse en pied.

## Pas ici

La photo du meilleur buteur. Elle demanderait le consentement à l'image de
chaque joueur, comme le joueur de la semaine (`lib/consentement-image`).

## Où

- `src/lib/buteurs-affiche.ts` : le choix, les matchs comptés, les journées
  proposées, le classement et ses rangs. Pur, vérifié par
  `scripts/test-affiche-buteurs.ts`.
- `src/lib/buteurs-publics.ts` : la lecture côté serveur.
- `src/lib/og-buteurs.tsx` : le rendu. `scripts/rendu-buteurs.tsx` le montre
  sur des équipes fictives.
- `src/app/api/c/[slug]/affiche/buteurs/route.tsx` : la route.
- `src/components/competition/AfficheProgramme.tsx` : l'onglet « Buteurs ».
