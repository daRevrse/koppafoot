# App mobile : l'onglet Espace casquette

*2026-10-27. Proposition faite à l'utilisateur, qui l'a acceptée telle quelle (« C'est OK »).*

## Pourquoi

L'onglet Espace casquette est le dernier onglet vide de l'application (barre du bas : Direct, Actus, Évolution,
Espace casquette). Les casquettes (`lib/hats`) disent ce qu'un compte **fait** : organiser des compétitions
(`is_organizer`), posséder un terrain (`is_venue_owner`), tenir la console live comme scoreur validé
(`is_scorer`). Elles se cumulent, et le superadmin est organisateur et scoreur d'office. Évolution dit ce qu'on
**est** (joueur, manager, arbitre) ; l'Espace casquette dit ce qu'on a à faire.

Sur le site, ces outils vivent dans trois pages : `/live-ops` (la console), `/organizer` (l'espace
organisateur), `/mes-terrains` (terrains et réservations). L'onglet les rassemble pour le téléphone, autour du
jour de match.

## Objectifs

- Un compte qui porte une ou plusieurs casquettes voit, d'un coup d'œil, ce qui l'attend : les matchs dont il
  tient le direct, ses compétitions, les réservations de ses terrains.
- Le geste le plus fréquent (ouvrir la console d'un match au bord du terrain) se fait en deux touchers depuis
  l'onglet.
- Un compte sans casquette comprend ce que sont les casquettes et sait comment en demander une.

## Hors champ (v1)

- **L'onglet montre, il n'écrit pas.** Prendre un amical (« Je couvre »), confirmer ou refuser une réservation,
  configurer une compétition : tout cela s'ouvre sur le site. Aucune règle Firestore ni route serveur nouvelle.
- **Pas de console live native.** C'est un chantier à part, bien plus gros. La console s'ouvre sur le site.
- Pas d'interrupteur pour passer d'une casquette à l'autre : les sections s'empilent.

## Ce qu'on refuserait

- Une section vide affichée pour une casquette qu'on n'a pas : un compte sans terrain ne voit pas « Mes terrains ».
- Un bouton qu'on ne peut pas actionner (même principe que `/live-ops` pour « Amicaux sans scoreur »).
- Des chiffres qui divergent du site : mêmes requêtes, mêmes filtres que les pages du site.

## L'écran

En-tête `EnTeteOnglet titre="Espace casquette"`, puis les sections dans cet ordre, chacune seulement si elle a
lieu d'être :

### 1. Matchs à tenir (console live)

Pour qui : tout compte à qui l'on a confié un match ou une compétition (modérateur, scoreur d'un arbitre,
détenteur d'un code de console), et tout scoreur validé. Ce n'est pas une casquette : un organisateur peut
nommer n'importe quel compte modérateur.

Contenu, repris de `/live-ops` (`src/app/(moderator)/live-ops/page.tsx`) :

- **Matchs confiés un par un** : `matches` où `moderator_ids` contient le compte (`onMatchesIModerate`), sauf
  terminés ou annulés, triés par date et heure. Ligne : les deux équipes, le jour et l'heure, le terrain,
  « En direct » si le match est en cours, et « Scoreur de {arbitre} » quand c'est un arbitre qui l'a confié.
  Toucher → la console sur le site : `/matches/{id}/manage`.
- **Matchs du jour des compétitions tenues** : les compétitions où le compte est modérateur ou organisateur,
  plus celles d'un code de console (`listModeratedCompetitions` : `moderator_ids`, `organizer_ids`, et le groupe
  de collections `staff_grants` où `uid` = le compte, non révoqué, non expiré), sans les bacs à sable
  d'entraînement. Pour chacune, ses matchs du jour (l'application sait déjà les écouter :
  `ecouterMatchsCompetition`). Toucher un match → `/live-ops/{cid}/matches/{mid}/live`. *Mon choix :* seules
  les compétitions qui ont un match ce jour-là apparaissent ici (les autres sont dans « Mes compétitions » ou
  derrière le lien « Toute la console » → `/live-ops`), et un match terminé reste dans la liste du jour, marqué
  « Terminé » ; un match annulé n'y est pas.
- **Amicaux sans scoreur** (scoreurs seulement) : pas de liste, le nombre, « 3 amicaux cherchent un scoreur »,
  qui mène à `/live-ops` où on les prend. Même requête que `onAmicauxSansScoreur`. Rien quand il n'y en a pas.
- **S'entraîner** : un lien discret vers `/live-ops/entrainement`, toujours présent dans la section.

