# Design : KoppaFoot+ et « Pas de pubs », une offre par profil

**Date :** 2026-10-13
**Statut :** Design validé par le fondateur en conversation le 2026-10-13, puis corrigé par lui le même jour sur deux points (le changement de rôle met fin à KoppaFoot+ ; KoppaFoot+ n'agit que pour ce que le compte est). Spec à relire avant le plan. Branche `feat/koppafoot-plus`, partie de `master` après la fusion du paiement (PR #109).

## Le problème

KoppaFoot Pro se vend à tout le monde, par une entrée unique « Mon offre ». Or il ne sert qu'à trois profils. Ce qu'il fait, lu dans le code :

| Profil | Ce que le Pro lui apporte |
|---|---|
| Manager | Plus de 2 équipes, le Club multi-équipes, pas de pub |
| Organisateur (casquette) | Plus d'1 compétition en cours, plus de 16 équipes par compétition, pas de pub |
| Propriétaire de terrain (casquette) | Plus d'1 terrain, pas de pub |
| Joueur, arbitre, spectateur, scoreur | Pas de pub, rien d'autre |

Trois conséquences. Un joueur qui achète le Pro paie le prix fort pour le seul retrait de la publicité. La page lui propose « Gérer mon club », qui mène à la création d'un Club multi-équipes dont il n'a aucune équipe à remplir : c'est ce que le compte du fondateur a rencontré le 2026-10-13. Et le serveur ne regarde jamais ce que le compte est : avec le Pro, il lève tous les plafonds à la fois et ouvre le club à n'importe qui.

Le droit « sans pub » existe déjà à part (`droits/{uid}.sans_pub`), mais il ne se vend pas : l'administration l'accorde à la main.

## Ce que le fondateur a tranché

- **Une règle ne bouge pas** : « un joueur ne dirige pas d'équipe, sauf s'il est ajouté dans le staff d'une équipe, et cela avec des limites ». Un joueur membre du staff d'une équipe reste un joueur : ce n'est pas un manager, et le staff ne lui ouvre aucune offre.
- **KoppaFoot Pro devient KoppaFoot+**, partout où le nom se lit.
- **Deux offres**, chacune avec ses prix réglés dans l'administration :
  - **KoppaFoot+** : pour les managers, les organisateurs et les propriétaires de terrain, et eux seuls.
  - **Pas de pubs** : le seul retrait de la publicité. Pour tout le monde, 1 mois ou 1 an.
- **Managers et casquettes voient les deux offres** ; les autres ne voient que « Pas de pubs ».
- **KoppaFoot+ est limité à ce que le compte est.** Un joueur qui porte une casquette peut l'avoir, mais il n'agit alors que pour cette casquette.
- **Changer de rôle met fin à KoppaFoot+**, après accord explicite, sans remboursement.
- **L'entrée « Mon offre » disparaît** : elle s'appelle « KOPPAFOOT+ » pour les premiers, « Pas de pubs » pour les seconds.

## Qui a droit à KoppaFoot+

Une fonction pure, `offresDuProfil`, dans `lib/offre`, lue par le serveur et par le navigateur :

- **manager** : le rôle, et lui seul (`user_type` ou `evolution_role` vaut `manager`). Ni le staff d'une équipe, ni le fait d'en avoir une à son nom sans le rôle ;
- **organisateur** : la casquette `is_organizer`. Le superadmin l'est d'office (`lib/hats`) ;
- **propriétaire de terrain** : la casquette `is_venue_owner`.

Le scoreur est une casquette, mais le Pro ne lui apporte rien : il n'ouvre pas KoppaFoot+. « Pas de pubs », lui, est ouvert à tous.

## KoppaFoot+ n'agit que pour ce que le compte est

Aujourd'hui, avoir le Pro lève tout. Désormais, chaque avantage demande KoppaFoot+ **et** le titre qui va avec :

| Le compte est | KoppaFoot+ lui lève |
|---|---|
| Manager | Le plafond de 2 équipes ; le Club multi-équipes |
| Organisateur | Le plafond d'1 compétition en cours ; les 16 équipes par compétition |
| Propriétaire de terrain | Le plafond d'1 terrain |
| Tout compte avec KoppaFoot+ | La publicité |

Un joueur organisateur qui a KoppaFoot+ mène donc autant de compétitions qu'il veut, sans pub, mais il n'a ni équipes au-delà du plafond, ni club. Les titres se cumulent : un manager propriétaire a les deux lignes.

Trois endroits du serveur changent pour cela :

- **Les plafonds** (`limiteDeCreation`, `lib/offre-server`) ne se lèvent que pour le titre concerné. Créer un terrain ou une compétition demande déjà la casquette : seul le plafond d'équipes change en pratique.
- **Le club** : le créer demande d'être manager avec KoppaFoot+ ; il n'est éveillé que tant que son propriétaire l'est (`estEveille`, `lib/clubs-serveur`). Sinon il s'endort, comme aujourd'hui quand le Pro s'arrête : sa page ne s'affiche plus, rien n'est effacé, il revit tel quel.
- **Créer une équipe demande le rôle manager, côté serveur.** Aujourd'hui seul l'écran le vérifie : `/api/teams` accepte n'importe quel compte. C'est la règle du fondateur, écrite là où elle tient. Un seul écran appelle cette route, et il est déjà réservé aux managers.

## Changer de rôle

Le rôle se change à un seul endroit, l'écran des rôles (`components/roles/ChoixDuRole`), par une écriture du navigateur que les règles autorisent. Rien ne peut donc aujourd'hui y attacher une condition.

- **Le changement de rôle passe par le serveur** (`POST /api/roles`), qui écrit le rôle et ce qui en dépend dans une même transaction.
- **Le compte a un KoppaFoot+ actif, et le nouveau profil n'y a plus droit** (il n'est plus manager et ne porte aucune casquette) : le serveur refuse tant que l'accord n'est pas donné. L'écran demande : « Changer de rôle met fin à ton KoppaFoot+, qui courait jusqu'au 12 novembre. Il n'est pas remboursé. » Accepté : KoppaFoot+ est résilié et le rôle change, ensemble. Refusé : rien ne change.
- **Le compte garde une casquette** : KoppaFoot+ continue, pour cette casquette seulement. L'écran le dit avant de changer : « Ton KoppaFoot+ continue pour tes compétitions. Il ne couvrira plus tes équipes ni ton club. » Pas de résiliation.
- **Résilié veut dire terminé.** Le droit s'arrête la veille, avec son motif ; redevenir manager ne le rend pas, il faut le racheter. Les paiements passés restent au journal.
- **Quel que soit son origine** : un KoppaFoot+ accordé à la main par l'administration s'arrête de la même façon. Le droit suit le profil.
- **« Pas de pubs » n'est pas touché** par un changement de rôle.
- **Le club s'endort** avec le KoppaFoot+ de son propriétaire, ou dès qu'il n'est plus manager.

