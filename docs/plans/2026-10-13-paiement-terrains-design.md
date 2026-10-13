# Design : Le paiement mobile, lot 2 — frais de réservation de terrain, ticket et battement

**Date :** 2026-10-13
**Statut :** Design validé par le fondateur le 2026-10-13, à implémenter (temps 1). Branche `feat/paiement-terrains`, partie de `feat/paiement-fedapay` (le lot 1, non fusionné, dont ce lot réutilise le socle).

## Le problème

Une équipe demande un créneau, le propriétaire confirme, et rien n'engage personne : l'équipe peut ne pas venir, le terrain reste vide un soir qu'il aurait pu louer. Tout le règlement se fait hors de la plateforme, qui « n'encaisse rien ».

La vidéo du 7 octobre a promis autre chose aux propriétaires : des frais de réservation payés par mobile, et « fini les lapins ».

## Le circuit, tel que le fondateur l'a arrêté

Un seul circuit d'argent pour les terrains :

1. L'équipe demande un créneau. Le propriétaire confirme.
2. L'équipe paie les **frais de réservation : 5 % du prix du créneau**. C'est un acompte.
3. Elle reçoit un **ticket** (un code, un QR code).
4. Sur place, le gérant **valide le ticket**. L'équipe lui règle **les 95 % restants en liquide**, hors de l'application.
5. L'acompte est **versé au gérant** par un dépôt FedaPay.

Exemple, terrain à 10 000 FCFA : 500 d'acompte dans l'application (plus les frais de paiement), 9 500 en liquide le jour du match.

La vidéo, déjà publiée, dit que les frais s'ajoutent au tarif et sont « remboursés si le match a lieu ». Ici ils font partie du prix, et sont déduits de ce que l'équipe règle sur place. **Pour l'équipe c'est le même argent** : payer 500 puis 9 500 revient à payer 10 000 et se faire rendre 500. Mais dans le parcours normal, aucun argent ne retourne vers elle, et c'est ce qui rend le circuit simple.

Le paiement de tout le prix dans l'application, un temps envisagé comme option du gérant, est **écarté** : il ne rapprochait pas le produit de la vidéo, et ramenait vingt fois plus d'argent en transit, un versement du revenu principal du gérant à trois jours, et des frais de paiement sur tout le prix.

## Ce que le compte FedaPay permet (constaté en bac à sable le 2026-10-13)

- **Les dépôts sont fermés.** `POST /v1/payouts` répond `403 Opération non autorisée`. Ils s'activent sur demande au support.
- **L'argent encaissé est bloqué trois jours.** Une collecte approuvée porte `to_be_transferred_at` = approbation + 3 jours ; le solde reste à zéro d'ici là. Délai en réel à confirmer avec FedaPay.
- **Il y a un solde par opérateur** (`togocel`, `moov_tg`, …). La doc ne dit pas si un dépôt vers un opérateur peut puiser dans l'argent encaissé par un autre.
- La doc ne cite que **Mixx by Yas** pour les dépôts au Togo ; une autre page cite aussi Moov Togo.
- Un dépôt : `POST /v1/payouts` (`amount`, `currency`, `mode`, `customer.phone_number`, `merchant_reference`), puis `PUT /v1/payouts/start`. États : `pending`, `started`, `processing`, `sent`, `failed`. Frais et événements de webhook non documentés.

**Conséquence : ce lot se construit en deux temps** (voir « Ordre de construction »). Tout ce qui précède le dépôt se teste dès maintenant ; le dépôt automatique ne peut être ni écrit en confiance ni testé avant l'activation.

## Décisions

### Qui est concerné
- **Le propriétaire choisit, terrain par terrain.** Dans « Mes terrains », un bloc « Frais de réservation dans l'application » : il l'active et donne le numéro mobile money où être versé. Il faut un tarif horaire. Un terrain qui ne l'active pas continue comme aujourd'hui.
- **Toutes les réservations** d'un terrain qui l'a activé : demande depuis la fiche, amical, match de compétition. Pas les créneaux que le propriétaire bloque lui-même. Celui qui paie est le demandeur de la réservation.
- Les réservations confirmées avant l'activation ne sont pas touchées.
- **Site web seulement** : l'application mobile n'a aucun écran de réservation.