*Mon choix :* sans aucun match à tenir, la section n'apparaît que pour un scoreur (le nombre d'amicaux et
l'entraînement ont alors un sens) ; pour les autres, elle disparaît.

### 2. Mes compétitions (organisateur)

Pour qui : `isOrganizer(profil)`, et aussi tout compte modérateur d'une compétition (le site les appelle
« co-organisées », `listCompetitionsCoOrganisees`).

Contenu : `listCompetitionsByOrganizer` puis `listCompetitionsCoOrganisees`, sans les bacs à sable, les plus
récentes d'abord. Ligne : logo, nom, statut (les libellés du site, comme l'annuaire de l'application), ville.
Toucher → la page native de la compétition (`/competition/[cid]`), déjà construite. Un bouton « Gérer » sur la
ligne → `/organizer/competitions/{cid}` sur le site. Au pied de la section : « Créer une compétition » →
`/organizer/competitions/new`.

### 3. Mes terrains (propriétaire)

Pour qui : `isVenueOwner(profil)`.

Contenu : les réservations où `owner_id` = le compte (`onBookingsByOwner`), en deux groupes :

- **À répondre** : statut `pending`, du plus ancien au plus récent (on répond d'abord à qui attend depuis
  longtemps) ; *mon choix :* seulement les demandes pour aujourd'hui ou plus tard, une demande pour un créneau
  passé n'appelle plus de réponse ;
- **Aujourd'hui** : statut `confirmed` et date du jour, par heure.

Ligne : le terrain, le jour et l'heure, la durée, le demandeur (nom d'équipe sinon nom du compte). Toucher →
`/mes-terrains/reservations`. Lien de section → `/mes-terrains`. Sans rien à répondre ni à recevoir aujourd'hui :
une phrase (« Rien à traiter aujourd'hui ») plutôt qu'une section qui disparaît, puisque le compte a la casquette.

### 4. Sans casquette et sans rien à tenir

L'onglet explique en trois lignes ce que sont les casquettes, et propose les trois candidatures du site :
organiser des compétitions (`/organisateurs/candidature`), tenir la console comme scoreur
(`/scoreurs/candidature`), référencer son terrain (`/terrains/candidature`). Sans compte : la même chose, avec
la connexion d'abord (`raison` à ajouter dans `lib/raisons-auth`, comme « role »).

## Contraintes

- **Données** : lectures Firestore côté client, déjà permises par les règles en production (`matches` et
  `competitions` en lecture publique, `bookings` au propriétaire, `staff_grants` à son titulaire). Les requêtes
  et leurs index existent : ce sont celles des pages du site.
- **Écoute** : en direct pour les matchs (un match qui passe en live change d'allure, comme sur `/live-ops`) ;
  coupée en arrière-plan, comme le Direct (`usePremierPlan`).
- **Le site dans le navigateur intégré** (`ouvrirSurLeSite`) **n'a pas la session de l'application.** La
  première fois, le site demandera de se connecter dans ce navigateur. C'est déjà le cas des liens vers le site
  aujourd'hui ; à dire dans la PR, et à traiter plus tard (passer la session au site) si c'est gênant au bord du
  terrain. *Mon choix de ne pas le traiter en v1 :* l'application ne sort que sur Android pour l'instant, où le
  navigateur intégré partage la session de Chrome : un compte déjà connecté au site dans Chrome n'aura rien à
  refaire.
- **Les casquettes se lisent sur le profil** chargé à la connexion (`useAuth().profil`, champs `isOrganizer`,
  `isVenueOwner`, `isScorer`, `isSuperAdmin`, via `isOrganizer`/`isVenueOwner`/`isScorer` de `lib/hats`). Une
  casquette accordée pendant que l'application est ouverte apparaît au prochain rafraîchissement du profil.
- Partager ce qui peut l'être avec le site (filtres, tris, libellés) dans des modules sans SDK, comme pour les
  autres écrans de l'application ; les écouteurs restent dans `mobile/src/lib`.

## Ce qui est décidé

- L'ordre des sections : Matchs à tenir, Mes compétitions, Mes terrains (proposition acceptée).
- La v1 n'écrit rien ; la console et la gestion s'ouvrent sur le site (proposition acceptée).
- Le titre de l'onglet reste « Espace casquette » (choisi par l'utilisateur le 2026-10-22).

## Laissé au constructeur

- La mise en page des lignes et des sections (reprendre les briques existantes : `Bloc`, `LigneMatch`,
  `CarteAnnuaire`, `EtatVide`).
- Le découpage en PR (une par section est raisonnable : Matchs à tenir d'abord).
- Le squelette de chargement, le glisser-pour-rafraîchir.