**Les règles Firestore se ferment d'autant.** Un navigateur n'écrit plus ni `user_type` ni `evolution_role` : sans cela, il suffirait d'écrire son rôle directement pour éviter la question. `evolution_role` n'est aujourd'hui même pas un champ protégé. L'application mobile n'écrit pas de rôle, et l'invitation à reprendre une équipe (`/api/team-manager-invites`) passe déjà par le serveur.

## Les deux offres

### KoppaFoot+
- Le droit `pro`, sous son nouveau nom, limité comme dit plus haut.
- Formules `pro_mois` et `pro_an`, inchangées.
- **Achat refusé à qui n'y a pas droit**, par le serveur : la page ne montre pas la formule, et un appel direct est refusé.

### Pas de pubs
- Le droit `sans_pub`, qui existe : il ne fait que retirer les emplacements des partenaires (`components/partenaires/Emplacement`, par `useSansPub`).
- Deux formules nouvelles, `sans_pub_mois` et `sans_pub_an`. Même parcours que KoppaFoot+ : page de paiement FedaPay, une période sans renouvellement automatique, période ajoutée à la fin en cours, reçu, rappel sept jours avant et la veille.
- **Pas proposé tant que KoppaFoot+ est actif** : il le comprend déjà. Un appel direct est refusé, on ne fait pas payer deux fois la même chose.

