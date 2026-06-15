# Design : Gestion de compétition & score en direct (Miabé CAN)

**Date :** 2026-06-15
**Statut :** Approuvé

## Contexte

Une compétition « Miabé CAN » débute dans ~1 mois (coup d'envoi mi-juillet 2026). On veut proposer à l'organisation une fonctionnalité de **score en direct**, et plus largement une **gestion de compétition** (poules + phase finale).

**Objectif business — c'est un produit d'appel.** La CAN n'est pas une fin en soi : elle sert à faire entrer du trafic en haut de l'entonnoir (page live publique, partageable), puis à router les visiteurs vers les features cœur de Koppafoot. **North star = Managers → Clubs** : un manager converti ramène son effectif → les joueurs alimentent le mercato → d'autres managers recrutent (effet boule de neige côté offre).

**État de l'existant (réutilisable) :** le moteur live match-par-match existe déjà (console arbitre `referee-panel/matches/[id]/manage`, vue spectateur `matches/[id]/live`, schéma `live_state` avec chrono/périodes/événements, score auto-incrémenté via `addMatchEvent`). Infra de croissance présente : push FCM, campagnes email (Resend), auto-post Tribune (`submitMatchReport`), PWA.

## Décisions de design

| Sujet | Décision |
|---|---|
| Format | Poules + phase finale (élimination directe) |
| Équipes | Entités **propres à la compétition** (pas des clubs Koppafoot), créées par l'orga : nom + logo/drapeau + poule |
| Joueurs | Pas d'effectif géré ; score par équipe + **buteur en texte libre** → classement buteurs approximatif |
| Accès public | Total, sans compte, URL partageable (`/c/[slug]`) |
| Opérateur live | L'organisateur (+ staff) — pas d'arbitre assigné |
| Setup | Orga **autonome** de A à Z dans son propre espace |
| Rôle | Nouveau rôle `organizer`, promu par superadmin, staff via `organizer_ids[]` |
| Données | Collection **dédiée** `competitions/**` (pas de réutilisation de `matches`) |
| Classement | **Calculé côté client** depuis les matchs (YAGNI) ; bracket = structure stockée |
| Hook conversion central | « Revendique ton équipe → club pré-rempli » → **V2** ; MVP = CTA managers génériques |

---

## 1. Architecture

```
Espace ORGANISATEUR (privé, rôle organizer)        PUBLIC (sans compte)
┌─────────────────────────────────┐        ┌──────────────────────────────┐
│ (organizer)/competitions/...     │ écrit  │  /c/[slug]                   │
│  • CRUD compétition / équipes    │───────▶│   Accueil · Calendrier ·     │
│  • Tirage poules + calendrier    │        │   Classement · Bracket ·     │
│  • Console live (chrono/buts)    │        │   Buteurs · Page équipe ·    │
└─────────────────────────────────┘        │   Vue match live (temps réel)│
            │ Firestore                      └──────────────┬───────────────┘
            ▼                                  onSnapshot (lecture publique)
   competitions/{cid}                                       │
     ├─ comp_teams/{tid}                                    ▼
     └─ comp_matches/{mid}  (live_state réutilisé) ◀── CTA conversion → signup
```

- Collection dédiée → règles `read: if true` limitées à `competitions/**` (aucune fuite des matchs de clubs privés). Écriture si `uid in organizer_ids`.
- Routes publiques **hors du groupe `(app)`** → pas de mur de login. Le live reste temps réel via `onSnapshot` (fonctionne sans auth grâce aux règles).
- On **réutilise le schéma `live_state`** et on **copie/adapte** la vue live existante.

---

## 2. Modèle de données

Conventions du repo : Firestore en `snake_case`, types domaine en `camelCase` avec converters `toX()`. Miroir camelCase à créer comme `FirestoreMatch`/`Match`.

### `competitions/{cid}`
```
name              "Miabé CAN 2026"
slug              "miabe-can"          // unique → URL /c/miabe-can
logo_url, banner_url
organizer_ids[]   // comptes autorisés (staff)
created_by        // uid créateur
status            draft | registration | group_stage | knockout | completed
format {
  group_count          4
  teams_per_group      4
  qualifiers_per_group 2
  has_third_place      true
  points: { win 3, draw 1, loss 0 }
}
start_date, end_date, venue_city
created_at, updated_at
```

### `competitions/{cid}/comp_teams/{tid}`
```
name, short_name, logo_url, color
group             "A".."D" | null
claimed_by_manager_id, claimed_by_team_id   // V2, posés mais inutilisés en MVP
created_at, updated_at
```
> Pas de stats stockées : classement calculé côté client. Champs `claimed_by_*` prévus pour brancher la revendication V2 sans migration.

### `competitions/{cid}/comp_matches/{mid}`
```
competition_id
stage          group | knockout
group          "A" | null
round          round_of_16 | quarter | semi | final | third_place | null
bracket_slot   // position dans le tableau
home_team_id, away_team_id          // réf comp_team ; null = slot indéterminé
home_team_name, away_team_name      // dénormalisés (snapshot)
home_team_logo, away_team_logo
date, time, venue_name, venue_city
status         scheduled | live | completed | cancelled
score_home, score_away
penalty_home, penalty_away          // tirs au but (knockout)
winner_team_id
feeds_into_match_id, feeds_into_slot  // propagation bracket (home|away)
live_state { … }                    // MÊME shape que FirestoreMatch.live_state
created_at, updated_at
```
> Événements `live_state.events` réutilisés : un but porte `player_name` (texte libre) + `team_id` (comp_team), sans `player_id`. Score incrémenté comme `addMatchEvent`. Pas de remplacements. Propagation bracket à la fin du match (côté console), pas de Cloud Function.

### Rôle `organizer`
- Ajout à `UserRole` + `ROLE_REDIRECTS` (`/organizer`), `ROLE_LABELS` (« Organisateur »), couleurs/nav.
- Nouveau groupe de routes `(organizer)` (layout + sidebar calqués sur `(venue-owner)`).
- Promotion : étendre `/api/admin/promote` (et/ou le script) pour cibler un rôle.

### Règles Firestore (ajout)
```js
function isOrganizerOf(cid) {
  let p = /databases/$(database)/documents/competitions/$(cid);
  return isAuthenticated() && exists(p) && request.auth.uid in get(p).data.organizer_ids;
}
match /competitions/{cid} {
  allow read: if true;
  allow create: if isRole('organizer') && request.auth.uid in request.resource.data.organizer_ids;
  allow update, delete: if isOrganizerOf(cid) || isSuperAdmin();
  match /comp_teams/{tid}   { allow read: if true; allow write: if isOrganizerOf(cid) || isSuperAdmin(); }
  match /comp_matches/{mid} { allow read: if true; allow write: if isOrganizerOf(cid) || isSuperAdmin(); }
}
```
> Index composites à ajouter dans `firestore.indexes.json` (ex. `comp_matches` where `status==live` orderBy `date` ; where `group==…`).

---

## 3. Espace organisateur

### Carte des écrans
```
/organizer                              → Mes compétitions
/organizer/competitions/new             → Création
/organizer/competitions/[cid]           → Tableau de bord compétition
        ├─ /teams                        → CRUD équipes
        ├─ /groups                       → Tirage poules
        ├─ /schedule                     → Calendrier matchs de poule
        ├─ /knockout                     → Phase finale (bracket)
        └─ /matches/[mid]/live           → Console live simplifiée
```

### Flux clés
**Tirage poules** — drag manuel dans Poule A/B/C/D **ou** bouton « Tirage aléatoire ». Garde-fou : passage en `group_stage` bloqué tant que les poules ne sont pas complètes.

**Génération calendrier** — bouton « Générer les matchs de poule » → round-robin simple par poule (méthode du cercle ; 4 équipes → 6 matchs / 3 journées). L'orga date ensuite chaque match.

**Phase finale** — bouton « Générer la phase finale » → lit le classement et place les qualifiés (1A–2B, …). Seeding auto **best-effort + éditable manuellement** (robustesse pour nombres non-standard). Crée les `comp_matches` knockout avec `feeds_into_*`.

### Console live simplifiée
Réutilise chrono/périodes/écriture `live_state`, **sans** grille joueurs / participations / verrou compo :
- Chrono start/pause + passage de périodes.
- 2 gros boutons « +1 BUT » (dom/ext) → modale « Buteur (optionnel) » texte libre → événement but + score.
- Cartons jaune/rouge optionnels.
- « Siffler la fin » → `completed` ; si knockout & égalité → saisie tirs au but → `winner_team_id` → **propagation** dans le slot suivant.
- Nouvelles fonctions dans `lib/competition-firestore.ts` (équivalents `initLiveMatch`/`addMatchEvent`/… pointés sur `comp_matches`). On ne touche pas au moteur des clubs.

---

## 4. Pages publiques (`/c/[slug]`)

```
/c/[slug]                  → Accueil (live du jour + résultats + accès rapides)
/c/[slug]/calendar         → Calendrier par journée
/c/[slug]/standings        → Classement des poules (calcul client)
/c/[slug]/bracket          → Tableau phase finale (réactif)
/c/[slug]/scorers          → Classement buteurs (agrégat texte libre)
/c/[slug]/teams/[tid]      → Page équipe (landing partageable)
/c/[slug]/matches/[mid]    → Vue match (live temps réel ou rapport)
```
> Alias vanity optionnel `/can`.

**Classement** : un tableau par poule, tri points → diff → BP → confrontation directe ; qualifiés surlignés.
**Bracket** : arbre quarts → demis → finale (+ petite finale), slots vides jusqu'à détermination, vainqueurs qui montent en direct.
**Vue match** : copie de la vue live existante + boutons partage + OG dynamique.

### Rendu
- **Live = client `onSnapshot`** (fonctionne sans connexion via règles publiques).
- **Coquille statique + SEO + OG images = Server Components + `firebase-admin`**. `opengraph-image.tsx` par match (score live en image) → aperçus riches WhatsApp. Nouveau pattern → fallback image statique si génération échoue.
- Mobile-first, images lazy, poids minimal.

---

## 5. Surfaces de conversion (le tunnel)

### A. Acquisition (viralité)
- Bouton **Partager WhatsApp** (`wa.me/?text=…`) sur match / but / classement / page équipe.
- **OG images dynamiques** (score live) → CTR élevé dans WhatsApp.
- Micro-CTA « Partage le but ⚽ » après un but.

### B. Activation (anonyme → compte, par sur-valeur)
- 🔔 **« Notif à chaque but de [équipe] »** → mini-signup express → capture token push. **Pont n°1.** Réutilise `fcm-client.ts` + `/api/notifications/push` + `useNotifications`. À chaque but loggé, la console pousse une notif aux followers de l'équipe.
- Buteurs : « C'est toi ? Crée ton profil joueur » (MVP générique → V2 liaison).

### C. Routage → features cœur (priorité managers)
- **CTA manager récurrent** : « Tu gères une équipe ? Crée ton club » → signup manager → création de club.
- **« Inscris ton équipe à la prochaine édition »** (accueil + page équipe) → waitlist + signup manager.
- Onboarding segmenté : rôle **Manager/Coach mis en avant** quand l'inscription vient de la CAN.

### D. Rétention (réutilise l'existant)
- **Auto-post Tribune** de chaque résultat (comme `submitMatchReport`).
- **Push FCM** : « match dans 1h », « mi-temps », « résultat final ».
- **Campagnes email** (Resend + `/admin/campaigns`) ciblées managers.

### E. Mesure
- Champ `signup_source: "competition:<slug>"` à l'inscription via la CAN → mesure des comptes/managers/clubs issus du tournoi.

### MVP vs V2
- **MVP** : partage WhatsApp + OG · hook notif-but · CTA managers + « prochaine édition » · auto-post Tribune · `signup_source`.
- **V2** : revendication d'équipe pré-remplie (héritage ghost players) · liaison buteurs↔profils · campagnes email auto-segmentées · push reminders automatisés (cron).

> Principe directeur : **le live reste gratuit et ouvert** ; on convertit par la notif, l'identité et la participation — jamais par un blocage.

---

## 6. Séquencement & risques (~4 semaines)

| Phase | Contenu | Livrable | Sem. |
|---|---|---|---|
| **0 — Fondations** | Rôle `organizer` · types + `lib/competition-firestore.ts` · règles + index · création compét. + CRUD équipes | L'orga crée la CAN et ses équipes | S1 |
| **1 — Le live ⚠️ CRITIQUE** | Tirage · calendrier · **console live** · **vue match publique** | Un match en direct, public. Minimum vendable. | S1-2 |
| **2 — Hub public** | Accueil · calendrier · classement · bracket + génération + propagation · page équipe · buteurs | Hub complet | S2-3 |
| **3 — Tunnel conversion** | Partage WhatsApp + OG · notif-but · CTA managers + « prochaine édition » · `signup_source` · auto-post | Growth actif | S3-4 |
| **4 — Rodage** | Répétition générale (match live mobile, coupure réseau) · perf · buffer | Confiance jour J | S4 |

**Si le temps manque** : Phases 0-1 non-négociables. Phase 2 importante. Phase 3 allégeable (partage + OG + auto-post suffisent). Revendication & email auto = V2.

### Pièges techniques
1. **Live increvable jour J** : état serveur (`live_state`) = source de vérité ; tester refresh + coupure réseau en plein match ; verrou léger « 1 seul opérateur ».
2. **Chrono = horloge serveur** (`timer_start_at` + offset), jamais locale.
3. **Lecture publique sans auth** : vérifier `onSnapshot` pour visiteur non connecté.
4. **OG dynamiques** (Server Components + admin SDK) : marge + fallback statique.
5. **Index Firestore composites** créés tôt.
6. **Propagation bracket idempotente** (n'écrire que si le slot change).
7. **Coût Firestore le jour de la finale** (pic spectateurs × onSnapshot) — surveiller ; mitigation possible (doc « live » agrégé / fallback polling).
8. **Dates/fuseau** : stocker ISO, afficher local.

---

## Fichiers impactés (vue d'ensemble)

| Fichier | Action |
|---|---|
| `src/types/index.ts` | + `FirestoreCompetition/CompTeam/CompMatch` + miroirs camelCase ; `"organizer"` dans `UserRole`, `ROLE_REDIRECTS`, `ROLE_LABELS` |
| `src/lib/competition-firestore.ts` | Nouveau — CRUD + converters + live (init/timer/event/period/finish) + propagation bracket + agrégats (classement/buteurs) |
| `src/config/navigation.ts` | + nav organisateur (groupée, flat, bottom, titres, couleurs) |
| `firestore.rules` | + `isOrganizerOf` + bloc `competitions/**` |
| `firestore.indexes.json` | + index composites `comp_matches` |
| `src/app/api/admin/promote/route.ts` | Promotion ciblée par rôle (organizer) |
| `src/app/(organizer)/layout.tsx` + sidebar | Nouveau — espace organisateur |
| `src/app/(organizer)/organizer/**` | Nouveau — compétitions, équipes, poules, calendrier, knockout, console live |
| `src/app/c/[slug]/**` | Nouveau — pages publiques (accueil, calendrier, classement, bracket, buteurs, équipe, match) + `opengraph-image.tsx` |
| `src/components/competition/**` | Nouveau — composants partagés (scoreboard, bracket, tableau classement, boutons partage, hooks conversion) |
| `src/lib/firestore.ts` | Réutilisation auto-post Tribune pour résultats CAN |

---

## Suite

Plan d'implémentation détaillé → skill `writing-plans`.
