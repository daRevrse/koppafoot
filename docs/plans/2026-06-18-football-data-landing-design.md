# Design : Home « front football » + données réelles (football-data.org)

**Date :** 2026-06-18
**Statut :** Approuvé

## Contexte

La home devient un **front public façon média football** : compétitions, matchs/résultats, feed public (La Tribune), avec une **promo plateforme légère** dessous. Comme on n'a pas encore de données locales, on alimente le contenu « vrai football » via **football-data.org** (gratuit). Les tournois Koppafoot (créés par les organisateurs) restent le produit, surfacés à part.

## Sécurité / quotas (important)

- **Token secret** dans `.env.local` (gitignoré) : `FOOTBALL_DATA_TOKEN`. Jamais committé. `.env.example` documente la clé (sans valeur).
- Header `X-Auth-Token`. Base `https://api.football-data.org/v4`.
- **Quota gratuit ~10 req/min.** Le provider demande explicitement de **lire les headers de réponse** pour s'auto-throttler : `X-RequestsAvailable` (requêtes restantes) et `X-RequestCounter-Reset` (secondes avant reset). Le wrapper les lit, log, et **s'abstient** si `X-RequestsAvailable` ≤ 0.
- **Cache ISR agressif** (`next: { revalidate }`) → la grande majorité des rendus servent du cache, pas l'API. ~2 appels par régénération max (matchs + compétitions).
- **Dégradation gracieuse** : pas de token / quota dépassé / erreur → la fn renvoie `[]`/`null`, la section « réelle » se masque, la home tient sur le contenu Koppafoot + la promo.

## Lib serveur `src/lib/football-data.ts`

- `fdFetch<T>(path, revalidate)` : ajoute le header, `next:{revalidate}`, lit/loggue `X-RequestsAvailable`/`X-RequestCounter-Reset`, renvoie `null` si pas de token / `!res.ok` / quota épuisé. Typé (pas de `any`).
- `getTodayFootball()` → `/matches` (jour), normalisé en `{ live[], finished[], upcoming[] }` (id, compétition+emblem, équipes+crest, score, statut, heure). `revalidate` ~60 s.
- `getFeaturedCompetitions()` → `/competitions`, filtré à une liste curated (CL, PL, FL1, BL1, SA, PD) → `{ id, code, name, emblem, area }`. `revalidate` ~1 jour.
- *(option plus tard : `getStandings(code)` — gardé pour économiser le quota au lancement.)*

+ `getRecentPublicPosts(limit)` (Firestore `posts`, déjà public, via firebase-admin) pour l'aperçu du feed.

## Structure de la home (Server Component, ISR)
```
LandingNav (allégée)
Hero            ← compétition Koppafoot à la une si active, sinon hero de marque  [HeroSpotlight existant]
Scores du jour  ← NEW (réel) : live ⚽ + derniers résultats + prochains (football-data)
Compétitions    ← phares réelles (football-data) + "Nos tournois Koppafoot" → /competitions
La Tribune      ← NEW : aperçu des derniers posts publics → /feed
Koppafoot c'est aussi…  ← promo plateforme LÉGÈRE (profils/équipes/mercato) → signup
CTA + Footer
```
Les grosses sections Rôles/Fonctionnalités/Stats sont retirées de la home (fichiers conservés) au profit d'une bande de promo condensée.

## Lots
1. **Lib** : `football-data.ts` (fdFetch + getTodayFootball + getFeaturedCompetitions) + `getRecentPublicPosts` ; `.env.example` documenté.
2. **Sections + page** : `TodayFootball`, `FeaturedFootballCompetitions`, `TribunePreview`, promo légère ; nouvel ordre dans `page.tsx`.

## Vérif
Pas de test runner → `npm run build` exit 0 + `npm run lint` (zéro nouvelle erreur) + manuel (home affiche les scores réels du jour avec le token ; sans token, dégradation propre).
