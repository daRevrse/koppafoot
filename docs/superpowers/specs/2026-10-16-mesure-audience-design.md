# Mesure d'audience : compétitions, matchs, direct

Date : 2026-10-16. Demande du propriétaire du produit : savoir combien de
personnes visitent les pages de compétitions et de matchs, combien suivent un
match en direct à un instant donné, et la courbe minute par minute. Pour
l'administration, et pour le staff de chaque compétition, qui voit
l'audience de la sienne et peut l'exporter en PDF.

## Le problème

KoppaFoot ne sait pas qui le regarde. Vercel Analytics, déjà installé, compte
des pages vues par adresse dans son propre tableau de bord : on ne peut pas
afficher ces chiffres dans l'admin, et il ne connaît pas le « simultané ».
Dans la base, il n'y a que le nombre d'abonnés d'une compétition, compté à la
volée.

Or c'est le chiffre qui se vend : « 87 personnes suivaient la finale au moment
du 2-1 » parle à un sponsor (voir le dossier business plan), et à un
organisateur qui doute que son tournoi intéresse quelqu'un. C'est aussi
l'organisateur qui démarche les sponsors de son tournoi : il lui faut ces
chiffres sous une forme qu'il peut envoyer, pas seulement un écran.

## Ce qu'on mesure, et ce qu'on ne mesure pas

Mesuré, à partir de la mise en ligne :

- **Les visites** des pages d'une compétition et de chaque match, jour par jour.
  Une visite = un appareil, un jour, une page cible ; ses **vues** comptent
  chaque ouverture.
- **Les spectateurs en direct maintenant** sur un match, à la minute près.
- **La courbe d'audience d'un match en direct**, minute par minute : son pic
  de simultanés et le moment du pic, à placer face aux buts.
- **Le temps moyen** passé sur un direct.
- **D'où viennent les visites** : l'application, un QR code, un lien partagé
  depuis KoppaFoot, ou autre.
- **Connecté ou non** (un oui/non, jamais le compte).

Pas mesuré, et dit tel quel dans l'admin :

- **Rien de rétroactif.** Avant la mise en ligne, il n'y a que le tableau de
  bord Vercel, sans simultanés.
- **Des appareils, pas des personnes.** Un même supporter sur son téléphone
  puis son ordinateur fait deux visites ; dix supporters autour d'un téléphone
  en font une.
- **Pas de visiteurs uniques sur un mois.** L'identifiant de l'appareil change
  chaque jour (voir « Vie privée ») : trente jours de visites ne se dédoublonnent
  pas. On parle donc de visites, jamais de « visiteurs uniques sur 30 jours ».
- **Pas à la seconde** : la minute.
- **Pas de liste nominative**, même pour les comptes connectés.
- **Un écran éteint ou un onglet en arrière-plan ne compte pas** comme
  spectateur : c'est voulu, sinon le chiffre gonfle.
- **Le Direct de l'accueil** (la liste des scores, sur le site et dans l'appli)
  ne compte pas comme spectateur d'un match : seule la fiche du match compte.

## Décisions

1. **Un document par appareil, par jour et par page cible** — pas de compteur
   partagé. Chaque appareil n'écrit que son propre document : aucun point
   chaud, quel que soit le nombre de spectateurs (un compteur unique saturerait
   vers une écriture par seconde, soit 60 spectateurs).
2. **Le navigateur écrit directement dans Firestore**, sans route API, comme
   il lit déjà le match en direct. Les visiteurs sans compte écrivent aussi :
   les règles valident la forme de chaque écriture. Pas d'appel de fonction
   Vercel par spectateur et par minute.
3. **Un compteur public peut être gonflé par quelqu'un de décidé** : accepté,
   comme pour les vues des partenaires (`/api/partenaires/vue`). Le jour où un
   contrat se paiera à l'audience, App Check ou une mesure vérifiable prendra le
   relais.
