# Design : L'anglais, pour ceux qui regardent

**Date :** 2026-09-29
**Statut :** Livré (site). Rien à déployer en dehors du code. **Application mobile : nouvelle version à construire** pour la langue des e-mails Firebase (une ligne).

## Le problème

Le site avait une bascule FR/EN, mais :

1. **Presque rien ne changeait.** Le dictionnaire central couvrait la barre, le menu du compte et les réglages. Le Direct, les compétitions, les matchs, les équipes et les joueurs (ce qu'un visiteur anglophone ouvre depuis un lien WhatsApp) restaient en français.
2. **Le serveur ne savait pas lire la langue.** Les pages rendues côté serveur (titres, aperçus, fiches) sortaient toujours en français, et un navigateur anglais sans choix enregistré recevait le français.
3. **Les dates et les nombres restaient français** : `fr-FR` et la locale `fr` de date-fns un peu partout, « 6,7 » pour une note.
4. **Des incohérences** : le produit tutoie, mais une soixantaine de phrases vouvoyaient (dont les e-mails, qui commencent par « Salut ») ; les e-mails de Firebase Auth (vérification, mot de passe) partaient dans la langue du projet ; la suppression de compte demandait de taper « SUPPRIMER » même en anglais ; un commentaire décrivait la bascule de langue comme non branchée.

## Décisions

### La langue d'une requête
- `i18n/config.ts` (sans directive, lisible des deux côtés) : le cookie `koppafoot_langue`, sinon l'en-tête `Accept-Language`. L'anglais seulement pour un navigateur qui liste l'anglais **et pas** le français : qui lit le français le garde.
- `i18n/serveur.ts` : `langueServeur()` (mise en cache par requête) et `textesServeur(T)` pour les composants serveur. Le layout racine transmet la même décision au `LangueProvider` : serveur et navigateur ne choisissent jamais chacun de leur côté.
- La bascule écrit le cookie et rejoue le rendu serveur (`router.refresh`) sans recharger la page. Elle vit sur `/parametres`, page publique, maintenant traduite elle aussi.

### Les phrases à côté de l'écran qui les dit
- `textes(fr, en)` (`i18n/textes.ts`) : chaque écran déclare ses phrases, l'anglais est exigé clé par clé (sinon erreur de compilation). Les pluriels et accords sont des fonctions (`buts(n)`), les paragraphes riches du JSX. Un composant client les lit avec `useTextes(T)`, un composant serveur avec `textesServeur(T)`.
- Pourquoi pas tout dans le dictionnaire central : chaque page aurait embarqué toutes les phrases du produit dans les deux langues. Le dictionnaire central reste pour la coquille (barre, compte, réglages).
- `textes` s'importe depuis `@/i18n/textes`, jamais depuis `@/i18n` (module client : un composant serveur y recevrait une référence au lieu de la fonction).
- `i18n/foot.ts` : le vocabulaire commun (tours, groupe, états d'un match, buts, passes, colonnes du classement), recopié jusque-là dans huit fichiers.

### Les réponses mises en cache
- Les routes mises en cache par le CDN ne lisent pas le cookie : la recherche prend `?lang=`, et le Direct, les performances et les matchs du jour renvoient des données brutes (`amical: true`, `groupe`, `tour`, `areaEn`) que le navigateur met en mots.

### Dates et nombres
- `LOCALE` : `fr-FR` / `en-GB` (jour avant mois, 24 h, comme au Ghana et au Nigeria) ; `LOCALE_DATE_FNS` : `fr` / `enGB`.
- **Les dates avec jour de la semaine s'écrivent à la main** (`dateAvecJour`, `dateAvecJourLong` dans `lib/dates.ts`). Vérifié sur les émulateurs : en anglais britannique, le Node du serveur écrit « Sat 3 Oct » et Chrome « Sat, 3 Oct » (l'inverse au format long avec l'année). Le Direct rendu par le serveur changeait de texte en arrivant dans le navigateur, et React reconstruisait tout l'arbre. Le français ne varie pas ; un test vérifie jour par jour, sur une année, que l'écriture à la main donne exactement celle d'Unicode.
- La note : « 6,7 » en français, « 6.7 » en anglais (`formaterNote(note, langue)`).

### Ce qui est traduit
Le Direct (accueil, recherche, rails, classement des performances), l'annuaire des compétitions et le football mondial, les actus, la page d'une compétition (calendrier, classement, tableau, buteurs, inscription), la page d'un match (en-tête, fil, stats, compositions, infos, forme, pronostic, homme du match), la fiche d'équipe en compétition et la fiche du club, la fiche d'un joueur (bilan, forme, publications, commentaires), la connexion en fenêtre, la barre du bas, les réglages. Libellés des événements, postes, formats de compétition, provenances du tableau (« 2nd in Group A »), états de forme et erreurs de connexion Firebase ont leur version anglaise.

### Corrections
- **Tutoiement partout** (dictionnaire, e-mails, pages de connexion, outils des managers, organisateurs et administrateurs, messages des routes). Le « vous » pluriel reste là où il s'adresse à deux personnes ou plus (« le règlement reste entre vous », « Managers, inscrivez votre équipe »).
- **E-mails de Firebase Auth** : `auth.languageCode` suit la langue du site ; l'application mobile le fixe au français.
- **Suppression du compte** : le mot à taper suit la langue (« SUPPRIMER » / « DELETE ») ; la route accepte les deux.

## Ce qui reste en français

Proposés comme lots suivants :
1. **Inscription et compte** : pages `/signup`, `/login` (pleine page), vérification d'e-mail, mot de passe oublié, profil personnel, onboarding.
2. **La langue du compte** : l'enregistrer sur le profil, pour que les push et les e-mails envoyés par le serveur partent dans la langue de chacun (aujourd'hui ils partent en français).
3. **L'application mobile** : elle n'a pas encore de système de langue.
4. **Les outils** : espaces manager, joueur, arbitre, organisateur, console de match, administration, `/stats`, messages d'erreur des routes.

## Vérifications

- `tsc` (site et mobile) sans erreur ; lint des fichiers touchés au même niveau qu'avant (aucun avertissement nouveau).
- `mobile/src/__tests__/dates.test.ts` : dates avec jour (français = Unicode sur 365 jours, anglais sans virgule), jours proches, note selon la langue ; les 149 tests passent.
- Émulateurs, navigateur réel, en français et en anglais : Direct, annuaire, compétition, match de compétition, équipe en compétition, club, joueur, amical, classement ; attribut `lang` du document ; un navigateur `en-GB` sans cookie reçoit l'anglais ; bascule FR → EN sur `/parametres` sans rechargement, page suivante en anglais ; plus d'erreur d'hydratation ; format téléphone.
