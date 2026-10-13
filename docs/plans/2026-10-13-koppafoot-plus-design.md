# Design : KoppaFoot+ et « Pas de pubs », une offre par profil

**Date :** 2026-10-13
**Statut :** Design validé par le fondateur en conversation le 2026-10-13, puis corrigé par lui le même jour. Premier de deux chantiers : celui-ci porte les offres ; le changement de rôle (accord, fin de KoppaFoot+, gel des équipes) a sa propre spec, `2026-10-13-changer-de-role-design.md`, qui s'appuie sur celui-ci. Spec à relire avant le plan. Branche `feat/koppafoot-plus`, partie de `master` après la fusion du paiement (PR #109).

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
- **Changer de rôle met fin à KoppaFoot+**, après accord explicite, sans remboursement, et gèle les équipes du manager : c'est le second chantier.
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

## En attendant le second chantier

Le rôle se change encore depuis le navigateur, sans question. Ce chantier-ci suffit pourtant à ce que personne ne garde un avantage qu'il n'a plus à avoir : KoppaFoot+ étant limité au titre du compte, un manager qui devient joueur perd sur-le-champ ses équipes sans plafond et l'éveil de son club. Il lui reste la publicité retirée, jusqu'au terme. L'accord explicite, la résiliation et le gel des équipes arrivent avec le second chantier.

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

Aucune collection nouvelle, aucune règle Firestore à déployer.

| Donnée | |
|---|---|
| `droits/{uid}` | `sans_pub` peut désormais avoir `source: "paiement"`. Un marqueur `rappel_sans_pub_le`, sur le modèle de `rappel_pro_le`. |
| `paiements/{id}` | `formule` peut valoir `sans_pub_mois` ou `sans_pub_an`, `droit` vaut alors `sans_pub`. |
| `settings/offre.prix` | Quatre clés : `pro_mois`, `pro_an`, `sans_pub_mois`, `sans_pub_an`. |

**Les noms internes ne bougent pas** : `pro`, `pro_mois`, `pro_an`, `droits.pro`, `estPro`. Les renommer casserait la lecture des droits et des paiements déjà écrits, et les références envoyées à FedaPay.

## Les pièces