4. **Un battement par minute et par spectateur**, à une seconde tirée au
   hasard dans la minute (pour étaler les écritures), seulement pendant le
   direct (`status: "live"`, mi-temps comprise) et seulement page visible.
5. **La minute est l'heure du mur** (minutes depuis l'époque Unix), pas la
   minute du match : la courbe se recale ensuite sur le coup d'envoi et sur les
   buts, dont on connaît l'heure.
6. **L'identifiant d'appareil change chaque jour** : tiré au hasard, gardé dans
   le stockage local avec sa date, remplacé le lendemain. Aucun lien entre deux
   jours, aucun lien avec le compte.
7. **Données brutes gardées 30 jours**, puis résumées : le résumé d'une
   compétition et d'un match (visites par jour, courbe, pic) se garde, le
   détail par appareil se supprime.
8. **L'administration voit tout ; le staff d'une compétition voit la sienne.**
   Organisateurs et modérateurs (ceux qui la configurent, voir lib/hats) ont
   une page Statistiques par compétition : ses pages et ses matchs, jamais les
   amicaux ni les autres compétitions. Des agrégats seulement, comme
   l'administration — personne ne lit une session.
9. **L'appli compte par la page web** : toucher un match y ouvre la fiche web
   dans le navigateur intégré, le battement y tourne déjà. L'appli marque ces
   liens `?via=app`.
10. **Un rapport PDF par compétition**, téléchargé en un geste depuis cette
    page : un vrai fichier, généré par le serveur, qu'on envoie tel quel sur
    WhatsApp à un sponsor. L'impression du navigateur (« Enregistrer en PDF »)
    aurait évité une dépendance, mais c'est un parcours de trois écrans sur un
    téléphone Android, et presque impraticable sur un iPhone.

## Modèle de données

```
audience/{cible}                       résumé, écrit par le serveur seul
audience/{cible}/sessions/{session}    un appareil, un jour
```

`cible` désigne ce qu'on regarde :

- `comp-{cid}` : les pages d'une compétition (`/c/{slug}`, ses équipes, sa page
  d'inscription) ;
- `match-{mid}` : la fiche d'un match, de compétition (`/c/{slug}/matches/{mid}`)
  ou amical (`/matches/{id}`). Les identifiants de documents des deux
  collections ne se croisent pas en pratique ; la session porte `cid` pour un
  match de compétition.

`session` = `{jour}_{appareil}`, par exemple `20261016_k3j9x0p2a4b5c6d7` :
`jour` en `AAAAMMJJ` (heure de Lomé, comme le reste du produit), `appareil` 16
caractères tirés au hasard.

Une session :

| champ | type | rôle |
|---|---|---|
| `jour` | chaîne `AAAAMMJJ` | recopie le préfixe de l'identifiant, pour les requêtes |
| `vues` | entier ≥ 1 | ouvertures de la page ce jour-là |
| `premiere` | horodatage serveur | première ouverture |
| `derniere` | horodatage serveur | dernier signe de vie |
| `minutes` | liste d'entiers | minutes de direct où la page était visible (matchs seulement), 300 au plus |
| `via` | `app` · `qr` · `partage` · `autre` | d'où vient la visite, lu à la première ouverture |
| `connecte` | booléen | un compte était connecté |
| `cid` | chaîne ou absent | la compétition d'un match de compétition |

Le résumé `audience/{cible}` (lot 3) : `par_jour.{jour}: { visites, vues }`,
`courbe: { {minute}: n }`, `pic`, `pic_a`, `minutes_vues`, `maj_le`.

## Collecte, côté navigateur

Module pur `lib/audience.ts` (testé dans la suite partagée) : le jour à
l'heure de Lomé, la minute, l'identifiant du jour, la lecture de `via`, et
tous les calculs de lecture (courbe, pic, temps moyen, visites par jour).

Crochet `useAudience(cible, { direct, cid })` dans `lib/audience-client.ts` :