### L'acompte
- **5 % du prix du créneau.** Prix = tarif horaire × durée, **figé au moment où le règlement s'ouvre** : changer son tarif ensuite ne touche pas une réservation acceptée.
- Arrondi aux 50 FCFA supérieurs, 100 au minimum (le plancher FedaPay). 10 000 → 500 ; 7 500 → 400 ; 1 500 → 100.
- **Il se paie après le oui du propriétaire.** Un refus ne déplace aucun argent.
- **Échéance : 24 h après la confirmation, et au plus tard au début du créneau.** Passé ce délai, la réservation est annulée par le système, le créneau libéré, les deux parties prévenues.
- **Frais de paiement en plus, payés par l'équipe**, affichés avant de payer : « Acompte 500 + frais de paiement 20 = 520 ». Ils sont calculés par l'application à un taux réglé dans l'admin (`settings/paiement.taux_frais`, en pour cent, arrondi à l'entier supérieur). Le compte FedaPay reste réglé « frais à la charge du marchand », comme décidé pour le Pro : sinon FedaPay ajouterait les siens par-dessus. Tant que le taux n'est pas réglé il vaut 0 : KoppaFoot supporte alors les frais de FedaPay, et l'admin l'affiche en clair.

### Le ticket
- **Il naît quand l'acompte est réglé.** Un code de six caractères tirés au hasard dans un alphabet sans caractères ambigus (ni 0, O, 1, I, L), et un QR code qui porte l'adresse `…/ticket/{code}`.
- **Seule l'équipe qui a payé le voit**, sur sa réservation.
- **Le propriétaire le valide sur place** : il scanne le QR avec l'appareil photo de son téléphone, qui ouvre la page du ticket où il est connecté, ou il tape le code dans ses réservations. Aucun lecteur à construire.
- Le serveur vérifie que celui qui valide possède le terrain, que le ticket est celui d'une réservation en cours, et qu'on est **dans la fenêtre : d'une heure avant le début jusqu'à la fin du créneau, battement compris**. Cinq essais par minute et par compte.
- La page du ticket dit au gérant : l'équipe, le créneau, « Acompte payé : 500 · Reste à régler sur place : 9 500 ».
- Valider deux fois ne change rien.

### Le battement
- Chaque terrain règle **0, 15 ou 30 minutes** (`battement_min`, 0 par défaut). Un créneau 18 h – 19 h avec 15 minutes occupe le planning jusqu'à 19 h 15.
- Il entre dans le seul calcul de chevauchement du dépôt (`seChevauchent`, lib/terrains), donc partout où il sert : l'avertissement à la demande, l'avertissement à la confirmation, la prise d'une proposition, les créneaux publics.
- Il prolonge la fenêtre de validation du ticket.

### La clôture d'une réservation payée
| Clôture | Quand | L'acompte |
|---|---|---|
| `joue` | Le ticket a été validé | dû au propriétaire |
| `absent` | La fenêtre est passée sans validation | dû au propriétaire |
| `annule_equipe` | L'équipe annule après avoir payé | dû au propriétaire |
| `annule_proprietaire` | Le propriétaire annule après le paiement | **rendu à l'équipe**, hors frais de paiement |
| `libere` | L'acompte n'est jamais venu | rien n'a été encaissé |

Personne ne déclare l'absence : elle se constate. Et personne n'a intérêt à tricher sur le ticket, le propriétaire touchant l'acompte dans les deux cas. Le ticket donne un historique juste (joué, ou absent), qui servira plus tard à dire la fiabilité d'une équipe.

### Le versement
- Chaque somme due devient une ligne `dus` : à qui, combien, pourquoi, et **à partir de quand les fonds sont libérés** (le `to_be_transferred_at` de la collecte).
- **Chaque matin, un seul dépôt par bénéficiaire** pour ses lignes dues dont les fonds sont libérés. Vers le numéro de versement du propriétaire ; pour un remboursement, vers le téléphone que l'équipe a donné dans sa demande.
- **Tant que FedaPay n'a pas activé les dépôts** (`settings/paiement.depots_actifs` à faux), aucune tentative : les sommes s'accumulent en « dû », visibles du propriétaire et de l'admin.
- **Un dépôt en échec** laisse la somme due et la signale dans l'admin. L'admin peut toujours **régler à la main** une somme due et la marquer versée : c'est le filet pour un échec, pour un opérateur que FedaPay ne sert pas, et pour l'attente de l'activation.
- Le propriétaire lit sur chaque réservation : « Acompte dû », « Versé le … ».

## Où vit l'argent

Le propriétaire peut aujourd'hui modifier depuis son navigateur n'importe quel champ d'une réservation (`firestore.rules`), et les terrains sont en lecture publique. Ni un montant, ni un état de paiement, ni un numéro de versement ne peuvent donc y vivre. Tout va dans des collections fermées aux navigateurs (`allow read, write: if false`), lues par des routes.