### Les deux ensemble
- Acheter KoppaFoot+ quand « Pas de pubs » court encore : les deux droits courent chacun jusqu'à son terme. Ni remboursement, ni conversion du temps restant.
- Un droit sans échéance (accordé par l'administration) ne se prolonge pas : rien à vendre, comme aujourd'hui pour le Pro.

### Les prix
`settings/offre.prix` porte quatre prix au lieu de deux. Un prix vide : la formule n'est pas en vente. Les prix actuels de KoppaFoot+ (500 et 5 000 FCFA) ne bougent pas ; ceux de « Pas de pubs » sont à saisir par le fondateur, et rien ne se vend avant.

## Le parcours

- **Le menu du compte** (`AvatarBottomSheet`, `ScoreHeader`) : l'entrée s'appelle « KOPPAFOOT+ » si le profil y a droit, « Pas de pubs » sinon. L'adresse reste `/offre` : les notifications et les e-mails déjà envoyés y mènent.
- **La page `/offre`** porte le même titre que le menu.
  - Profil KoppaFoot+ : KoppaFoot+ d'abord (état, échéance, formules, et les seuls plafonds que son profil lève), puis « Pas de pubs » en dessous, sauf si KoppaFoot+ est actif.
  - Autres profils : « Pas de pubs » seul (état, échéance, formules). Ni plafonds, ni club.
  - Le lien « Gérer mon club » ne se montre qu'aux managers.
- **Le retour de paiement** et ses messages disent ce qui a été acheté : « Tu as KoppaFoot+ jusqu'au … » ou « Plus de publicité jusqu'au … ».
- **`/mon-club`**, ouvert par un compte qui n'est pas manager : la page dit que le club réunit les équipes d'un manager, sans formulaire.

## Ce qui arrive aux comptes d'aujourd'hui

- **Un KoppaFoot+ déjà actif sur un compte hors profil** (le compte joueur du fondateur) court jusqu'à son terme, mais limité comme les autres : pour un joueur, il ne retire plus que la publicité. Il ne se prolonge pas ; à l'échéance, « Pas de pubs » lui est proposé.
- **Un club dont le propriétaire n'est pas manager** s'endort au déploiement. Rien n'est effacé ; il revit si son propriétaire redevient manager avec KoppaFoot+.
- **Une équipe au nom d'un compte qui n'est pas manager** reste la sienne : rien ne lui est retiré, il n'en crée simplement plus.
- L'administration accorde toujours l'un ou l'autre droit à la main, à qui elle veut.
- Les plafonds de l'offre gratuite et leur date d'entrée en vigueur (30 novembre 2026) ne changent pas.

## Où ça vit

Aucune collection nouvelle.

| Donnée | |
|---|---|
| `droits/{uid}` | `sans_pub` peut désormais avoir `source: "paiement"`. Un marqueur `rappel_sans_pub_le`, sur le modèle de `rappel_pro_le`. Un `pro` résilié garde sa trace : `jusqu_au` ramené à la veille, et `motif` dit pourquoi. |
| `paiements/{id}` | `formule` peut valoir `sans_pub_mois` ou `sans_pub_an`, `droit` vaut alors `sans_pub`. |
| `settings/offre.prix` | Quatre clés : `pro_mois`, `pro_an`, `sans_pub_mois`, `sans_pub_an`. |
| `users/{uid}` | `user_type` et `evolution_role` ne s'écrivent plus que par le serveur. |
| `firestore.rules` | `evolution_role` rejoint les champs protégés, et la branche qui laissait le titulaire changer de rôle disparaît. **À déployer avec le code**, pas avant : l'écran des rôles en ligne écrit encore par le navigateur. |

**Les noms internes ne bougent pas** : `pro`, `pro_mois`, `pro_an`, `droits.pro`, `estPro`. Les renommer casserait la lecture des droits et des paiements déjà écrits, et les références envoyées à FedaPay.

## Les pièces

| Fichier | Rôle |
|---|---|
| `src/lib/offre.ts` | Pur : `offresDuProfil` (ce qu'un profil peut acheter), ce que KoppaFoot+ lève pour un profil, et si un changement de rôle demande une résiliation. Les messages de plafond disent KoppaFoot+. |
| `src/lib/offre-server.ts` | Les plafonds ne se lèvent que pour le titre concerné. |
| `src/lib/paiement.ts` | Le catalogue à quatre formules ; `lirePrix` et `formulesEnVente` les suivent. |
| `src/lib/paiement-serveur.ts` | `formulesPour` rend les formules du profil ; `demarrerPaiement` refuse une formule hors profil, et « Pas de pubs » sous KoppaFoot+ actif ; l'effet d'un achat écrit le droit de la formule (`pro` ou `sans_pub`) ; l'accusé de réception et les rappels d'échéance couvrent les deux. |
| `src/lib/roles-serveur.ts` (nouveau) | Changer de rôle : le rôle, ses champs, et la résiliation de KoppaFoot+ s'il le faut, dans une transaction. |
| `src/app/api/roles/route.ts` (nouveau) | `POST` : changer de rôle. Répond qu'un accord est requis, avec l'échéance perdue, tant qu'il n'est pas donné. |
| `src/components/roles/ChoixDuRole.tsx` | Appelle la route ; demande l'accord quand le serveur le réclame. |
| `src/lib/clubs-serveur.ts`, `src/app/api/clubs/route.ts` | Le club : manager avec KoppaFoot+, pour le créer comme pour l'éveiller. |
| `src/app/api/teams/route.ts` | Créer une équipe demande le rôle manager. |
| `src/lib/email.ts` | Le reçu dit ce qui a été acheté. |
| `src/app/api/offre/route.ts` | Rend le titre de l'offre du profil, ses formules, et les plafonds qui le concernent. |
| `src/app/api/paiements/route.ts` | Les statuts des refus nouveaux. |
| `src/app/api/admin/offre/route.ts`, `src/app/(admin)/admin/offre/page.tsx` | Quatre prix, libellés renommés. |
| `src/app/(app)/offre/page.tsx` | Titre et sections selon le profil, FR et EN. |
| `src/app/(app)/mon-club/page.tsx`, `teams/page.tsx`, `clubs/[slug]/page.tsx` | Renommage ; le club pour les managers. |
| `src/components/layout/AvatarBottomSheet.tsx`, `v2/ScoreHeader.tsx`, `src/i18n/fr.ts`, `en.ts` | L'entrée de menu selon le profil. |
| `src/components/offre/LimiteOffre.tsx` | Renommage. |
| `firestore.rules` | Le rôle ne s'écrit plus par le navigateur. |
| Conditions, confidentialité | Renommage, « Pas de pubs » décrit, la fin de KoppaFoot+ au changement de rôle écrite noir sur blanc, date de mise à jour. |

## Le renommage

« KoppaFoot Pro » et « Pro » deviennent « KoppaFoot+ » dans tout ce qu'une personne lit : écrans (FR et EN), notifications, e-mails, reçu, libellé de la collecte chez FedaPay, conditions, confidentialité, administration. Une trentaine de mentions dans treize fichiers, plus les deux fichiers de langue.

- Dans une phrase : « KoppaFoot+ ». En titre de menu et de page : « KOPPAFOOT+ ».
- « Pas de pubs » en français, « No ads » en anglais.
- Ce qui a déjà été envoyé (notifications, reçus) garde l'ancien nom : on ne réécrit pas le passé.
- Les commentaires du code suivent le nouveau nom là où ils décrivent le produit ; les identifiants, non.

## Ce qui protège

- **Tout se décide au serveur**, sur le profil qu'il relit : l'offre proposée, l'achat, chaque plafond, le club, le changement de rôle. Les écrans ne font qu'afficher.
- **Le rôle ne s'écrit plus depuis un navigateur** : c'est ce qui rend la question de la résiliation impossible à éviter.
- **Le montant reste lu au serveur**, dans `settings/offre`, par formule. Rien ne change à `reglerPaiement`, seule porte qui accorde un droit.
- **La porte du lot précédent tient** : sans clé FedaPay réelle, rien ne se vend ; en bac à sable, les superadmins seuls.

## Quand ça casse

| Cas | Ce qui se passe |
|---|---|
| Un joueur appelle directement l'achat de KoppaFoot+ | Refusé : « KoppaFoot+ est réservé aux managers, organisateurs et propriétaires de terrain. » |
| Un joueur membre du staff d'une équipe veut KoppaFoot+ | Refusé de même : le staff n'est pas un manager. |
| Un joueur organisateur achète KoppaFoot+ | Accepté. Ses compétitions n'ont plus de plafond ; il n'a ni équipes en plus, ni club. |
| Un compte avec KoppaFoot+ actif appelle l'achat de « Pas de pubs » | Refusé : KoppaFoot+ retire déjà la publicité. |
| Un manager avec KoppaFoot+ veut devenir joueur | Le serveur demande l'accord. Accepté : KoppaFoot+ s'arrête sans remboursement, le rôle change, son club s'endort. |
| Le même, s'il est aussi organisateur | Pas de résiliation : KoppaFoot+ continue pour ses compétitions, son club s'endort. |
| Il redevient manager plus tard | Son KoppaFoot+ résilié ne revient pas. Il peut le racheter. |
| Un joueur avec « Pas de pubs » devient manager | Les deux offres lui sont proposées ; son « Pas de pubs » court toujours. |
| Un paiement arrive pour une formule à laquelle le compte n'a plus droit (rôle changé entre le clic et le paiement) | L'argent est reçu : le droit est accordé quand même, et il est limité à ce que le profil ouvre. On ne garde pas un paiement sans rien donner. |
| « Pas de pubs » se termine pendant que KoppaFoot+ est actif | Pas de rappel : la publicité ne revient pas. |

## Vérifications

- Tests purs : `offresDuProfil` (chaque rôle, chaque casquette, le cumul, le superadmin, le scoreur seul, le joueur membre d'un staff) ; ce que KoppaFoot+ lève pour chaque profil ; quand un changement de rôle demande une résiliation ; le catalogue à quatre formules, `lirePrix`, `formulesEnVente`.
- Tests du serveur, contre le faux Firestore : les formules proposées à chaque profil ; le refus de KoppaFoot+ hors profil ; le refus de « Pas de pubs » sous KoppaFoot+ actif ; un achat « Pas de pubs » accorde, se prolonge, et rejoué ne change rien ; chaque plafond ne se lève que pour son titre ; le club ne s'éveille que pour un manager ; le changement de rôle sans accord ne change rien, avec accord résilie et change ensemble, avec une casquette ne résilie pas ; les tests du Pro passent sans changer de comportement ; les rappels d'échéance des deux droits.
- Règles Firestore : `user_type` et `evolution_role` refusés au navigateur.
- Le texte compilé des écrans retouchés (espaces, voir la note sur SWC).
- Bac à sable : un compte joueur voit « Pas de pubs » au menu et sur la page, l'achète avec l'outil de test, et les emplacements des partenaires disparaissent ; un compte manager voit « KOPPAFOOT+ » et les deux offres ; un manager avec KoppaFoot+ qui devient joueur passe par la question, et perd KoppaFoot+ ; un joueur ne peut créer ni club ni équipe.

## Hors périmètre

- L'application mobile : elle n'a ni écran d'offre, ni changement de rôle.
- Le staff d'une équipe et ses limites : la règle du fondateur n'est pas touchée.
- Ce qu'un manager fait de ses équipes avant de changer de rôle (voir « À trancher »).
- Ce que « Pas de pubs » retire d'affichages aux partenaires : arbitré par le fondateur, qui fixe le prix.

## À trancher

- **Un manager qui a encore des équipes peut-il changer de rôle ?** Aujourd'hui oui, et il les garde : un joueur se retrouve alors à diriger des équipes, ce que la règle du fondateur exclut. Soit le serveur refuse tant qu'il n'a pas confié ou supprimé ses équipes, soit on laisse comme aujourd'hui. Cette spec ne change rien tant que ce n'est pas tranché.