- à l'ouverture de la page : crée la session ou ajoute une vue (`vues +1`,
  `derniere`) ; si le match est en direct, la minute en cours part dans la
  même écriture ;
- si `direct` : puis un battement à chaque minute suivante, à une seconde tirée
  au hasard, tant que la page est visible (`minutes` reçoit la minute,
  `derniere` avance) ; il s'arrête en arrière-plan et reprend au retour, la
  minute du retour partant aussitôt ;
- n'écrit rien si `navigator.webdriver` est vrai (navigateur piloté), ni sur
  les pages de l'administration et de la console ;
- ne bloque jamais la page : une écriture refusée ou hors ligne est ignorée.

Branché sur `/c/[slug]`, `/c/[slug]/teams/[tid]`, `/c/[slug]/rejoindre`
(cible compétition) et sur les deux fiches de match (cible match, `direct`
quand le match est en cours).

`via` : le paramètre `?via=` que posent nos propres liens — le bouton de
partage (`partage`), le QR code d'une compétition (`qr`), l'appli (`app`) —
sinon `autre`. Les aperçus de liens (WhatsApp, réseaux) n'exécutent pas de
JavaScript et ne comptent donc pas.

## Règles Firestore

```
match /audience/{cible} {
  allow read, write: if false;            // résumé : le serveur seul
  match /sessions/{session} {
    allow read, delete: if false;          // lecture par le SDK admin seul
    allow create: if sessionValide() && request.resource.data.vues == 1
                  && request.resource.data.minutes.size() <= 1;
    allow update: if sessionValide()
                  && request.resource.data.diff(resource.data).affectedKeys()
                       .hasOnly(['vues', 'derniere', 'minutes'])
                  && request.resource.data.vues in [resource.data.vues, resource.data.vues + 1]
                  && request.resource.data.minutes.size() <= resource.data.minutes.size() + 1;
  }
}
```

`sessionValide()` : identifiant de la forme `^[0-9]{8}_[a-z0-9]{16}$`, `jour`
égal à son préfixe, `cible` de la forme `comp-…` ou `match-…`, `derniere` égal
à `request.time`, champs limités à la liste ci-dessus, `via` dans ses quatre
valeurs, `minutes` de 300 éléments au plus. **Quand une écriture ajoute une
minute** (la liste grandit), cette dernière minute doit tomber à ±3 minutes de
`request.time` : une horloge de téléphone fausse de plus fait simplement perdre
ce spectateur. Une écriture qui n'ajoute qu'une vue ne vérifie rien sur les
minutes, sans quoi une page rouverte le soir serait refusée à cause d'une
minute de l'après-midi. Testées sur le banc d'essai des règles avant tout
déploiement.

## Lecture

Les calculs vivent une fois, dans `lib/audience-serveur.ts` (SDK admin), sur
les fonctions pures de `lib/audience` : l'administration, la page des
organisateurs et le PDF lisent les mêmes chiffres, calculés au même endroit.

Route `GET /api/competitions/[cid]/audience` (staff de la compétition ou
superadmin, contrôlé par `peutConfigurer`) : la même réponse que
`?cible=comp-{cid}` ci-dessous, et `?match={mid}` pour la courbe d'un de ses
matchs. Elle refuse un match qui n'appartient pas à la compétition.

Route `GET /api/admin/audience` (superadmin), SDK admin :

- `?cible=comp-{cid}` : visites et vues par jour sur 30 jours, part connectée,
  provenance, et la liste de ses matchs avec visites, pic, moment du pic et
  temps moyen ;
- `?cible=match-{mid}` : visites, courbe minute par minute, pic et son heure,
  temps moyen, spectateurs maintenant ; plus les buts du match (minute et
  heure), pour les poser sur la courbe ;
- sans paramètre : le panorama — visites des 30 derniers jours, les
  compétitions et les matchs les plus suivis, et **en direct maintenant** (pour
  chaque match en cours, les sessions dont `derniere` date de moins de 2
  minutes, par agrégation `count()`).

