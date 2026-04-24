# Training Schedule Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permettre au manager de configurer des créneaux d'entraînement récurrents (hebdomadaires) par équipe, affichés dans le calendrier agrégé de toutes ses équipes.

**Architecture:** `TrainingScheduleSlot` stocké dans le champ `training_schedule` du document Firestore `/teams/{teamId}`. Génération des occurrences côté client dans `calendar/page.tsx` à partir des équipes déjà chargées. Configuration depuis l'onglet Paramètres de chaque équipe.

**Tech Stack:** Next.js 16, Firebase/Firestore, TypeScript, Tailwind CSS, motion/react, lucide-react, react-hot-toast

---

## Task 1 : Types + converter (`types/index.ts` + `lib/firestore.ts`)

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/firestore.ts`

### Step 1 : Ajouter `TrainingScheduleSlot` dans `src/types/index.ts`

À la fin du fichier (après la section Ghost Players), ajouter :

```typescript
// ============================================
// Training Schedule
// ============================================

export interface TrainingScheduleSlot {
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=dimanche, 1=lundi...6=samedi
  time: string;      // "19:00"
  location: string;
  label?: string;    // "Tactique", "Physique", etc.
}
```

Dans `FirestoreTeam` (chercher `interface FirestoreTeam`), ajouter avant `created_at` :

```typescript
  training_schedule?: TrainingScheduleSlot[];
```

Dans `Team` (chercher `interface Team`), ajouter avant `createdAt` :

```typescript
  trainingSchedule?: TrainingScheduleSlot[];
```

### Step 2 : Mettre à jour le converter `toTeam` dans `src/lib/firestore.ts`

La fonction `toTeam` (ligne ~82) se termine par :
```typescript
    squadNumbers: d.squad_numbers ?? {},
    createdAt: formatDate(d.created_at), updatedAt: formatDate(d.updated_at),
```

Ajouter `trainingSchedule` avant `createdAt` :
```typescript
    squadNumbers: d.squad_numbers ?? {},
    trainingSchedule: d.training_schedule ?? [],
    createdAt: formatDate(d.created_at), updatedAt: formatDate(d.updated_at),
```

### Step 3 : Vérifier le build

```bash
npm run build
```
Attendu : aucune erreur TypeScript.

### Step 4 : Commit

```bash
git add src/types/index.ts src/lib/firestore.ts
git commit -m "feat(types): add TrainingScheduleSlot type and update Team converter"
```

---

## Task 2 : Section "Planning d'entraînement" dans `teams/[id]/page.tsx`

**Files:**
- Modify: `src/app/(app)/teams/[id]/page.tsx`

L'onglet Paramètres se trouve dans le bloc `{activeTab === "settings" && isTeamManager && ...}` (ligne ~1623). Il faut ajouter une section entre "Statut de recrutement" et "Informations".

### Step 1 : Ajouter `Dumbbell` dans les imports Lucide

Dans la ligne d'import lucide-react (ligne ~8-13), `Dumbbell` est déjà présent. Si non, l'ajouter.

### Step 2 : Ajouter le state pour le formulaire de créneau

Dans la section des state declarations du composant (après les ghost players states), ajouter :

```typescript
// Training schedule
const [scheduleForm, setScheduleForm] = useState({
  day: 1 as TrainingScheduleSlot["day"],
  time: "19:00",
  location: "",
  label: "",
});
const [addingSlot, setAddingSlot] = useState(false);
```

### Step 3 : Ajouter l'import du type

Dans `import type { Team, UserProfile, Match, JoinRequest, Achievement, Training, GhostPlayer } from "@/types"`, ajouter `TrainingScheduleSlot`.

### Step 4 : Ajouter la fonction `handleAddSlot`

Dans la section des handlers (avant le return), ajouter :

```typescript
const handleAddSlot = async () => {
  if (!team || !scheduleForm.location.trim()) return;
  setAddingSlot(true);
  try {
    const newSlot: TrainingScheduleSlot = {
      day: scheduleForm.day,
      time: scheduleForm.time,
      location: scheduleForm.location.trim(),
      ...(scheduleForm.label.trim() ? { label: scheduleForm.label.trim() } : {}),
    };
    const updated = [...(team.trainingSchedule ?? []), newSlot];
    await updateTeam(team.id, { training_schedule: updated });
    setScheduleForm({ day: 1, time: "19:00", location: "", label: "" });
    toast.success("Créneau ajouté");
    await fetchTeam();
  } catch {
    toast.error("Erreur lors de l'ajout");
  } finally {
    setAddingSlot(false);
  }
};

