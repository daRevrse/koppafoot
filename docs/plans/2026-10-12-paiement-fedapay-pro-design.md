# Design : Le paiement mobile, lot 1 — socle FedaPay et vente de KoppaFoot Pro

**Date :** 2026-10-12
**Statut :** Design validé, à implémenter. Branche `feat/paiement-fedapay`.

## Le problème

Rien ne s'achète sur KoppaFoot. Le Pro existe (`droits/{uid}`, limites, Club multi-équipes, sans pub) mais l'administration l'accorde à la main depuis `/admin/offre`, et la page « Mon offre » dit « pas encore en vente, écris-nous ». `lib/offre.ts` a prévu la suite depuis le premier jour : le paiement écrira le même document, avec `source: "paiement"`.

Trois flux d'argent attendent dans le dépôt. Ils n'ont pas le même poids :

| Flux | Ce qu'il demande à FedaPay |
|---|---|
| KoppaFoot Pro | Encaisser. L'argent reste chez KoppaFoot. |
| Frais de réservation de terrain (vidéo du 7 octobre) | Encaisser, puis reverser à l'équipe ou au propriétaire. |
| Frais d'inscription en compétition | Encaisser, puis reverser à l'organisateur. |

**Ce lot ne fait que le premier**, et construit le socle que les deux autres réutiliseront : le client FedaPay, le webhook signé, le journal des paiements. Il prouve toute la chaîne avec de l'argent réel sans dépendre d'aucun reversement.

## Ce que la doc FedaPay impose

Lu le 2026-10-12 sur docs.fedapay.com (collectes, webhooks, méthodes de paiement, référence d'API, types de comptes, journal des modifications) et dans le code source du SDK Node.

- **Serveurs** : `https://sandbox-api.fedapay.com/v1` et `https://api.fedapay.com/v1`. `Authorization: Bearer <clé secrète>`. Les clés de test ne marchent que sur le serveur de test.
- **Créer une collecte** : `POST /transactions` avec `description`, `amount` (entier), `currency: { iso: "XOF" }`, `callback_url`, `customer`, `merchant_reference` (unique : un doublon fait échouer la création), `custom_metadata`.
- **Lien de paiement** : `POST /transactions/{id}/token` → `{ token, url }`.
- **Relire** : `GET /transactions/{id}`, ou `GET /transactions/merchant/{reference}`. La collecte porte `status`, `amount`, `fees`, `mode`, `merchant_reference`, `custom_metadata`, `receipt_url`, `last_error_code`.
- **États** : `pending`, `approved`, `declined`, `canceled`, `refunded`, `transferred`, `expired`, plus `approved_partially_refunded` et `transferred_partially_refunded` (vus dans le SDK). **`declined` et `canceled` ne sont pas finaux** : le client peut réessayer sur la même page. Une collecte `pending` expire après 24 h.
- **Le retour ne prouve rien** : le client revient sur `callback_url?id=…&status=…`, et la doc écrit « ne vous fiez pas au statut renvoyé par l'URL ».
- **Webhook** : événements `transaction.created`, `.updated`, `.approved`, `.declined`, `.canceled`, `.transferred`. En-tête `X-FEDAPAY-SIGNATURE: t=<secondes>,s=<hex>`, où `s` = HMAC-SHA256 de `<t>.<corps brut>` avec le secret de l'endpoint (un secret par endpoint, différent en test et en réel) ; le SDK tolère 300 s d'écart. Toute réponse hors 2xx est un échec ; FedaPay réessaie 9 fois, puis **désactive le webhook** après 10 échecs.
- **Togo** : Mixx by Yas (`togocel`) et Moov (`moov_tg`) à l'encaissement, plus Visa/MasterCard.
- **Bac à sable** : un seul mode mobile money, `momo_test`. Les numéros `64000001` et `66000001` réussissent, tout autre échoue.
- **Types de comptes** : un compte « Travailleur indépendant » est plafonné à **10 transactions par semaine** et à 100–300 000 XOF par transaction. Un compte « Business » n'a pas de plafond.

**Constaté en bac à sable le 2026-10-12** (les quatre appels du client, joués avec une clé `sk_sandbox_…`) :
- L'enveloppe des réponses est **`{ "v1/transaction": { … } }`**, que la référence d'API ne montre pas. `deballer` accepte aussi la forme à plat et la clé sans version.
- `merchant_reference` et `custom_metadata.paiement_id` sont bien renvoyés à la relecture : la vérification « cette collecte est la nôtre » tient sur les deux.
- `GET /transactions/merchant/{reference}` retrouve la collecte, et répond 404 pour une référence inconnue.
- Une collecte se crée **sans objet `customer`**, et avec une adresse de retour en `http://localhost:3000`.
- La page de paiement est servie par `sandbox-process.fedapay.com`. La collecte porte aussi `payment_url` et `payment_token` dès sa création.

**Constaté au premier paiement de test, le même jour** :
- **Les numéros de test sont béninois, à dix chiffres** : `0164000001` réussit (pays `bj`). `64000001`, tel que la doc l'écrit, est refusé, sous le pays `bj` comme sous `tg`.
- **La page de paiement verrouille le pays sur celui du compte marchand** (le Togo) et valide le numéro en conséquence : on ne peut pas y saisir un numéro de test, et un vrai numéro togolais y est refusé en bac à sable. Un paiement de test réussi passe donc par l'API « sans redirection » : `POST /v1/momo_test` avec le jeton de la collecte et `phone_number: { number, country }` (le chemin du SDK ; la référence d'API écrit `/v1/transactions/{mode}`). C'est ce que fait `scripts/payer-fedapay-test.ts`.
- **Les frais s'ajoutent pour le client** : 62 FCFA sur 1 500 (4 % en bac à sable). La collecte garde `amount = 1500` ; `amount_debited = 1562` et `fees = 62` portent le reste. La vérification de montant compare `amount`, elle tient.
- Le chemin du webhook, joué sur une vraie ligne : refusée puis approuvée sur la même collecte, la ligne passe à `paye`, le Pro court du 12 octobre au 12 novembre, une notification part ; **rejoué, il ne change rien**.

