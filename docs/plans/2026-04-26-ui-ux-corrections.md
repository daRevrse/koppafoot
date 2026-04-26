# UI/UX Corrections & System Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corriger 6 problèmes UI/UX et système identifiés : loading screens, grids, logos d'équipes, page 404, ajout de joueurs (bug Firestore), et liens vers profils publics.

**Architecture:** Fixes localisés sans refactoring global — chaque tâche touche 1-2 fichiers max. La racine du bug "ajout joueur" est une règle Firestore manquante pour la sous-collection `ghost_players` (non couverte par la règle parent `teams`). Le bug training create est secondaire.

**Tech Stack:** Next.js App Router, Firebase/Firestore, Tailwind CSS, TypeScript, Framer Motion

---

## Task 1 — Firestore rules : sous-collection `ghost_players` (BUG CRITIQUE)

**Root cause :** `firestore.rules` n'a aucune règle pour `teams/{teamId}/ghost_players/{ghostId}`. En Firestore, les règles du document parent ne couvrent PAS les sous-collections. Résultat : tout read/write sur ghost_players est refusé → erreur `permission-denied` dans le listener + ajout de joueur impossible.

**Files:**
- Modify: `firestore.rules:207-222` (juste avant la fermeture de `match /databases/...`)

**Step 1 — Ajouter la règle manquante**

Dans `firestore.rules`, avant la dernière `}` qui ferme `match /databases/{database}/documents`, ajouter :

```
    match /teams/{teamId}/ghost_players/{ghostId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() &&
        get(/databases/$(database)/documents/teams/$(teamId)).data.manager_id == request.auth.uid;
      allow update, delete: if isAuthenticated() &&
        get(/databases/$(database)/documents/teams/$(teamId)).data.manager_id == request.auth.uid;
    }
```

**Step 2 — Corriger la règle training create/delete (bug secondaire)**

La règle actuelle `allow create, delete: if isAuthenticated() && resource.data.manager_id == ...` utilise `resource` pour `create`, mais `resource` n'existe pas à la création. Séparer en deux règles :

Remplacer dans `firestore.rules` :
```
    match /trainings/{trainingId} {
      allow read: if isAuthenticated();
      allow create, delete: if isAuthenticated() && resource.data.manager_id == request.auth.uid;
      allow update: if isAuthenticated() && (resource.data.manager_id == request.auth.uid || request.resource.data.diff(resource.data).affectedKeys().hasOnly(['attendees', 'updated_at']));
    }
```
Par :
```
    match /trainings/{trainingId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && request.resource.data.manager_id == request.auth.uid;
      allow delete: if isAuthenticated() && resource.data.manager_id == request.auth.uid;
      allow update: if isAuthenticated() && (resource.data.manager_id == request.auth.uid || request.resource.data.diff(resource.data).affectedKeys().hasOnly(['attendees', 'updated_at']));
    }
```

**Step 3 — Déployer les règles Firestore**

```bash
firebase deploy --only firestore:rules
```
Expected output : `✔  firestore: released rules firestore.rules`

**Step 4 — Commit**

```bash
git add firestore.rules
git commit -m "fix(firestore): add ghost_players subcollection rules and fix training create rule"
```

---

## Task 2 — Logos d'équipes dans la liste `/teams`

**Root cause :** `src/app/(app)/teams/page.tsx:342-344` affiche toujours l'icône Shield, même quand `team.logoUrl` existe.

**Files:**
- Modify: `src/app/(app)/teams/page.tsx:342-344`

**Step 1 — Remplacer le bloc logo**

Remplacer :
```tsx
<div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colors.bg}`}>
  <Shield size={24} className={colors.icon} />
</div>
```
Par :
```tsx
<div className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl ${colors.bg}`}>
  {team.logoUrl
    ? <img src={team.logoUrl} alt={team.name} className="h-full w-full object-cover" />
    : <Shield size={24} className={colors.icon} />}
</div>
```

**Step 2 — Commit**

```bash
git add src/app/(app)/teams/page.tsx
git commit -m "fix(teams): display team logo in list when available"
```

---

## Task 3 — Grid 2 colonnes → 4 colonnes

**Context :** La grille des équipes (`/teams`) est actuellement `sm:grid-cols-2`. L'utilisateur veut 4 éléments par ligne sur grands écrans.

**Files:**
- Modify: `src/app/(app)/teams/page.tsx:322`

**Step 1 — Modifier la classe grid**

Remplacer :
```tsx
<div className="grid gap-4 sm:grid-cols-2">
```
Par :
```tsx
<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
```

**Step 2 — Commit**

```bash
git add src/app/(app)/teams/page.tsx
git commit -m "feat(teams): expand grid to 4 columns on xl screens"
```

---

## Task 4 — Liens vers profils publics dans le roster

**Context :** Les noms des joueurs dans le roster (`/teams/[id]`) sont du texte brut. Les profils publics existent à `/profile/[uid]`.

**Files:**
- Modify: `src/app/(app)/teams/[id]/page.tsx:1222-1226`

**Step 1 — Vérifier l'import Link**

S'assurer que `Link` est importé depuis `"next/link"` en haut du fichier (déjà présent vérifier).

**Step 2 — Wrapper le nom du joueur avec Link**