| Collection | |
|---|---|
| `reglements/{idRéservation}` (nouvelle) | Le dossier d'argent d'une réservation : `owner_id`, `user_id`, `venue_id`, `prix`, `acompte`, `taux_frais`, `echeance`, `fin_fenetre`, `paye_le`, `paiement_id`, `code`, `valide_le`, `cloture`, `clos_le`. |
| `paiements/{id}` (lot 1) | Gagne `objet` (`"pro"` ou `"acompte"`, absent = `"pro"`), `reservation_id`, `frais_client`. `montant` reste le total demandé à FedaPay. |
| `dus/{id}` (nouvelle) | `beneficiaire`, `montant`, `motif` (`"acompte"` ou `"remboursement"`), `reservation_id`, `disponible_le`, `depot_id`, `regle_le`. |
| `depots/{id}` (nouvelle) | `beneficiaire`, `numero`, `montant`, `etat` (`a_envoyer`, `envoye`, `verse`, `echoue`, `manuel`), `fedapay_id`, `dus` (les lignes réglées), `erreur`. |
| `comptes_versement/{uid}` (nouvelle) | `numero`, `pays`, `modifie_le`. |
| `venues/{id}` (public) | Gagne `paiement_app` (booléen) et `battement_min`. Rien d'autre. |
| `bookings/{id}` | Gagne `reglement_vu`, une copie d'affichage de l'état (`acompte_attendu`, `acompte_paye`, clôture). **Le serveur ne la relit jamais.** |
| `settings/paiement` | `taux_frais`, `depots_actifs`. Écrit par l'admin. |

## Les pièces

| Fichier | Rôle |
|---|---|
| `src/lib/reglement.ts` (nouveau) | Pur : `acompteDe`, `fraisDePaiement`, `echeanceAcompte`, `fenetreDeValidation`, `clotureDe`, `nouveauCode`, les types. |
| `src/lib/terrains.ts` | `seChevauchent` prend un battement. |
| `src/lib/paiement.ts` | `objet` d'un paiement. |
| `src/lib/paiement-serveur.ts` | `reglerPaiement` applique l'effet selon l'objet : le droit pour le Pro, le règlement pour un acompte. `demarrerPaiement` sait démarrer un acompte. |
| `src/lib/reglement-serveur.ts` (nouveau) | `ouvrirReglement`, `payerAcompte` (l'effet d'un acompte réglé : ticket, notifications), `validerTicket`, `cloturer`, `annuler`, `libererEchus`. |
| `src/lib/versements-serveur.ts` (nouveau) | Créer une ligne due, lister ce qui est dû, régler à la main. Au temps 2 : regrouper en dépôts, envoyer, suivre. |
| `src/lib/fedapay.ts` | Au temps 2 : `creerDepot`, `envoyerDepot`, `lireDepot`. |
| Routes | `POST /api/paiements` accepte `{ objet: "acompte", reservation }` ; `GET /api/reservations/[id]/reglement` (les deux parties) ; `POST /api/reservations/ticket` (valider) ; `PUT /api/venues/[id]/paiement` (activer, numéro, battement) ; `GET`/`POST /api/admin/versements`. Les routes de réservation existantes ouvrent, annulent ou clôturent le règlement. |
| Écrans | « Mes terrains » (activation, numéro, battement) ; « Mes réservations » (payer, ticket) ; réservations reçues (états, valider un code) ; `/ticket/[code]` ; fiche publique du terrain (mention des frais) ; admin (sommes dues, régler à la main). |
| Tâche du matin | Libère les acomptes échus, clôt les fenêtres passées. Au temps 2 : envoie et relit les dépôts. |

**Le règlement s'ouvre à tout passage à « confirmée »**, quel qu'en soit le chemin (confirmation, proposition prise, match aligné), et aussi à la première lecture d'une réservation confirmée qui n'en a pas : une confirmation écrite par un autre chemin ne laisse pas une réservation sans dossier.

**L'échéance s'applique aussi à la lecture.** La tâche ne tourne qu'une fois par jour : un acompte échu est donc traité comme tel dès qu'on lit le règlement ou qu'on tente de le payer, et les créneaux publics ignorent une réservation dont l'acompte est échu.

## Ce qui protège l'argent

- **Les montants viennent du règlement**, jamais de la réservation ni du navigateur.
- **`reglerPaiement` reste la seule porte** : collecte relue chez FedaPay, référence et montant vérifiés, effet écrit dans une transaction avec l'état payé. Un acompte réglé deux fois ne crée qu'un ticket.
- **Une somme due ne se verse qu'une fois** : elle est rattachée à son dépôt dans une transaction, et le dépôt est écrit en base, sous une référence unique chez FedaPay, avant d'être demandé.
- **Jamais avant que les fonds soient libérés**, jamais plus que ce qui est dû.
- **Le numéro de versement est une cible.** Tout changement prévient le propriétaire (cloche, téléphone, e-mail), et aucun dépôt ne part vers un numéro modifié depuis moins de 24 h.
- **Bac à sable** : seul un superadmin peut payer, comme au lot 1.