**Reste à constater avec un webhook envoyé par FedaPay lui-même** : le champ de l'événement qui porte la collecte (`entity`, d'après l'exemple de la doc ; la route accepte aussi `object` et `data`, et se replie sur l'identifiant FedaPay), et si FedaPay ajoute ses paramètres à l'adresse de retour avec `&` ou avec un second `?` (la page lit les deux).

## Décisions

### Ce qu'on vend
- **Le Pro seul**, en deux formules : `pro_mois` (1 mois) et `pro_an` (12 mois). L'option sans pub reste accordée à la main.
- **Une période, pas un abonnement.** Le mobile money ne prélève pas tout seul : on paie, le Pro court jusqu'à une date, rien ne se renouvelle automatiquement.
- **Sur le web uniquement.** L'application Expo n'a pas d'écran d'offre, et Apple comme Google imposent leur facturation pour un bien numérique vendu dans une application.

### Les prix sont un réglage
- `settings/offre` gagne `prix: { pro_mois: number | null, pro_an: number | null }`, saisis dans `/admin/offre`.
- Une formule est en vente si son prix est un entier d'au moins 100 (le plancher FedaPay) **et** si `FEDAPAY_SECRET_KEY` est configurée. Sinon elle n'apparaît pas.
- **Tant qu'aucune formule n'est en vente, « Mon offre » reste exactement comme aujourd'hui.** Vider les prix est l'interrupteur d'urgence, et le code peut partir en production avant l'ouverture.

### Le parcours : la page de paiement FedaPay
1. « Mon offre » affiche les formules en vente, prix et bouton « Payer ».
2. `POST /api/paiements { formule }` crée la ligne `paiements/{id}`, la collecte chez FedaPay (`merchant_reference` = `id`), le lien de paiement, et renvoie `{ url }`. Le navigateur y va.
3. Le client paie sur la page FedaPay (mobile money ou carte).
4. Il revient sur `/offre?paiement={id}`. La page appelle `GET /api/paiements/{id}`, qui relit la collecte et règle le paiement, puis affiche « Paiement reçu, tu es Pro jusqu'au … », « en attente de confirmation » (elle redemande toutes les 3 s, dix fois) ou « paiement non abouti ». Le paramètre `status` de l'adresse est ignoré.
5. En parallèle, FedaPay appelle `POST /api/webhooks/fedapay`, qui règle le même paiement.

