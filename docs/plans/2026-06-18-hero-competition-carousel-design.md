# Design : Hero compétition fusionné (carrousel)

**Date :** 2026-06-18
**Statut :** Approuvé

## Contexte

Fusionner le Hero + la section matchs/résultats en **un bloc carrousel** centré sur une compétition à la fois (d'après le wireframe utilisateur) : gauche = bannière + carte « VS » du match à la une ; droite = liste résultats/à venir + CTA. Le carrousel défile **les compétitions Koppafoot**, plus **un slide « mosaïque »** des grandes compétitions réelles (football-data).

## Données (serveur, ISR, dégradation gracieuse)

- `getHeroCompetitions(maxComps=5)` dans `competition-admin.ts` (admin SDK) → `CompetitionHeroSlide[]`, un par compétition publique :
  ```
  { competition: Competition; featured: CompMatch | null; results: CompMatch[]; upcoming: CompMatch[] }
  ```
  Implémentation : **1 lecture par compétition** (`comp_matches.get()`), dérivation en mémoire — featured = live > prochain programmé ; results = completed récents (≤5) ; upcoming = scheduled datés, soonest (≤5). try/catch → `[]`.
- `getFeaturedCompetitions()` (football-data) + `getTodayFootball()` → slide mosaïque (déjà existants).

## Composant `CompetitionHeroCarousel` (client, props serveur)

- **Slides 1..N (compétitions Koppafoot)** : gauche = bannière (`<img>`) + carte VS (match à la une : crest/lettre, score ou « VS », statut live) ; droite haut = Résultats + à venir (compacts, liens vers `/c/[slug]/matches/[mid]`) ; droite bas = CTA **« Suivre »** → `/c/[slug]`.
- **Slide final (mosaïque foot réel)** : grille des emblèmes des grandes compétitions (football-data) à gauche ; scores du jour réels compacts à droite ; CTA « Tous les scores ».
- Flèches `‹ ›` + swipe mobile + dots ; autoplay léger (pause au survol). Données plates (Competition/CompMatch/FootballCompetition/FootballMatch) → props sûres.

## Intégration `page.tsx`

Le carrousel **remplace** `HeroSpotlight` ET `TodayFootball` ET `FeaturedFootballCompetitions` en haut (fusion). Ordre :
```
LandingNav
CompetitionHeroCarousel   ← NEW (remplace HeroSpotlight + TodayFootball + FeaturedFootballCompetitions)
CompetitionsTeaser        ← "Nos tournois Koppafoot" → /competitions
TribunePreview
PlatformPromo
CTASection + LandingFooter
```

## Replis
- Aucune compétition Koppafoot publique → carrousel démarre sur la mosaïque (ou slide de marque).
- Pas de football-data → pas de slide mosaïque.
- Toujours un slide à l'écran.

## Lots
1. **Lib** : `getHeroCompetitions()` (+ type `CompetitionHeroSlide`) dans `competition-admin.ts`.
2. **Carrousel** : `CompetitionHeroCarousel` + intégration `page.tsx` (retire HeroSpotlight/TodayFootball/FeaturedFootballCompetitions du flux ; fichiers conservés).

## Vérif
`npm run build` exit 0 + lint (zéro nouvelle erreur) + manuel (carrousel défile compét → VS + résultats/à venir corrects ; slide mosaïque réel ; swipe mobile ; replis sans data).
