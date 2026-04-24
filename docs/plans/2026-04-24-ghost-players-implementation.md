# Ghost Players Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permettre au manager de créer des "ghost players" (joueurs sans compte) dans son équipe, intégrés sans distinction visuelle dans le roster, la composition de match et les events live, avec rollup automatique des stats post-match.

**Architecture:** Sous-collection Firestore `/teams/{teamId}/ghost_players`. Les ghost players sont traités comme des vrais joueurs partout dans l'UI — la seule différence est côté manager : actions Modifier/Supprimer/Stats au lieu de Voir profil/Retirer. Le rollup des stats est déclenché côté client dans le batch de validation post-match (`submitManagerFeedback`).

**Tech Stack:** Next.js 16, Firebase/Firestore, TypeScript, Tailwind CSS, motion/react, lucide-react, react-hot-toast

---

## Task 1 : Types (`src/types/index.ts`)

**Files:**
- Modify: `src/types/index.ts` (à la fin du fichier, après la section Bookings)

**Step 1: Ajouter les deux types**

À la fin de `src/types/index.ts`, ajouter :

```typescript
// ============================================
// Ghost Players
// ============================================

export interface FirestoreGhostPlayer {
  first_name: string;
  last_name: string;
  position: "goalkeeper" | "defender" | "midfielder" | "forward";
  squad_number?: string;
  matches_played: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  created_at: string;
  updated_at: string;
}

export interface GhostPlayer {
  id: string;
  teamId: string;
  firstName: string;
  lastName: string;
  position: "goalkeeper" | "defender" | "midfielder" | "forward";
  squadNumber?: string;
  matchesPlayed: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  createdAt: string;
  updatedAt: string;
}
```

**Step 2: Vérifier le build TypeScript**

```bash
npm run build
```
Attendu : aucune erreur TS.

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add FirestoreGhostPlayer and GhostPlayer types"
```

---

## Task 2 : Firestore — CRUD + rollup (`src/lib/firestore.ts`)

**Files:**
- Modify: `src/lib/firestore.ts` (ajouter à la fin)

**Step 1: Ajouter l'import du type en haut du fichier**

Dans le bloc d'imports des types (lignes 27-41), ajouter `GhostPlayer, FirestoreGhostPlayer` :

```typescript
import type {
  // ... existing imports ...
  GhostPlayer, FirestoreGhostPlayer,
} from "@/types";
```

**Step 2: Ajouter le converter `toGhostPlayer`**

Dans la section Converters (après `formatDate`), ajouter :

```typescript
export function toGhostPlayer(id: string, teamId: string, d: FirestoreGhostPlayer): GhostPlayer {
  return {
    id,
    teamId,
    firstName: d.first_name,
    lastName: d.last_name,
    position: d.position,
    squadNumber: d.squad_number,
    matchesPlayed: d.matches_played ?? 0,
    goals: d.goals ?? 0,
    assists: d.assists ?? 0,
    yellowCards: d.yellow_cards ?? 0,
    redCards: d.red_cards ?? 0,
    createdAt: formatDate(d.created_at),
    updatedAt: formatDate(d.updated_at),
  };
}
```

**Step 3: Ajouter les fonctions CRUD + listeners à la fin du fichier**

```typescript
// ============================================
// Ghost Players
// ============================================