| Fichier | Rôle |
|---|---|
| `src/lib/offre.ts` | Pur : `offresDuProfil` (ce qu'un profil peut acheter) et ce que KoppaFoot+ lève pour un profil. Les messages de plafond disent KoppaFoot+. |
| `src/lib/offre-server.ts` | Les plafonds ne se lèvent que pour le titre concerné. |
| `src/lib/paiement.ts` | Le catalogue à quatre formules ; `lirePrix` et `formulesEnVente` les suivent. |
| `src/lib/paiement-serveur.ts` | `formulesPour` rend les formules du profil ; `demarrerPaiement` refuse une formule hors profil, et « Pas de pubs » sous KoppaFoot+ actif ; l'effet d'un achat écrit le droit de la formule (`pro` ou `sans_pub`) ; l'accusé de réception et les rappels d'échéance couvrent les deux. |
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
| Conditions, confidentialité | Renommage, « Pas de pubs » décrit, KoppaFoot+ dit pour qui il est et ce qu'il lève, date de mise à jour. |

## Le renommage

« KoppaFoot Pro » et « Pro » deviennent « KoppaFoot+ » dans tout ce qu'une personne lit : écrans (FR et EN), notifications, e-mails, reçu, libellé de la collecte chez FedaPay, conditions, confidentialité, administration. Une trentaine de mentions dans treize fichiers, plus les deux fichiers de langue.

- Dans une phrase : « KoppaFoot+ ». En titre de menu et de page : « KOPPAFOOT+ ».
- « Pas de pubs » en français, « No ads » en anglais.
- Ce qui a déjà été envoyé (notifications, reçus) garde l'ancien nom : on ne réécrit pas le passé.
- Les commentaires du code suivent le nouveau nom là où ils décrivent le produit ; les identifiants, non.

## Ce qui protège

- **Tout se décide au serveur**, sur le profil qu'il relit à chaque geste : l'offre proposée, l'achat, chaque plafond, le club. Les écrans ne font qu'afficher. Écrire soi-même son rôle n'y gagne rien : on n'obtient que ce que ce rôle ouvre.
- **Le montant reste lu au serveur**, dans `settings/offre`, par formule. Rien ne change à `reglerPaiement`, seule porte qui accorde un droit.
- **La porte du lot précédent tient** : sans clé FedaPay réelle, rien ne se vend ; en bac à sable, les superadmins seuls.

## Quand ça casse

| Cas | Ce qui se passe |
|---|---|
| Un joueur appelle directement l'achat de KoppaFoot+ | Refusé : « KoppaFoot+ est réservé aux managers, organisateurs et propriétaires de terrain. » |
| Un joueur membre du staff d'une équipe veut KoppaFoot+ | Refusé de même : le staff n'est pas un manager. |
| Un joueur organisateur achète KoppaFoot+ | Accepté. Ses compétitions n'ont plus de plafond ; il n'a ni équipes en plus, ni club. |
| Un compte avec KoppaFoot+ actif appelle l'achat de « Pas de pubs » | Refusé : KoppaFoot+ retire déjà la publicité. |
| Un manager avec KoppaFoot+ devient joueur | Son KoppaFoot+ ne couvre plus ses équipes ni son club, qui s'endort ; il ne lui retire plus que la publicité, et ne se prolonge pas. La résiliation avec accord viendra du second chantier. |
| Le même, s'il est aussi organisateur | KoppaFoot+ continue pour ses compétitions ; son club s'endort. |
| Il redevient manager | Son KoppaFoot+, s'il court encore, couvre de nouveau ses équipes et son club. |
| Un joueur avec « Pas de pubs » devient manager | Les deux offres lui sont proposées ; son « Pas de pubs » court toujours. |
| Un paiement arrive pour une formule à laquelle le compte n'a plus droit (rôle changé entre le clic et le paiement) | L'argent est reçu : le droit est accordé quand même, et il est limité à ce que le profil ouvre. On ne garde pas un paiement sans rien donner. |
| « Pas de pubs » se termine pendant que KoppaFoot+ est actif | Pas de rappel : la publicité ne revient pas. |

## Vérifications

- Tests purs : `offresDuProfil` (chaque rôle, chaque casquette, le cumul, le superadmin, le scoreur seul, le joueur membre d'un staff) ; ce que KoppaFoot+ lève pour chaque profil ; le catalogue à quatre formules, `lirePrix`, `formulesEnVente`.
- Tests du serveur, contre le faux Firestore : les formules proposées à chaque profil ; le refus de KoppaFoot+ hors profil ; le refus de « Pas de pubs » sous KoppaFoot+ actif ; un achat « Pas de pubs » accorde, se prolonge, et rejoué ne change rien ; chaque plafond ne se lève que pour son titre ; le club ne s'éveille que pour un manager ; créer une équipe sans le rôle manager est refusé ; les tests du Pro passent sans changer de comportement ; les rappels d'échéance des deux droits.
- Le texte compilé des écrans retouchés (espaces, voir la note sur SWC).
- Bac à sable : un compte joueur voit « Pas de pubs » au menu et sur la page, l'achète avec l'outil de test, et les emplacements des partenaires disparaissent ; un compte manager voit « KOPPAFOOT+ » et les deux offres ; un manager avec KoppaFoot+ qui devient joueur voit son club s'endormir ; un joueur ne peut créer ni club ni équipe.

## Hors périmètre

- **Le changement de rôle** : accord, résiliation de KoppaFoot+, gel des équipes, rôle écrit par le serveur. C'est le second chantier.
- L'application mobile : elle n'a pas d'écran d'offre.
- Le staff d'une équipe et ses limites : la règle du fondateur n'est pas touchée.
- Ce que « Pas de pubs » retire d'affichages aux partenaires : arbitré par le fondateur, qui fixe le prix.
