# Design : KoppaFoot+ et « Pas de pubs », une offre par profil

**Date :** 2026-10-13
**Statut :** Design validé par le fondateur en conversation le 2026-10-13, spec à relire avant le plan. Branche `feat/koppafoot-plus`, partie de `master` après la fusion du paiement (PR #109).

## Le problème

KoppaFoot Pro se vend à tout le monde, par une entrée unique « Mon offre ». Or il ne sert qu'à trois profils. Ce qu'il fait, lu dans le code :

| Profil | Ce que le Pro lui apporte |
|---|---|
| Manager | Plus de 2 équipes, le Club multi-équipes, pas de pub |
| Organisateur (casquette) | Plus d'1 compétition en cours, plus de 16 équipes par compétition, pas de pub |
| Propriétaire de terrain (casquette) | Plus d'1 terrain, pas de pub |
| Joueur, arbitre, spectateur, scoreur | Pas de pub, rien d'autre |

Deux conséquences. Un joueur qui achète le Pro paie le prix fort pour le seul retrait de la publicité. Et la page lui propose « Gérer mon club », qui mène à la création d'un Club multi-équipes dont il n'a aucune équipe à remplir : le serveur ne vérifie que le Pro, pas le rôle. C'est ce que le compte du fondateur a rencontré le 2026-10-13.

Le droit « sans pub » existe déjà à part (`droits/{uid}.sans_pub`), mais il ne se vend pas : l'administration l'accorde à la main.

## Ce que le fondateur a tranché

- **Une règle ne bouge pas** : « un joueur ne dirige pas d'équipe, sauf s'il est ajouté dans le staff d'une équipe, et cela avec des limites ». La création d'équipe n'entre donc pas dans une offre payante pour les joueurs, et rien ici n'y touche.
- **KoppaFoot Pro devient KoppaFoot+**, partout où le nom se lit.
- **Deux offres**, chacune avec ses prix réglés dans l'administration :
  - **KoppaFoot+** : ce que le Pro fait aujourd'hui. Proposé aux managers, organisateurs et propriétaires de terrain, et à eux seuls.
  - **Pas de pubs** : le seul retrait de la publicité. Proposé à tout le monde, 1 mois ou 1 an.
- **Managers et casquettes voient les deux offres** ; les autres ne voient que « Pas de pubs ».
- **L'entrée « Mon offre » disparaît** : elle s'appelle « KOPPAFOOT+ » pour les premiers, « Pas de pubs » pour les seconds.

## La règle : qui a droit à KoppaFoot+

Une fonction pure, `offresDuProfil`, dans `lib/offre`, lue par le serveur et par le navigateur :

- **KoppaFoot+** si le compte est manager (`user_type` ou `evolution_role` vaut `manager`), ou porte la casquette organisateur (`is_organizer`), ou la casquette propriétaire (`is_venue_owner`), ou est superadmin (il organise d'office, voir `lib/hats`).
- **Pas de pubs** : toujours.

Le scoreur est une casquette, mais le Pro ne lui apporte rien : il n'ouvre pas KoppaFoot+.

**Un cas hérité.** Le serveur compte aussi comme manager un compte qui gère au moins une équipe sans en porter le rôle (c'est déjà ce que fait `/api/offre`). Le plafond de 2 équipes le concernera le 30 novembre : il doit pouvoir acheter KoppaFoot+. Le menu, qui ne lit que le profil, lui dira « Pas de pubs » alors que la page lui montrera les deux offres. L'écart est accepté : ces comptes ne devraient pas exister, d'après la règle du fondateur.

## Les deux offres

### KoppaFoot+
- Le droit `pro`, inchangé : plafonds levés, Club multi-équipes, pas de pub.
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
  - Profil KoppaFoot+ : KoppaFoot+ d'abord (état, échéance, formules, plafonds et usage), puis « Pas de pubs » en dessous, sauf si KoppaFoot+ est actif.
  - Autres profils : « Pas de pubs » seul (état, échéance, formules). Ni plafonds, ni club.
  - Un compte hors profil qui a déjà KoppaFoot+ (accordé ou acheté avant) voit son état et son échéance, sans rien à acheter tant qu'il court.
- **Le retour de paiement** et ses messages disent ce qui a été acheté : « Tu as KoppaFoot+ jusqu'au … » ou « Plus de publicité jusqu'au … ».

## Le Club multi-équipes

- **Créer un club demande d'être manager et d'avoir KoppaFoot+.** Aujourd'hui le serveur ne demande que le Pro.
- Le lien « Gérer mon club » de la page d'offre ne se montre qu'aux managers.
- `/mon-club`, ouvert par un compte qui n'est pas manager : la page dit que le club réunit les équipes d'un manager, sans formulaire. Les invitations reçues, elles, ne concernent que des managers : rien ne change pour eux.

## Rien ne se retire

- Un KoppaFoot+ actif sur un compte hors profil court jusqu'à son terme, avec tous ses effets.
- Un club déjà créé par un compte qui n'est pas manager reste en place et se gère comme avant ; seule la création est fermée.
- L'administration accorde toujours l'un ou l'autre droit à la main, à qui elle veut, sans regarder le profil.
- Les plafonds de l'offre gratuite et leur date d'entrée en vigueur (30 novembre 2026) ne changent pas.

## Où ça vit

Aucune collection nouvelle, aucune règle Firestore à déployer.

| Donnée | |
|---|---|
| `droits/{uid}` | Inchangé. `sans_pub` peut désormais avoir `source: "paiement"`. Un marqueur `rappel_sans_pub_le`, sur le modèle de `rappel_pro_le`. |
| `paiements/{id}` | Inchangé. `formule` peut valoir `sans_pub_mois` ou `sans_pub_an`, `droit` vaut alors `sans_pub`. |
| `settings/offre.prix` | Quatre clés : `pro_mois`, `pro_an`, `sans_pub_mois`, `sans_pub_an`. |

**Les noms internes ne bougent pas** : `pro`, `pro_mois`, `pro_an`, `droits.pro`, `estPro`. Les renommer casserait la lecture des droits et des paiements déjà écrits, et les références envoyées à FedaPay.

## Les pièces

| Fichier | Rôle |
|---|---|
| `src/lib/offre.ts` | `offresDuProfil` (pur). Les messages de plafond disent KoppaFoot+. |
| `src/lib/paiement.ts` | Le catalogue à quatre formules ; `lirePrix` et `formulesEnVente` les suivent. |
| `src/lib/paiement-serveur.ts` | `formulesPour` rend les formules du profil ; `demarrerPaiement` refuse une formule hors profil, et « Pas de pubs » sous KoppaFoot+ actif ; l'effet d'un achat écrit le droit de la formule (`pro` ou `sans_pub`) ; l'accusé de réception et les rappels d'échéance couvrent les deux. |
| `src/lib/email.ts` | Le reçu dit ce qui a été acheté. |
| `src/app/api/offre/route.ts` | Rend le titre de l'offre du profil et ses formules. |
| `src/app/api/paiements/route.ts` | Les statuts des refus nouveaux. |
| `src/app/api/admin/offre/route.ts`, `src/app/(admin)/admin/offre/page.tsx` | Quatre prix, libellés renommés. |
| `src/app/api/clubs/route.ts` | Création réservée aux managers. |
| `src/app/(app)/offre/page.tsx` | Titre et sections selon le profil, FR et EN. |
| `src/app/(app)/mon-club/page.tsx`, `teams/page.tsx`, `clubs/[slug]/page.tsx` | Renommage ; le club pour les managers. |
| `src/components/layout/AvatarBottomSheet.tsx`, `v2/ScoreHeader.tsx`, `src/i18n/fr.ts`, `en.ts` | L'entrée de menu selon le profil. |
| `src/components/offre/LimiteOffre.tsx` | Renommage. |
| Conditions, confidentialité | Renommage, « Pas de pubs » décrit, date de mise à jour. |

## Le renommage

« KoppaFoot Pro » et « Pro » deviennent « KoppaFoot+ » dans tout ce qu'une personne lit : écrans (FR et EN), notifications, e-mails, reçu, libellé de la collecte chez FedaPay, conditions, confidentialité, administration. Une trentaine de mentions dans treize fichiers, plus les deux fichiers de langue.

- Dans une phrase : « KoppaFoot+ ». En titre de menu et de page : « KOPPAFOOT+ ».
- « Pas de pubs » en français, « No ads » en anglais.
- Ce qui a déjà été envoyé (notifications, reçus) garde l'ancien nom : on ne réécrit pas le passé.
- Les commentaires du code suivent le nouveau nom là où ils décrivent le produit ; les identifiants, non.

## Ce qui protège

- **L'offre d'un profil se décide au serveur.** La page et le menu ne font qu'afficher ; `demarrerPaiement` relit le profil et refuse.
- **Le montant reste lu au serveur**, dans `settings/offre`, par formule. Rien ne change à `reglerPaiement`, seule porte qui accorde un droit.
- **La porte du lot précédent tient** : sans clé FedaPay réelle, rien ne se vend ; en bac à sable, les superadmins seuls.

## Quand ça casse

| Cas | Ce qui se passe |
|---|---|
| Un joueur appelle directement l'achat de KoppaFoot+ | Refusé : « KoppaFoot+ est réservé aux managers, organisateurs et propriétaires de terrain. » |
| Un compte avec KoppaFoot+ actif appelle l'achat de « Pas de pubs » | Refusé : KoppaFoot+ retire déjà la publicité. |
| Un manager redevient joueur avec KoppaFoot+ en cours | Il le garde jusqu'au terme ; il ne peut plus le prolonger. « Pas de pubs » lui est proposé à l'échéance. |
| Un joueur avec « Pas de pubs » devient manager | Les deux offres lui sont proposées ; son « Pas de pubs » court toujours. |
| Un paiement « Pas de pubs » arrive alors que le compte a reçu entre-temps un sans-pub sans échéance | La ligne est payée, sans effet, visible dans l'administration, comme pour le Pro aujourd'hui. |
| « Pas de pubs » se termine pendant que KoppaFoot+ est actif | Pas de rappel : la publicité ne revient pas. |

## Vérifications

- Tests purs : `offresDuProfil` (chaque rôle, chaque casquette, le cumul, le superadmin, le scoreur seul) ; le catalogue à quatre formules, `lirePrix`, `formulesEnVente`.
- Tests du serveur, contre le faux Firestore : les formules proposées à chaque profil ; le refus de KoppaFoot+ hors profil ; le refus de « Pas de pubs » sous KoppaFoot+ actif ; un achat « Pas de pubs » accorde, se prolonge, et rejoué ne change rien ; les tests du Pro passent sans changer de comportement ; les rappels d'échéance des deux droits.
- Le texte compilé des écrans retouchés (espaces, voir la note sur SWC).
- Bac à sable : un compte joueur voit « Pas de pubs » au menu et sur la page, l'achète avec l'outil de test, et les emplacements des partenaires disparaissent ; un compte manager voit « KOPPAFOOT+ » et les deux offres ; un joueur ne peut pas créer de club.

## Hors périmètre

- L'application mobile : elle n'a pas d'écran d'offre.
- Le staff d'une équipe et ses limites : la règle du fondateur n'est pas touchée.
- Un joueur qui tiendrait une équipe : écarté par le fondateur.
- Ce que « Pas de pubs » retire d'affichages aux partenaires : arbitré par le fondateur, qui fixe le prix.
