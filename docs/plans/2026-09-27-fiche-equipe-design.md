# Design : La fiche publique d'une équipe, qui ne se contredit plus

**Date :** 2026-09-27
**Statut :** Livré. Aucune règle Firestore à déployer, aucune migration. La route publique d'un club publie désormais son effectif.

## Le problème

Deux pages publiques pour une équipe : la fiche du club (`/teams/[id]`) et la fiche d'une équipe dans une compétition (`/c/[slug]/teams/[tid]`). Relues en visiteur, en compte étranger au club, en membre et en manager, sur téléphone et sur ordinateur :

1. **La fiche du club se contredisait.** Un visiteur lisait « Effectif 14 » au-dessus de « Aucun joueur dans l'équipe », « Aucun match programmé » à côté d'un bilan de quatre matchs joués, et trois onglets vides sur sept. Même connecté, l'onglet Matchs ignorait les compétitions que le bilan comptait. Le meilleur buteur et le meilleur passeur sortaient de compteurs de profil qu'un match ne crédite qu'une fois validé : « personne encore » sous un match où un passeur était nommé. Un visiteur qui touchait « Suivre » ne voyait rien se passer.
2. **Elle en montrait trop à un compte étranger** : le programme des entraînements, les présences, « 4/22 présents » sur un amical à venir.
3. **Elle se lisait mal.** Une grande carte par joueur (cinq écrans pour quatorze), deux listes mises bout à bout (un gardien après les attaquants), la ville répétée sur chaque ligne, le manager absent ; dix chiffres en tuiles géantes pour un bilan ; la forme dans le sens inverse de la page de match ; sept onglets dont un coupé.
4. **Les deux fiches s'ignoraient**, avec trois bandeaux différents d'une page d'équipe à l'autre. La fiche en compétition affichait les postes en anglais, gardait un quart d'écran de téléphone sous un bandeau collant, et ne menait ni au club ni aux profils.
5. **Une virgule seule** tenait lieu de valeur absente dans une vingtaine d'endroits (ratio de victoires, profil, console, organisateur, administration), trace d'un remplacement automatique des tirets.

## Décisions

### Une fiche publique, calculée d'un coup

- **`lib/fiche-club-serveur`** lit en une fois l'effectif (comptes et joueurs sans compte), le manager et son staff, les amicaux et les matchs de compétition des inscriptions du club, et en déduit le bilan, la forme, le rang dans chaque poule et les meilleurs joueurs. Le bilan et la liste reposent sur les mêmes matchs : ce que la fiche compte, elle le montre.
- **L'effectif est public** : nom, numéro, poste, photo, et le lien vers la fiche de ceux qui ont un compte, ce que chaque composition de match montrait déjà. Ni la condition déclarée, ni un identifiant de contact.
- **Les meilleurs joueurs se calculent sur les matchs** (`meneursDuClub`, pur et testé), amicaux et compétitions ensemble : un joueur se reconnaît par son compte d'une page à l'autre (« u_<compte> » en compétition), une ligne sans compte par son identifiant dans le club (« ghost_<ligne> »). Un but contre son camp ou refusé ne compte pour personne.
- **Les classements de poule deviennent purs** (`lib/poules`, réexportés par `competition-firestore`) pour que le serveur puisse dire un rang.

### Une page qui se lit

- **Un bandeau commun** (`BandeauEquipe`) : noir, pleine largeur, comme celui d'un match, avec la forme en lettres et les boutons carrés (retour, partager, suivre, modifier). Les fils d'ariane restant masqués partout (décision du 2026-09-05), le retour fait comme celui du tableau d'un match : on revient d'où l'on vient, et à défaut au dernier niveau cliquable du fil. La bannière d'un club reste, en fond sous un noir qui garde le nom lisible.
- **La carte du club** (`CarteDuClub`) remplace « À propos » et « Stats » : ville et niveau, recrutement, abonnés, bilan, forme (du plus ancien au plus récent), buts, meilleurs buteur et passeur, prochain match, compétitions avec rang et points, présentation. À droite sur ordinateur, entre le bandeau et les onglets sur téléphone.
- **L'effectif par poste** (`EffectifParPoste`), une ligne par joueur, le manager et le staff en tête ; le même composant sert l'effectif en compétition, postes en français et liens vers les profils. Le manager garde sa liste de gestion.
- **Les matchs vus du club** (`MatchsDuClub`) : l'adversaire, le score, le résultat, la compétition ou « Amical », en deux listes (à venir, joués). Les présences ne se lisent que par les membres.
- **Des onglets qui ont quelque chose à montrer** : Effectif, Matchs, puis Entraînements pour les membres, Palmarès et Galerie s'ils ne sont pas vides, et les onglets du manager.
- **« Suivre » en visiteur** ouvre l'invitation à créer un compte.

### Relier

- **La fiche en compétition mène au club** qui l'a revendiquée, **le club liste ses compétitions**, et les noms mènent aux profils.
- La fiche en compétition prend le même bandeau, non collant, le nom de la compétition en lien au-dessus de celui de l'équipe, et deux colonnes sur ordinateur : prochain match et bilan dans la compétition à droite, effectif et matchs à gauche.

### Les virgules

- Toutes les valeurs absentes affichées « , » redeviennent « – », et les séparateurs « , » redeviennent « · » ou « – ».

## Tutoriels

Les scripts des tutoriels manager et joueur visent les nouveaux onglets, et les guides nomment la carte du club au lieu de l'onglet Stats. Les PDF et leurs captures sont à régénérer avec leur outillage.

## Vérifications

- `mobile/src/__tests__/fiche-club.test.ts` (identité d'un joueur d'un match à l'autre, meilleurs joueurs, effectif par poste, rangement et statuts des matchs).
- Le tutoriel manager rejoué sur les émulateurs, une poule ajoutée à sa compétition, puis les deux fiches vues en visiteur, en compte étranger, en membre et en manager, sur téléphone et sur ordinateur.
