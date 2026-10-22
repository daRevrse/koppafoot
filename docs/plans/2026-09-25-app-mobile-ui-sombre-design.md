# Design : application mobile — une identité sombre

**Date :** 2026-09-25
**Statut :** Validé le 2026-09-25, à implémenter sur `claude/app-ui-sombre`.
**Prolonge :** [2026-09-24-app-mobile-lot1-design.md](2026-09-24-app-mobile-lot1-design.md), dont il reprend les neuf écrans sans en changer le comportement.

## Le périmètre

L'application reprenait jusqu'ici le site trait pour trait : fond blanc, vert `#059669`, coins carrés, lignes de match à plat. Elle prend une identité à elle, partie du vert profond de l'écran de lancement et de l'accueil.

Dans ce lot : la palette sombre sur les neuf écrans, la frise des jours, un Direct « tableau d'affichage » en cartes, des squelettes au chargement, des vibrations, un onglet Compte qui montre le profil et les compétitions suivies.

Hors lot : un thème clair ou qui suit le téléphone, la fiche de match native, le logo Google dans le bouton de connexion.

## Les décisions prises

1. **Tout sombre, un seul thème.** Le fond est `#0d291b`, celui de l'écran de lancement : on passe du lancement à l'application sans à-coup. Pas de thème clair à maintenir en parallèle.
2. **Pas de bibliothèque de style.** La palette vit dans `mobile/src/theme.ts`, renommée par rôles ; les composants sont retouchés à la main. NativeWind aurait réécrit tous les styles pour parler le vocabulaire du site, alors que l'application veut justement s'en distinguer ; une bibliothèque de composants aurait apporté des composants génériques à re-styler.
3. **Les animations passent par `Animated`** de React Native, pilote natif, sans dépendance. Elles s'arrêtent quand le téléphone demande de réduire les animations.
4. **Un seul module natif ajouté : `expo-haptics`.** Il impose un nouveau build de développement EAS avant tout test sur téléphone : l'ancien build planterait au lancement faute du module.

## La palette

| Rôle | Couleur | Usage |
|---|---|---|
| `fond` | `#0d291b` | tous les écrans, la barre d'onglets |
| `surface` | `#12352a` | cartes de match, champs, carte profil |
| `surfaceHaute` | `#184233` | appui, en-tête de compétition collé |
| `bordure` | `#1f4a38` | séparateurs, contours |
| `texte` | `#F2F7F4` | texte principal |
| `texteSecondaire` | `#A9C2B4` | e-mail, phrases d'aide |
| `texteDiscret` | `#8FB09E` | heures, sous-titres, « FIN » |
| `primaire` | `#34D399` | onglet actif, liens, bouton plein, jour choisi |
| `direct` | `#FC8181` | minute, point et filet d'un match en cours |
| `accent` | `#FBBF24` | étoile |
| `erreur` | `#FCA5A5` | messages et bordures d'erreur |

**Un test garde les contrastes.** `theme.test.ts` exige 4,5 au moins pour chaque couleur de texte sur chacun des trois fonds. Il a fait éclaircir `texteDiscret` et `direct`, qui ne faisaient que 3,9 et 4,1 sur `surfaceHaute`.

**Le bouton plein** a un fond `primaire` et un libellé `#0d291b` (8,1). Le blanc sur l'ancien vert n'atteignait que 3,8.

**Les coins s'arrondissent :** 10 pour les champs et les boutons, 14 pour les cartes.

## Le cadre commun

- `app.json` : `userInterfaceStyle: "dark"`, pour que les alertes système et le clavier iOS suivent.
- La barre d'état est claire partout.
- La barre d'onglets est sur `fond`, avec un filet `bordure`. L'onglet actif est en `primaire`, les autres en `texteDiscret`.
- Le navigateur intégré (pages du site) prend `fond` et `primaire`.
- L'accueil ne change pas : ses images plein écran sont déjà sombres.

## Le Direct

**En-tête.** Le titre est à gauche. S'il y a des matchs en cours, une pastille « ● 3 en direct » s'affiche à droite ; la toucher active le filtre En direct. La puce « En direct » ne répète plus le nombre.

**La frise des jours** remplace ‹ Aujourd'hui › :
- Une case par jour, avec le jour abrégé et le numéro (« lun. 22 ») ; celle d'aujourd'hui dit « Auj. ».
- Un point sous chaque jour qui a au moins un match.
- La case choisie est pleine, en `primaire`, et reste centrée.
- La frise couvre J-7 à J+7, élargie au jour choisi s'il en sort. Le bouton « Voir mardi 30 » de l'état vide tombe ainsi toujours sur une case visible.
- Sous « En direct » et « Favoris », le jour ne filtre rien (règles du site, `groupesDuTableau`). La frise y reste, estompée et inactive, pour que rien ne saute d'un filtre à l'autre.
- Deux fonctions pures, `joursDeLaFrise` et `joursAvecMatchs`, vont dans `lib/direct-tableau.ts`.

**Les matchs en cartes :**
- Chaque compétition garde son en-tête collant (écusson, nom, ville, étoile), puis ses matchs en cartes `surface`, séparées de 8.
- La colonne de gauche dit l'état du match ; les scores sont en Outfit 20, comme sur un tableau d'affichage.
- Un match **en cours** a un filet `direct` à gauche et sa minute en rouge (« 67′ ») avec un point qui pulse (`PointDirect`).
- Un match **à venir** montre son heure.
- Un match **joué** montre « FIN » en discret, le vainqueur en gras et le perdant estompé.

**Le chargement.** Au premier chargement, des squelettes remplacent le rond qui tourne : deux en-têtes et trois cartes qui respirent. Le tirer-pour-rafraîchir reste, aux couleurs du thème.

