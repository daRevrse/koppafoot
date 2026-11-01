# Les dossards du jour : changer un numéro depuis la console

Date : 2026-11-01. Demande du propriétaire du produit : pouvoir modifier les
dossards des joueurs à partir de la feuille de match de la console.

## Ce qui est décidé avec le propriétaire

- **Le numéro vaut pour ce match seulement.** Il s'écrit sur la feuille du
  match (`home_lineup` / `away_lineup`), jamais sur l'effectif de l'équipe. Un
  maillot prêté pour la journée ne change pas l'effectif, et la feuille reste
  un constat de ce qui s'est joué (voir `FirestoreLineupEntry.position`).
- **Avant le coup d'envoi et pendant le direct.** Un numéro mal saisi se voit
  souvent au premier but.

## Avant le coup d'envoi : l'écran des feuilles

Chaque ligne de la feuille a sa case de numéro, à côté du bouton qui change le
rôle (comme le 🧤, un bouton n'en contient pas un autre). La toucher ouvre le
clavier numérique ; Entrée ou un appui ailleurs valide, Échap annule. Rien ne
s'écrit avant « Valider la feuille », qui emporte les numéros du jour.

Les numéros sont semés depuis la feuille enregistrée, comme les rôles : une
feuille déjà validée garde ceux qu'elle a constatés. Un joueur qui n'y figure
pas encore prend le numéro de l'effectif.

## Pendant le direct : « Dossards » dans le menu de la console

Le menu des gestes rares (⋯) ouvre la fenêtre des dossards : les deux feuilles
telles qu'elles se jouent, titulaires puis remplaçants. Côte à côte sur la
console couchée, une équipe à la fois sur un écran étroit. Rien ne part avant
« Enregistrer », et seuls les camps qui changent s'écrivent. La feuille garde
son état (`*_lineup_ready`) : on corrige un numéro, on ne revalide rien.

Le terrain de la console, le choix du buteur et la fiche publique du match
lisent tous la feuille : ils suivent d'eux-mêmes. Aucune règle Firestore ne
change : la console écrit déjà la feuille (`champsDeLaConsole`, `comp_matches`).
L'écriture part comme les autres gestes de la console, hors ligne compris.

## Les choix de détail

- **De 0 à 99**, sans zéro devant (« 07 » devient « 7 »). Une case vidée
  retire le numéro.
- **Deux lignes gardent leur numéro** : un dossard de la feuille de secours
  (« N°9 », `lib/dossards`) et un « Joueur 9 » d'adversaire hors plateforme
  (`lib/effectif-match`). Leur numéro est tout ce qu'on sait d'eux.
- **Un numéro porté deux fois est signalé, pas bloqué** : case en rouge et une
  ligne d'alerte. C'est le scoreur qui voit les maillots.
- **Un numéro qui diffère de l'effectif est cerclé d'ambre.**

## Où

- `src/lib/numeros-du-jour.ts` : `lireNumero`, `numeroModifiable`,
  `numerosDeLaFeuille`, `appliquerNumeros`, `numerosEnDouble`. Pur, vérifié par
  `scripts/test-numeros-du-jour.ts`.
- `src/components/competition/LiveMatchConsole.tsx` : `CaseNumero` sur l'écran
  des feuilles, `ModaleDossards` et l'entrée « Dossards » du menu du direct.

## Vérifié

Sur les émulateurs Firebase, avec les vraies règles, en vue téléphone : deux
numéros changés avant le coup d'envoi (dont « 07 »), un doublon signalé puis
corrigé, les feuilles validées, le match lancé, puis trois numéros changés
pendant le direct, téléphone couché. Les feuilles portent les nouveaux
numéros, le terrain de la console les affiche, et l'effectif de l'équipe n'a
pas bougé.
