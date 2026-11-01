# L'effectif repris quand le manager crée l'équipe d'une compétition

Date : 2026-11-01. Demande du propriétaire du produit : quand un manager
reçoit une équipe depuis une compétition, qu'il en reçoive aussi les joueurs,
au lieu de les ressaisir.

## Le problème

L'organisateur crée une équipe dans son tournoi et tape son effectif à la
main : des noms, des dossards, parfois un poste. Il invite ensuite un manager
à la diriger. À l'acceptation, le manager choisit (voir
`lib/rattachement-equipe`, décidé le 2026-10-22) :

- **lier** l'équipe à une des siennes ;
- **créer** l'équipe dans « Mes équipes ».

Créer donnait une équipe **vide** : le nom, le logo, la ville, la catégorie,
et aucun joueur. Pour retrouver son effectif, le manager devait recréer chaque
joueur sans compte à la main dans son équipe, puis « Resynchroniser » depuis
la page de l'équipe de compétition et confirmer chaque rapprochement. Personne
ne le faisait : les joueurs restaient dans le tournoi seul, et leurs matchs
avec eux.

## Ce qui change

**Créer reprend l'effectif.** Dans la même transaction que l'équipe :

- chaque ligne **libre** de l'effectif (tapée à la main, sans compte ni fiche
  de club, voir `estLigneLibre` dans `lib/fusion-import`) devient une **fiche
  sans compte** de l'équipe (`teams/{id}/ghost_players`) ;
- la ligne reçoit `club_ghost_id`, l'identifiant de sa fiche. Elle garde son
  identifiant et son nom : ce sont eux que portent les feuilles de match, ses
  buts, ses cartons et ses titres d'homme du match la suivent.

C'est exactement l'état que laisse un import confirmé (`planifierImport`) :
un « Resynchroniser » qui suit n'a rien à refaire pour ces fiches
(vérifié dans `scripts/test-rattachement.ts`).

**Les joueurs qui ont un compte ne sont pas ajoutés d'office.** Leur ligne
porte déjà leur compte, leurs stats les suivent. Ils rejoignent l'équipe par
invitation, comme toujours, et pas à leur insu. La création les compte, et
l'écran le dit : « 3 joueurs ont un compte KoppaFoot : invite-les depuis ton
équipe pour qu'ils la rejoignent. »

**Lier ne change pas.** L'équipe du manager a déjà son effectif ; c'est
« Resynchroniser » qui rapproche, avec confirmation.

## Les choix de détail

- **Le nom** se coupe au premier mot : prénom, puis le reste. L'affichage les
  recolle et retrouve le nom tapé par l'organisateur, dans son ordre.
- **Le poste** est celui de la ligne quand `normaliserPoste` le lit, sinon
  milieu, le choix par défaut du formulaire d'une fiche.
- **Les compteurs** de la fiche partent de zéro, comme pour une fiche
  rapprochée à la main : les matchs de compétition se lisent par la ligne, les
  recopier les compterait deux fois.
- **La photo** d'une ligne reste sur la ligne. Elle est rangée sous la
  compétition, et supprimer la fiche effacerait son fichier.
- **Au plus 100 fiches** d'un coup (`FICHES_REPRISES_MAX`) : une transaction
  Firestore plafonne à 500 écritures. Au-delà, les lignes restent libres et se
  reprennent par « Resynchroniser ».
- **Deux clics ne font pas deux équipes.** La transaction relit l'équipe de
  compétition : déjà liée, elle lève `DejaLiee` (409 sur
  `/api/competitions/rattacher-equipe`).

## Où

- `lib/rattachement-equipe` : `effectifDepuisCompetition` et
  `messageDeReprise`, purs.
- `lib/rattachement-serveur` : `appliquerRattachement` crée l'équipe, les
  fiches et pose les liens en une transaction ; rend `{ equipeId, repris }`.
- `/api/team-manager-invites/[id]` et `/api/competitions/rattacher-equipe`
  renvoient `repris` ; l'invitation et la page de l'équipe de compétition le
  disent au manager.