En v1, tout se calcule à la lecture, à partir des sessions : c'est l'échelle
d'aujourd'hui. « Maintenant » interroge les sessions de chaque match en cours,
dans sa propre sous-collection : l'index automatique sur `derniere` suffit. Le
panorama des 30 jours, lui, interroge `sessions` en groupe de collections sur
`jour` : il faut une exemption d'index en portée « groupe de collections »
dans `firestore.indexes.json` (comme `staff_grants.uid`), à déployer — le
déploiement des index se demande, il n'est pas couvert par l'autorisation des
règles. La tâche quotidienne du lot 3 s'en sert aussi.

## Écrans de l'administration

- **Tableau de bord** (`/admin`) : « En direct maintenant : N spectateurs sur M
  matchs », avec le détail par match.
- **Statistiques** (`/admin/stats`) : une section « Audience · 30 jours » —
  visites des compétitions et des matchs, les cinq compétitions et les cinq
  matchs les plus suivis (au pic), provenance, part de l'appli.
- **Fiche d'une compétition** (`/admin/competitions/[cid]`) : une carte
  « Audience » — visites par jour en barres, et ses matchs avec leur pic.
- **Fiche d'audience d'un match** (`/admin/audience/[cible]`, nouvelle) : la
  courbe minute par minute, les buts posés dessus, le pic, le temps moyen. Elle
  vaut pour les amicaux, qui n'ont pas de fiche dans l'admin.

Chaque écran rappelle en une ligne ce que le chiffre compte (« des appareils,
pas des personnes ; un écran éteint ne compte pas »).

## La page Statistiques des organisateurs

`/organizer/competitions/[cid]/statistiques`, ouverte au staff de la
compétition (le garde de l'espace organisateur s'en charge déjà), atteinte
depuis le tableau de bord de la compétition.

- **En haut, les chiffres clés** sur la période choisie (7 jours, 30 jours, ou
  depuis le début de la collecte) : visites des pages de la compétition,
  visites de ses matchs, pic de spectateurs simultanés et le match où il a eu
  lieu, temps moyen sur un direct, part venue de l'appli, nombre d'abonnés.
- **En direct maintenant**, quand l'un de ses matchs est en cours : les
  spectateurs du moment, rafraîchis toutes les 30 secondes.
- **Les visites par jour**, en barres.
- **Ses matchs**, du plus suivi au moins suivi : visites, pic et son heure,
  temps moyen. Toucher un match déplie sa courbe minute par minute, buts posés
  dessus.
- **D'où viennent les visites** : appli, QR code, lien partagé, autre.
- **Le bouton « Télécharger le rapport PDF »**.
- La même ligne d'honnêteté que l'admin, et, tant que la collecte a moins de
  30 jours, la date de son début : un chiffre faible la première semaine ne
  veut pas dire un tournoi sans public.

## Le rapport PDF

`GET /api/competitions/[cid]/audience/rapport?periode=7j|30j|tout` (la période
choisie sur la page, `30j` par défaut) rend un `application/pdf` nommé
`audience-{slug}-{AAAA-MM-JJ}.pdf`, avec le même contrôle d'accès que la page.

Généré par le serveur avec `pdf-lib` (JavaScript pur, sans moteur de rendu ni
binaire à installer) et `@pdf-lib/fontkit` pour embarquer les polices Outfit
déjà présentes dans `assets/fonts` : le rapport a la typographie de la marque,
pas de l'Helvetica. Une page A4, deux au plus :

1. L'en-tête : logo de la compétition, son nom, l'organisateur, la période,
   « Mesuré par KoppaFoot ».