export async function createGhostPlayer(
  teamId: string,
  data: {
    firstName: string;
    lastName: string;
    position: "goalkeeper" | "defender" | "midfielder" | "forward";
    squadNumber?: string;
  }
): Promise<string> {
  const ref = collection(db, "teams", teamId, "ghost_players");
  const doc_ = await addDoc(ref, {
    first_name: data.firstName.trim(),
    last_name: data.lastName.trim(),
    position: data.position,
    squad_number: data.squadNumber?.trim() || null,
    matches_played: 0,
    goals: 0,
    assists: 0,
    yellow_cards: 0,
    red_cards: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return doc_.id;
}

export async function updateGhostPlayer(
  teamId: string,
  ghostId: string,
  data: {
    firstName?: string;
    lastName?: string;
    position?: "goalkeeper" | "defender" | "midfielder" | "forward";
    squadNumber?: string;
  }
): Promise<void> {
  const ref = doc(db, "teams", teamId, "ghost_players", ghostId);
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.firstName !== undefined) update.first_name = data.firstName.trim();
  if (data.lastName !== undefined) update.last_name = data.lastName.trim();
  if (data.position !== undefined) update.position = data.position;
  if (data.squadNumber !== undefined) update.squad_number = data.squadNumber.trim() || null;
  await updateDoc(ref, update);
}

export async function deleteGhostPlayer(teamId: string, ghostId: string): Promise<void> {
  await deleteDoc(doc(db, "teams", teamId, "ghost_players", ghostId));
}

export async function getGhostPlayersByTeam(teamId: string): Promise<GhostPlayer[]> {
  const ref = collection(db, "teams", teamId, "ghost_players");
  const snap = await getDocs(ref);
  return snap.docs.map((d) => toGhostPlayer(d.id, teamId, d.data() as FirestoreGhostPlayer));
}

export function onGhostPlayersByTeam(
  teamId: string,
  callback: (data: GhostPlayer[]) => void
): Unsubscribe {
  const ref = collection(db, "teams", teamId, "ghost_players");
  return onSnapshot(ref, (snap) => {
    callback(snap.docs.map((d) => toGhostPlayer(d.id, teamId, d.data() as FirestoreGhostPlayer)));
  });
}

export async function rollupGhostPlayerStats(
  teamId: string,
  ghostPlayers: GhostPlayer[],
  matchEvents: Match["liveState"] extends null | undefined ? never : NonNullable<Match["liveState"]>["events"]
): Promise<void> {
  if (!ghostPlayers.length || !matchEvents?.length) return;

  const ghostIds = new Set(ghostPlayers.map((g) => g.id));
  // Count stats per ghost
  const stats: Record<string, { goals: number; assists: number; yellow_cards: number; red_cards: number }> = {};

  for (const event of matchEvents) {
    if (!event.playerId || !ghostIds.has(event.playerId)) continue;
    if (!stats[event.playerId]) stats[event.playerId] = { goals: 0, assists: 0, yellow_cards: 0, red_cards: 0 };
    if (event.type === "goal") stats[event.playerId].goals += 1;
    if (event.type === "yellow_card") stats[event.playerId].yellow_cards += 1;
    if (event.type === "red_card") stats[event.playerId].red_cards += 1;
  }

  if (!Object.keys(stats).length) {
    // Still increment matches_played for all ghosts who were in lineup
    // (handled by caller passing only ghosts who played)
    return;
  }

  const batch = writeBatch(db);
  for (const [ghostId, s] of Object.entries(stats)) {
    const ref = doc(db, "teams", teamId, "ghost_players", ghostId);
    batch.update(ref, {
      goals: increment(s.goals),
      assists: increment(s.assists),
      yellow_cards: increment(s.yellow_cards),
      red_cards: increment(s.red_cards),
      matches_played: increment(1),
      updated_at: new Date().toISOString(),
    });
  }
  await batch.commit();
}
```

**Step 4: Vérifier le build**

```bash
npm run build
```
Attendu : aucune erreur TS.

**Step 5: Commit**

```bash
git add src/lib/firestore.ts
git commit -m "feat(firestore): ghost players CRUD, listener and stats rollup"
```

---

## Task 3 : Roster unifié dans `teams/[id]/page.tsx`

**Files:**
- Modify: `src/app/(app)/teams/[id]/page.tsx`

Il y a 4 sous-étapes : state, modals, liste unifiée, bouton d'ajout.

### 3a — Imports et state

**Step 1: Ajouter les imports**

En haut du fichier, dans les imports depuis `@/lib/firestore` :
```typescript
import {
  // ... existing ...
  onGhostPlayersByTeam,
  createGhostPlayer,
  updateGhostPlayer,
  deleteGhostPlayer,
} from "@/lib/firestore";
```

Dans les imports de types :
```typescript
import type { Team, UserProfile, Match, JoinRequest, Achievement, Training, GhostPlayer } from "@/types";
```

Dans les imports Lucide (ajouter `BarChart2, Bot`) :
```typescript
import { ..., BarChart2 } from "lucide-react";
```

**Step 2: Ajouter le state ghost players dans le composant**

Après les state modals existants (ligne ~458) :
```typescript
// Ghost players
const [ghostPlayers, setGhostPlayers] = useState<GhostPlayer[]>([]);
const [showGhostModal, setShowGhostModal] = useState(false);
const [editingGhost, setEditingGhost] = useState<GhostPlayer | null>(null);
const [ghostStatsTarget, setGhostStatsTarget] = useState<GhostPlayer | null>(null);
const [deletingGhostId, setDeletingGhostId] = useState<string | null>(null);
```

**Step 3: Ajouter le listener real-time ghost players**

Après le listener `onTrainingsByTeam` (lignes ~505-510) :
```typescript
// Real-time ghost players listener
useEffect(() => {
  if (!teamId) return;
  const unsub = onGhostPlayersByTeam(teamId, setGhostPlayers);
  return unsub;
}, [teamId]);
```

### 3b — Modal création/édition ghost player

**Step 4: Ajouter le composant `GhostPlayerModal` avant le composant principal**

```typescript
function GhostPlayerModal({
  ghost,
  onClose,
  onSaved,
  teamId,
}: {
  ghost: GhostPlayer | null;
  onClose: () => void;
  onSaved: () => void;
  teamId: string;
}) {
  const [form, setForm] = useState({
    firstName: ghost?.firstName ?? "",
    lastName: ghost?.lastName ?? "",
    position: ghost?.position ?? "midfielder" as GhostPlayer["position"],
    squadNumber: ghost?.squadNumber ?? "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) return;
    setSubmitting(true);
    try {
      if (ghost) {
        await updateGhostPlayer(teamId, ghost.id, form);
        toast.success("Joueur modifié");
      } else {
        await createGhostPlayer(teamId, form);
        toast.success("Joueur ajouté");
      }
      onSaved();
      onClose();
    } catch {
      toast.error("Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <h3 className="mb-4 text-lg font-bold text-gray-900">
          {ghost ? "Modifier le joueur" : "Ajouter un joueur"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Prénom</label>
              <input
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                placeholder="Jean"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Nom</label>
              <input
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                placeholder="Dupont"
                required
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Poste</label>
            <select
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value as GhostPlayer["position"] })}
            >
              <option value="goalkeeper">Gardien</option>
              <option value="defender">Défenseur</option>
              <option value="midfielder">Milieu</option>
              <option value="forward">Attaquant</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Numéro de dossard (optionnel)</label>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
              value={form.squadNumber}
              onChange={(e) => setForm({ ...form, squadNumber: e.target.value })}
              placeholder="Ex: 10"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Annuler
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
              {submitting ? "Enregistrement..." : ghost ? "Modifier" : "Ajouter"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
```

**Step 5: Ajouter la modal Stats ghost player**

```typescript
function GhostStatsModal({
  ghost,
  onClose,
}: {
  ghost: GhostPlayer;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
      >
        <h3 className="mb-1 text-lg font-bold text-gray-900">
          {ghost.firstName} {ghost.lastName}
        </h3>
        <p className="mb-5 text-xs text-gray-400">{POSITION_LABELS[ghost.position] ?? ghost.position}</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Matchs", value: ghost.matchesPlayed },
            { label: "Buts", value: ghost.goals },
            { label: "Assists", value: ghost.assists },
            { label: "Jaunes", value: ghost.yellowCards },
            { label: "Rouges", value: ghost.redCards },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center rounded-xl bg-gray-50 py-3">
              <span className="text-2xl font-black text-gray-900">{s.value}</span>
              <span className="text-[10px] font-semibold text-gray-400 uppercase">{s.label}</span>
            </div>
          ))}
        </div>
        <button onClick={onClose}
          className="mt-5 w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
          Fermer
        </button>
      </motion.div>
    </div>
  );
}
```

### 3c — Liste unifiée dans l'onglet Effectif

**Step 6: Remplacer la liste des membres existante dans l'onglet `roster`**

La section `{members.filter((m) => m.uid !== team.managerId).length > 0 ? ...}` (lignes 964-1031) doit être remplacée. Il faut afficher membres réels (hors manager) + ghost players ensemble.

Remplacer le bloc de la liste par :

```typescript
{/* Unified list: real members (excl. manager) + ghost players */}
{(() => {
  const realPlayers = members.filter((m) => m.uid !== team.managerId);
  const totalCount = realPlayers.length + ghostPlayers.length;

  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-12">
        <Users size={32} className="text-gray-300" />
        <p className="mt-3 text-sm text-gray-500">Aucun joueur dans l&apos;équipe</p>
      </div>
    );
  }

  return (
    <AnimatePresence mode="popLayout">
      {/* Real players */}
      {realPlayers.map((member, i) => {
        const pos = member.position ?? "";
        const initials = `${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`;
        const isStarter = lineup.includes(member.uid);
        return (
          <motion.div key={member.uid} layout
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -60, height: 0 }} transition={{ duration: 0.3, delay: i * 0.05 }}
            className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 hover:shadow-sm transition-shadow sm:flex-row sm:items-center sm:justify-between sm:p-4"
          >
            <div className="flex items-center gap-3">
              {isTeamManager && (
                <button onClick={() => handleLineupToggle(member.uid)}
                  title={isStarter ? "Retirer des titulaires" : "Ajouter aux titulaires"}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${isStarter ? "border-primary-600 bg-primary-600 text-white" : "border-gray-300 text-transparent hover:border-primary-400"}`}>
                  <UserCheck size={12} />
                </button>
              )}
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white ${avatarColor(`${member.firstName} ${member.lastName}`)}`}>
                {member.profilePictureUrl ? <img src={member.profilePictureUrl} alt="" className="h-full w-full object-cover" /> : initials}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-gray-900">{member.firstName} {member.lastName}</h4>
                  {isStarter && <span className="rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-semibold text-primary-700">Titulaire</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <MapPin size={11} /> {member.locationCity}
                  {pos && <span className={`ml-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${POSITION_COLORS[pos] ?? "bg-gray-100 text-gray-600"}`}>{POSITION_LABELS[pos] ?? pos}</span>}
                </div>
              </div>
            </div>
            {isTeamManager && (
              <div className="flex items-center gap-3 border-t border-gray-100 pt-2 sm:border-t-0 sm:pt-0 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
                <div className="flex items-center gap-2 sm:border-r sm:border-gray-100 sm:pr-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">N°</span>
                  <input
                    type="text"
                    className="h-8 w-11 rounded-xl border border-gray-100 bg-gray-50/50 text-center text-sm font-black text-gray-900 shadow-sm focus:border-primary-300 focus:bg-white focus:ring-0 transition-all sm:h-9 sm:w-12"
                    value={teamSquadNumbers[member.uid] || ""}
                    onChange={(e) => handleSquadNumberChange(member.uid, e.target.value)}
                    placeholder="—"
                  />
                </div>
                <button onClick={() => handleRemoveMember(member.uid)} disabled={removingMember === member.uid}
                  className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                  {removingMember === member.uid ? <Loader2 size={12} className="animate-spin" /> : <UserMinus size={12} />} Retirer
                </button>
              </div>
            )}
          </motion.div>
        );
      })}

      {/* Ghost players */}
      {ghostPlayers.map((ghost, i) => {
        const initials = `${ghost.firstName[0] ?? ""}${ghost.lastName[0] ?? ""}`;
        return (
          <motion.div key={`ghost-${ghost.id}`} layout
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -60, height: 0 }} transition={{ duration: 0.3, delay: (realPlayers.length + i) * 0.05 }}
            className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 hover:shadow-sm transition-shadow sm:flex-row sm:items-center sm:justify-between sm:p-4"
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white ${avatarColor(`${ghost.firstName} ${ghost.lastName}`)}`}>
                {initials}
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">{ghost.firstName} {ghost.lastName}</h4>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {ghost.squadNumber && <span className="font-bold text-gray-700">N°{ghost.squadNumber}</span>}
                  <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${POSITION_COLORS[ghost.position] ?? "bg-gray-100 text-gray-600"}`}>
                    {POSITION_LABELS[ghost.position] ?? ghost.position}
                  </span>
                </div>
              </div>
            </div>
            {isTeamManager && (
              <div className="flex items-center gap-2 border-t border-gray-100 pt-2 sm:border-t-0 sm:pt-0 w-full sm:w-auto justify-end">
                <button
                  onClick={() => setGhostStatsTarget(ghost)}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  <BarChart2 size={12} /> Stats
                </button>
                <button
                  onClick={() => { setEditingGhost(ghost); setShowGhostModal(true); }}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  <Edit3 size={12} /> Modifier
                </button>
                <button
                  onClick={async () => {
                    setDeletingGhostId(ghost.id);
                    try {
                      await deleteGhostPlayer(teamId, ghost.id);
                      toast.success("Joueur supprimé");
                    } catch {
                      toast.error("Erreur lors de la suppression");
                    } finally {
                      setDeletingGhostId(null);
                    }
                  }}
                  disabled={deletingGhostId === ghost.id}
                  className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                  {deletingGhostId === ghost.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Supprimer
                </button>
              </div>
            )}
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
})()}
```

### 3d — Bouton d'ajout + rendu des modals

**Step 7: Remplacer le bouton "Recruter des joueurs" existant**

Remplacer :
```typescript
{isTeamManager && (
  <Link href="/recruitment" className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary-200 bg-primary-50/50 py-4 text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors">
    <UserPlus size={16} /> Recruter des joueurs
  </Link>
)}
```

Par :
```typescript
{isTeamManager && (
  <div className="flex gap-2">
    <button
      onClick={() => { setEditingGhost(null); setShowGhostModal(true); }}
      className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-white py-4 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
      <Plus size={16} /> Ajouter un joueur
    </button>
    <Link href="/recruitment"
      className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary-200 bg-primary-50/50 py-4 text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors">
      <UserPlus size={16} /> Recruter
    </Link>
  </div>
)}
```

**Step 8: Ajouter le rendu des modals ghost player**

Juste avant le `</> ` de fermeture du composant (là où sont rendus les autres modals), ajouter :

```typescript
<AnimatePresence>
  {showGhostModal && (
    <GhostPlayerModal
      ghost={editingGhost}
      teamId={teamId}
      onClose={() => { setShowGhostModal(false); setEditingGhost(null); }}
      onSaved={() => {}}
    />
  )}
  {ghostStatsTarget && (
    <GhostStatsModal
      ghost={ghostStatsTarget}
      onClose={() => setGhostStatsTarget(null)}
    />
  )}
</AnimatePresence>
```

**Step 9: Vérifier le build**

```bash
npm run build
```
Attendu : aucune erreur TS.

**Step 10: Commit**

```bash
git add src/app/(app)/teams/[id]/page.tsx
git commit -m "feat(teams): unified roster with ghost player CRUD (add/edit/delete/stats)"
```

---

## Task 4 : Match live — ghost players dans la composition

**Files:**
- Modify: `src/app/(app)/matches/[id]/page.tsx`

Le fichier de match utilise les `Participation` pour afficher les joueurs en composition. Les ghost players doivent apparaître dans la liste de sélection de lineup.

**Step 1: Ajouter l'import**

```typescript
import { getGhostPlayersByTeam } from "@/lib/firestore";
import type { ..., GhostPlayer } from "@/types";
```

**Step 2: Ajouter le state**

```typescript
const [ghostPlayers, setGhostPlayers] = useState<GhostPlayer[]>([]);
```

**Step 3: Charger les ghost players quand on connaît l'équipe du manager**

Dans le `useEffect` qui charge le match ou après avoir déterminé `myTeamId` :

```typescript
useEffect(() => {
  if (!myTeamId) return;
  getGhostPlayersByTeam(myTeamId).then(setGhostPlayers);
}, [myTeamId]);
```

**Step 4: Dans le sélecteur de lineup (mode `lineupMode`)**

Là où les joueurs confirmés sont listés pour la composition, ajouter les ghost players à la suite. Ils apparaissent comme des joueurs normaux — pas de distinction visuelle.

Chercher dans le fichier les blocs qui rendent les players en `lineupMode` (lignes ~718-812 environ) et s'assurer que les ghost players sont inclus dans la liste affichée.

**Step 5: Vérifier le build**

```bash
npm run build
```

**Step 6: Commit**

```bash
git add src/app/(app)/matches/[id]/page.tsx
git commit -m "feat(match): include ghost players in lineup selection"
```

---

## Task 5 : Rollup post-match (`submitManagerFeedback`)

**Files:**
- Modify: `src/lib/firestore.ts` (fonction `submitManagerFeedback`, lignes 680-724)

**Step 1: Modifier la signature de `submitManagerFeedback`**

Ajouter un paramètre optionnel pour le rollup :

```typescript
export async function submitManagerFeedback(
  matchId: string,
  managerId: string,
  data: {
    validation: "validated" | "contested";
    comments?: string;
    refereeRating?: number;
  },
  ghostRollup?: {
    teamId: string;
    ghostPlayers: GhostPlayer[];
  }
): Promise<void> {
```

**Step 2: Appeler le rollup dans la fonction**

Après le `transaction.update(...)` (ou après le `runTransaction`), ajouter :

```typescript
  // Rollup ghost player stats if provided
  if (ghostRollup && matchData.live_state?.events) {
    await rollupGhostPlayerStats(
      ghostRollup.teamId,
      ghostRollup.ghostPlayers,
      matchData.live_state.events as any
    );
  }
```

Note : le rollup se fait après la transaction pour éviter les conflits de batch.

**Step 3: Mettre à jour l'appel dans la page match**

Dans `src/app/(app)/matches/[id]/page.tsx`, là où `submitManagerFeedback` est appelé, passer les ghost players :

```typescript
await submitManagerFeedback(matchId, user.uid, feedbackData, {
  teamId: myTeamId,
  ghostPlayers,
});
```

**Step 4: Vérifier le build**

```bash
npm run build
```
Attendu : aucune erreur TS.

**Step 5: Commit**

```bash
git add src/lib/firestore.ts src/app/(app)/matches/[id]/page.tsx
git commit -m "feat(match): rollup ghost player stats on post-match validation"
```

---

## Task 6 : Vérification finale

**Step 1: Build complet**

```bash
npm run build
```
Attendu : `✓ Compiled successfully`, aucune erreur TypeScript.

**Step 2: Checklist manuelle**

- [ ] Manager peut ajouter un ghost player depuis l'onglet Effectif
- [ ] Ghost player apparaît dans la liste sans distinction visuelle
- [ ] Boutons Stats / Modifier / Supprimer fonctionnent
- [ ] Modal Stats affiche les compteurs à zéro pour un nouveau ghost
- [ ] En mode lineup sur la page match, les ghost players apparaissent dans la liste

**Step 3: Commit final si ajustements**

```bash
git add -p
git commit -m "fix(ghost-players): final adjustments"
```

---

## Résumé des fichiers touchés

| Fichier | Nature |
|---------|--------|
| `src/types/index.ts` | Ajout types `FirestoreGhostPlayer`, `GhostPlayer` |
| `src/lib/firestore.ts` | Ajout CRUD, listener, rollup ; modification `submitManagerFeedback` |
| `src/app/(app)/teams/[id]/page.tsx` | Roster unifié, modals ghost player |
| `src/app/(app)/matches/[id]/page.tsx` | Ghost players dans lineup + rollup au feedback |
