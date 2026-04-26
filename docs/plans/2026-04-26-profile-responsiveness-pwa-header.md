# Profile Responsiveness + PWA Header Safe Area — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corriger la responsivité de la page Profil, filtrer l'affichage par rôle, et ajouter le support safe-area-inset-top dans le header PWA.

**Architecture:** 4 tâches indépendantes sur 3 fichiers principaux — aucune dépendance entre elles. Pas de nouveaux composants : corrections chirurgicales de classes Tailwind et de conditions de rendu existantes.

**Tech Stack:** Next.js App Router, Tailwind CSS, React conditional rendering, CSS env() safe-area-inset

---

## Contexte important

### Header
`src/components/layout/AppHeader.tsx:40` — la balise `<header>` a une **hauteur fixe** `h-14 lg:h-16` et **aucun padding-top**. Le manifest est en mode `standalone` avec `viewportFit: "cover"`, ce qui expose le contenu sous la barre système sur iOS/Android. Le bas est déjà géré (`.pb-safe` dans `globals.css`) mais le haut ne l'est pas.

### Profil propre (`/profile`)
- **Tabs** (ligne 393) : `overflow-x-auto` sur le conteneur MAIS `flex-1` sur les boutons → les tabs ne scrollent pas, ils se compriment. Sur mobile avec 5 tabs (joueur : Info, Palmarès, Posts, Galerie, Carte FUT) l'expérience est mauvaise.
- **Mode lecture, onglet Info** (ligne 411) : Grille `md:grid-cols-3` avec Bio / Coordonnées / Informations physiques affichées **pour tous les rôles**. Un manager voit "Pied fort", "Taille", "Poids" sur son profil — incohérent.
- **Mode édition** (ligne 495) : Même problème — les champs physiques (pied fort, taille, poids, date de naissance) et les sections role-specific apparaissent correctement pour player/referee, mais la section physique complète est montrée même aux managers et venue_owners.

### Profil public (`/profile/[uid]`)
- **Tabs** (ligne 694) : Même bug `flex-1` + **pas de `overflow-x-auto`** sur le conteneur.

---

## Task 1 — PWA Header : safe-area-inset-top

**Files:**
- Modify: `src/app/globals.css` (après le bloc `.pb-safe`, ligne ~153)
- Modify: `src/components/layout/AppHeader.tsx:40`

**Step 1 — Ajouter `.pt-safe` dans globals.css**

Dans `src/app/globals.css`, après la classe `.pb-safe` (ligne 151-153), ajouter :

```css
.pt-safe {
  padding-top: env(safe-area-inset-top, 0px);
}
```

**Step 2 — Modifier le header**

Dans `src/components/layout/AppHeader.tsx`, ligne 40, remplacer :
```tsx
<header className="relative flex h-14 lg:h-16 items-center justify-between border-b-2 border-primary-600 bg-white px-4 lg:px-6">
```
Par :
```tsx
<header className="relative flex min-h-14 lg:min-h-16 items-center justify-between border-b-2 border-primary-600 bg-white px-4 lg:px-6 pt-safe">
```