2. Les chiffres clés, en grands chiffres.
3. Les visites par jour, en barres.
4. La courbe du match le plus suivi, avec son pic et ses buts.
5. Les cinq matchs les plus suivis, en tableau.
6. En pied de page, ce que les chiffres comptent et ce qu'ils ne comptent pas
   (appareils, pas personnes ; pages visibles seulement ; depuis quelle date),
   et la date de génération. Un sponsor doit pouvoir lire le rapport sans
   personne pour l'expliquer — et sans y voir plus qu'il ne dit.

Les graphiques sont dessinés par `pdf-lib` (rectangles et lignes), à partir
des mêmes séries que l'écran : pas d'image de l'écran, pas de navigateur sans
tête côté serveur.

## Vie privée et conservation

- Pas de cookie : l'identifiant vit dans le stockage local, change chaque jour,
  et n'est rattaché à aucun compte. Ni adresse IP, ni appareil, ni navigateur
  enregistrés.
- La page Confidentialité ajoute cet identifiant à « Cookies et stockage sur
  ton appareil », et sa durée (30 jours avant résumé) à « Combien de temps nous
  les gardons ». La mention des « statistiques de fréquentation anonymes »
  devient vraie pour KoppaFoot lui-même, plus seulement pour Vercel.

## Coût

Une écriture par visite, plus une par minute et par spectateur de direct. Un
match suivi par 200 personnes pendant 100 minutes : environ 20 000 écritures
Firestore, quelques centimes au-delà du quota gratuit quotidien. Les lectures
ne viennent que de l'administration. Aucun appel de fonction Vercel côté
spectateur.

## Livraison

1. **La collecte** (en premier, parce que rien n'est rétroactif) : `lib/audience`
   et ses tests, le crochet, les règles et leur banc d'essai, le branchement sur
   les pages, `?via=` sur le partage, le QR code et l'appli, la page
   Confidentialité. Rien ne s'affiche encore ; les données s'accumulent.
2. **La lecture** : `lib/audience-serveur`, les deux routes, l'exemption
   d'index, les quatre écrans de l'administration et la page Statistiques des
   organisateurs.
3. **Le rapport PDF** : la route du rapport, ses deux dépendances, le bouton.
4. **Le résumé et la purge** : une tâche quotidienne (`/api/cron/audience`, à
   côté des deux existantes) résume la veille dans `audience/{cible}`, garde la
   courbe des matchs terminés, photographie le nombre d'abonnés de chaque
   compétition (sa courbe, qu'on n'a pas aujourd'hui), et supprime les sessions
   de plus de 30 jours. Les écrans et le rapport lisent alors le résumé pour le
   passé et les sessions pour le jour même. **À livrer avant le trentième jour
   de collecte**, quel que soit l'avancement des lots 2 et 3.

## Tests

- `lib/audience` : jour de Lomé autour de minuit, identifiant qui change de
  jour, lecture de `via`, courbe et pic (deux appareils, minutes qui se
  chevauchent), temps moyen, spectateur à zéro minute.
- Règles : sur le banc d'essai, création et mise à jour valides, vue en double,
  champ en trop, `via` inconnu, minute hors fenêtre, lecture refusée, résumé
  refusé au navigateur — avec des cas témoins dont l'issue est connue.
- Le crochet : rien n'est écrit page cachée ; le battement reprend au retour.
- Les routes de lecture : le staff d'une compétition lit la sienne, pas celle
  d'un autre ; un match d'une autre compétition est refusé.
- Le rapport : un `application/pdf` valide (relu par `pdf-lib`), qui porte le
  nom de la compétition et ses chiffres ; une compétition sans aucune visite
  rend un rapport qui le dit, pas une erreur.

## Hors périmètre

- L'audience d'un amical vue par ses managers, et un rapport PDF d'amical.
- Un rapport personnalisable (choix des sections, logo du sponsor).
- Les compétitions du monde (`/competitions/monde/…`), qui ne sont pas des
  compétitions KoppaFoot.
- La mesure de l'accueil et du Direct.
- Une mesure vérifiable (App Check), tant qu'aucun contrat ne se paie à
  l'audience.
