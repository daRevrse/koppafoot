# Design : Email templates & campagnes admin

**Date :** 2026-04-28  
**Statut :** Approuvé

## Contexte

Les templates email existants sont fonctionnels mais visuellement minimaux (HTML inline sans branding). Les managers nouvellement inscrits n'ont pas encore créé d'équipe, les joueurs n'ont pas candidaté. On veut (1) retravailler le design des emails et (2) donner à l'admin des campagnes de relance ciblées et personnalisées.

## Décisions de design

- **Ton :** Chaleureux & motivant, avec prénom dans l'objet et corps
- **Titre "Coach" :** Tous les emails adressés à un manager incluent `Coach {prénom}` — dans l'objet et la salutation
- **Approche technique :** HTML inline partagé via `emailLayout()`, sans nouvelles dépendances

---

## 1. Refonte `src/lib/email.ts`

### Layout partagé

```
┌──────────────────────────────────────┐
│  KOPPAFOOT           fond #059669    │  h=60px, logo texte blanc
├──────────────────────────────────────┤
│  [Contenu spécifique au template]    │  max-width:560px, bg:white
│                                      │  padding:32px, border-radius:12px
│  [ CTA principal ]                   │  bouton vert arrondi
├──────────────────────────────────────┤
│  © 2025 KoppaFoot · koppafoot.com    │  footer gris clair, 12px
└──────────────────────────────────────┘
```

Fonction : `emailLayout(content: string): string`

### Templates transactionnels (mis à jour)

| Fonction | Objet | Salutation | CTA |
|---|---|---|---|
| `invitationEmailHtml(senderName, teamName, recipientFirstName)` | `{senderName} vous invite dans {teamName}` | `Salut {firstName},` | Voir l'invitation → /mercato |
| `joinRequestEmailHtml(playerName, teamName, managerFirstName)` | `{playerName} veut rejoindre {teamName}` | `Salut Coach {firstName},` | Voir la demande → /teams |
| `adminMessageEmailHtml(title, body)` | `{title}` | *(pas de salutation)* | Ouvrir KoppaFoot → /dashboard |

### Templates de campagne (nouveaux)

| Fonction | Objet | Corps |
|---|---|---|
| `campaignManagerNoTeamHtml(firstName)` | `Coach {firstName}, votre équipe vous attend 👋` | Vous êtes inscrit en tant que manager mais n'avez pas encore créé d'équipe. En 2 minutes, lancez votre équipe et commencez à recruter. |
| `campaignPlayerNoTeamHtml(firstName)` | `{firstName}, des équipes cherchent un joueur comme vous ⚽` | Des dizaines d'équipes actives cherchent des joueurs. Candidatez maintenant et commencez à jouer. |
| `campaignWelcomeManagerHtml(firstName)` | `Bienvenue sur KoppaFoot, Coach {firstName} ! 🎉` | 3 étapes pour lancer votre équipe : créer l'équipe, inviter des joueurs, défier un adversaire. |
| `campaignPlayerInactiveHtml(firstName)` | `{firstName}, vous nous manquez ⚽` | Votre dernier match remonte à plus d'un mois. Des équipes cherchent encore des joueurs près de chez vous. |

---

## 2. Mise à jour `/api/notifications/push/route.ts`

Lire `first_name` et `user_type` depuis le doc Firestore utilisateur (déjà fetchéé pour l'email).  
Construire la salutation : si `user_type === "manager"` → `Coach ${first_name}`, sinon `${first_name}`.  
Passer aux templates `invitationEmailHtml` et `joinRequestEmailHtml`.

---

## 3. Route `/api/admin/campaigns/route.ts` (nouveau fichier)

### GET
Retourne les stats en parallèle :
```json
[
  { "type": "manager_no_team",    "count": 12, "userIds": ["uid1", ...] },
  { "type": "player_no_team",     "count": 34, "userIds": [...] },
  { "type": "manager_welcome",    "count":  5, "userIds": [...] }
]
```

**Requêtes Firestore :**
- `manager_no_team` : `users(user_type=manager)` dont l'uid n'est pas dans `teams.manager_id`
- `player_no_team` : `users(user_type=player)` dont l'uid n'a aucun doc dans `join_requests` ni `participations`
- `manager_welcome` : `users(user_type=manager, created_at > now-48h)`

### POST `{ campaignType, title, body }`
Pour chaque uid ciblé :
1. Lit `first_name` depuis Firestore
2. Génère l'email HTML personnalisé
3. Envoie l'email via Resend
4. Crée une notification in-app

Sécurité : vérifie Bearer token + `user_type === "superadmin"`.

---

## 4. Page `/admin/campaigns` (nouveau fichier)

Style identique à `settings/page.tsx` (motion, cards rounded-2xl).

**Comportement :**
- Au mount : appelle `GET /api/admin/campaigns` pour charger les counts
- Chaque campagne affiche : nom, description, badge count, bouton "Envoyer →"
- Clic → modal avec titre + corps pré-remplis (éditables)
- Confirmation → `POST /api/admin/campaigns`
- Toast succès avec count de destinataires

**Campagnes affichées :**
1. 🟡 Managers sans équipe
2. 🟢 Joueurs sans candidature
3. 🔵 Managers récents (bienvenue)

---

## 5. Navigation admin

- `src/config/navigation.ts` : ajouter `{ path: "/admin/campaigns", icon: "Megaphone", label: "Campagnes" }` dans le groupe `"systeme"`
- `src/app/(admin)/layout.tsx` : ajouter `"/admin/campaigns": "Campagnes"` dans `PAGE_TITLES`
- `src/components/layout/AdminSidebar.tsx` : ajouter `Megaphone` aux imports et à `ICONS`

---

## Fichiers impactés

| Fichier | Action |
|---|---|
| `src/lib/email.ts` | Refonte complète |
| `src/app/api/notifications/push/route.ts` | Passer firstName + salutation aux templates |
| `src/app/api/admin/campaigns/route.ts` | Nouveau |
| `src/app/(admin)/admin/campaigns/page.tsx` | Nouveau |
| `src/config/navigation.ts` | + Campagnes |
| `src/app/(admin)/layout.tsx` | + PAGE_TITLES |
| `src/components/layout/AdminSidebar.tsx` | + Megaphone |