Changements :
- `h-14` → `min-h-14` (hauteur minimale, s'adapte au safe-area)
- `h-16` → `min-h-16` (idem pour desktop)
- Ajout de `pt-safe` (pousse le contenu sous la barre système)

**Step 3 — Commit**

```bash
git add src/app/globals.css src/components/layout/AppHeader.tsx
git commit -m "fix(pwa): add safe-area-inset-top support to app header"
```

---

## Task 2 — Tabs profil propre : fix overflow scrolling

**Files:**
- Modify: `src/app/(app)/profile/page.tsx:393-406`

**Problème :** Le conteneur a `overflow-x-auto` mais les boutons ont `flex-1`. `flex-1` étire chaque bouton pour remplir l'espace disponible — résultat : pas de scroll, les textes s'écrasent.

**Fix :** Supprimer `flex-1` des boutons, ajouter `shrink-0` pour que chaque bouton garde sa largeur naturelle et que le conteneur scrolle réellement.

**Step 1 — Modifier les tabs**

Dans `src/app/(app)/profile/page.tsx`, remplacer (lignes 394-405) :
```tsx
<div className="mt-6 flex gap-1 rounded-lg bg-gray-100 p-1 overflow-x-auto">
  {tabs.map((t) => (
    <button
      key={t.key}
      onClick={() => setTab(t.key)}
      className={`flex items-center justify-center gap-1.5 flex-1 rounded-md py-2 text-sm font-medium transition-colors whitespace-nowrap px-3 ${
        tab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
      }`}
    >
      <t.icon size={14} />
      {t.label}
    </button>
  ))}
</div>
```
Par :
```tsx
<div className="mt-6 flex gap-1 rounded-lg bg-gray-100 p-1 overflow-x-auto scrollbar-none">
  {tabs.map((t) => (
    <button
      key={t.key}
      onClick={() => setTab(t.key)}
      className={`flex shrink-0 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-colors whitespace-nowrap px-3 ${
        tab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
      }`}
    >
      <t.icon size={14} />
      {t.label}
    </button>
  ))}
</div>
```

Changements : `flex-1` → supprimé, `shrink-0` ajouté.

**Step 2 — Commit**

```bash
git add src/app/(app)/profile/page.tsx
git commit -m "fix(profile): fix tab overflow scrolling on mobile (own profile)"
```

---

## Task 3 — Tabs profil public : fix overflow scrolling

**Files:**
- Modify: `src/app/(app)/profile/[uid]/page.tsx:694-708`

**Même problème + le conteneur n'a pas de `overflow-x-auto`.**

**Step 1 — Modifier les tabs du profil public**

Dans `src/app/(app)/profile/[uid]/page.tsx`, remplacer (lignes 694-708) :
```tsx
<div className="mt-4 flex gap-1 rounded-lg bg-gray-100 p-1">
  {publicTabs.map((t) => (
    <button
      key={t.key}
      onClick={() => setActiveTab(t.key)}
      className={`flex items-center justify-center gap-1.5 flex-1 rounded-md py-2 text-sm font-medium transition-colors whitespace-nowrap px-3 ${
        activeTab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
      }`}
    >
      <t.icon size={14} />
      {t.label}
    </button>
  ))}
</div>
```
Par :
```tsx
<div className="mt-4 flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1 scrollbar-none">
  {publicTabs.map((t) => (
    <button
      key={t.key}
      onClick={() => setActiveTab(t.key)}
      className={`flex shrink-0 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-colors whitespace-nowrap px-3 ${
        activeTab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
      }`}
    >
      <t.icon size={14} />
      {t.label}
    </button>
  ))}
</div>
```

Changements : ajout de `overflow-x-auto scrollbar-none`, `flex-1` → supprimé, `shrink-0` ajouté.

**Step 2 — Commit**

```bash
git add src/app/(app)/profile/[uid]/page.tsx
git commit -m "fix(profile): fix tab overflow scrolling on mobile (public profile)"
```

---

## Task 4 — Profil propre : affichage conditionnel par rôle

**Files:**
- Modify: `src/app/(app)/profile/page.tsx` (mode lecture et mode édition)

### Sous-tâche A — Mode lecture : cacher les infos physiques pour les non-joueurs/arbitres

**Problème :** Le bloc "Informations physiques" (pied fort, taille, poids, âge) est affiché pour TOUS les rôles dans le mode lecture.

Dans `src/app/(app)/profile/page.tsx`, le bloc "Informations physiques" en mode lecture est à la ligne ~428. Il ressemble à :
```tsx
{/* Physical Info Card */}
<div className="rounded-lg border border-gray-200 bg-white p-5 md:col-span-3">
  <h3 className="mb-3 text-sm font-semibold text-gray-900 flex items-center gap-2">
    <Ruler size={16} className="text-emerald-600" />
    Informations physiques
  </h3>
  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
    ...
  </div>
</div>
```

Wrapper ce bloc avec une condition de rôle :
```tsx
{/* Physical Info Card — players and referees only */}
{(user.userType === "player" || user.userType === "referee") && (
  <div className="rounded-lg border border-gray-200 bg-white p-5 md:col-span-3">
    <h3 className="mb-3 text-sm font-semibold text-gray-900 flex items-center gap-2">
      <Ruler size={16} className="text-emerald-600" />
      Informations physiques
    </h3>
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      ...
    </div>
  </div>
)}
```

### Sous-tâche B — Mode édition : cacher les champs physiques pour les managers/venue_owners

**Problème :** Le bloc "Informations physiques" dans le formulaire d'édition (pied fort, taille, poids, date de naissance) est visible pour TOUS les rôles.

Dans le formulaire d'édition (autour de la ligne 495), trouver le bloc commenté `{/* Physical info */}` et le wrapper :
```tsx
{/* Physical info — players and referees only */}
{(user.userType === "player" || user.userType === "referee") && (
  <div className="md:col-span-2">
    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
      <Ruler size={16} className="text-emerald-600" /> Informations physiques
    </div>
    {/* ... all the physical fields (strongFoot, height, weight, DOB) ... */}
  </div>
)}
```

**Important :** Les champs `position`/`skillLevel` (player-only) et `licenseNumber`/`licenseLevel`/`experienceYears` (referee-only) sont déjà correctement conditionnels — ne pas les toucher.

**Step 1 — Lire les lignes exactes**

Lire `src/app/(app)/profile/page.tsx` autour des lignes 425-465 (mode lecture) et 493-572 (mode édition) pour identifier les blocs exacts.

**Step 2 — Appliquer les deux wrappers**

**Step 3 — Commit**

```bash
git add src/app/(app)/profile/page.tsx
git commit -m "fix(profile): hide physical info for manager and venue_owner roles"
```

---

## Ordre d'exécution

1. Task 1 (PWA header) — fichiers différents, fix rapide
2. Task 2 (tabs propre) — même fichier que Task 4, faire avant
3. Task 3 (tabs public) — fichier séparé
4. Task 4 (role-based display) — même fichier que Task 2, faire après le commit de Task 2

## Validation finale

- [ ] Sur un iPhone en mode PWA standalone : le header ne chevauche plus la barre système
- [ ] Sur mobile (375px) : les tabs scrollent horizontalement sur le profil propre
- [ ] Sur mobile (375px) : les tabs scrollent horizontalement sur le profil public
- [ ] Profil manager en mode lecture : pas de section "Informations physiques"
- [ ] Profil manager en mode édition : pas de champs physiques (pied fort, taille, poids, DOB)
- [ ] Profil joueur : toutes les sections toujours présentes
- [ ] Profil arbitre : informations physiques présentes, champs licence présents