## Quand ça casse

| Panne | Ce qui se passe |
|---|---|
| Le webhook et le retour manquent | La tâche du matin règle l'acompte, comme au lot 1. Le ticket apparaît alors. |
| L'équipe paie après l'échéance (page FedaPay restée ouverte) | Le règlement est déjà `libere` : l'acompte est rendu à l'équipe (ligne due « remboursement »), sans ticket. |
| Le propriétaire annule après l'acompte | Ligne due « remboursement » vers l'équipe. |
| Le propriétaire oublie de valider un match joué | Clôture `absent`. Il touche l'acompte de toute façon ; seul l'historique est faux. |
| Le terrain est retiré avec des créneaux payés à venir | Les créneaux confirmés restent (règle actuelle) ; s'il les annule, l'acompte est rendu. |
| Dépôt refusé, numéro faux, opérateur non servi | La somme reste due, signalée dans l'admin, réglable à la main. |
| Un remboursement n'a pas de numéro | Idem : dû, signalé, à régler à la main. |

## Les textes

- **Conditions** (rôle « Gérant de terrain ») : sur un terrain qui l'a activé, KoppaFoot encaisse les frais de réservation, 5 % du prix, pour le compte du gérant et les lui reverse ; le reste se règle sur place ; KoppaFoot ne prend aucune commission. L'acompte reste acquis au gérant si l'équipe annule ou ne vient pas ; il est rendu si le gérant annule.
- **Confidentialité** : FedaPay sert aussi aux frais de réservation ; KoppaFoot garde le numéro de versement du gérant.
- **« La plateforme n'encaisse rien »** est écrit à six endroits (`/terrains`, « Mes terrains », l'accueil de l'inscription propriétaire, deux commentaires, la demande de créneau) : à reprendre.
- **L'application reprend les mots de la vidéo**, pour qu'elle reste valable sans être refaite. Partout où les frais sont annoncés à l'équipe : « Frais de réservation : 500 FCFA. Remboursés si le match a lieu : ils sont déduits de ce que tu règles sur place. » Au propriétaire : « Ton prix reste ton prix. »
- **Le README de la vidéo** dit ce que l'application fait réellement, et les deux écarts qui restent : la vidéo montre l'équipe payer avant la confirmation du propriétaire (ici, après), et prend 2 000 FCFA en exemple (ici, 5 % du prix).

## Ordre de construction

**Temps 1, testable aujourd'hui.** Le battement, le règlement, le paiement de l'acompte, le ticket et sa validation, les clôtures, les sommes dues, l'admin (ce qui est dû, régler à la main), les écrans, les textes. À la fin du temps 1, le circuit entier fonctionne, le versement se faisant à la main.

**Temps 2, quand FedaPay aura activé les dépôts.** Les trois appels du client, le regroupement en dépôts, l'envoi, le suivi, les échecs. Son plan s'écrira à ce moment-là, sur ce que le bac à sable montrera d'un vrai dépôt (frais, états, webhook éventuel, solde par opérateur).

## Vérifications

- Tests purs (`mobile/src/__tests__/reglement.test.ts`) : acompte (arrondi, plancher, prix nul), frais de paiement, échéance (24 h, début du créneau), fenêtre de validation avec et sans battement, clôture, alphabet et longueur du code ; `seChevauchent` avec battement.
- Tests du serveur, contre le faux Firestore du lot 1 : un acompte réglé crée un seul ticket même réglé deux fois ; un acompte payé après échéance devient un remboursement dû ; la validation refuse un autre propriétaire, un code inconnu, hors fenêtre ; chaque clôture crée la bonne ligne due ; une ligne due ne se règle qu'une fois.
- Bac à sable : activer sur un terrain de test, confirmer une demande, payer l'acompte avec l'outil de test, voir le ticket, le valider par le code puis par l'adresse du QR, constater la ligne due ; laisser passer une échéance ; annuler côté propriétaire.

## Hors périmètre

- Le paiement des 95 % restants dans l'application : il se fait en liquide.
- Les frais d'inscription en compétition (lot 3).
- L'application mobile, une note de fiabilité des équipes, les litiges.

## À trancher quand FedaPay aura répondu

- Les frais d'un dépôt, et donc le taux des frais de paiement qui doit les couvrir ; s'il faut un montant minimum avant de verser.
- Le délai réel de libération des fonds.
- Si un dépôt vers Moov Togo est possible, et si un dépôt peut puiser dans le solde d'un autre opérateur.
