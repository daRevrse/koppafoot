# Training Schedule (Phase D) — Design Document
Date: 2026-04-24

## Concept

Le manager configure des créneaux d'entraînement récurrents (hebdomadaires) par équipe. Chaque équipe a son propre planning. Dans le calendrier, tous les créneaux de toutes les équipes du manager sont agrégés et affichés avec l'équipe source. Les créneaux sont générés côté client à la volée — pas de documents Firestore supplémentaires.

---

## Section 1 — Types (`types/index.ts`)

```typescript
export interface TrainingScheduleSlot {
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=dimanche, 1=lundi...6=samedi
  time: string;     // "19:00"
  location: string;
  label?: string;   // "Tactique", "Physique", etc.
}
```

Ajouts dans :
- `FirestoreTeam` : `training_schedule?: TrainingScheduleSlot[]`
- `Team` : `trainingSchedule?: TrainingScheduleSlot[]`

---

## Section 2 — Configuration dans `teams/[id]/page.tsx`

Onglet **Paramètres** — nouvelle section "Planning d'entraînement" :
- Liste des créneaux existants (jour, heure, lieu, label) avec bouton supprimer
- Formulaire inline "Ajouter un créneau" : sélecteur jour (Lun–Dim), input heure, input lieu, input label optionnel
- Sauvegarde via `updateTeam(teamId, { training_schedule: [...] })`

Chaque équipe gère son propre `training_schedule` depuis sa page dédiée.

---

## Section 3 — Calendrier (`calendar/page.tsx`)

**Approche :** génération côté client, calcul à l'affichage.

**Chargement :** `getTeamsByManager` retourne déjà les équipes avec `trainingSchedule` (après mise à jour du converter `toTeam`).

**Génération des occurrences du mois :**
```typescript
type TrainingEvent = {
  date: string;       // "YYYY-MM-DD"
  teamName: string;
  teamId: string;
  time: string;
  location: string;
  label?: string;
};

function generateTrainingEvents(teams: Team[], year: number, month: number): TrainingEvent[]
// Pour chaque équipe → pour chaque slot → pour chaque jour du mois
// Si new Date(year, month, day).getDay() === slot.day → ajouter l'occurrence
```

**Affichage calendrier :**
- Dot violet `bg-violet-400` sur les jours avec entraînement
- Légende : ajout entrée "Entraînement" avec dot violet

**Panneau latéral (jour sélectionné) :**
- Créneaux d'entraînement mélangés aux matchs, triés par heure
- Card violet avec 🏋️, nom de l'équipe, heure, lieu, label optionnel
- Pas de dot sur les cards entraînement (pas de statut)