Remplacer (ligne ~1224) :
```tsx
<h4 className="font-semibold text-gray-900">{member.firstName} {member.lastName}</h4>
```
Par :
```tsx
<Link href={`/profile/${member.uid}`} className="font-semibold text-gray-900 hover:text-primary-600 transition-colors">
  {member.firstName} {member.lastName}
</Link>
```

**Step 3 — Commit**

```bash
git add src/app/(app)/teams/[id]/page.tsx
git commit -m "feat(teams): link player names to public profiles in roster"
```

---

## Task 5 — Page 404 personnalisée

**Context :** Aucun fichier `not-found.tsx` n'existe. Next.js App Router utilise `app/not-found.tsx` comme page 404 globale.

**Files:**
- Create: `src/app/not-found.tsx`

**Step 1 — Créer le fichier**

```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-primary-50">
        <span className="text-5xl">⚽</span>
      </div>
      <h1 className="mt-6 text-6xl font-black text-gray-900 font-display">404</h1>
      <p className="mt-2 text-xl font-semibold text-gray-700">Page introuvable</p>
      <p className="mt-2 text-sm text-gray-400">
        Cette page n&apos;existe pas ou a été déplacée.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
      >
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
```

**Step 2 — Commit**

```bash
git add src/app/not-found.tsx
git commit -m "feat: add custom 404 not-found page"
```

---

## Task 6 — Système de chargement (loading screens)

**Context :** Aucun fichier `loading.tsx` n'existe. Pendant le rendering, l'écran est vide. Next.js App Router utilise `loading.tsx` pour afficher un squelette pendant le chargement des pages.

**Files:**
- Create: `src/app/(app)/loading.tsx`
- Create: `src/app/(app)/teams/loading.tsx`
- Create: `src/app/(app)/teams/[id]/loading.tsx`

**Step 1 — Loading générique pour le groupe `(app)`**

Créer `src/app/(app)/loading.tsx` :

```tsx
export default function AppLoading() {
  return (
    <div className="animate-pulse space-y-6 p-4 sm:p-6">
      <div className="h-8 w-48 rounded-xl bg-gray-200" />
      <div className="h-4 w-64 rounded-lg bg-gray-100" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-48 rounded-2xl bg-gray-200" />
        ))}
      </div>
    </div>
  );
}
```

**Step 2 — Loading spécifique liste teams**

Créer `src/app/(app)/teams/loading.tsx` :

```tsx
export default function TeamsLoading() {
  return (
    <div className="animate-pulse space-y-6 p-4 sm:p-6">
      <div className="h-8 w-40 rounded-xl bg-gray-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="h-1 bg-gray-200" />
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-gray-200" />
                <div className="space-y-2">
                  <div className="h-4 w-32 rounded-lg bg-gray-200" />
                  <div className="h-3 w-20 rounded-lg bg-gray-100" />
                </div>
              </div>
              <div className="h-14 rounded-lg bg-gray-100" />
              <div className="h-9 rounded-lg bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 3 — Loading spécifique page team**

Créer `src/app/(app)/teams/[id]/loading.tsx` :

```tsx
export default function TeamDetailLoading() {
  return (
    <div className="animate-pulse">
      {/* Banner */}
      <div className="h-40 bg-gray-200 sm:h-56" />
      {/* Header info */}
      <div className="relative px-4 pb-4 pt-0 sm:px-6">
        <div className="-mt-10 flex items-end gap-4">
          <div className="h-20 w-20 rounded-2xl border-4 border-white bg-gray-200 sm:h-24 sm:w-24" />
          <div className="mb-2 space-y-2">
            <div className="h-6 w-40 rounded-lg bg-gray-200" />
            <div className="h-4 w-24 rounded-lg bg-gray-100" />
          </div>
        </div>
        {/* Tabs */}
        <div className="mt-4 flex gap-4 border-b border-gray-200 pb-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-20 rounded-t-lg bg-gray-200" />
          ))}
        </div>
        {/* Content */}
        <div className="mt-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 4 — Commit**

```bash
git add src/app/(app)/loading.tsx src/app/(app)/teams/loading.tsx src/app/(app)/teams/[id]/loading.tsx
git commit -m "feat: add skeleton loading screens for app, teams list, and team detail"
```

---

## Ordre d'exécution recommandé

1. **Task 1** en premier (Firestore rules) — bloquant pour l'ajout de joueurs
2. **Task 2** (logos) — dépend de `teams/page.tsx` comme Task 3
3. **Task 3** (grid) — peut être committé avec Task 2 dans le même fichier
4. **Task 4** (profil links)
5. **Task 5** (page 404)
6. **Task 6** (loading screens)

## Validation finale

- [ ] `firebase deploy --only firestore:rules` réussi
- [ ] Ajout d'un ghost player dans une équipe fonctionne (pas d'erreur permission-denied)
- [ ] Le logo de l'équipe s'affiche dans la liste `/teams`
- [ ] La grille est à 4 colonnes sur xl
- [ ] Cliquer sur un nom de joueur dans le roster ouvre `/profile/[uid]`
- [ ] Aller sur une URL inexistante affiche la page 404 custom
- [ ] Naviguer entre pages n'affiche plus d'écran blanc (squelette visible)
