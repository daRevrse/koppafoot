# Design : Console live — règles foot, chrono, verrouillage, plein écran

**Date :** 2026-06-17
**Statut :** Approuvé

## Contexte

Correctif comportemental de `LiveMatchConsole` (composant partagé orga + modérateur) pour coller aux règles standards du football et sécuriser l'opération le jour J.

## 1. Feuille de match + joueurs en live

- **Feuille de match intelligente** : **max 11 titulaires** par équipe (cap dur — au-delà, le joueur bascule remplaçant ; « le reste = remplaçants »). Validable avec ≤ 11 titulaires, jamais plus. (La compétition n'a pas de taille d'équipe → constante `STARTERS_MAX = 11`.)
- **`on_pitch` explicite** : nouveaux champs `home_on_pitch` / `away_on_pitch: string[]` (ids) sur le `comp_match`, résilients au refresh. Au **coup d'envoi**, `on_pitch` = les titulaires de chaque feuille.
- **Sélecteurs but / carton** : uniquement les joueurs **sur le terrain** (`on_pitch`).
- **Carton rouge** → sortie de `on_pitch` (exclu, pas de remplaçant → infériorité).
- **2e jaune** (compté depuis les événements `yellow_card` du joueur) → **rouge automatique** : log rouge + sortie de `on_pitch` + toast.
- **Remplacement** : sortant ∈ `on_pitch`, entrant ∈ banc (remplaçants pas entrés, non exclus) ; **max 5/équipe** (compté depuis les événements `substitution` ; bouton désactivé au-delà) ; sortant ne revient pas ; `on_pitch` mis à jour (−sortant, +entrant).
- L'`on_pitch` est maintenu par la console (l'opérateur connaît sortant+entrant au moment du remplacement) ; pas besoin de dériver depuis les events.

## 2. Chrono (90 min, 2× 45, mi-temps)

Affichage continu 0→90 (horloge serveur `timer_start_at` + `timer_offset`).
- **« Mi-temps »** → snap `timer_offset = 45min`, stop (`pauseCompTimer(cid, mid, 2_700_000)`), période → mi-temps.
- **« Reprise 2e mi-temps »** → `startCompTimer` (repart de 45:00, compte 45→90).
- **« Fin du match »** → snap `timer_offset = 90min` (`pauseCompTimer(cid, mid, 5_400_000)`) puis `finishCompMatch`.
- **Auto-pause retirée** : l'opérateur peut dépasser 45/90 (temps additionnel affiché) ; ce sont les boutons qui figent aux bornes.

## 3. Verrouillage (rôle-dépendant)

La console charge `useAuth` + `onCompetition(cid)` pour savoir si l'utilisateur est **organisateur** (`uid ∈ organizerIds`) ou **modérateur**.
- Match **live** : **modérateur** = aucun bouton retour/quitter, garde `beforeunload` ; il sort à la fin du match. **Organisateur** = bouton **« Quitter »** visible (peut sortir à tout moment).
- Avant le coup d'envoi et après la fin : tout le monde peut quitter (retour normal).

## 4. Plein écran

- Au **coup d'envoi** (clic « Lancer / Coup d'envoi », geste utilisateur) → `requestFullscreen()` sur le conteneur. Sortie du plein écran à la fin du match (best-effort ; ignore les erreurs si refusé).

## Modèle / lib
- + `home_on_pitch` / `away_on_pitch` (types `FirestoreCompMatch`/`CompMatch` + mapper, défaut `[]`).
- Mises à jour `on_pitch` via `updateCompMatch` (champ existant). 2e-jaune et compte de remplacements **dérivés des événements** (pas de champ en plus). Pas de nouvelle règle Firestore (`comp_matches` déjà écrivable orga/modérateur).

## Lots
1. **Modèle** : `on_pitch` (types + mapper).
2. **Console** : refonte `LiveMatchConsole` (4 points ci-dessus).

## Vérif
Pas de test runner → `npm run build` exit 0 + `npm run lint` (zéro nouvelle erreur) + manuel (feuille ≤11 → coup d'envoi plein écran → but/carton limités au terrain, 2e jaune exclut, 5 remplacements max → mi-temps snap 45 → fin snap 90 ; modérateur ne peut pas quitter en live, orga oui).