const handleRemoveSlot = async (index: number) => {
  if (!team) return;
  const updated = (team.trainingSchedule ?? []).filter((_, i) => i !== index);
  try {
    await updateTeam(team.id, { training_schedule: updated });
    toast.success("Créneau supprimé");
    await fetchTeam();
  } catch {
    toast.error("Erreur lors de la suppression");
  }
};
```

### Step 5 : Ajouter la section dans l'onglet Paramètres

Dans `{activeTab === "settings" && isTeamManager && ...}`, ajouter après le bloc "Statut de recrutement" et avant le bloc "Informations" :

```typescript
{/* Training schedule */}
<div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
  <div className="flex items-center gap-2">
    <Dumbbell size={16} className="text-violet-500" />
    <h3 className="font-semibold text-gray-900">Planning d&apos;entraînement</h3>
  </div>

  {/* Existing slots */}
  {(team.trainingSchedule ?? []).length === 0 ? (
    <p className="text-sm text-gray-400 italic">Aucun créneau configuré</p>
  ) : (
    <div className="space-y-2">
      {(team.trainingSchedule ?? []).map((slot, i) => (
        <div key={i} className="flex items-center justify-between rounded-lg bg-violet-50 px-3 py-2">
          <div className="text-sm">
            <span className="font-semibold text-violet-900">
              {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"][slot.day]} {slot.time}
            </span>
            <span className="ml-2 text-violet-700">{slot.location}</span>
            {slot.label && <span className="ml-2 text-violet-500 text-xs">· {slot.label}</span>}
          </div>
          <button
            onClick={() => handleRemoveSlot(i)}
            className="ml-3 flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )}

  {/* Add slot form */}
  <div className="space-y-3 border-t border-gray-100 pt-4">
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ajouter un créneau</p>
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="mb-1 block text-xs text-gray-400">Jour</label>
        <select
          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none"
          value={scheduleForm.day}
          onChange={(e) => setScheduleForm({ ...scheduleForm, day: Number(e.target.value) as TrainingScheduleSlot["day"] })}
        >
          <option value={1}>Lundi</option>
          <option value={2}>Mardi</option>
          <option value={3}>Mercredi</option>
          <option value={4}>Jeudi</option>
          <option value={5}>Vendredi</option>
          <option value={6}>Samedi</option>
          <option value={0}>Dimanche</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-400">Heure</label>
        <input
          type="time"
          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none"
          value={scheduleForm.time}
          onChange={(e) => setScheduleForm({ ...scheduleForm, time: e.target.value })}
        />
      </div>
    </div>
    <div>
      <label className="mb-1 block text-xs text-gray-400">Lieu</label>
      <input
        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none"
        placeholder="Stade municipal"
        value={scheduleForm.location}
        onChange={(e) => setScheduleForm({ ...scheduleForm, location: e.target.value })}
      />
    </div>
    <div>
      <label className="mb-1 block text-xs text-gray-400">Label (optionnel)</label>
      <input
        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none"
        placeholder="Tactique, Physique..."
        value={scheduleForm.label}
        onChange={(e) => setScheduleForm({ ...scheduleForm, label: e.target.value })}
      />
    </div>
    <button
      onClick={handleAddSlot}
      disabled={addingSlot || !scheduleForm.location.trim()}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
    >
      {addingSlot ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
      Ajouter
    </button>
  </div>
</div>
```

### Step 6 : Vérifier le build

```bash
npm run build
```
Attendu : aucune erreur TypeScript.

### Step 7 : Commit

```bash
git add src/app/(app)/teams/[id]/page.tsx
git commit -m "feat(teams): training schedule configuration in settings tab"
```

---

## Task 3 : Affichage dans `calendar/page.tsx`

**Files:**
- Modify: `src/app/(app)/calendar/page.tsx`

### Step 1 : Ajouter les imports

```typescript
import { getMatchesByTeamIds, getTeamsByManager, getTeamsByPlayer, getTeamsByIds } from "@/lib/firestore";
import type { Match, Team, TrainingScheduleSlot } from "@/types";
```

Note : `getTeamsByPlayer` retourne déjà des `Team[]` avec `trainingSchedule`. Pour les managers, `getTeamsByManager` fait de même. Il faut stocker les équipes dans un state.

### Step 2 : Ajouter le type local `TrainingEvent`

Avant le composant, ajouter :

```typescript
type TrainingEvent = {
  date: string;
  teamName: string;
  teamId: string;
  time: string;
  location: string;
  label?: string;
};
```

### Step 3 : Ajouter la fonction `generateTrainingEvents`

Avant le composant, ajouter :

```typescript
function generateTrainingEvents(teams: Team[], year: number, month: number): TrainingEvent[] {
  const events: TrainingEvent[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (const team of teams) {
    for (const slot of team.trainingSchedule ?? []) {
      for (let day = 1; day <= daysInMonth; day++) {
        if (new Date(year, month, day).getDay() === slot.day) {
          events.push({
            date: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
            teamName: team.name,
            teamId: team.id,
            time: slot.time,
            location: slot.location,
            label: slot.label,
          });
        }
      }
    }
  }
  return events;
}
```

### Step 4 : Ajouter le state `teams` dans le composant

```typescript
const [teams, setTeams] = useState<Team[]>([]);
```

### Step 5 : Modifier `fetchMatches` pour stocker les équipes

Dans `fetchMatches` (useCallback), après avoir résolu les `teams`, ajouter :
```typescript
setTeams(teams); // stocker les équipes pour les créneaux
```

Note : la variable locale s'appelle déjà `teams` dans le fetch — adapter le nom si conflit. Voici la version complète de `fetchMatches` à utiliser :

```typescript
const fetchMatches = useCallback(async () => {
  if (!user) return;
  setLoading(true);
  try {
    const isManager = user.userType === "manager";
    const userTeams = isManager
      ? await getTeamsByManager(user.uid)
      : await getTeamsByPlayer(user.uid);
    const teamIds = [...new Set(userTeams.map((t) => t.id))];
    setTeams(userTeams);
    if (teamIds.length > 0) {
      const result = await getMatchesByTeamIds(teamIds);
      setMatches(result);
    } else {
      setMatches([]);
    }
  } catch (err) {
    console.error("Error fetching matches:", err);
  } finally {
    setLoading(false);
  }
}, [user]);
```

### Step 6 : Calculer les training events par date

Dans le composant, après `matchesByDate`, ajouter :

```typescript
// Training events grouped by date
const trainingEventsByDate = useMemo(() => {
  const map: Record<string, TrainingEvent[]> = {};
  for (const ev of generateTrainingEvents(teams, year, month)) {
    if (!map[ev.date]) map[ev.date] = [];
    map[ev.date].push(ev);
  }
  return map;
}, [teams, year, month]);

const selectedTrainings = selectedDate ? (trainingEventsByDate[selectedDate] ?? []) : [];
```

### Step 7 : Mettre à jour les day cells pour afficher le dot violet

Dans le rendu des day cells (bouton par jour), la condition `hasEvents` utilise `matchesByDate[key]`. Ajouter `hasTraining` :

```typescript
const hasEvents = !!matchesByDate[key];
const hasTraining = !!trainingEventsByDate[key];
```

Dans le JSX du bouton, après les dots de match, ajouter le dot violet :

```typescript
{hasTraining && (
  <div className="mt-0.5 flex gap-0.5">
    <div className={`h-1 w-1 rounded-full ${isSelected ? "bg-white" : "bg-violet-400"}`} />
  </div>
)}
```

### Step 8 : Mettre à jour la légende

Dans la section légende (après les STATUS_STYLES), ajouter l'entrée entraînement :

```typescript
{/* Training legend entry */}
<div className="flex items-center gap-1.5 text-xs text-gray-500">
  <div className="h-2 w-2 rounded-full bg-violet-400" />
  Entraînement
</div>
```

### Step 9 : Afficher les créneaux dans le panneau latéral

Dans le panneau latéral (`selectedMatches.length > 0 ?`), le remplacer par une liste combinée matchs + entraînements triés par heure :

```typescript
{selectedMatches.length > 0 || selectedTrainings.length > 0 ? (
  <div className="space-y-3">
    {/* Matches */}
    {selectedMatches.map((match) => {
      const style = STATUS_STYLES[match.status] ?? DEFAULT_STYLE;
      return (
        <motion.div key={match.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
          className={`rounded-lg ${style.bg} p-3`}>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${style.dot}`} />
            <span className="text-xs font-semibold text-gray-500 uppercase">
              {style.label} {match.format && `· ${match.format}`}
            </span>
          </div>
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-gray-500" />
              <span className="text-sm font-bold text-gray-900">
                {match.homeTeamName} vs {match.awayTeamName}
              </span>
            </div>
            {match.status === "completed" && match.scoreHome != null && match.scoreAway != null && (
              <div className="mt-1 flex items-center gap-2 ml-6">
                <span className="text-sm font-bold text-gray-700 font-display">
                  {match.scoreHome} - {match.scoreAway}
                </span>
              </div>
            )}
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
            {match.time && <span className="flex items-center gap-1"><Clock size={12} /> {match.time}</span>}
            {match.venueName && (
              <span className="flex items-center gap-1">
                <MapPin size={12} /> {match.venueName}{match.venueCity ? `, ${match.venueCity}` : ""}
              </span>
            )}
          </div>
        </motion.div>
      );
    })}
    {/* Training events */}
    {selectedTrainings.map((ev, i) => (
      <motion.div key={`training-${i}`} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
        className="rounded-lg bg-violet-50 p-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-violet-400" />
          <span className="text-xs font-semibold text-violet-600 uppercase">🏋️ Entraînement</span>
        </div>
        <div className="mt-2">
          <span className="text-sm font-bold text-violet-900">{ev.teamName}</span>
          {ev.label && <span className="ml-2 text-xs text-violet-500">· {ev.label}</span>}
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-violet-600">
          {ev.time && <span className="flex items-center gap-1"><Clock size={12} /> {ev.time}</span>}
          <span className="flex items-center gap-1"><MapPin size={12} /> {ev.location}</span>
        </div>
      </motion.div>
    ))}
  </div>
) : (
  <div className="flex flex-col items-center py-8 text-center">
    <Trophy size={24} className="text-gray-300" />
    <p className="mt-2 text-sm text-gray-400">
      {selectedDate ? "Rien de prévu ce jour" : "Clique sur un jour pour voir les détails"}
    </p>
  </div>
)}
```

### Step 10 : Vérifier le build

```bash
npm run build
```
Attendu : aucune erreur TypeScript.

### Step 11 : Commit

```bash
git add src/app/(app)/calendar/page.tsx
git commit -m "feat(calendar): display recurring training schedule events"
```

---

## Task 4 : Vérification finale

### Step 1 : Build complet

```bash
npm run build
```
Attendu : `✓ Compiled successfully`, aucune erreur TypeScript.

### Step 2 : Checklist manuelle

- [ ] Manager peut ajouter un créneau dans l'onglet Paramètres d'une équipe
- [ ] Le créneau apparaît dans la liste avec jour/heure/lieu
- [ ] Supprimer un créneau fonctionne
- [ ] Dans le calendrier, les jours avec entraînement ont un dot violet
- [ ] En cliquant sur un jour avec entraînement, la card violette s'affiche
- [ ] L'équipe source est indiquée sur la card entraînement
- [ ] La légende du calendrier inclut "Entraînement"

### Step 3 : Mettre à jour PLAN.md

Marquer Phase D comme complète dans `PLAN.md`.

---

## Résumé des fichiers touchés

| Fichier | Nature |
|---------|--------|
| `src/types/index.ts` | `TrainingScheduleSlot`, champs `FirestoreTeam.training_schedule`, `Team.trainingSchedule` |
| `src/lib/firestore.ts` | `toTeam` : mapper `training_schedule → trainingSchedule` |
| `src/app/(app)/teams/[id]/page.tsx` | Section planning dans onglet Paramètres (add/remove créneaux) |
| `src/app/(app)/calendar/page.tsx` | Génération occurrences, dots violets, panneau latéral, légende |