Le montant vient toujours de `settings/offre`, lu par le serveur. Le navigateur n'envoie que le nom de la formule.

`callback_url` : `APP_URL` (lib/partage) en réel, l'origine de la requête en bac à sable, pour que le retour fonctionne en local et sur un aperçu.

FedaPay ajoute `id` et `status` à cette adresse, qui porte déjà un paramètre. S'il les colle avec un second « ? », le nôtre arrive pollué (`XYZ?id=258…`) : la page n'en garde que les vingt premiers caractères, ceux d'un identifiant Firestore (`idPaiementDuRetour`).

À FedaPay on envoie le prénom, le nom et l'e-mail du compte, **et seulement s'ils sont tous là** : un compte créé par SMS n'a pas d'e-mail, et la page de paiement le demandera elle-même. **Jamais le téléphone** : le numéro du profil n'est pas forcément celui du portefeuille, le client le tape sur la page de paiement.

### Les règles de durée (`nouvelleEcheance`, pure)
- Acheté le 12 octobre pour 1 mois : Pro du 12 octobre **au 12 novembre inclus**.
- Racheté alors que le Pro court encore : la période s'ajoute **à la fin en cours** ; `depuis` ne bouge pas.
- Un Pro expiré repart du jour de l'achat.
- Un Pro accordé par l'admin avec une échéance se prolonge pareil, et sa `source` devient `"paiement"`.
- Un Pro accordé **sans échéance** : aucun bouton, et `POST /api/paiements` refuse (`deja_illimite`). S'il est accordé entre le clic et le paiement, le règlement **ne l'écrase pas** : la ligne passe à `paye` sans échéance, l'admin la voit « payée sans effet » et rembourse à la main.
- Fin de mois : le 31 janvier + 1 mois donne le dernier jour de février.

### Une seule fonction accorde le Pro : `reglerPaiement(id)`
Appelée par le webhook, par la vérification au retour, par la tâche de 6 h et par le bouton « Revérifier » de l'admin.