**Les vibrations.** Un module `lib/retour.ts`, au-dessus d'`expo-haptics`, donne une vibration de sélection au changement de jour ou de filtre et un choc léger sur l'étoile. Il ne fait rien sur le web.

**Les états vides et hors ligne** gardent leurs textes, avec une icône au-dessus. Le bandeau « Pas de connexion » passe sur `surface`, avec un nuage barré.

## Le Compte

**Connecté :**
- Une carte profil : un avatar rond de 56 (la photo si `profilePictureUrl` existe, sinon les initiales en `primaire`), le nom, l'e-mail, la ville.
- « Compétitions suivies » : une ligne par compétition (écusson, nom, ville, étoile pleine).
  - La ligne ouvre la page de la compétition sur le site.
  - L'étoile arrête le suivi. La ligne reste, étoile vide, jusqu'à ce qu'on quitte l'onglet : un appui raté se rattrape d'un second appui.
- La liste est lue à chaque arrivée sur l'onglet, par `lireCompetitions(ids)` dans `lib/direct-firestore.ts`. Elle fait un `getDoc` par compétition (lecture publique), passe par le mapper partagé `toCompetition`, ignore les compétitions supprimées et trie par nom.
- Deux lignes squelettes pendant la lecture.
- Si le compte ne suit rien : « Aucune compétition suivie. Touche l'étoile d'une compétition dans le Direct. », avec un bouton « Aller au Direct ».
- « Se déconnecter » reste en bas, en contour.

**Sans connexion :** le texte actuel, une icône, les deux boutons.

## Connexion, inscription, mot de passe, profil

La structure ne change pas, seule la palette s'applique :
- « Fermer » devient une croix dans un rond `surface`, avec le libellé d'accessibilité « Fermer ».
- Un champ qui a le focus prend une bordure `primaire`.
- Le clavier iOS est sombre (`keyboardAppearance="dark"`).
- « Continuer avec Google » reste un bouton contour.

## Les tests et la vérification

Ces tests s'ajoutent aux 28 existants :
- `theme.test.ts` : les contrastes des paires employées.
- `joursDeLaFrise` : la fenêtre, et son élargissement au jour choisi.
- `joursAvecMatchs` : les dates nulles sont ignorées.
- `initiales` : accents, nom vide, prénom seul.

`jest` doit afficher « N passed » avec N supérieur à 28 ; « 0 total » est un échec (voir l'imbrication d'`expo-modules-core` du lot 1). Puis `lint` et `typecheck`.

Chaque écran est vérifié dans Chrome par la version web d'Expo, captures à l'appui. Viennent ensuite un nouveau build de développement EAS pour Android, puis le test sur téléphone : les vibrations, le point qui pulse, le clavier.

## La livraison

Une branche `claude/app-ui-sombre` partie d'`origin/master`, avec un commit par partie (thème et cadre, Direct, Compte, écrans d'authentification) et une seule PR.

## Révision du 2026-10-21 : le noir et la DA du site

Après les premières captures, l'utilisateur a demandé quatre changements. Ils remplacent ce qui précède là où ils le contredisent.

1. **Le fond est noir : le thème sombre du site, tel quel** (`src/styles/dark.css`).

   | Rôle | Couleur | Le site |
   |---|---|---|
   | `fond` | `#080d0b` | `--k-bg` |
   | `surface` | `#101714` | `--k-surface` |
   | `surfaceHaute` | `#16201c` | `--k-surface-2` |
   | `bordure` | `#26322e` | `--k-border` |
   | `bordureForte` | `#3b4a45` | `--k-border-fort` (champ au focus) |
   | `texte` | `#eef3f0` | `--k-ink-900` |
   | `texteSecondaire` | `#b7c1bc` | `--k-ink-600` |
   | `texteDiscret` | `#7f8a85` | `--k-ink-400` |
   | `primaire` | `#34d399` | `text-emerald-600` en sombre |
   | `bouton` | `#047857`, libellé blanc | `bg-gray-900` en sombre |
   | `direct` | `#f87171` | `red-400` ; `red-500` ne fait que 4,4 sur `surfaceHaute` |

   L'écran de lancement passe en `#080d0b`, et `theme.test.ts` vérifie qu'il reste égal au fond. L'icône garde son vert.

2. **La DA du site.**
   - **Coins carrés.** Seuls les éléments ronds du site le restent dans l'app : pastilles de filtre, écussons, points, petits boutons-icônes.
   - **Titres :** Outfit Black (900), en capitales, interlignage serré.
   - **Étiquettes, boutons et liens de pied :** DM Sans Black, 10–11 px, en capitales espacées.
   - **Matchs :** noms 13 px gras, scores 13 px Black, minute 11 px Black rouge, perdant en `texteDiscret`. Plus de cartes : des lignes séparées par des filets.
   - **Champs :** filet carré, texte 14 px demi-gras. Au focus, la bordure passe en `bordureForte`, pas en vert.
   - **Frise :** le jour choisi est souligné en vert, comme les onglets du site.

3. **Les listes du Direct se replient.**
   - L'en-tête d'une compétition porte l'écusson, le nom en 13 px Black et la ville en 11 px gras avec un repère. Viennent ensuite l'étoile, le nombre de matchs et un chevron.
   - Tout est ouvert par défaut, comme sur le site.
   - Replier n'est pas mémorisé d'une ouverture à l'autre de l'app : c'est le comportement du site.
   - Le repli s'anime (`LayoutAnimation`), sauf quand le téléphone demande moins d'animations.

4. **L'accueil prend l'image de la page de connexion du site** (`public/branding/login_side.jpg` : un ballon sur un terrain en terre). Elle reste fixe en fond, et seuls les textes défilent par-dessus. Les trois photos de stade européen disparaissent : l'app vise d'abord le public africain.
