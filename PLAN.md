# Manager Mobile Experience — Plan Global

5 axes majeurs pour améliorer l'expérience manager sur mobile et enrichir les fonctionnalités.

**Ordre d'exécution :** Phase A → Phase B → Phase C → Phase D

---

## Phase A : Responsivité + Bottom Bar Avatar

### A1. Bottom Bar — Remplacer "Profil" par Avatar Menu
- [x] `MobileBottomNav.tsx` — Remplacer le 5ème onglet "Profil" par l'avatar utilisateur
  - Photo de profil (ou initiales) au lieu de l'icône User
  - Au tap : bottom sheet glassmorphism avec avatar + nom + rôle, lien "Mon profil", lien "Paramètres" (placeholder), bouton "Déconnexion"

### A2. Responsivité des pages Manager
- [x] `dashboard/page.tsx` — Ajustements padding/taille mobile
- [x] `teams/page.tsx` — Cards `grid-cols-1` mobile, boutons full-width
- [x] `teams/[id]/page.tsx` — Tabs scroll horizontal, roster compact, modals mobile
- [x] `matches/page.tsx` — Form stack `grid-cols-1`, match cards vertical
- [x] `mercato/page.tsx` — Player cards `grid-cols-1`, filtres collapsibles
- [x] `calendar/page.tsx` — Vue compacte mobile (déjà responsive)

---

## Phase B : Manager ≠ Joueur

### Problèmes identifiés
- `calendar/page.tsx` appelle `getTeamsByPlayer(user.uid)` pour les managers → incorrect
- Vérifier que les managers ne voient pas de menus joueur (sidebar/bottom nav)

### Corrections
- [x] `calendar/page.tsx` — Supprimer `getTeamsByPlayer` pour les managers
- [x] `navigation.ts` — Vérifier que le manager n'a pas d'onglets de joueur

---

## Phase C : Ghost Players (Joueurs sans compte)

### Concept
Joueur de l'effectif permanent créé par le manager (joueur qui n'a pas de smartphone/PC).
- Pas de compte Firebase Auth, existe uniquement dans l'équipe
- Pas dans le mercato
- Utilisable en match live : titulaire, remplaçant, buts, cartons
- A des stats : matchs joués, buts, assists, cartons
- A un numéro de dossard, PAS de photo
- Géré par le manager : CRUD
- Pas de demande de participation : directement disponible en composition
- Dans le roster : liste unifiée avec les vrais joueurs, icône 🤖 robot pour différencier
- Actions dépendent de la nature : vrai joueur → profil/retirer | ghost → modifier/supprimer

### Schema : `/teams/{teamId}/ghost_players/{ghostId}`
```
first_name, last_name, position, squad_number?,
matches_played, goals, assists, yellow_cards, red_cards,
created_at, updated_at
```

### Fichiers
- [x] `types/index.ts` — Ajouter `FirestoreGhostPlayer` + `GhostPlayer`
- [x] `lib/firestore.ts` — CRUD ghost players + real-time listener + rollup
- [x] `teams/[id]/page.tsx` — Roster unifié, CRUD modal, Stats modal
- [x] Système match live — Ghost players dans lineup, rollup stats post-match

---

## Phase D : Jours d'entraînement configurables

### Concept
Créneaux récurrents (en complément des entraînements ponctuels existants).
Planning hebdomadaire → apparaît dans le calendrier de chaque joueur.

### Schema : champ `training_schedule` dans `/teams/{teamId}`
```
{ day: 0-6, time: "HH:MM", location: string, label?: string }[]
```

### Fichiers
- [ ] `types/index.ts` — Ajouter `TrainingScheduleSlot`
- [ ] `teams/[id]/page.tsx` — Onglet Paramètres : planning hebdomadaire
- [ ] `calendar/page.tsx` — Générer événements récurrents, style distinct (🏋️)

---

## Vérification

| Phase | Check |
|-------|-------|
| A | `npm run build` ✅ |
| B | `npm run build` + manager ne voit plus de routes joueur |
| C | `npm run build` + CRUD ghost players + participation match |
| D | `npm run build` + créneaux dans calendrier |