1. Lit `paiements/{id}`. Une ligne d'un autre environnement que celui du serveur (une ligne du bac à sable vue par la production) est laissée telle quelle : ses collectes vivent sur l'autre serveur FedaPay.
2. Relit la collecte chez FedaPay, par `fedapay_id` (ou par `merchant_reference` si la ligne ne l'a pas encore), et recopie sur la ligne `fedapay_statut`, `mode`, `frais`, `recu_url`. **Si la ligne est déjà `paye`, on s'arrête là** : son état ne bouge plus, aucun droit n'est réécrit.
3. Vérifie que la collecte est la nôtre : `merchant_reference` = `id` (à défaut `custom_metadata.paiement_id`, qu'on envoie aussi), `amount` = `montant`. Un écart : aucun octroi, `anomalie` renseignée sur la ligne, visible dans l'admin.
4. Traduit l'état FedaPay (`etatDepuisFedapay`, pure) :

   | FedaPay | Ligne | Final chez nous |
   |---|---|---|
   | `pending` | `en_attente` | non |
   | `approved`, `transferred` | `paye` | oui |
   | `declined` | `echoue` | non |
   | `canceled` | `annule` | non |
   | `expired` | `expire` | oui |
   | `refunded` et variantes, sans avoir été `paye` | `annule` | oui |

5. Si `paye` : **dans une transaction Firestore**, relit la ligne et `droits/{uid}`, calcule la nouvelle échéance, écrit `droits/{uid}.pro` (`source: "paiement"`, `accorde_par: null`, `motif: "Achat Pro 1 mois"` ou `"… 12 mois"`, suivi de `" (bac à sable)"` hors réel) et passe la ligne à `paye` avec `echeance_avant`, `echeance_apres`, `applique_le`. La transaction relit l'état de la ligne : deux appels simultanés n'accordent qu'une fois.
6. Après la transaction, et seulement si c'est elle qui a accordé : notification (cloche + push) et e-mail de reçu. Un échec ici ne remet rien en cause.

Une ligne `paye` ne change plus d'état. `fedapay_statut` continue de suivre FedaPay : si la collecte passe à `refunded`, la ligne reste `paye` et l'admin la voit marquée « remboursée chez FedaPay ». **Le Pro ne se retire jamais tout seul** ; l'admin le retire dans `/admin/offre`, comme aujourd'hui.

### Le webhook
- Lit le corps brut (`await req.text()`), vérifie la signature avec `FEDAPAY_WEBHOOK_SECRET` (comparaison à temps constant, 300 s de tolérance). Signature absente ou fausse : 400.
- N'applique pas le contenu de l'événement : il y prend seulement `merchant_reference` (repli : `custom_metadata.paiement_id`) pour savoir quelle ligne régler, puis appelle `reglerPaiement`.
- Événement d'un autre type, ou sans ligne correspondante : 200, pour ne pas faire désactiver le webhook.
- FedaPay injoignable pendant la relecture : 500, FedaPay réessaiera.

### Le bac à sable écrit dans la vraie base
Le poste de développement et les aperçus Vercel partagent le Firestore de la production. Avec des clés de test, quiconque trouve une adresse d'aperçu s'offrirait le Pro en monnaie fictive. Donc, quand `FEDAPAY_ENV` n'est pas `live` :
- seuls les superadmins voient les formules et peuvent appeler `POST /api/paiements` (403 sinon) ;
- chaque ligne porte `environnement: "sandbox"`, et le motif du droit le dit.

### Ce qu'on range

`paiements/{id}` — fermée aux navigateurs (`allow read, write: if false`, comme `clubs`) :

| Champ | |
|---|---|
| `uid`, `formule`, `droit` | Qui, quoi. |
| `montant`, `devise` | Entier, `"XOF"`. |
| `statut` | `en_attente`, `paye`, `echoue`, `annule`, `expire`. |
| `environnement` | `"sandbox"` ou `"live"`. |
| `fedapay_id`, `fedapay_statut`, `mode`, `frais`, `recu_url` | Recopiés de la collecte à chaque relecture. |
| `echeance_avant`, `echeance_apres`, `applique_le` | Ce que le paiement a changé. |
| `anomalie` | `null`, ou `"montant"`, `"reference"`. |
| `created_at`, `updated_at` | |

La ligne est écrite **avant** l'appel à FedaPay : si la seconde écriture (celle de `fedapay_id`) échoue, le webhook retrouve quand même la ligne par `merchant_reference`. Si FedaPay refuse la création, la ligne est supprimée et la route répond 502 : rien ne traîne.

À la suppression d'un compte, les lignes restent : ce sont des pièces comptables, et elles ne portent que l'identifiant.

### Les pièces

| Fichier | Rôle |
|---|---|
| `src/lib/paiement.ts` (nouveau) | Pur, partagé avec le navigateur : `FORMULES`, `formulesEnVente`, `nouvelleEcheance`, `etatDepuisFedapay`, `deciderReglement`, `idPaiementDuRetour`, les types. |
| `src/lib/fedapay.ts` (nouveau) | Serveur : `creerCollecte`, `lienDePaiement`, `lireCollecte`, `lireCollecteParReference`, et les aides pures (`deballer`, `normaliserCollecte`, `corpsCollecte`, `signatureValide`, `cibleDeLEvenement`). En `fetch`, sans le SDK `fedapay` : il apporte axios 0.28 et une configuration globale (`FedaPay.setApiKey`) pour trois appels. Aucun import `node:*` : le HMAC est calculé par la route du webhook et passé à `signatureValide`, pour que le fichier reste importable par les tests. |
| `src/lib/paiement-serveur.ts` (nouveau) | `demarrerPaiement`, `reglerPaiement`, `reverifierPaiementsOuverts`, `rappelerEcheancesPro`. |
| `scripts/webhook-fedapay.ts` (nouveau) | Outil de dev : envoie un événement signé à une adresse locale, FedaPay ne joignant pas `localhost`. Il ne peut rien accorder : la route relit toujours la collecte. |
| `src/app/api/paiements/route.ts` (nouveau) | `POST` : démarre un achat. |
| `src/app/api/paiements/[id]/route.ts` (nouveau) | `GET` : la vérification au retour ; 404 pour tout autre que le titulaire. |
| `src/app/api/webhooks/fedapay/route.ts` (nouveau) | `POST` : le webhook. |
| `src/app/api/admin/paiements/route.ts` (nouveau) | `GET` : les 100 derniers paiements. `POST { id }` : revérifier. |
| `src/app/api/admin/offre/route.ts` | `PUT` accepte aussi `{ prix }`. `GET` renvoie les prix. |
| `src/app/api/offre/route.ts` | Renvoie `formules` (celles en vente pour cet appelant). |
| `src/app/(app)/offre/page.tsx` | Les formules, le bouton, les trois états du retour. Français et anglais. |
| `src/app/(admin)/admin/offre/page.tsx` | Les deux prix, la liste des paiements. |
| `src/app/api/cron/scoreur-manquant/route.ts` | Appelle aussi `reverifierPaiementsOuverts` et `rappelerEcheancesPro`. |
| `src/lib/offre.ts` | `FirestoreReglageOffre.prix` ; l'en-tête ne dit plus « rien ne s'achète ». |
| `src/types/index.ts`, `src/lib/push-categories.ts` | Type de notification `offre`, classé « perso ». |
| `src/lib/email.ts` | `recuPaiementHtml`. |
| `firestore.rules` | `paiements`. |
| `.env.example` | Les trois variables. |
| Conditions, confidentialité | Voir plus bas. |

### Garde-fou contre le harcèlement de l'API
`POST /api/paiements` refuse (429) au-delà de 5 tentatives créées par le même compte dans l'heure. Le compte se lit par `where("uid", "==", uid)` et le tri se fait en mémoire : un compte a une poignée de lignes, et on évite un index composé.

### Les rappels d'échéance
La tâche de 6 h prévient **7 jours avant** et **la veille** : « Ton Pro se termine le 19 octobre », avec le lien vers Mon offre. Pour tout Pro qui a une échéance, d'où qu'il vienne (un testeur à qui l'admin l'a accordé est le premier client à convaincre), et seulement en réel avec une formule en vente : un rappel sans bouton derrière n'apprend rien. `rappel_pro_le` sur `droits/{uid}` marque le jour du dernier rappel : une tâche rejouée ne sonne pas deux fois.

### Quand ça casse

| Panne | Ce qui rattrape |
|---|---|
| Webhook perdu ou en retard | La vérification au retour. |
| Onglet fermé avant le retour | Le webhook. |
| Les deux | La tâche de 6 h revérifie les lignes `en_attente`, `echoue` et `annule` de moins de 48 h ; et le bouton « Revérifier » de l'admin. Les lignes plus vieilles sont relues une dernière fois puis passées à `expire`, sauf si FedaPay n'a pas répondu ce matin-là : sans cela la liste des lignes ouvertes grossirait sans fin. Une ligne `expire` qui se révélerait payée s'accorde quand même. |
| FedaPay injoignable au clic | 502, « Paiement indisponible, réessaie », ligne supprimée. |
| Refusé puis réussi sur la même page | L'état n'était pas final, l'approbation s'applique. |
| Reçu ou push en échec | N'empêche pas l'octroi. |
| Remboursement fait à la main chez FedaPay | Ligne marquée, Pro retiré à la main. |

### Les textes
- **Conditions** : le paragraphe « L'utilisation de KoppaFoot est gratuite… » devient : KoppaFoot Pro est payant, son prix est affiché avant tout paiement ; on achète une période, **sans renouvellement automatique** ; le paiement passe par FedaPay ; **pas de remboursement une fois la période commencée** ; en cas de double paiement ou d'erreur, on prolonge ou on rembourse à la main sur simple message. Le reste (jouer, suivre, s'inscrire, arbitrer restent gratuits) ne bouge pas.
- **Confidentialité** : FedaPay reçoit le prénom, le nom et l'e-mail pour émettre le reçu, et le numéro que le client tape sur sa page ; KoppaFoot ne voit ni ne garde aucun numéro de carte ou de portefeuille.

## Configuration

| Variable | |
|---|---|
| `FEDAPAY_SECRET_KEY` | Clé secrète. Absente : rien n'est en vente, `POST /api/paiements` répond 503. |
| `FEDAPAY_WEBHOOK_SECRET` | Le secret de l'endpoint du webhook. |
| `FEDAPAY_ENV` | `live` en production ; toute autre valeur, ou l'absence, vaut bac à sable. |

Serveur seulement, aucune `NEXT_PUBLIC_`. Sur Vercel : clés de test sur Preview, clés réelles sur Production.

## Mise en service

1. Clés de test dans `.env.local`.
2. Déployer `firestore.rules` (`--project koppafoot`).
3. Dans le tableau de bord FedaPay de test, créer le webhook vers l'adresse d'un aperçu Vercel, événements `transaction.*`, et copier son secret.
4. Fusionner : rien ne se voit tant que les prix sont vides.
5. Compte FedaPay réel validé. **Vérifier son type** : « Travailleur indépendant » plafonne à 10 ventes par semaine, il faut « Business » pour vendre sans limite.
6. Webhook réel vers **`https://www.koppafoot.com/api/webhooks/fedapay`** — avec `www` : le domaine nu redirige, et un webhook ne suit pas une redirection. Décocher « Désactiver le webhook lorsque l'application génère des erreurs ».
7. Clés réelles dans Vercel (Production), redéployer.
8. Saisir les prix. Un vrai paiement, au plus petit prix, par le fondateur. Puis annoncer.

## Vérifications

- `mobile/src/__tests__/paiement.test.ts` (là où tournent les modules partagés) : `nouvelleEcheance` (premier achat, prolongation, Pro expiré, Pro accordé par l'admin, Pro sans échéance, fin de mois, 29 février, 12 mois), `etatDepuisFedapay` (chaque état, un état inconnu), `deciderReglement` (octroi, ligne déjà payée, écart de montant, écart de référence), les prix (vide, sous le plancher, non entier), `idPaiementDuRetour`, `trierLignesOuvertes`, et la règle Firestore de `paiements`.
- `mobile/src/__tests__/fedapay.test.ts` : `signatureValide` (bonne, mauvais secret, corps altéré, horodatage trop vieux, en-tête illisible, plusieurs `s=`), `deballer` (les trois formes d'enveloppe), `normaliserCollecte`, `corpsCollecte` (client incomplet, jamais de téléphone), `cibleDeLEvenement`.
- `npx tsc --noEmit`, `npm run lint`, et un seul `npm run build` à la fin (il consomme le quota API-Football).
- Bac à sable, en local : acheter avec `64000001` → retour → Pro accordé par le chemin « retour » ; acheter avec un autre numéro → « non abouti », aucun droit.
- Bac à sable, sur un aperçu Vercel : le chemin webhook, puis **rejouer l'événement** depuis le tableau de bord FedaPay et constater que l'échéance n'a pas bougé.
- Compte non superadmin en bac à sable : aucune formule affichée, `POST` → 403.

## Hors périmètre, et ce que la doc apprend pour la suite

- L'option sans pub à la vente, l'achat dans l'application mobile, l'historique des paiements côté client, le retrait automatique d'un droit.
- **Réservations et inscriptions** (lots suivants) :
  - FedaPay a un type de compte **Marketplace**, avec sous-comptes et commission répartie à l'encaissement. C'est probablement le bon outil pour payer un propriétaire ou un organisateur, plutôt que des reversements faits à la main. À étudier en premier (page « API des sous-comptes »).
  - Les reversements (« dépôts ») s'activent sur demande au support ; au Togo la doc ne cite que **Mixx by Yas**.
  - **Aucune API de remboursement** : il se fait depuis le tableau de bord, et uniquement vers MTN. Rembourser les frais de réservation d'une équipe togolaise passera donc par un dépôt, pas par un remboursement, et un client Moov pose un vrai problème.
  - Depuis septembre 2026, FedaPay peut retenir des fonds (retenues temporaires, réserves de risque) : le solde disponible n'est pas forcément le solde encaissé.
  - Chaque encaissement a des frais. « Remboursés intégralement » et « 0 % de commission » supposent que quelqu'un les absorbe.
