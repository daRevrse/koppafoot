# Design : Découverte publique des compétitions + refonte landing

**Date :** 2026-06-17
**Statut :** Approuvé

## Contexte

Les pages publiques d'une compétition existent (`/c/[slug]/**`), mais on ne peut y accéder qu'avec le lien direct : **aucun moyen pour le public de découvrir/parcourir les compétitions**, et aucune fonction pour lister publiquement les compétitions. La landing (`/`) est aujourd'hui 100 % marketing/acquisition (Hero « Le foot amateur en mieux » → signup) et ne montre aucune compétition.

Objectif : **faciliter la découverte des compétitions par le public** et **remodeler la landing** pour mettre les compétitions/le live en avant — tout en préservant le tunnel d'acquisition (north star **managers → clubs**).

## Décisions de design

| Sujet | Décision |
|---|---|
| Ampleur landing | **Refonte orientée compétitions** (nouveau hero live-forward, sections réordonnées) |
| Acquisition | **Double tunnel** : compétitions en haut, sections d'acquisition gardées dessous |
| Découverte | **Page annuaire dédiée `/competitions`** + teaser « à la une » sur la landing |
| Hero | **Spotlight** sur la compétition à la une, avec replis propres (live → prochain match → pitch) |
| Rendu | **Approche A — rendu serveur** (`firebase-admin`) pour SEO + perf ; temps réel exact sur la page match |
| Visibilité | Compétition publique dès que `status != "draft"` (pas de nouveau champ ; `draft` = brouillon caché) |
| « À la une » | Heuristique statut + récence : en cours (`group_stage`/`knockout`) > à venir (`registration`) > terminée récente |

---

## 1. Couche données (serveur)

Module **server-only** `src/lib/competition-admin.ts` (utilise `adminDb` ; **jamais importé côté client**).

```
getPublicCompetitions(): Promise<Competition[]>
  → adminDb lit toutes les compétitions, filtre status != "draft" en mémoire,
    trie par pertinence (en cours > à venir > terminée), puis start_date/created_at desc.

getFeaturedCompetition(): Promise<{ competition: Competition; highlightMatch: CompMatch | null } | null>
  → 1re de getPublicCompetitions ; pour cette compét', cherche son "match vedette" :
    live (status==live, limit 1) sinon prochain programmé (status==scheduled, date!=null,
    orderBy date asc, limit 1). null si aucune compétition publique.
```

- **Converters partagés** : extraire `toCompetition`/`toCompMatch`/`formatDate` (fonctions pures) dans `src/lib/competition-mappers.ts`, importé par `competition-firestore.ts` (client) ET `competition-admin.ts` (serveur). Évite d'embarquer le SDK web dans le bundle serveur et la duplication. `formatDate` gère déjà les Timestamps admin (`.toDate()`/`.seconds`).
- **Règles Firestore** : inchangées (l'admin SDK contourne les règles ; les pages `/c` restent en lecture client `read: if true`). Rien à redéployer.
- **Coût/fraîcheur** : `export const revalidate = 60` sur l'annuaire et la landing → 1-2 lectures serveur cachées, pas de listeners. Badge « live » jusqu'à ~1 min de retard ; le lien renvoie au temps réel exact.

---

## 2. Page annuaire `/competitions`

`src/app/competitions/page.tsx` — top-level public (hors `(app)`, comme `/c`), **Server Component**, `revalidate = 60`, métadonnées SEO (`title: "Compétitions — Koppafoot"` + description).

**Chrome** : bandeau public léger (logo → `/`, CTA « Rejoindre ») — pas la `LandingNav` (liens ancres). Style cohérent avec `/c`.

**Structure** :
```
[ Header public léger ]
[ Hero strip : "Compétitions" + nb total + champ recherche (île client) ]
[ Section "En cours"  → grille de cartes ]   (group_stage | knockout)
[ Section "À venir"   → grille de cartes ]   (registration)
[ Section "Terminées" → grille de cartes ]   (completed)
```
- Regroupement par statut = découverte sans pills ; tout en HTML serveur → SEO.
- Recherche = petite île client qui filtre la liste rendue (nom + ville). Progressive enhancement (contenu complet sans JS).
- **Carte** (réutilise le style `/c`) : bannière/logo, nom, badge statut (🟢 En cours / 🔵 À venir / ⚪ Terminée), dates, ville → `/c/[slug]`.
- **États** : aucune compétition → état vide + CTA signup ; section sans entrée → masquée.

---

## 3. Refonte landing

`src/app/page.tsx` devient un **Server Component `async`**, `revalidate = 60` :
```
LandingNav            (+ lien "Compétitions" → /competitions, desktop & mobile)
HeroSpotlight   ★NEW
CompetitionsTeaser ★NEW
RolesSection          (gardé)
FeaturesSection       (gardé)
StatsSection          (gardé)
CTASection            (gardé)
LandingFooter         (gardé)
```
- `FanSection` retirée (redondante avec le contenu compétitions réel au-dessus).
- **Flux data** : `page.tsx` fait `Promise.all([getFeaturedCompetition(), getPublicCompetitions()])` → props vers `HeroSpotlight`/`CompetitionsTeaser` (composants `"use client"` pour les animations `motion`, mais **sans fetch client** — données reçues en props).

**HeroSpotlight** — fond = bannière compétition (repli image stade). Carte spotlight glassy :
- logo + nom + badge statut ;
- match vedette : **live** → mini-scoreboard + pulse « EN DIRECT » → CTA « Suivre le direct » (`/c/[slug]/matches/[mid]`) ; sinon **prochain match** → équipes + date/heure → CTA « Voir la compétition » ; sinon → CTA « Voir la compétition » ;
- CTA secondaire « Rejoindre Koppafoot » → `/signup` ;
- **repli si aucune compétition publique / erreur fetch** → hero de marque actuel (« Le foot amateur en mieux » + signup). Zéro page cassée.

**CompetitionsTeaser** — 1-3 cartes + « Voir toutes les compétitions → ». Si la seule compétition est déjà dans le hero → se réduit à une bande CTA vers `/competitions` (pas de doublon).

---

## Fichiers impactés (vue d'ensemble)

| Fichier | Action |
|---|---|
| `src/lib/competition-mappers.ts` | Nouveau — converters purs extraits (`toCompetition`/`toCompTeam`/`toCompMatch`/`formatDate`) |
| `src/lib/competition-firestore.ts` | Réimporter les converters depuis `competition-mappers` (refactor, pas de changement de comportement) |
| `src/lib/competition-admin.ts` | Nouveau — `getPublicCompetitions`, `getFeaturedCompetition` (admin SDK) |
| `src/app/competitions/page.tsx` | Nouveau — annuaire public (Server Component, SEO, revalidate) |
| `src/components/competition/CompetitionDirectory*.tsx` | Nouveau — carte + île recherche client |
| `src/app/page.tsx` | Server Component async ; nouvel ordre des sections ; fetch + props |
| `src/components/landing/HeroSpotlight.tsx` | Nouveau — hero spotlight (client, props serveur) + repli marque |
| `src/components/landing/CompetitionsTeaser.tsx` | Nouveau — teaser « à la une » |
| `src/components/landing/LandingNav.tsx` | + lien « Compétitions » (desktop & mobile) |
| `src/components/landing/FanSection.tsx` | Retirée de la composition (fichier conservé, non importé) |

---

## Suite

Plan d'implémentation détaillé → skill `writing-plans`.
