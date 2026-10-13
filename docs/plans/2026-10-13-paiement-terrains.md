# Paiement mobile, lot 2 (temps 1) : frais de réservation de terrain, ticket et battement — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sur un terrain qui l'a activé, l'équipe paie 5 % du prix après le oui du propriétaire, reçoit un ticket que le gérant valide sur place, et l'acompte devient une somme due au gérant, réglable à la main dans l'admin en attendant les dépôts FedaPay.

**Architecture:** Un module pur (`lib/reglement`) porte les règles (acompte, échéance, fenêtre du ticket, clôture) et décide, comme `lib/reservations` le fait pour les matchs, ce qu'il faut faire d'un règlement d'après l'état de sa réservation. `lib/reglement-serveur` l'exécute dans Firestore ; `lib/versements-serveur` tient les sommes dues. Le socle du lot 1 est réutilisé : `reglerPaiement` reste la seule porte, et applique désormais un effet selon l'objet du paiement (le droit Pro, ou le règlement d'un acompte).

**Tech Stack:** Next.js 16.2.3, firebase-admin 13, React 19, Tailwind 4, jest (dans `mobile/`). Une dépendance ajoutée : `qrcode.react`, pour dessiner le QR du ticket.

**Spec:** `docs/plans/2026-10-13-paiement-terrains-design.md`

## Global Constraints

- **Branche** `feat/paiement-terrains` (partie de `feat/paiement-fedapay`). Un commit par tâche, message en français, terminé par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **Avant chaque tâche : `git branch --show-current` doit rendre `feat/paiement-terrains`** (le dossier a déjà changé de branche en cours de travail).
- **Temps 1 seulement** : aucun appel aux dépôts FedaPay (`/v1/payouts`), fermés sur le compte.
- **Avant d'écrire une route** : `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`. `params` est une promesse.
- **L'argent ne vit que dans des collections fermées** (`reglements`, `dus`, `depots`, `comptes_versement`, `paiements`). Le serveur ne relit jamais `reglement_vu` sur une réservation, ni un montant venu du navigateur.
- **Acompte** : 5 % du prix, arrondi aux 50 FCFA supérieurs, 100 au minimum. **Échéance** : 24 h après l'ouverture, au plus tard au début du créneau. **Fenêtre du ticket** : d'une heure avant le début à la fin du créneau, battement compris. **Battement** : 0, 15 ou 30 minutes.
- **Heures** : une réservation porte `date` (« AAAA-MM-JJ ») et `time` (« HH:MM ») à l'heure de Lomé, qui est UTC. Tous les instants se rangent en millisecondes UTC.
- **Code du ticket** : 6 caractères de `ABCDEFGHJKMNPQRSTUVWXYZ23456789`.
- **Les mots de la vidéo** : à l'équipe, « Remboursés si le match a lieu : ils sont déduits de ce que tu règles sur place. » Au propriétaire, « Ton prix reste ton prix. »
- **Pas de rétroactivité** : un règlement ne s'ouvre que pour une réservation DEMANDÉE après l'activation des frais sur le terrain (`venues.paiement_app_depuis`, en millisecondes). Une équipe paie ce qu'on lui a annoncé en demandant.
- **Une somme due s'écrit une fois**, avec `regle_le: null` en toutes lettres : Firestore ne retrouve pas un champ absent, et c'est sur lui que la liste des sommes à verser filtre.
- **Bac à sable** : seul un superadmin peut payer (verrou du lot 1, inchangé).
- **Tests** : modules purs par `import` dans `mobile/src/__tests__/` ; modules serveur par `require` avec le faux Firestore (`mobile/src/test-aides/faux-firestore.ts`, créé à la tâche 3). Lancer : `(cd mobile && npx jest src/__tests__/<fichier>)`. `(cd mobile && npx tsc --noEmit)` a 3 erreurs préexistantes : n'en ajouter aucune.
- **Serveur de dev** par `preview_start` (`koppafoot-dev`), jamais par Bash. Un seul `npm run build`, à la fin, serveur arrêté. **Ne jamais appeler la tâche cron en local** : elle notifie de vrais joueurs.
- **Aucun secret** écrit dans le dépôt ni affiché.

## Review Focus

1. **Une équipe paie alors que le créneau a déjà été libéré** (page FedaPay restée ouverte après l'échéance) → pas de ticket ; l'acompte lui est dû en retour, une seule fois. → test de `effetAcompte`, tâche 5.
2. **Le propriétaire annule une réservation dont l'acompte est payé** → l'acompte est dû à l'équipe, pas au propriétaire, et rien n'est dû deux fois si le geste est rejoué. → test de `suivreReservation`, tâche 5.
3. **Un gérant tape le code d'un ticket d'un autre terrain** (ou un code au hasard) → même réponse que pour un code inconnu, rien n'est validé, et les essais sont comptés. → test de `validerTicket`, tâche 5.
4. **Un propriétaire programme un match sur son propre terrain** (réservation où demandeur et propriétaire sont la même personne) ou bloque un créneau → aucun règlement ne s'ouvre. → test de `planReglement`, tâche 2.
5. **Le tarif change après la confirmation** → l'acompte demandé reste celui du prix figé à l'ouverture. → test de `suivreReservation`, tâche 5.

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `src/lib/reglement.ts` (créé) | Pur : acompte, frais, échéance, fenêtre, code, clôture, `planReglement`. |
| `src/lib/terrains.ts` | `seChevauchent` et `libreA` prennent un battement. |
| `src/lib/paiement.ts`, `src/lib/fedapay.ts` | Objet d'un paiement ; date de libération des fonds d'une collecte. |
| `src/lib/paiement-serveur.ts` | `reglerPaiement` par effets ; `demarrerAcompte`. |
| `src/lib/versements-serveur.ts` (créé) | Compte de versement, sommes dues, régler à la main. |
| `src/lib/reglement-serveur.ts` (créé) | `suivreReservation`, `effetAcompte`, `validerTicket`, vues. |
| `mobile/src/test-aides/faux-firestore.ts` (créé) | Le faux Firestore partagé par les suites serveur. |
| Routes (tâche 6) | `venues/[id]/paiement`, `reservations/[id]/reglement`, `reservations/ticket`, `admin/versements` ; greffes sur `bookings`, `paiements`, les routes de terrain d'un match, les créneaux publics, la tâche du matin. |
| Composants (tâches 7 et 8) | `components/venue/ReglementEquipe.tsx`, `PaiementTerrain.tsx`, `ValiderTicket.tsx`, `FraisDus.tsx` ; page `/ticket/[code]`. |
| Admin (tâche 9) | `/admin/versements`. |

---

### Task 1: Le battement

**Files:**
- Modify: `src/lib/terrains.ts` (`seChevauchent`, `libreA`)
- Modify: `src/types/index.ts` (`FirestoreVenue`, `Venue`, `FirestoreBooking`, `Booking`)
- Modify: `src/lib/firestore.ts` (`toVenue`, `toBooking`)
- Modify: `src/app/api/bookings/[id]/route.ts` (prise d'une proposition)
- Modify: `src/app/(app)/mes-terrains/reservations/page.tsx`, `src/components/venue/BookingRequest.tsx`, `src/components/venue/AnnuaireTerrains.tsx`, `src/app/(marketing)/terrains/[id]/page.tsx`, `src/app/(marketing)/terrains/annuaire/page.tsx`
- Test: `mobile/src/__tests__/battement.test.ts`

**Interfaces:**
- Produces: `seChevauchent(a, b, battementMin = 0): boolean` ; `libreA(horaires, occupations, creneau, battementMin = 0)` ; `Venue.battementMin?: number`, `Venue.paiementApp?: boolean` ; `Booking.reglementVu?: string | null`.

- [ ] **Step 1: Écrire le test**

Créer `mobile/src/__tests__/battement.test.ts` :

```ts
import { libreA, seChevauchent } from "@/lib/terrains";

// Le module vit côté site (src/lib/terrains) ; il est pur, et c'est ici que
// la suite de tests des modules partagés tourne.

const c = (time: string, duration: number, date = "2026-10-17") => ({ date, time, duration });

describe("seChevauchent", () => {
  it("sans battement, deux créneaux qui se suivent ne se chevauchent pas", () => {
    expect(seChevauchent(c("18:00", 1), c("19:00", 1))).toBe(false);
    expect(seChevauchent(c("18:00", 1), c("18:30", 1))).toBe(true);
  });

  it("avec un battement, le créneau garde le terrain après sa fin", () => {
    expect(seChevauchent(c("18:00", 1), c("19:00", 1), 15)).toBe(true);
    expect(seChevauchent(c("18:00", 1), c("19:10", 1), 15)).toBe(true);
    expect(seChevauchent(c("18:00", 1), c("19:15", 1), 15)).toBe(false);
    expect(seChevauchent(c("18:00", 1), c("19:30", 1), 30)).toBe(false);
  });

  it("le battement vaut dans les deux sens : le créneau d'avant garde aussi le sien", () => {
    expect(seChevauchent(c("19:00", 1), c("18:00", 1), 15)).toBe(true);
    expect(seChevauchent(c("19:15", 1), c("18:00", 1), 15)).toBe(false);
  });

  it("deux jours différents ne se chevauchent jamais", () => {
    expect(seChevauchent(c("18:00", 1), c("18:00", 1, "2026-10-18"), 30)).toBe(false);
  });
});

describe("libreA", () => {
  it("tient compte du battement du terrain", () => {
    const occupations = [c("18:00", 1)];
    expect(libreA(null, occupations, c("19:00", 1)).libre).toBe(true);
    expect(libreA(null, occupations, c("19:00", 1), 15).libre).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer, constater l'échec**

Run: `(cd mobile && npx jest src/__tests__/battement.test.ts)`
Expected: FAIL sur « avec un battement… » (`Expected: true, Received: false`) : le troisième argument est ignoré.

- [ ] **Step 3: Le battement dans le calcul**

Dans `src/lib/terrains.ts`, remplacer la fonction `seChevauchent` et son commentaire par :

```ts
/**
 * Deux créneaux se chevauchent-ils ?
 *
 * Le propriétaire en a besoin au moment de confirmer : accepter deux équipes
 * sur le même samedi 18 h est l'erreur qui coûte un client, et elle ne se
 * voit pas dans une liste triée par date d'arrivée.
 *
 * `battementMin` : ce que le terrain garde après chaque créneau. Un match
 * part en retard, déborde, et l'équipe suivante attend sur le bord : avec
 * quinze minutes de battement, un 18 h – 19 h occupe jusqu'à 19 h 15.
 */
export function seChevauchent(
  a: { date: string; time: string; duration: number },
  b: { date: string; time: string; duration: number },
  battementMin = 0,
): boolean {
  if (a.date !== b.date) return false;
  const min = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return Number.isNaN(h) ? 0 : h * 60 + (Number.isNaN(m) ? 0 : m);
  };
  const debutA = min(a.time);
  const debutB = min(b.time);
  return debutA < debutB + b.duration * 60 + battementMin && debutB < debutA + a.duration * 60 + battementMin;
}
```

Et dans `libreA`, ajouter le paramètre et le passer :

```ts
export function libreA(
  horaires: HorairesOuverture | null,
  occupations: Occupation[],
  creneau: Occupation,
  battementMin = 0,
): { ouvert: boolean; libre: boolean } {
  return {
    ouvert: horsHoraires(horaires, creneau) === null,
    libre: !occupations.some((o) => seChevauchent(o, creneau, battementMin)),
  };
}
```

Run: `(cd mobile && npx jest src/__tests__/battement.test.ts)`
Expected: PASS.

- [ ] **Step 4: Les types et les lecteurs**

Dans `src/types/index.ts` :

- `FirestoreVenue`, après `opening_hours` :

```ts
  /** Ce que le terrain garde après chaque créneau, en minutes : 0, 15 ou 30. */
  battement_min?: number;
  /** Les frais de réservation se paient dans l'application (lib/reglement). */
  paiement_app?: boolean;
  /**
   * Depuis quand, en millisecondes. Les frais ne valent que pour les demandes
   * faites APRÈS : une équipe paie ce qu'on lui a annoncé en demandant.
   */
  paiement_app_depuis?: number;
```

- `Venue`, après `openingHours` (repérer la ligne `openingHours` de l'interface `Venue`) :

```ts
  battementMin?: number;
  paiementApp?: boolean;
```

- `FirestoreBooking`, après `team_name` :

```ts
  /**
   * Où en sont les frais de réservation, pour l'affichage des listes :
   * « acompte_attendu », « acompte_paye », ou la clôture. Une COPIE : la
   * vérité est dans `reglements/{id}`, fermée aux navigateurs, et le serveur
   * ne relit jamais ce champ (le propriétaire peut l'écrire depuis le sien).
   */
  reglement_vu?: string | null;
```

- `Booking` : ajouter `reglementVu?: string | null;` à côté de ses autres champs facultatifs.

Dans `src/lib/firestore.ts` : dans `toVenue`, ajouter après `openingHours: horairesLus(d.opening_hours),` :

```ts
    battementMin: d.battement_min === 15 || d.battement_min === 30 ? d.battement_min : 0,
    paiementApp: d.paiement_app === true,
```

et dans `toBooking`, ajouter après `proposition: d.proposition ?? null,` :

```ts
    reglementVu: d.reglement_vu ?? null,
```

- [ ] **Step 5: Les endroits où l'on compare des créneaux**

Repérer les cinq appels : `grep -rn "seChevauchent(\|libreA(" src --include=*.ts --include=*.tsx`.

1. `src/app/api/bookings/[id]/route.ts`, action `prendre-proposition` : avant `const libre = …`, lire le battement du terrain et le passer.

```ts
        const terrain = (await adminDb.collection("venues").doc(b.venue_id).get()).data();
        const battement = terrain?.battement_min === 15 || terrain?.battement_min === 30 ? terrain.battement_min : 0;
        const libre = !memeJour.docs.some((d) => {
          const x = d.data() as FirestoreBooking;
          return x.status === "confirmed" && seChevauchent(x, creneau, battement);
        });
```

2. `src/app/(app)/mes-terrains/reservations/page.tsx`, dans le `useMemo` des `conflits` : le battement est celui du terrain de la demande.

```ts
    for (const b of attente) {
      const battement = terrains.find((t) => t.id === b.venueId)?.battementMin ?? 0;
      const heurt = confirmees.find((c) => c.venueId === b.venueId && seChevauchent(c, b, battement));
      if (heurt) map.set(b.id, heurt);
    }
```

et ajouter `terrains` aux dépendances de ce `useMemo` : `[attente, confirmees, terrains]`.

3. `src/components/venue/BookingRequest.tsx` : ajouter la prop `battementMin = 0` (avec son type `battementMin?: number;`) à côté de `pricePerHour`, et la passer : `seChevauchent(c, { date, time, duration: heures }, battementMin)`. Ajouter `battementMin` aux dépendances du `useMemo` concerné.

4. `src/app/(marketing)/terrains/[id]/page.tsx` : dans l'objet lu du terrain, ajouter `battementMin: v.battement_min === 15 || v.battement_min === 30 ? v.battement_min : 0,` et `paiementApp: v.paiement_app === true,` (avec leurs types dans l'interface locale, `battementMin: number; paiementApp: boolean;`), puis passer `battementMin={venue.battementMin}` à `<BookingRequest>`.

5. `src/components/venue/AnnuaireTerrains.tsx` : ajouter `battementMin?: number;` à `TerrainListe`, et passer `libreA(t.horaires, t.occupations, creneau, t.battementMin ?? 0)`. Dans `src/app/(marketing)/terrains/annuaire/page.tsx`, à côté de `pricePerHour: n(v.price_per_hour),`, ajouter `battementMin: v.battement_min === 15 || v.battement_min === 30 ? v.battement_min : 0,`.

- [ ] **Step 6: Vérifier**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

Run: `(cd mobile && npx jest src/__tests__/battement.test.ts)`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/terrains.ts src/types/index.ts src/lib/firestore.ts "src/app/api/bookings/[id]/route.ts" "src/app/(app)/mes-terrains/reservations/page.tsx" src/components/venue/BookingRequest.tsx src/components/venue/AnnuaireTerrains.tsx "src/app/(marketing)/terrains/[id]/page.tsx" "src/app/(marketing)/terrains/annuaire/page.tsx" mobile/src/__tests__/battement.test.ts
git commit -m "feat(terrains): un battement après chaque créneau

Un match part en retard et déborde : le terrain peut garder 15 ou 30
minutes après chaque créneau. Le battement entre dans le seul calcul de
chevauchement, donc partout où il sert.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Les règles pures d'un règlement

**Files:**
- Create: `src/lib/reglement.ts`
- Test: `mobile/src/__tests__/reglement.test.ts`

**Interfaces:**
- Consumes: `BookingStatus` de `@/types` (type seulement).
- Produces (tout exporté de `@/lib/reglement`) :
  - `BATTEMENTS`, `type Battement = 0 | 15 | 30`, `battementLu(x: unknown): Battement`
  - `prixDuCreneau(tarifHoraire: unknown, duree: unknown): number`
  - `acompteDe(prix: number): number`, `fraisDePaiement(montant: number, tauxPourCent: unknown): number`
  - `debutDuCreneau(date: string, time: string): number`
  - `echeanceAcompte(ouvertLe: number, debut: number): number`
  - `fenetreDeValidation(c: { date: string; time: string; duration: number }, battementMin: number): { ouvre: number; ferme: number }`
  - `ALPHABET_CODE`, `LONGUEUR_CODE`, `nouveauCode(hasard?: () => number): string`, `codeSaisi(brut: unknown): string | null`
  - `numeroTogolais(brut: unknown): string | null`
  - `type ClotureReglement = "joue" | "absent" | "annule_equipe" | "annule_proprietaire" | "libere"`
  - `type EtatReglement = "acompte_attendu" | "acompte_paye" | ClotureReglement`
  - `interface FirestoreReglement`, `etatDuReglement(r): EtatReglement`
  - `type PlanReglement`, `interface EntreePlan`, `planReglement(e: EntreePlan): PlanReglement`
  - `interface VueReglement` (ce que le serveur montre du règlement à l'une des deux parties), `interface ResumeTicket` (ce que dit un ticket au gérant) : les formes que les routes renvoient et que les écrans lisent.

- [ ] **Step 1: Écrire les tests**

Créer `mobile/src/__tests__/reglement.test.ts` :

```ts
import {
  ALPHABET_CODE, acompteDe, battementLu, codeSaisi, debutDuCreneau, echeanceAcompte, etatDuReglement,
  fenetreDeValidation, fraisDePaiement, nouveauCode, numeroTogolais, planReglement, prixDuCreneau,
  type EntreePlan,
} from "@/lib/reglement";

// Le module vit côté site (src/lib/reglement) ; il est pur, et c'est ici que
// la suite de tests des modules partagés tourne.

const H = 3_600_000;

describe("prixDuCreneau", () => {
  it("multiplie le tarif horaire par la durée", () => {
    expect(prixDuCreneau(10_000, 1)).toBe(10_000);
    expect(prixDuCreneau(5_000, 1.5)).toBe(7_500);
  });

  it("vaut 0 sans tarif ou sans durée lisibles", () => {
    expect(prixDuCreneau(0, 1)).toBe(0);
    expect(prixDuCreneau(-5, 1)).toBe(0);
    expect(prixDuCreneau("10000", 1)).toBe(0);
    expect(prixDuCreneau(10_000, 0)).toBe(0);
    expect(prixDuCreneau(undefined, undefined)).toBe(0);
  });
});

describe("acompteDe", () => {
  it("prend 5 % du prix", () => {
    expect(acompteDe(10_000)).toBe(500);
    expect(acompteDe(25_000)).toBe(1_250);
  });

  it("arrondit aux 50 FCFA supérieurs", () => {
    expect(acompteDe(7_500)).toBe(400);
    expect(acompteDe(3_100)).toBe(200);
  });

  it("ne descend pas sous 100, le plancher de FedaPay", () => {
    expect(acompteDe(1_500)).toBe(100);
    expect(acompteDe(200)).toBe(100);
  });

  it("vaut 0 quand il n'y a pas de prix : pas de règlement", () => {
    expect(acompteDe(0)).toBe(0);
    expect(acompteDe(-100)).toBe(0);
    expect(acompteDe(Number.NaN)).toBe(0);
  });
});

describe("fraisDePaiement", () => {
  it("applique le taux et arrondit à l'entier supérieur", () => {
    expect(fraisDePaiement(500, 4)).toBe(20);
    expect(fraisDePaiement(400, 4)).toBe(16);
    expect(fraisDePaiement(150, 3.5)).toBe(6);
  });

  it("vaut 0 sans taux réglé ou avec un taux absurde", () => {
    expect(fraisDePaiement(500, 0)).toBe(0);
    expect(fraisDePaiement(500, null)).toBe(0);
    expect(fraisDePaiement(500, -2)).toBe(0);
    expect(fraisDePaiement(500, "4")).toBe(0);
    expect(fraisDePaiement(500, 50)).toBe(0);
  });
});

describe("le temps d'un créneau", () => {
  const debut = Date.parse("2026-10-17T18:00:00Z");

  it("lit le début à l'heure de Lomé, qui est UTC", () => {
    expect(debutDuCreneau("2026-10-17", "18:00")).toBe(debut);
    expect(Number.isNaN(debutDuCreneau("pas une date", "18:00"))).toBe(true);
  });

  it("l'acompte se paie dans les 24 h", () => {
    expect(echeanceAcompte(debut - 72 * H, debut)).toBe(debut - 48 * H);
  });

  it("et au plus tard au début du créneau", () => {
    expect(echeanceAcompte(debut - 3 * H, debut)).toBe(debut);
  });

  it("le ticket se valide d'une heure avant le début à la fin du créneau", () => {
    expect(fenetreDeValidation({ date: "2026-10-17", time: "18:00", duration: 1.5 }, 0))
      .toEqual({ ouvre: debut - H, ferme: debut + 1.5 * H });
  });

  it("le battement prolonge la fenêtre", () => {
    expect(fenetreDeValidation({ date: "2026-10-17", time: "18:00", duration: 1 }, 15).ferme).toBe(debut + H + 15 * 60_000);
  });
});

describe("battementLu", () => {
  it("garde 0, 15 et 30, et ramène le reste à 0", () => {
    expect(battementLu(15)).toBe(15);
    expect(battementLu(30)).toBe(30);
    expect(battementLu(0)).toBe(0);
    expect(battementLu(20)).toBe(0);
    expect(battementLu("15")).toBe(0);
    expect(battementLu(undefined)).toBe(0);
  });
});

describe("le code du ticket", () => {
  it("fait six caractères de l'alphabet sans caractères ambigus", () => {
    const code = nouveauCode();
    expect(code).toHaveLength(6);
    expect([...code].every((ch) => ALPHABET_CODE.includes(ch))).toBe(true);
    expect(ALPHABET_CODE).not.toMatch(/[01OIL]/);
  });

  it("suit le hasard qu'on lui donne", () => {
    expect(nouveauCode(() => 0)).toBe("AAAAAA");
    expect(nouveauCode(() => 0.999999)).toBe("999999");
  });

  it("accepte une saisie en minuscules, avec des espaces ou des tirets", () => {
    expect(codeSaisi("k7m-2qz")).toBe("K7M2QZ");
    expect(codeSaisi("  K7M 2QZ ")).toBe("K7M2QZ");
  });

  it("refuse ce qui n'est pas un code", () => {
    expect(codeSaisi("K7M2Q")).toBeNull();
    expect(codeSaisi("K7M2QZZ")).toBeNull();
    expect(codeSaisi("K7M2Q0")).toBeNull();
    expect(codeSaisi("../../x")).toBeNull();
    expect(codeSaisi(null)).toBeNull();
    expect(codeSaisi(123456)).toBeNull();
  });
});

describe("numeroTogolais", () => {
  it("garde huit chiffres commençant par 7 ou 9", () => {
    expect(numeroTogolais("90 12 34 56")).toBe("90123456");
    expect(numeroTogolais("+228 70 12 34 56")).toBe("70123456");
    expect(numeroTogolais("0022899123456")).toBe("99123456");
  });

  it("refuse le reste", () => {
    expect(numeroTogolais("22123456")).toBeNull();
    expect(numeroTogolais("9012345")).toBeNull();
    expect(numeroTogolais("0164000001")).toBeNull();
    expect(numeroTogolais("")).toBeNull();
    expect(numeroTogolais(null)).toBeNull();
  });
});

describe("etatDuReglement", () => {
  it("suit l'acompte, puis la clôture", () => {
    expect(etatDuReglement({ paye_le: null, cloture: null })).toBe("acompte_attendu");
    expect(etatDuReglement({ paye_le: "x", cloture: null })).toBe("acompte_paye");
    expect(etatDuReglement({ paye_le: "x", cloture: "joue" })).toBe("joue");
    expect(etatDuReglement({ paye_le: null, cloture: "libere" })).toBe("libere");
  });
});

describe("planReglement", () => {
  const maintenant = Date.parse("2026-10-15T10:00:00Z");
  const reservation = { status: "confirmed" as const, kind: "demande", owner_id: "gerant", user_id: "equipe", cancelled_by: null };
  const ouvert = { echeance: maintenant + 24 * H, fin_fenetre: maintenant + 60 * H, paye: false, valide: false, cloture: null };
  const plan = (e: Partial<EntreePlan>) => planReglement({ reservation, reglement: null, payant: true, maintenant, ...e });

  it("ouvre un règlement quand une réservation est confirmée sur un terrain payant", () => {
    expect(plan({})).toEqual({ action: "ouvrir" });
  });

  it("n'ouvre rien tant que le propriétaire n'a pas dit oui", () => {
    expect(plan({ reservation: { ...reservation, status: "pending" } })).toEqual({ action: "rien" });
  });

  it("n'ouvre rien sur un terrain qui n'a pas activé le paiement", () => {
    expect(plan({ payant: false })).toEqual({ action: "rien" });
  });

  it("n'ouvre rien pour un créneau bloqué, ni quand le propriétaire joue chez lui", () => {
    expect(plan({ reservation: { ...reservation, kind: "blocage" } })).toEqual({ action: "rien" });
    expect(plan({ reservation: { ...reservation, user_id: "gerant" } })).toEqual({ action: "rien" });
  });

  it("attend l'acompte tant que l'échéance n'est pas passée", () => {
    expect(plan({ reglement: ouvert })).toEqual({ action: "rien" });
  });

  it("libère le créneau quand l'acompte n'est pas venu à temps", () => {
    expect(plan({ reglement: { ...ouvert, echeance: maintenant - 1 } }))
      .toEqual({ action: "clore", cloture: "libere", du: null, annulerReservation: true });
  });

  it("une fois payé, attend le match", () => {
    expect(plan({ reglement: { ...ouvert, paye: true, echeance: maintenant - 1 } })).toEqual({ action: "rien" });
  });

  it("clôt « joué » dès que le ticket est validé : l'acompte est dû au propriétaire", () => {
    expect(plan({ reglement: { ...ouvert, paye: true, valide: true } }))
      .toEqual({ action: "clore", cloture: "joue", du: "proprietaire", annulerReservation: false });
  });

  it("clôt « absent » quand la fenêtre passe sans validation : l'acompte est dû au propriétaire", () => {
    expect(plan({ reglement: { ...ouvert, paye: true, fin_fenetre: maintenant - 1 } }))
      .toEqual({ action: "clore", cloture: "absent", du: "proprietaire", annulerReservation: false });
  });

  it("l'équipe annule après avoir payé : l'acompte reste au propriétaire", () => {
    const annulee = { ...reservation, status: "cancelled" as const, cancelled_by: "demandeur" };
    expect(plan({ reservation: annulee, reglement: { ...ouvert, paye: true } }))
      .toEqual({ action: "clore", cloture: "annule_equipe", du: "proprietaire", annulerReservation: false });
  });

  it("le match est déplacé ou annulé (le système libère) : c'est l'équipe qui s'en va", () => {
    const liberee = { ...reservation, status: "cancelled" as const, cancelled_by: "systeme" };
    expect(plan({ reservation: liberee, reglement: { ...ouvert, paye: true } }))
      .toEqual({ action: "clore", cloture: "annule_equipe", du: "proprietaire", annulerReservation: false });
  });

  it("le propriétaire annule après le paiement : l'acompte est rendu à l'équipe", () => {
    const annulee = { ...reservation, status: "cancelled" as const, cancelled_by: "proprietaire" };
    expect(plan({ reservation: annulee, reglement: { ...ouvert, paye: true } }))
      .toEqual({ action: "clore", cloture: "annule_proprietaire", du: "equipe", annulerReservation: false });
  });

  it("une annulation avant tout paiement ne doit rien à personne", () => {
    const parLeGerant = { ...reservation, status: "cancelled" as const, cancelled_by: "proprietaire" };
    const parLEquipe = { ...reservation, status: "cancelled" as const, cancelled_by: "demandeur" };
    expect(plan({ reservation: parLeGerant, reglement: ouvert }))
      .toEqual({ action: "clore", cloture: "annule_proprietaire", du: null, annulerReservation: false });
    expect(plan({ reservation: parLEquipe, reglement: ouvert }))
      .toEqual({ action: "clore", cloture: "annule_equipe", du: null, annulerReservation: false });
  });

  it("une réservation disparue vaut une annulation par l'équipe", () => {
    expect(plan({ reservation: null, reglement: { ...ouvert, paye: true } }))
      .toEqual({ action: "clore", cloture: "annule_equipe", du: "proprietaire", annulerReservation: false });
  });

  it("un règlement clos ne se rouvre ni ne se reclôt", () => {
    expect(plan({ reglement: { ...ouvert, paye: true, valide: true, cloture: "joue" } })).toEqual({ action: "rien" });
    const annulee = { ...reservation, status: "cancelled" as const, cancelled_by: "proprietaire" };
    expect(plan({ reservation: annulee, reglement: { ...ouvert, paye: true, cloture: "joue" } })).toEqual({ action: "rien" });
  });
});
```

- [ ] **Step 2: Lancer, constater l'échec**

Run: `(cd mobile && npx jest src/__tests__/reglement.test.ts)`
Expected: FAIL, `Could not locate module @/lib/reglement`.

- [ ] **Step 3: Écrire le module**

Créer `src/lib/reglement.ts` :

```ts
import type { BookingStatus } from "@/types";

// ============================================
// Les frais de réservation d'un terrain : l'acompte, son ticket, sa clôture.
//
// UN SEUL CIRCUIT D'ARGENT. Le propriétaire dit oui, l'équipe paie 5 % du prix
// dans l'application, reçoit un ticket, le fait valider sur place et règle le
// reste en liquide. L'acompte revient au propriétaire dans tous les cas, sauf
// un : s'il annule lui-même, il est rendu à l'équipe.
//
// PERSONNE NE DÉCLARE RIEN. Un ticket validé dit que le match a eu lieu ; une
// fenêtre passée sans validation dit l'absence. Le propriétaire touchant
// l'acompte dans les deux cas, personne n'a intérêt à tricher : le ticket ne
// sert qu'à tenir un historique juste.
//
// UN SEUL CALCUL, APPELÉ APRÈS CHAQUE GESTE — la même idée que lib/reservations
// pour le terrain d'un match. `planReglement` compare la réservation telle
// qu'elle est avec son règlement tel qu'il est, et dit quoi faire. Confirmer,
// annuler, laisser passer l'heure : aucun de ces gestes ne porte sa propre
// règle d'argent.
//
// Module pur : aucun SDK. Le serveur (lib/reglement-serveur) l'exécute, les
// écrans l'appellent pour annoncer un montant ; ses tests tournent dans
// mobile/src/__tests__/reglement.test.ts.
// ============================================

/** Les frais de réservation : la part du prix payée dans l'application. */
export const TAUX_ACOMPTE = 0.05;
/** L'acompte s'arrondit à ce pas, vers le haut. */
export const ARRONDI_ACOMPTE = 50;
/** Le plancher de FedaPay : pas de collecte sous 100 XOF. */
export const ACOMPTE_PLANCHER = 100;
/** Le temps laissé pour payer après le oui du propriétaire. */
export const DELAI_ACOMPTE_MS = 24 * 3_600_000;
/** Le ticket se valide à partir d'une heure avant le coup d'envoi. */
export const AVANCE_VALIDATION_MS = 3_600_000;
/** Au-delà, un taux de frais est une faute de saisie. */
const TAUX_FRAIS_MAX = 20;

export const BATTEMENTS = [0, 15, 30] as const;
export type Battement = (typeof BATTEMENTS)[number];

export function battementLu(x: unknown): Battement {
  return x === 15 || x === 30 ? x : 0;
}

/** Le prix d'un créneau : tarif horaire × durée. 0 quand l'un des deux manque. */
export function prixDuCreneau(tarifHoraire: unknown, duree: unknown): number {
  if (typeof tarifHoraire !== "number" || typeof duree !== "number") return 0;
  if (!Number.isFinite(tarifHoraire) || !Number.isFinite(duree) || tarifHoraire <= 0 || duree <= 0) return 0;
  return Math.round(tarifHoraire * duree);
}

/** L'acompte d'un prix ; 0 quand il n'y a pas de prix, donc pas de règlement. */
export function acompteDe(prix: number): number {
  if (!Number.isFinite(prix) || prix <= 0) return 0;
  return Math.max(ACOMPTE_PLANCHER, Math.ceil((prix * TAUX_ACOMPTE) / ARRONDI_ACOMPTE) * ARRONDI_ACOMPTE);
}

/**
 * Les frais de paiement ajoutés à ce que l'équipe paie, au taux réglé dans
 * l'administration. Sans taux lisible, 0 : KoppaFoot supporte alors les frais
 * de FedaPay.
 */
export function fraisDePaiement(montant: number, tauxPourCent: unknown): number {
  if (typeof tauxPourCent !== "number" || !Number.isFinite(tauxPourCent)) return 0;
  if (tauxPourCent <= 0 || tauxPourCent > TAUX_FRAIS_MAX) return 0;
  return Math.ceil((montant * tauxPourCent) / 100);
}

/** L'instant du début d'un créneau. Lomé vit à l'heure UTC : rien à convertir. */
export function debutDuCreneau(date: string, time: string): number {
  return Date.parse(`${date}T${time}:00Z`);
}

/** Jusqu'à quand l'acompte se paie : 24 h, et au plus tard le début du créneau. */
export function echeanceAcompte(ouvertLe: number, debut: number): number {
  return Math.min(ouvertLe + DELAI_ACOMPTE_MS, debut);
}

/** Quand le ticket se valide : d'une heure avant le début à la fin, battement compris. */
export function fenetreDeValidation(
  c: { date: string; time: string; duration: number },
  battementMin: number,
): { ouvre: number; ferme: number } {
  const debut = debutDuCreneau(c.date, c.time);
  return {
    ouvre: debut - AVANCE_VALIDATION_MS,
    ferme: debut + c.duration * 3_600_000 + battementMin * 60_000,
  };
}

/** Ni 0 ni O, ni 1 ni I ni L : un code se dicte au bord d'un terrain. */
export const ALPHABET_CODE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const LONGUEUR_CODE = 6;

/** `hasard` rend un nombre dans [0, 1[ ; le serveur lui passe un tirage sûr. */
export function nouveauCode(hasard: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < LONGUEUR_CODE; i += 1) {
    code += ALPHABET_CODE[Math.min(ALPHABET_CODE.length - 1, Math.floor(hasard() * ALPHABET_CODE.length))];
  }
  return code;
}

/** Ce que le gérant a tapé ou scanné, remis en forme ; `null` si ce n'est pas un code. */
export function codeSaisi(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  const code = brut.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== LONGUEUR_CODE) return null;
  return [...code].every((c) => ALPHABET_CODE.includes(c)) ? code : null;
}

/** Un numéro mobile togolais, réduit à ses huit chiffres ; `null` s'il n'en est pas un. */
export function numeroTogolais(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  const chiffres = brut.replace(/[\s.-]/g, "").replace(/^(\+228|00228)/, "");
  return /^[79]\d{7}$/.test(chiffres) ? chiffres : null;
}

export type ClotureReglement = "joue" | "absent" | "annule_equipe" | "annule_proprietaire" | "libere";

/** Ce qu'on montre : où en est l'acompte, puis comment la réservation a fini. */
export type EtatReglement = "acompte_attendu" | "acompte_paye" | ClotureReglement;

/** Le dossier d'argent d'une réservation — `reglements/{idRéservation}`. Écrit par le serveur seul. */
export interface FirestoreReglement {
  owner_id: string;
  user_id: string;
  venue_id: string;
  venue_name: string;
  /** Qui joue, tel qu'on le dit au gérant : le nom de l'équipe, sinon celui du demandeur. */
  demandeur: string;
  /** Le créneau et le prix, FIGÉS à l'ouverture : un tarif changé après coup n'y touche pas. */
  date: string;
  time: string;
  duration: number;
  prix: number;
  acompte: number;
  /** Le taux des frais de paiement au moment de l'ouverture, en pour cent. */
  taux_frais: number;
  /** En millisecondes UTC. */
  echeance: number;
  ouvre_validation: number;
  fin_fenetre: number;
  paye_le: unknown;
  paiement_id: string | null;
  /** Quand FedaPay libère les fonds de l'acompte (ISO), recopié de la collecte. */
  disponible_le: string | null;
  code: string | null;
  valide_le: unknown;
  cloture: ClotureReglement | null;
  clos_le: unknown;
  created_at: unknown;
  updated_at: unknown;
}

export function etatDuReglement(r: Pick<FirestoreReglement, "paye_le" | "cloture">): EtatReglement {
  return r.cloture ?? (r.paye_le ? "acompte_paye" : "acompte_attendu");
}

export interface EntreePlan {
  /** La réservation telle qu'elle est ; `null` si elle n'existe plus. */
  reservation: {
    status: BookingStatus;
    kind?: string | null;
    owner_id: string;
    user_id: string;
    cancelled_by?: string | null;
  } | null;
  /** Son règlement tel qu'il est ; `null` s'il n'a jamais été ouvert. */
  reglement: { echeance: number; fin_fenetre: number; paye: boolean; valide: boolean; cloture: ClotureReglement | null } | null;
  /** Le terrain fait payer ses frais de réservation dans l'application, et il y a un acompte à demander. */
  payant: boolean;
  maintenant: number;
}

export type PlanReglement =
  | { action: "rien" }
  | { action: "ouvrir" }
  | {
      action: "clore";
      cloture: ClotureReglement;
      /** À qui l'acompte payé est dû ; `null` si rien n'a été payé. */
      du: "proprietaire" | "equipe" | null;
      /** L'acompte n'est pas venu : le serveur annule aussi la réservation, le créneau se libère. */
      annulerReservation: boolean;
    };

/**
 * Que faire du règlement d'une réservation, d'après l'état des deux ?
 *
 * Idempotent : rappelé sur un règlement clos, ou deux fois de suite, il ne
 * demande rien de plus.
 */
export function planReglement({ reservation, reglement, payant, maintenant }: EntreePlan): PlanReglement {
  if (!reglement) {
    const aOuvrir = Boolean(reservation)
      && reservation!.status === "confirmed"
      && reservation!.kind !== "blocage"
      // Le propriétaire qui joue sur son propre terrain ne se verse pas d'acompte.
      && reservation!.owner_id !== reservation!.user_id
      && payant;
    return aOuvrir ? { action: "ouvrir" } : { action: "rien" };
  }
  if (reglement.cloture !== null) return { action: "rien" };

  if (!reservation || reservation.status === "cancelled") {
    const parLeGerant = reservation?.cancelled_by === "proprietaire";
    return {
      action: "clore",
      cloture: parLeGerant ? "annule_proprietaire" : "annule_equipe",
      du: reglement.paye ? (parLeGerant ? "equipe" : "proprietaire") : null,
      annulerReservation: false,
    };
  }

  if (!reglement.paye) {
    return maintenant > reglement.echeance
      ? { action: "clore", cloture: "libere", du: null, annulerReservation: true }
      : { action: "rien" };
  }
  if (reglement.valide) return { action: "clore", cloture: "joue", du: "proprietaire", annulerReservation: false };
  if (maintenant > reglement.fin_fenetre) {
    return { action: "clore", cloture: "absent", du: "proprietaire", annulerReservation: false };
  }
  return { action: "rien" };
}

/**
 * Ce que le serveur montre d'un règlement à l'une de ses deux parties
 * (GET /api/reservations/{id}/reglement). Les montants sont en XOF, les
 * instants en millisecondes UTC.
 */
export interface VueReglement {
  role: "equipe" | "proprietaire";
  etat: EtatReglement;
  terrain: string;
  date: string;
  time: string;
  duration: number;
  /** Le prix du créneau, et ce qui en est payé dans l'application. */
  prix: number;
  acompte: number;
  /** Les frais de paiement ajoutés, et ce que l'équipe paie en tout. */
  frais: number;
  total: number;
  /** Ce qui se règle sur place. */
  reste: number;
  echeance: number;
  /** La fenêtre de validation du ticket. */
  ouvre: number;
  ferme: number;
  /** Le code du ticket : pour l'équipe seule, une fois l'acompte payé. */
  code: string | null;
  valide: boolean;
  /** Pour le propriétaire, réservation close : ce qui lui est dû, et quand cela a été versé (`null` : pas encore). */
  du: { montant: number; verseLe: number | null } | null;
}

/** Ce que dit un ticket au gérant qui le lit (/api/reservations/ticket). */
export interface ResumeTicket {
  reservation: string;
  terrain: string;
  equipe: string;
  date: string;
  time: string;
  duration: number;
  acompte: number;
  reste: number;
  valide: boolean;
}
```

- [ ] **Step 4: Lancer, constater le succès**

Run: `(cd mobile && npx jest src/__tests__/reglement.test.ts)`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reglement.ts mobile/src/__tests__/reglement.test.ts
git commit -m "feat(reglement): les règles des frais de réservation d'un terrain

Acompte de 5 %, échéance, fenêtre de validation du ticket, code, et le
seul calcul qui dit quoi faire d'un règlement d'après l'état de sa
réservation : ouvrir, attendre, clore, et à qui l'acompte est dû.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Le socle sait régler autre chose que le Pro

**Files:**
- Create: `mobile/src/test-aides/faux-firestore.ts`
- Modify: `src/lib/paiement.ts` (objet d'un paiement), `src/lib/fedapay.ts` (date de libération)
- Modify: `src/lib/paiement-serveur.ts` (`reglerPaiement` par effets)
- Modify: `src/app/api/admin/paiements/route.ts`, `src/app/(admin)/admin/offre/page.tsx` (une ligne sans formule)
- Test: `mobile/src/__tests__/paiement-serveur.test.ts`, `mobile/src/__tests__/fedapay.test.ts`, `mobile/src/__tests__/paiement.test.ts`

**Interfaces:**
- Produces :
  - `@/lib/paiement` : `type ObjetPaiement = "pro" | "acompte"`, `objetDe(l: { objet?: ObjetPaiement | null }): ObjetPaiement` ; `FirestorePaiement.formule: IdFormule | null`, `.droit: DroitOffre | null`, `.objet?: ObjetPaiement`, `.reservation_id?: string | null`, `.frais_client?: number` ; `Collecte.disponibleLe: string | null`.
  - `@/lib/paiement-serveur` : `interface ContexteEffet { id: string; jour: string; environnement: EnvironnementPaiement; collecte: Collecte }`, `interface EffetPrepare { ecrire(): void; champs: Partial<FirestorePaiement>; apres: (() => Promise<void>) | null }`, `type Effet = (tx: FirebaseFirestore.Transaction, ligne: FirestorePaiement, c: ContexteEffet) => Promise<EffetPrepare>`, `EFFETS: Record<ObjetPaiement, Effet>` (l'effet `acompte` est branché à la tâche 5) ; `EtatPaiement.formule: IdFormule | null`.
  - `mobile/src/test-aides/faux-firestore.ts` : `base: Map<string, Record<string, unknown>>`, `adminDb` (faux), `vider(): void`.

Refactorisation sous tests verts : le comportement du Pro ne change pas.

- [ ] **Step 1: Sortir le faux Firestore de la suite existante**

Créer `mobile/src/test-aides/faux-firestore.ts` :

```ts
// Un faux Firestore en mémoire pour les suites des modules serveur.
//
// Il tient ses transactions à la file, comme le vrai les isole : deux
// transactions ne s'entrelacent jamais, mais tout ce qui s'écrit HORS
// transaction peut passer entre deux. Les lectures d'une transaction voient
// l'état d'avant, ses écritures s'appliquent d'un coup à la fin.
//
// Hors de `__tests__` exprès : jest prendrait ce fichier pour une suite vide.

export type Doc = Record<string, unknown>;
export interface FauxRef { id: string; path: string }

export const base = new Map<string, Doc>();
let file: Promise<unknown> = Promise.resolve();
let compteur = 0;

/** Un identifiant comme ceux de Firestore : vingt caractères alphanumériques. */
const idNeuf = () => `Auto${String((compteur += 1)).padStart(16, "0")}`;

/** La valeur d'un champ, « pro.jusqu_au » compris. */
function champ(data: Doc, nom: string): unknown {
  return nom.split(".").reduce<unknown>((v, cle) => (v && typeof v === "object" ? (v as Doc)[cle] : undefined), data);
}

function ref(chemin: string) {
  return {
    id: chemin.split("/")[1],
    path: chemin,
    get: async () => snap(chemin),
    set: async (data: Doc, options?: { merge?: boolean }) => {
      base.set(chemin, options?.merge ? { ...(base.get(chemin) ?? {}), ...data } : { ...data });
    },
    update: async (data: Doc) => {
      if (!base.has(chemin)) throw new Error(`document absent : ${chemin}`);
      base.set(chemin, { ...base.get(chemin), ...data });
    },
    delete: async () => { base.delete(chemin); },
  };
}

function snap(chemin: string) {
  const data = base.get(chemin);
  return {
    exists: data !== undefined,
    id: chemin.split("/")[1],
    ref: ref(chemin),
    data: () => (data ? { ...data } : undefined),
    get: (nom: string) => (data ? champ(data, nom) : undefined),
  };
}

type Filtre = [string, string, unknown];

function requete(collection: string, filtres: Filtre[]) {
  const lire = async () => {
    const docs = [...base.entries()]
      .filter(([chemin, data]) => chemin.startsWith(`${collection}/`) && filtres.every(([nom, op, valeur]) => {
        const v = champ(data, nom);
        return op === "in" ? (valeur as unknown[]).includes(v) : v === valeur;
      }))
      .map(([chemin]) => snap(chemin));
    return { docs, empty: docs.length === 0, size: docs.length };
  };
  return {
    where: (nom: string, op: string, valeur: unknown) => requete(collection, [...filtres, [nom, op, valeur]]),
    limit: () => requete(collection, filtres),
    orderBy: () => requete(collection, filtres),
    get: lire,
  };
}

export const adminDb = {
  collection: (nom: string) => ({
    doc: (id?: string) => ref(`${nom}/${id ?? idNeuf()}`),
    where: (champNom: string, op: string, valeur: unknown) => requete(nom, [[champNom, op, valeur]]),
    orderBy: () => requete(nom, []),
    get: requete(nom, []).get,
  }),
  getAll: async (...refs: FauxRef[]) => refs.map((r) => snap(r.path)),
  runTransaction: <T,>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
    const suite = file.then(async () => {
      const ecritures: (() => void)[] = [];
      const resultat = await fn({
        get: async (r: FauxRef) => snap(r.path),
        set: (r: FauxRef, data: Doc, options?: { merge?: boolean }) => {
          ecritures.push(() => base.set(r.path, options?.merge ? { ...(base.get(r.path) ?? {}), ...data } : { ...data }));
        },
        update: (r: FauxRef, data: Doc) => {
          ecritures.push(() => base.set(r.path, { ...base.get(r.path), ...data }));
        },
        delete: (r: FauxRef) => { ecritures.push(() => base.delete(r.path)); },
      });
      ecritures.forEach((ecrire) => ecrire());
      return resultat;
    });
    file = suite.catch(() => {});
    return suite;
  },
};

/** À appeler avant chaque test : une base vide, une file de transactions neuve. */
export function vider(): void {
  base.clear();
  file = Promise.resolve();
}
```

Dans `mobile/src/__tests__/paiement-serveur.test.ts` : supprimer les définitions locales `mockBase`, `mockFile`, `mockSnap`, `mockRef`, `mockChamp`, `mockCompteur`, `mockIdNeuf` et le type `FauxRef`, garder `type Doc = Record<string, unknown>;`, et remplacer le bloc `jest.mock("@/lib/firebase-admin", …)` par :

```ts
jest.mock("@/lib/firebase-admin", () => ({ adminDb: require("../test-aides/faux-firestore").adminDb }));
```

Ajouter en tête du fichier, après les imports :

```ts
import { base as mockBase, vider } from "../test-aides/faux-firestore";
```

et dans le `beforeEach` global, remplacer `mockBase.clear();` et `mockFile = Promise.resolve();` par un seul `vider();`.

Run: `(cd mobile && npx jest src/__tests__/paiement-serveur.test.ts)`
Expected: PASS, 44 tests. (La suite ne change pas de comportement : elle ne fait que changer de faux.)

- [ ] **Step 2: Les tests de ce qui change**

Dans `mobile/src/__tests__/paiement.test.ts`, ajouter `objetDe` à l'import de `@/lib/paiement`, puis :

```ts
describe("objetDe", () => {
  it("une ligne d'avant les acomptes est un achat du Pro", () => {
    expect(objetDe({})).toBe("pro");
    expect(objetDe({ objet: null })).toBe("pro");
    expect(objetDe({ objet: "pro" })).toBe("pro");
  });

  it("reconnaît un acompte", () => {
    expect(objetDe({ objet: "acompte" })).toBe("acompte");
  });
});
```

Dans `mobile/src/__tests__/fedapay.test.ts`, suite `normaliserCollecte` : ajouter `to_be_transferred_at: "2026-10-15T19:32:58.962Z"` à l'objet du premier test, et `disponibleLe: "2026-10-15T19:32:58.962Z"` à son résultat attendu ; ajouter `disponibleLe: null` au résultat attendu du test « rend les champs absents à null ».

Dans `mobile/src/__tests__/paiement-serveur.test.ts` : ajouter `disponibleLe: null` à l'objet rendu par l'aide `collecte(…)`.

Run: `(cd mobile && npx jest src/__tests__/paiement.test.ts src/__tests__/fedapay.test.ts)`
Expected: FAIL (`objetDe` n'existe pas ; `disponibleLe` manque au résultat).

- [ ] **Step 3: L'objet d'un paiement, la date de libération**

Dans `src/lib/paiement.ts` :

- avant `export interface FirestorePaiement`, ajouter :

```ts
/** Ce qu'un paiement achète : le Pro, ou les frais de réservation d'un terrain (lib/reglement). */
export type ObjetPaiement = "pro" | "acompte";

/** L'objet d'une ligne ; les lignes d'avant les acomptes n'en portent pas : ce sont des achats du Pro. */
export function objetDe(l: { objet?: ObjetPaiement | null }): ObjetPaiement {
  return l.objet === "acompte" ? "acompte" : "pro";
}
```

- dans `FirestorePaiement`, remplacer `formule: IdFormule;` et `droit: DroitOffre;` par :

```ts
  /** Absent d'une ligne d'avant les acomptes : un achat du Pro. */
  objet?: ObjetPaiement;
  /** La formule et le droit achetés ; `null` pour un acompte. */
  formule: IdFormule | null;
  droit: DroitOffre | null;
  /** Pour un acompte : la réservation dont il est l'acompte. */
  reservation_id?: string | null;
  /** Pour un acompte : la part de `montant` qui est des frais de paiement. */
  frais_client?: number;
```

- dans `FirestorePaiement`, remplacer le commentaire de `montant` par `/** En XOF, entier : le total demandé à FedaPay, frais de paiement compris. */`.

- dans `Collecte`, ajouter après `recuUrl` :

```ts
  /** Quand FedaPay libère les fonds de cette collecte (ISO) ; `null` s'il ne le dit pas. */
  disponibleLe: string | null;
```

Dans `src/lib/fedapay.ts`, `normaliserCollecte` : ajouter au résultat `disponibleLe: texte(brut.to_be_transferred_at),`.

- [ ] **Step 4: `reglerPaiement` par effets**

Dans `src/lib/paiement-serveur.ts` :

- ajouter `objetDe`, `type Collecte`, `type EnvironnementPaiement`, `type ObjetPaiement` à l'import de `@/lib/paiement`.

- remplacer le type `formule` de `EtatPaiement` par `formule: IdFormule | null;`.

- juste avant le commentaire « Règle un paiement », ajouter :

```ts
/** Ce qu'un effet reçoit : la ligne réglée, la collecte relue, le jour. */
export interface ContexteEffet {
  id: string;
  jour: string;
  environnement: EnvironnementPaiement;
  collecte: Collecte;
}

/** Un effet prêt à s'appliquer : ses lectures sont faites, il ne reste qu'à écrire. */
export interface EffetPrepare {
  /** Les écritures de l'effet, dans la transaction. */
  ecrire(): void;
  /** Ce que l'effet pose sur la ligne de paiement. */
  champs: Partial<FirestorePaiement>;
  /** Après la transaction : prévenir. Ne remet rien en cause. */
  apres: (() => Promise<void>) | null;
}

/**
 * Ce qu'un paiement réglé change, selon son objet.
 *
 * UN EFFET LIT, PUIS ÉCRIT. Une transaction Firestore veut toutes ses
 * lectures avant sa première écriture : l'effet fait les siennes en se
 * préparant, et `reglerPaiement` n'appelle `ecrire` qu'ensuite, avec le
 * passage de la ligne à « payé ». L'argent reçu et ce qu'il achète tiennent
 * ainsi dans la même transaction.
 */
export type Effet = (tx: FirebaseFirestore.Transaction, ligne: FirestorePaiement, c: ContexteEffet) => Promise<EffetPrepare>;

/** L'achat du Pro : la période s'ajoute à la fin en cours (lib/paiement, nouvelleEcheance). */
const effetPro: Effet = async (tx, ligne, c) => {
  const droitsRef = adminDb.collection("droits").doc(ligne.uid);
  const actuel = ((await tx.get(droitsRef)).data() as FirestoreDroits | undefined)?.pro ?? null;
  const mois = ligne.formule ? FORMULES[ligne.formule].mois : 0;
  const suite = mois > 0 ? nouvelleEcheance(actuel, c.jour, mois) : null;
  if (!suite) {
    // Un Pro sans échéance a été accordé entre le clic et le paiement : on
    // ne l'écrase pas. La ligne est payée, sans échéance : l'administration
    // la voit « payée sans effet » et rembourse à la main.
    return { ecrire: () => {}, champs: { echeance_avant: null, echeance_apres: null }, apres: null };
  }
  const accorde: DroitAccorde = {
    depuis: suite.depuis,
    jusqu_au: suite.jusqu_au,
    source: "paiement",
    accorde_par: null,
    motif: motifAchat(mois, c.environnement),
  };
  return {
    ecrire: () => tx.set(droitsRef, { pro: accorde, updated_at: FieldValue.serverTimestamp() }, { merge: true }),
    champs: {
      echeance_avant: actuel && droitActif(actuel, c.jour) ? actuel.jusqu_au : null,
      echeance_apres: suite.jusqu_au,
    },
    apres: () => accuserReception(ligne, suite.jusqu_au, c.collecte.recuUrl),
  };
};

/** Un objet dont l'effet n'est pas encore branché : la ligne est payée, rien d'autre ne bouge. */
const sansEffet: Effet = async () => ({ ecrire: () => {}, champs: {}, apres: null });

export const EFFETS: Record<ObjetPaiement, Effet> = { pro: effetPro, acompte: sansEffet };
```

- dans `reglerPaiement`, remplacer tout le corps de la transaction et ce qui la suit (de `const jour = jourDeLome();` jusqu'à la fin de la fonction) par :

```ts
  const contexte: ContexteEffet = { id, jour: jourDeLome(), environnement, collecte };
  const resultat = await adminDb.runTransaction(async (tx) => {
    const l = await tx.get(ref);
    if (!l.exists) return null;
    const courante = l.data() as FirestorePaiement;

    const decision = deciderReglement(courante, id, collecte);
    if (decision.anomalie) {
      tx.update(ref, { ...suivi, anomalie: decision.anomalie });
      return { ligne: { ...courante, anomalie: decision.anomalie }, apres: null };
    }
    if (!decision.accorder) {
      // Une ligne payée le reste (deciderReglement) : seul le suivi bouge.
      tx.update(ref, { ...suivi, statut: decision.statut });
      return { ligne: { ...courante, statut: decision.statut }, apres: null };
    }

    const effet = await EFFETS[objetDe(courante)](tx, courante, contexte);
    effet.ecrire();
    const regle = { ...suivi, statut: "paye" as const, applique_le: FieldValue.serverTimestamp(), ...effet.champs };
    tx.update(ref, regle);
    return { ligne: { ...courante, ...effet.champs, statut: "paye" as const }, apres: effet.apres };
  });
  if (!resultat) return null;

  if (resultat.ligne.anomalie && !ligne.anomalie) {
    console.error("[paiements] écart avec FedaPay:", id, resultat.ligne.anomalie, { collecte: collecte.id });
  }
  if (resultat.apres) await resultat.apres().catch((err) => console.error("[paiements] après règlement:", id, err));
  return vueEtat(resultat.ligne);
}
```

Conserver, au-dessus, le commentaire « TOUT SE DÉCIDE DANS LA TRANSACTION… » : il reste vrai. Supprimer les lignes devenues inutiles (`const droitsRef = …` dans `reglerPaiement`).

- dans `demarrerPaiement`, l'objet `ligne` : ajouter `objet: "pro",` après `uid,`.

- [ ] **Step 5: Une ligne sans formule, dans l'administration**

Dans `src/app/(admin)/admin/offre/page.tsx` : le type `VuePaiement` reçoit `formule: IdFormule | null;`, et l'affichage `{LIBELLE_FORMULE[p.formule]}` devient `{p.formule ? LIBELLE_FORMULE[p.formule] : "Frais de réservation"}`.

`src/app/api/admin/paiements/route.ts` renvoie déjà `formule: l.formule` : rien à changer.

- [ ] **Step 6: Vérifier que rien n'a bougé**

Run: `(cd mobile && npx jest src/__tests__/paiement-serveur.test.ts src/__tests__/paiement.test.ts src/__tests__/fedapay.test.ts)`
Expected: PASS. Les 44 tests de `paiement-serveur` passent sans avoir été modifiés, hors le faux partagé et `disponibleLe`.

Run: `npx tsc --noEmit`
Expected: aucune erreur.

Run: `(cd mobile && npx tsc --noEmit)`
Expected: les 3 erreurs préexistantes, aucune dans `test-aides` ni dans les suites.

- [ ] **Step 7: Commit**

```bash
git add src/lib/paiement.ts src/lib/fedapay.ts src/lib/paiement-serveur.ts "src/app/(admin)/admin/offre/page.tsx" mobile/src/test-aides/faux-firestore.ts mobile/src/__tests__/paiement-serveur.test.ts mobile/src/__tests__/paiement.test.ts mobile/src/__tests__/fedapay.test.ts
git commit -m "refactor(paiement): reglerPaiement applique un effet selon l'objet du paiement

Le Pro n'était qu'un cas : la collecte relue et vérifiée, ce qu'elle
achète est désormais un effet, écrit dans la même transaction que le
passage à « payé ». Rien ne change pour le Pro ; les frais de
réservation d'un terrain s'y brancheront. Le faux Firestore des tests
devient un fichier partagé.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Les sommes dues

**Files:**
- Create: `src/lib/versements-serveur.ts`
- Test: `mobile/src/__tests__/versements-serveur.test.ts`

**Interfaces:**
- Consumes: `adminDb` ; `numeroTogolais` de `@/lib/reglement` ; `notifierCompte` de `@/lib/notifier-serveur` ; `sendNotificationEmail(to, subject, html)`, `adminMessageEmailHtml(title, body, lien)` de `@/lib/email`.
- Produces (tout exporté de `@/lib/versements-serveur`) :
  - `interface FirestoreDu { beneficiaire: string; role: "proprietaire" | "equipe"; montant: number; motif: "acompte" | "remboursement"; reservation_id: string; libelle: string; telephone: string | null; disponible_le: string | null; depot_id: string | null; regle_le: unknown; created_at: unknown }`
  - `idDu(reservationId: string, motif: "acompte" | "remboursement", paiementId?: string | null): string`
  - `preparerDu(tx: FirebaseFirestore.Transaction, id: string, du: Omit<FirestoreDu, "depot_id" | "regle_le" | "created_at">): Promise<() => void>` : lit la somme dans la transaction, et rend l'écriture à appeler ensuite (sans effet si la somme existe déjà).
  - `interface CompteVersement { numero: string; pays: "tg"; modifie_le: number }`
  - `lireCompteVersement(uid: string): Promise<CompteVersement | null>`
  - `ecrireCompteVersement(uid: string, brut: unknown, maintenant?: number): Promise<CompteVersement>` (lève `ErreurVersement`)
  - `class ErreurVersement extends Error { readonly status: number }`
  - `reglerALaMain(ids: string[], adminUid: string): Promise<{ regles: number; montant: number }>`
  - `sommesDues(): Promise<{ beneficiaire: string; nom: string; numero: string | null; total: number; lignes: (FirestoreDu & { id: string })[] }[]>`

- [ ] **Step 1: Écrire les tests**

Créer `mobile/src/__tests__/versements-serveur.test.ts` :

```ts
import { adminDb, base, vider } from "../test-aides/faux-firestore";

// Les sommes dues (src/lib/versements-serveur), jouées contre le faux
// Firestore. C'est ici qu'on tient qu'une somme due ne se règle qu'une fois.

type Doc = Record<string, unknown>;

const mockNotifier = jest.fn(async (_uid: string, _n: unknown) => {});
const mockEmail = jest.fn(async (_a: string, _sujet: string, _html: string) => {});

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => ({ toMillis: () => Date.now() }) },
}));
jest.mock("@/lib/firebase-admin", () => ({ adminDb: require("../test-aides/faux-firestore").adminDb }));
jest.mock("@/lib/notifier-serveur", () => ({ notifierCompte: (uid: string, n: unknown) => mockNotifier(uid, n) }));
jest.mock("@/lib/email", () => ({
  adminMessageEmailHtml: (titre: string, corps: string) => `<p>${titre} ${corps}</p>`,
  sendNotificationEmail: (a: string, sujet: string, html: string) => mockEmail(a, sujet, html),
}));

// `require`, et non `import` : le module tire firebase-admin, dont la
// vérification de types de l'application mobile n'a pas les types.
const {
  idDu, preparerDu, lireCompteVersement, ecrireCompteVersement, reglerALaMain, sommesDues,
} = require("@/lib/versements-serveur") as {
  preparerDu: (tx: unknown, id: string, du: Doc) => Promise<() => void>;
  idDu: (reservationId: string, motif: "acompte" | "remboursement", paiementId?: string | null) => string;
  lireCompteVersement: (uid: string) => Promise<{ numero: string; pays: string; modifie_le: number } | null>;
  ecrireCompteVersement: (uid: string, brut: unknown, maintenant?: number) => Promise<{ numero: string }>;
  reglerALaMain: (ids: string[], adminUid: string) => Promise<{ regles: number; montant: number }>;
  sommesDues: () => Promise<{ beneficiaire: string; nom: string; numero: string | null; total: number; lignes: Doc[] }[]>;
};

const du = (p: Doc = {}): Doc => ({
  beneficiaire: "gerant", role: "proprietaire", montant: 500, motif: "acompte", reservation_id: "resa1",
  libelle: "Terrain des Cocotiers · 17 octobre 18:00", telephone: null, disponible_le: null, depot_id: null, regle_le: null,
  created_at: "t0", ...p,
});

beforeEach(() => {
  vider();
  mockNotifier.mockClear();
  mockEmail.mockClear();
});

describe("idDu", () => {
  it("une réservation n'a qu'un acompte dû", () => {
    expect(idDu("resa1", "acompte")).toBe("resa1_acompte");
  });

  it("un remboursement est celui d'un paiement précis", () => {
    expect(idDu("resa1", "remboursement", "paie1")).toBe("resa1_remb_paie1");
  });
});

describe("preparerDu", () => {
  const poser = (id: string, p: Doc = {}) => adminDb.runTransaction(async (tx) => {
    const ecrire = await preparerDu(tx, id, {
      beneficiaire: "gerant", role: "proprietaire", montant: 500, motif: "acompte", reservation_id: "resa1",
      libelle: "Terrain des Cocotiers · 17 octobre 18:00", telephone: null, disponible_le: null, ...p,
    });
    ecrire();
  });

  it("écrit une somme à verser, que la liste des sommes dues retrouve", async () => {
    await poser("resa1_acompte");

    expect(base.get("dus/resa1_acompte")).toMatchObject({ beneficiaire: "gerant", montant: 500, depot_id: null, regle_le: null });
    expect(await sommesDues()).toHaveLength(1);
  });

  it("ne remet pas à verser une somme déjà versée", async () => {
    await poser("resa1_acompte");
    await reglerALaMain(["resa1_acompte"], "admin1");

    await poser("resa1_acompte", { montant: 900 });

    expect(base.get("dus/resa1_acompte")).toMatchObject({ montant: 500 });
    expect(base.get("dus/resa1_acompte")?.regle_le).toBeTruthy();
    expect(await sommesDues()).toHaveLength(0);
  });
});

describe("le compte de versement", () => {
  it("s'enregistre avec un numéro togolais, réduit à ses huit chiffres", async () => {
    await ecrireCompteVersement("gerant", "+228 90 12 34 56", 1000);
    expect(await lireCompteVersement("gerant")).toEqual({ numero: "90123456", pays: "tg", modifie_le: 1000 });
  });

  it("refuse un numéro qui n'en est pas un", async () => {
    await expect(ecrireCompteVersement("gerant", "12345", 1000)).rejects.toMatchObject({ status: 400 });
    expect(await lireCompteVersement("gerant")).toBeNull();
  });

  it("ne prévient pas pour un premier numéro, ni pour le même numéro", async () => {
    await ecrireCompteVersement("gerant", "90123456", 1000);
    await ecrireCompteVersement("gerant", "90 12 34 56", 2000);
    expect(mockNotifier).not.toHaveBeenCalled();
    expect((await lireCompteVersement("gerant"))?.modifie_le).toBe(1000);
  });

  it("prévient le propriétaire quand le numéro change, cloche et e-mail, et date le changement", async () => {
    base.set("users/gerant", { first_name: "Kossi", email: "kossi@exemple.test" });
    await ecrireCompteVersement("gerant", "90123456", 1000);
    await ecrireCompteVersement("gerant", "99887766", 5000);
    expect(mockNotifier).toHaveBeenCalledTimes(1);
    expect(mockNotifier.mock.calls[0][0]).toBe("gerant");
    expect(mockEmail).toHaveBeenCalledTimes(1);
    expect(mockEmail.mock.calls[0][0]).toBe("kossi@exemple.test");
    expect(mockEmail.mock.calls[0][2]).toContain("99 88 77 66");
    expect(await lireCompteVersement("gerant")).toEqual({ numero: "99887766", pays: "tg", modifie_le: 5000 });
  });

  it("change le numéro même quand le compte n'a pas d'e-mail", async () => {
    await ecrireCompteVersement("gerant", "90123456", 1000);
    await ecrireCompteVersement("gerant", "99887766", 5000);
    expect(mockEmail).not.toHaveBeenCalled();
    expect(mockNotifier).toHaveBeenCalledTimes(1);
  });
});

describe("reglerALaMain", () => {
  it("marque les sommes versées et les rattache à un dépôt « manuel »", async () => {
    base.set("dus/a", du());
    base.set("dus/b", du({ montant: 400, reservation_id: "resa2" }));

    expect(await reglerALaMain(["a", "b"], "admin1")).toEqual({ regles: 2, montant: 900 });

    const depots = [...base.entries()].filter(([chemin]) => chemin.startsWith("depots/"));
    expect(depots).toHaveLength(1);
    expect(depots[0][1]).toMatchObject({ beneficiaire: "gerant", montant: 900, etat: "manuel", regle_par: "admin1", dus: ["a", "b"] });
    expect(base.get("dus/a")).toMatchObject({ depot_id: depots[0][0].split("/")[1] });
    expect(base.get("dus/a")?.regle_le).toBeTruthy();
  });

  it("ne règle pas deux fois la même somme", async () => {
    base.set("dus/a", du());
    await reglerALaMain(["a"], "admin1");
    expect(await reglerALaMain(["a"], "admin1")).toEqual({ regles: 0, montant: 0 });
    expect([...base.keys()].filter((chemin) => chemin.startsWith("depots/"))).toHaveLength(1);
  });

  it("ne règle pas deux fois quand deux administrateurs cliquent en même temps", async () => {
    base.set("dus/a", du());
    const [un, deux] = await Promise.all([reglerALaMain(["a"], "admin1"), reglerALaMain(["a"], "admin2")]);
    expect(un.regles + deux.regles).toBe(1);
    expect([...base.keys()].filter((chemin) => chemin.startsWith("depots/"))).toHaveLength(1);
  });

  it("refuse de mêler deux bénéficiaires dans un même versement", async () => {
    base.set("dus/a", du());
    base.set("dus/b", du({ beneficiaire: "autre" }));
    await expect(reglerALaMain(["a", "b"], "admin1")).rejects.toMatchObject({ status: 400 });
    expect(base.get("dus/a")?.regle_le).toBeNull();
  });

  it("ignore une ligne qui n'existe pas", async () => {
    base.set("dus/a", du());
    expect(await reglerALaMain(["a", "fantome"], "admin1")).toEqual({ regles: 1, montant: 500 });
  });
});

describe("sommesDues", () => {
  it("regroupe par bénéficiaire ce qui n'est pas encore versé, avec son numéro", async () => {
    base.set("dus/a", du());
    base.set("dus/b", du({ montant: 400, reservation_id: "resa2" }));
    base.set("dus/c", du({ beneficiaire: "equipe", role: "equipe", motif: "remboursement", montant: 500 }));
    base.set("dus/d", du({ regle_le: "hier", depot_id: "dep0" }));
    base.set("users/gerant", { first_name: "Kossi", last_name: "Mensah" });
    base.set("comptes_versement/gerant", { numero: "90123456", pays: "tg", modifie_le: 1 });

    const groupes = await sommesDues();

    expect(groupes).toHaveLength(2);
    const gerant = groupes.find((g) => g.beneficiaire === "gerant");
    expect(gerant).toMatchObject({ nom: "Kossi Mensah", numero: "90123456", total: 900 });
    expect(gerant?.lignes).toHaveLength(2);
    expect(groupes.find((g) => g.beneficiaire === "equipe")).toMatchObject({ numero: null, total: 500 });
  });
});
```

- [ ] **Step 2: Lancer, constater l'échec**

Run: `(cd mobile && npx jest src/__tests__/versements-serveur.test.ts)`
Expected: FAIL, `Could not locate module @/lib/versements-serveur`.

- [ ] **Step 3: Écrire le module**

Créer `src/lib/versements-serveur.ts` :

```ts
import { FieldValue } from "firebase-admin/firestore";
import { adminMessageEmailHtml, sendNotificationEmail } from "@/lib/email";
import { adminDb } from "@/lib/firebase-admin";
import { notifierCompte } from "@/lib/notifier-serveur";
import { numeroTogolais } from "@/lib/reglement";

// ============================================
// Ce que KoppaFoot doit, et à qui.
//
// UNE LIGNE PAR SOMME DUE (`dus`). L'acompte d'une réservation jouée, dû à
// son propriétaire ; l'acompte rendu à une équipe parce que le propriétaire a
// annulé. Chaque ligne dit pourquoi, et depuis quand FedaPay a libéré
// l'argent qui la couvre.
//
// UNE SOMME DUE NE SE VERSE QU'UNE FOIS. Son identifiant est écrit d'avance
// (`idDu`), et elle ne s'écrit que si elle n'existe pas (`preparerDu`) :
// rejouer le geste qui la crée n'en crée pas une seconde, et ne remet pas à
// verser une somme déjà versée. Elle est rattachée à son versement dans une
// transaction : deux clics simultanés n'en règlent qu'un.
//
// LE VERSEMENT, POUR L'INSTANT, EST FAIT À LA MAIN. Les dépôts FedaPay sont
// fermés sur le compte tant que leur support ne les a pas activés :
// l'administration lit ici ce qui est dû à chacun, verse par mobile money, et
// le marque. Le dépôt automatique écrira les mêmes documents (`depots`), et
// ce geste restera le filet d'un dépôt en échec.
//
// LE NUMÉRO DE VERSEMENT EST UNE CIBLE. Qui prend le compte d'un propriétaire
// détourne ses versements en le changeant : tout changement le prévient, et
// porte sa date (`modifie_le`), que le dépôt automatique lira.
// ============================================

const dus = () => adminDb.collection("dus");

export class ErreurVersement extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ErreurVersement";
  }
}

/** Une somme due — `dus/{id}`. Écrite par le serveur seul. */
export interface FirestoreDu {
  beneficiaire: string;
  role: "proprietaire" | "equipe";
  /** En XOF, entier. */
  montant: number;
  motif: "acompte" | "remboursement";
  reservation_id: string;
  /** « Terrain des Cocotiers · samedi 17 octobre à 18:00 », pour qui lit la liste. */
  libelle: string;
  /**
   * Pour un remboursement : le téléphone que l'équipe a donné dans sa demande,
   * où le lui rendre. `null` pour un propriétaire (il a son compte de
   * versement), et quand la réservation n'en porte pas.
   */
  telephone: string | null;
  /** Quand FedaPay libère les fonds (ISO) ; `null` s'il ne l'a pas dit. */
  disponible_le: string | null;
  depot_id: string | null;
  regle_le: unknown;
  created_at: unknown;
}

/**
 * L'identifiant d'une somme due, écrit d'avance. Une réservation n'a qu'un
 * acompte dû ; un remboursement est celui d'un paiement précis.
 */
export function idDu(reservationId: string, motif: "acompte" | "remboursement", paiementId?: string | null): string {
  return motif === "acompte" ? `${reservationId}_acompte` : `${reservationId}_remb_${paiementId ?? "x"}`;
}

/**
 * Prépare l'écriture d'une somme due dans une transaction, et rend cette
 * écriture.
 *
 * EN DEUX TEMPS, parce qu'une transaction Firestore veut toutes ses lectures
 * avant sa première écriture : on lit ici si la somme existe, l'appelant écrit
 * ensuite, avec le reste. Une somme qui existe n'est jamais réécrite : elle
 * porte peut-être déjà son versement.
 *
 * `regle_le: null` est écrit en toutes lettres : c'est sur lui que la liste
 * des sommes à verser filtre, et Firestore ne retrouve pas un champ absent.
 */
export async function preparerDu(
  tx: FirebaseFirestore.Transaction,
  id: string,
  du: Omit<FirestoreDu, "depot_id" | "regle_le" | "created_at">,
): Promise<() => void> {
  const ref = dus().doc(id);
  const deja = (await tx.get(ref)).exists;
  return () => {
    if (!deja) tx.set(ref, { ...du, depot_id: null, regle_le: null, created_at: FieldValue.serverTimestamp() });
  };
}

export interface CompteVersement {
  numero: string;
  pays: "tg";
  /** Quand le numéro a changé pour la dernière fois, en millisecondes. */
  modifie_le: number;
}

export async function lireCompteVersement(uid: string): Promise<CompteVersement | null> {
  const d = (await adminDb.collection("comptes_versement").doc(uid).get()).data();
  return d && typeof d.numero === "string"
    ? { numero: d.numero, pays: "tg", modifie_le: typeof d.modifie_le === "number" ? d.modifie_le : 0 }
    : null;
}

/** Enregistre le numéro où verser un propriétaire. Un changement le prévient. */
export async function ecrireCompteVersement(uid: string, brut: unknown, maintenant: number = Date.now()): Promise<CompteVersement> {
  const numero = numeroTogolais(brut);
  if (!numero) throw new ErreurVersement("Donne un numéro mobile money togolais : huit chiffres.", 400);

  const avant = await lireCompteVersement(uid);
  if (avant?.numero === numero) return avant;

  const compte: CompteVersement = { numero, pays: "tg", modifie_le: maintenant };
  await adminDb.collection("comptes_versement").doc(uid).set(compte);
  if (avant) {
    // Par tous les chemins : c'est le seul signal qu'a un propriétaire dont le
    // compte vient d'être pris. Rien ici ne défait le changement.
    const title = "Ton numéro de versement a changé";
    const body = `Les frais de réservation de tes terrains seront versés au ${numero.replace(/(\d{2})(?=\d)/g, "$1 ")}. `
      + "Si ce n'est pas toi, écris-nous tout de suite.";
    const email = (await adminDb.collection("users").doc(uid).get()).data()?.email;
    await Promise.allSettled([
      notifierCompte(uid, { type: "booking_answer", title, body, link: "/mes-terrains" }),
      typeof email === "string" && email
        ? sendNotificationEmail(email, title, adminMessageEmailHtml(title, body, "/mes-terrains"))
        : null,
    ]);
  }
  return compte;
}

/**
 * L'administration a versé ces sommes par mobile money : les marquer.
 *
 * Toutes doivent revenir au même bénéficiaire : c'est UN versement. Celles
 * déjà réglées sont ignorées, pas reversées.
 */
export async function reglerALaMain(ids: string[], adminUid: string): Promise<{ regles: number; montant: number }> {
  const uniques = [...new Set(ids.filter((id) => typeof id === "string" && id))];
  if (uniques.length === 0) return { regles: 0, montant: 0 };

  return adminDb.runTransaction(async (tx) => {
    const lus = await Promise.all(uniques.map((id) => tx.get(dus().doc(id))));
    const aRegler = lus.filter((s) => s.exists && !s.get("regle_le"));
    if (aRegler.length === 0) return { regles: 0, montant: 0 };

    const beneficiaires = new Set(aRegler.map((s) => s.get("beneficiaire") as string));
    if (beneficiaires.size > 1) throw new ErreurVersement("Un versement ne règle qu'un bénéficiaire à la fois.", 400);

    const montant = aRegler.reduce((somme, s) => somme + ((s.get("montant") as number) ?? 0), 0);
    const depot = adminDb.collection("depots").doc();
    tx.set(depot, {
      beneficiaire: [...beneficiaires][0],
      numero: null,
      montant,
      etat: "manuel",
      fedapay_id: null,
      dus: aRegler.map((s) => s.id),
      regle_par: adminUid,
      erreur: null,
      created_at: FieldValue.serverTimestamp(),
    });
    for (const s of aRegler) tx.update(s.ref, { depot_id: depot.id, regle_le: FieldValue.serverTimestamp() });
    return { regles: aRegler.length, montant };
  });
}

/** Ce qui reste à verser, regroupé par bénéficiaire, avec de quoi le joindre. */
export async function sommesDues(): Promise<{
  beneficiaire: string; nom: string; numero: string | null; total: number; lignes: (FirestoreDu & { id: string })[];
}[]> {
  const snap = await dus().where("regle_le", "==", null).get();
  const parBeneficiaire = new Map<string, (FirestoreDu & { id: string })[]>();
  for (const d of snap.docs) {
    const ligne = { id: d.id, ...(d.data() as FirestoreDu) };
    parBeneficiaire.set(ligne.beneficiaire, [...(parBeneficiaire.get(ligne.beneficiaire) ?? []), ligne]);
  }
  return Promise.all([...parBeneficiaire].map(async ([beneficiaire, lignes]) => {
    const [profil, compte] = await Promise.all([
      adminDb.collection("users").doc(beneficiaire).get().then((s) => s.data() ?? {}),
      lireCompteVersement(beneficiaire),
    ]);
    return {
      beneficiaire,
      nom: `${profil.first_name ?? ""} ${profil.last_name ?? ""}`.trim() || "Compte sans nom",
      numero: compte?.numero ?? null,
      total: lignes.reduce((somme, l) => somme + l.montant, 0),
      lignes,
    };
  }));
}
```

- [ ] **Step 4: Lancer, constater le succès**

Run: `(cd mobile && npx jest src/__tests__/versements-serveur.test.ts)`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add src/lib/versements-serveur.ts mobile/src/__tests__/versements-serveur.test.ts
git commit -m "feat(versements): ce que KoppaFoot doit, à qui, et le régler à la main

Une ligne par somme due, sous un identifiant écrit d'avance, écrite une
seule fois : rejouer le geste qui la crée n'en crée pas une seconde. Le versement se marque dans
une transaction, un seul bénéficiaire à la fois. Le numéro de versement
d'un propriétaire porte la date de son dernier changement, et le
prévient quand il change.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Le serveur des règlements

**Files:**
- Create: `src/lib/reglement-serveur.ts`
- Modify: `src/lib/paiement-serveur.ts` (`EFFETS.acompte`, `demarrerAcompte`, refus nouveaux)
- Test: `mobile/src/__tests__/reglement-serveur.test.ts`

**Interfaces:**
- Consumes: tout `@/lib/reglement` (tâche 2) ; `preparerDu`, `idDu`, `lireCompteVersement` de `@/lib/versements-serveur` (tâche 4) ; `type Effet`, `reglerPaiement` de `@/lib/paiement-serveur` (tâche 3) ; `recopierSurLeMatch(ref: { mid: string; cid?: string | null }, valeur)`, `surLeMatch(id, b, status)` de `@/lib/reservations-server` ; `notifierCompte` ; `dateLongue` de `@/lib/terrains`.
- Produces (de `@/lib/reglement-serveur`) :
  - `class ErreurReglement extends Error { readonly status: number }`
  - `terrainPayant(venueId: string): Promise<{ payant: boolean; depuis: number; tarif: number; battement: Battement; nom: string }>`
  - `suivreReservation(id: string, options?: { maintenant?: number; annoncer?: boolean }): Promise<(FirestoreReglement & { id: string }) | null>`
  - `texteAcompteAttendu(r: FirestoreReglement): string`
  - `effetAcompte: Effet`
  - `lireTicket(uid: string, brut: unknown, maintenant?: number): Promise<ResumeTicket>`, `validerTicket(uid: string, brut: unknown, maintenant?: number): Promise<ResumeTicket>`
  - `vuePour(uid: string, idReservation: string): Promise<VueReglement | null>`
  - `suivreReglementsOuverts(maintenant?: number): Promise<{ suivis: number; clos: number }>`
- Produces (de `@/lib/paiement-serveur`) : `demarrerAcompte(uid: string, reservation: unknown, origine: string): Promise<{ id: string; url: string }>` ; `RefusPaiement` gagne `"reservation" | "deja_paye" | "trop_tard"`.

- [ ] **Step 1: Écrire les tests**

Créer `mobile/src/__tests__/reglement-serveur.test.ts` :

```ts
import type { FirestoreReglement } from "@/lib/reglement";
import type { Collecte, FirestorePaiement } from "@/lib/paiement";
import { base, vider } from "../test-aides/faux-firestore";

// Le serveur des règlements (src/lib/reglement-serveur) et l'effet d'un
// acompte dans reglerPaiement, joués contre le faux Firestore et un faux
// FedaPay. C'est le circuit d'argent des terrains : qui doit quoi à qui, et
// jamais deux fois.

type Doc = Record<string, unknown>;

const mockFedapay = {
  environnement: "sandbox",
  creerCollecte: jest.fn(),
  lienDePaiement: jest.fn(),
  lireCollecte: jest.fn(),
  lireCollecteParReference: jest.fn(),
};
const mockNotifier = jest.fn(async (_uid: string, _n: unknown) => {});
const mockSurMatch = jest.fn(async (_ref: unknown, _valeur: unknown) => {});

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => ({ toMillis: () => Date.now() }) },
}));
jest.mock("@/lib/firebase-admin", () => ({ adminDb: require("../test-aides/faux-firestore").adminDb }));
jest.mock("@/lib/admin-api-auth", () => ({ estSuperadmin: (d?: Doc) => d?.is_superadmin === true }));
jest.mock("@/lib/email", () => ({ recuPaiementHtml: () => "<p>reçu</p>", sendNotificationEmail: jest.fn(async () => {}) }));
jest.mock("@/lib/notifier-serveur", () => ({ notifierCompte: (uid: string, n: unknown) => mockNotifier(uid, n) }));
jest.mock("@/lib/partage", () => ({ APP_URL: "https://www.koppafoot.com" }));
jest.mock("@/lib/reservations-server", () => ({
  recopierSurLeMatch: (ref: unknown, valeur: unknown) => mockSurMatch(ref, valeur),
  surLeMatch: (id: string, b: Doc, status: string) => ({ booking_id: id, venue_id: b.venue_id, venue_name: b.venue_name, status, proposition: null }),
}));
jest.mock("@/lib/fedapay", () => ({
  environnementFedapay: () => mockFedapay.environnement,
  fedapayConfigure: () => true,
  creerCollecte: (demande: unknown) => mockFedapay.creerCollecte(demande),
  lienDePaiement: (id: number) => mockFedapay.lienDePaiement(id),
  lireCollecte: (id: number) => mockFedapay.lireCollecte(id),
  lireCollecteParReference: (reference: string) => mockFedapay.lireCollecteParReference(reference),
}));

// `require`, et non `import` : ces modules tirent firebase-admin et
// next/server, dont la vérification de types de l'application mobile n'a pas
// les types.
type Reglement = FirestoreReglement & { id: string };
const { suivreReservation, lireTicket, validerTicket, vuePour, suivreReglementsOuverts } = require("@/lib/reglement-serveur") as {
  suivreReservation: (id: string, options?: { maintenant?: number; annoncer?: boolean }) => Promise<Reglement | null>;
  lireTicket: (uid: string, brut: unknown, maintenant?: number) => Promise<Doc>;
  validerTicket: (uid: string, brut: unknown, maintenant?: number) => Promise<Doc>;
  vuePour: (uid: string, id: string) => Promise<Doc | null>;
  suivreReglementsOuverts: (maintenant?: number) => Promise<{ suivis: number; clos: number }>;
};
const { reglerPaiement, demarrerAcompte } = require("@/lib/paiement-serveur") as {
  reglerPaiement: (id: string) => Promise<{ statut: string } | null>;
  demarrerAcompte: (uid: string, reservation: unknown, origine: string) => Promise<{ id: string; url: string }>;
};

const H = 3_600_000;
const RESA = "ResaAbCdEfGhIjKlMnOp";
const PAIE = "PaieAbCdEfGhIjKlMnOp";
/**
 * Un créneau dans dix jours, à 18 h. Jamais une date écrite en dur : les
 * fonctions qui lisent l'heure réelle (demarrerAcompte, vuePour) doivent
 * toujours le trouver à venir, le jour où cette suite tourne.
 */
const DEBUT = (Math.floor(Date.now() / (24 * H)) + 10) * 24 * H + 18 * H;
const DATE = new Date(DEBUT).toISOString().slice(0, 10);
/** Deux jours avant le match : la confirmation. */
const J2 = DEBUT - 48 * H;

const reservation = (p: Doc = {}): Doc => ({
  venue_id: "terrain1", venue_name: "Terrain des Cocotiers", owner_id: "gerant", user_id: "equipe",
  user_name: "Ama Koffi", team_name: "Étoile de Bè", date: DATE, time: "18:00", duration: 1,
  total_price: 0, status: "confirmed", kind: "demande", match_id: null, competition_id: null,
  cancelled_by: null, contact: { telephone: "90112233", email: null },
  // Demandée après l'activation des frais sur le terrain (1 000 < 2 000).
  created_at: { toMillis: () => 2_000 }, ...p,
});
const terrain = (p: Doc = {}): Doc => ({
  name: "Terrain des Cocotiers", owner_id: "gerant", price_per_hour: 10_000, paiement_app: true,
  paiement_app_depuis: 1_000, battement_min: 15, ...p,
});
const collecte = (statut: string, p: Partial<Collecte> = {}): Collecte => ({
  id: 258, statut, montant: 520, reference: PAIE, mode: "momo_test", frais: 20, recuUrl: null,
  disponibleLe: "2026-10-18T10:00:00.000Z", ...p,
});
const ligneAcompte = (p: Partial<FirestorePaiement> = {}): Doc => ({
  uid: "equipe", objet: "acompte", formule: null, droit: null, reservation_id: RESA, frais_client: 20,
  montant: 520, devise: "XOF", statut: "en_attente", environnement: "sandbox", fedapay_id: 258,
  fedapay_statut: "pending", mode: null, frais: null, recu_url: null, echeance_avant: null,
  echeance_apres: null, applique_le: null, anomalie: null, created_at: "t0", updated_at: "t0", ...p,
});

const reglement = () => base.get(`reglements/${RESA}`) as unknown as FirestoreReglement | undefined;
const resa = () => base.get(`bookings/${RESA}`) as Doc;
const dus = () => [...base.entries()].filter(([chemin]) => chemin.startsWith("dus/"));
const titres = (uid: string) => mockNotifier.mock.calls.filter(([u]) => u === uid).map(([, n]) => (n as { title: string }).title);

/** Un terrain payant, une réservation confirmée, le règlement ouvert deux jours avant. */
async function ouvrir(): Promise<Reglement> {
  const r = await suivreReservation(RESA, { maintenant: J2 });
  if (!r) throw new Error("le règlement ne s'est pas ouvert");
  mockNotifier.mockClear();
  return r;
}

/** L'acompte payé chez FedaPay, puis réglé chez nous. */
async function payer(): Promise<void> {
  base.set(`paiements/${PAIE}`, ligneAcompte());
  mockFedapay.lireCollecte.mockResolvedValue(collecte("approved"));
  await reglerPaiement(PAIE);
  mockNotifier.mockClear();
}

beforeEach(() => {
  vider();
  mockFedapay.environnement = "sandbox";
  mockFedapay.creerCollecte.mockReset();
  mockFedapay.lienDePaiement.mockReset();
  mockFedapay.lireCollecte.mockReset();
  mockFedapay.lireCollecteParReference.mockReset();
  mockNotifier.mockClear();
  mockSurMatch.mockClear();
  base.set("venues/terrain1", terrain());
  base.set("comptes_versement/gerant", { numero: "90123456", pays: "tg", modifie_le: 1 });
  base.set("settings/paiement", { taux_frais: 4 });
  base.set(`bookings/${RESA}`, reservation());
});

describe("suivreReservation : l'ouverture", () => {
  it("ouvre le règlement d'une réservation confirmée sur un terrain payant", async () => {
    const r = await suivreReservation(RESA, { maintenant: J2 });

    expect(r).toMatchObject({
      id: RESA, owner_id: "gerant", user_id: "equipe", venue_name: "Terrain des Cocotiers", demandeur: "Étoile de Bè",
      date: DATE, time: "18:00", duration: 1, prix: 10_000, acompte: 500, taux_frais: 4,
      echeance: J2 + 24 * H, ouvre_validation: DEBUT - H, fin_fenetre: DEBUT + H + 15 * 60_000,
      paye_le: null, paiement_id: null, code: null, valide_le: null, cloture: null,
    });
    expect(resa().reglement_vu).toBe("acompte_attendu");
    expect(titres("equipe")).toHaveLength(1);
  });

  it("l'échéance ne dépasse jamais le début du créneau", async () => {
    const r = await suivreReservation(RESA, { maintenant: DEBUT - 3 * H });
    expect(r?.echeance).toBe(DEBUT);
  });

  it("ne prévient pas quand l'appelant s'en charge", async () => {
    await suivreReservation(RESA, { maintenant: J2, annoncer: false });
    expect(mockNotifier).not.toHaveBeenCalled();
    expect(reglement()).toBeDefined();
  });

  it.each([
    ["le terrain n'a pas activé le paiement", () => base.set("venues/terrain1", terrain({ paiement_app: false }))],
    ["le terrain n'a pas de tarif", () => base.set("venues/terrain1", terrain({ price_per_hour: 0 }))],
    ["le propriétaire n'a pas donné de numéro de versement", () => base.delete("comptes_versement/gerant")],
    ["la demande date d'avant l'activation des frais", () => base.set("venues/terrain1", terrain({ paiement_app_depuis: 5_000 }))],
    ["le terrain n'a jamais daté l'activation de ses frais", () => base.set("venues/terrain1", terrain({ paiement_app_depuis: undefined }))],
    ["la réservation attend encore la réponse", () => base.set(`bookings/${RESA}`, reservation({ status: "pending" }))],
    ["c'est un créneau bloqué", () => base.set(`bookings/${RESA}`, reservation({ kind: "blocage", user_id: "gerant" }))],
    ["le propriétaire joue sur son propre terrain", () => base.set(`bookings/${RESA}`, reservation({ user_id: "gerant" }))],
  ])("n'ouvre rien quand %s", async (_cas, preparer) => {
    preparer();
    expect(await suivreReservation(RESA, { maintenant: J2 })).toBeNull();
    expect(reglement()).toBeUndefined();
    expect(resa().reglement_vu).toBeUndefined();
  });

  it("fige le prix : un tarif changé après la confirmation ne touche pas l'acompte", async () => {
    await ouvrir();
    base.set("venues/terrain1", terrain({ price_per_hour: 40_000 }));

    const r = await suivreReservation(RESA, { maintenant: J2 + H });

    expect(r).toMatchObject({ prix: 10_000, acompte: 500 });
  });
});

describe("suivreReservation : la clôture", () => {
  it("libère le créneau quand l'acompte n'est pas venu à temps, et prévient les deux", async () => {
    await ouvrir();

    const r = await suivreReservation(RESA, { maintenant: J2 + 25 * H });

    expect(r?.cloture).toBe("libere");
    expect(resa()).toMatchObject({ status: "cancelled", cancelled_by: "systeme", reglement_vu: "libere" });
    expect(dus()).toHaveLength(0);
    expect(titres("equipe")).toHaveLength(1);
    expect(titres("gerant")).toHaveLength(1);
  });

  it("recopie la libération sur le match quand la réservation en a un", async () => {
    base.set(`bookings/${RESA}`, reservation({ kind: "match", match_id: "match1" }));
    await ouvrir();

    await suivreReservation(RESA, { maintenant: J2 + 25 * H });

    expect(mockSurMatch).toHaveBeenCalledWith({ mid: "match1", cid: null }, expect.objectContaining({ booking_id: RESA, status: "cancelled" }));
  });

  it("une fenêtre passée sans ticket validé est une absence : l'acompte est dû au propriétaire", async () => {
    await ouvrir();
    await payer();

    const r = await suivreReservation(RESA, { maintenant: DEBUT + 2 * H });

    expect(r?.cloture).toBe("absent");
    expect(resa()).toMatchObject({ status: "confirmed", reglement_vu: "absent" });
    expect(dus()).toHaveLength(1);
    expect(base.get(`dus/${RESA}_acompte`)).toMatchObject({
      beneficiaire: "gerant", role: "proprietaire", montant: 500, motif: "acompte", reservation_id: RESA,
      telephone: null, disponible_le: "2026-10-18T10:00:00.000Z", depot_id: null, regle_le: null,
    });
  });

  it("l'équipe annule après avoir payé : l'acompte reste dû au propriétaire", async () => {
    await ouvrir();
    await payer();
    base.set(`bookings/${RESA}`, { ...resa(), status: "cancelled", cancelled_by: "demandeur" });

    const r = await suivreReservation(RESA, { maintenant: J2 + 30 * H });

    expect(r?.cloture).toBe("annule_equipe");
    expect(base.get(`dus/${RESA}_acompte`)).toMatchObject({ beneficiaire: "gerant", montant: 500 });
  });

  it("le propriétaire annule après le paiement : l'acompte est dû à l'équipe, pas à lui", async () => {
    await ouvrir();
    await payer();
    base.set(`bookings/${RESA}`, { ...resa(), status: "cancelled", cancelled_by: "proprietaire" });

    const r = await suivreReservation(RESA, { maintenant: J2 + 30 * H });

    expect(r?.cloture).toBe("annule_proprietaire");
    expect(dus()).toHaveLength(1);
    expect(base.get(`dus/${RESA}_remb_${PAIE}`)).toMatchObject({
      beneficiaire: "equipe", role: "equipe", montant: 500, motif: "remboursement", telephone: "90112233",
      depot_id: null, regle_le: null,
    });
    expect(titres("equipe")).toHaveLength(1);
  });

  it("rejouer le geste ne doit rien de plus", async () => {
    await ouvrir();
    await payer();
    base.set(`bookings/${RESA}`, { ...resa(), status: "cancelled", cancelled_by: "proprietaire" });

    await suivreReservation(RESA, { maintenant: J2 + 30 * H });
    await suivreReservation(RESA, { maintenant: J2 + 31 * H });
    await suivreReservation(RESA, { maintenant: DEBUT + 5 * H });

    expect(dus()).toHaveLength(1);
    expect(titres("equipe")).toHaveLength(1);
  });

  it("une annulation avant tout paiement clôt sans rien devoir", async () => {
    await ouvrir();
    base.set(`bookings/${RESA}`, { ...resa(), status: "cancelled", cancelled_by: "proprietaire" });

    expect((await suivreReservation(RESA, { maintenant: J2 + H }))?.cloture).toBe("annule_proprietaire");
    expect(dus()).toHaveLength(0);
  });
});

describe("l'effet d'un acompte réglé", () => {
  it("pose le ticket et prévient les deux parties", async () => {
    await ouvrir();
    base.set(`paiements/${PAIE}`, ligneAcompte());
    mockFedapay.lireCollecte.mockResolvedValue(collecte("approved"));

    expect(await reglerPaiement(PAIE)).toMatchObject({ statut: "paye" });

    expect(reglement()).toMatchObject({ paiement_id: PAIE, disponible_le: "2026-10-18T10:00:00.000Z", cloture: null });
    expect(reglement()?.paye_le).toBeTruthy();
    expect(reglement()?.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    expect(resa().reglement_vu).toBe("acompte_paye");
    expect(titres("equipe")).toHaveLength(1);
    expect(titres("gerant")).toHaveLength(1);
  });

  it("réglé deux fois, ne crée qu'un ticket", async () => {
    await ouvrir();
    base.set(`paiements/${PAIE}`, ligneAcompte());
    mockFedapay.lireCollecte.mockResolvedValue(collecte("approved"));

    await Promise.all([reglerPaiement(PAIE), reglerPaiement(PAIE)]);
    const code = reglement()?.code;
    await reglerPaiement(PAIE);

    expect(reglement()?.code).toBe(code);
    expect(titres("equipe")).toHaveLength(1);
    expect(dus()).toHaveLength(0);
  });

  it("payé après la libération du créneau : pas de ticket, l'acompte est rendu une fois", async () => {
    await ouvrir();
    await suivreReservation(RESA, { maintenant: J2 + 25 * H });
    mockNotifier.mockClear();
    base.set(`paiements/${PAIE}`, ligneAcompte());
    mockFedapay.lireCollecte.mockResolvedValue(collecte("approved"));

    await reglerPaiement(PAIE);
    await reglerPaiement(PAIE);

    expect(reglement()).toMatchObject({ cloture: "libere", code: null, paye_le: null });
    expect(dus()).toHaveLength(1);
    expect(base.get(`dus/${RESA}_remb_${PAIE}`)).toMatchObject({ beneficiaire: "equipe", montant: 500, motif: "remboursement" });
    expect(titres("equipe")).toHaveLength(1);
  });

  it("un second paiement du même acompte est rendu, le premier garde son ticket", async () => {
    await ouvrir();
    await payer();
    const code = reglement()?.code;
    const AUTRE = "AutrAbCdEfGhIjKlMnOp";
    base.set(`paiements/${AUTRE}`, ligneAcompte({ fedapay_id: 259 }));
    mockFedapay.lireCollecte.mockResolvedValue(collecte("approved", { id: 259, reference: AUTRE }));

    await reglerPaiement(AUTRE);

    expect(reglement()).toMatchObject({ code, paiement_id: PAIE });
    expect(base.get(`dus/${RESA}_remb_${AUTRE}`)).toMatchObject({ beneficiaire: "equipe", montant: 500 });
  });
});

describe("demarrerAcompte", () => {
  const ORIGINE = "http://localhost:3000";

  beforeEach(() => {
    base.set("users/equipe", { first_name: "Ama", last_name: "Koffi", email: "ama@exemple.test", is_superadmin: true });
    mockFedapay.creerCollecte.mockResolvedValue(collecte("pending"));
    mockFedapay.lienDePaiement.mockResolvedValue("https://sandbox-process.fedapay.com/jeton");
  });

  it("demande l'acompte et les frais de paiement, au montant du règlement", async () => {
    await ouvrir();

    const { id, url } = await demarrerAcompte("equipe", RESA, ORIGINE);

    expect(url).toBe("https://sandbox-process.fedapay.com/jeton");
    expect(base.get(`paiements/${id}`)).toMatchObject({
      uid: "equipe", objet: "acompte", formule: null, droit: null, reservation_id: RESA,
      montant: 520, frais_client: 20, statut: "en_attente", environnement: "sandbox",
    });
    expect(mockFedapay.creerCollecte).toHaveBeenCalledWith(expect.objectContaining({
      reference: id, montant: 520, retour: `${ORIGINE}/mes-reservations?paiement=${id}`,
    }));
  });

  it("refuse la réservation de quelqu'un d'autre, ou un identifiant qui n'en est pas un", async () => {
    await ouvrir();
    base.set("users/intrus", { is_superadmin: true });
    await expect(demarrerAcompte("intrus", RESA, ORIGINE)).rejects.toMatchObject({ code: "reservation" });
    await expect(demarrerAcompte("equipe", "../paiements/x", ORIGINE)).rejects.toMatchObject({ code: "reservation" });
    await expect(demarrerAcompte("equipe", { id: RESA }, ORIGINE)).rejects.toMatchObject({ code: "reservation" });
    expect(mockFedapay.creerCollecte).not.toHaveBeenCalled();
  });

  it("refuse une réservation sans règlement", async () => {
    base.set("venues/terrain1", terrain({ paiement_app: false }));
    await expect(demarrerAcompte("equipe", RESA, ORIGINE)).rejects.toMatchObject({ code: "reservation" });
  });

  it("refuse un acompte déjà payé", async () => {
    await ouvrir();
    await payer();
    await expect(demarrerAcompte("equipe", RESA, ORIGINE)).rejects.toMatchObject({ code: "deja_paye" });
  });

  it("refuse en bac à sable un compte qui n'est pas superadmin", async () => {
    await ouvrir();
    base.set("users/equipe", { first_name: "Ama", last_name: "Koffi" });
    await expect(demarrerAcompte("equipe", RESA, ORIGINE)).rejects.toMatchObject({ code: "bac_a_sable" });
  });
});

describe("le ticket", () => {
  const DANS_LA_FENETRE = DEBUT - 10 * 60_000;

  it("se valide sur place : la réservation est jouée et l'acompte dû au propriétaire", async () => {
    await ouvrir();
    await payer();
    const code = reglement()?.code;

    const resume = await validerTicket("gerant", code?.toLowerCase(), DANS_LA_FENETRE);

    expect(resume).toMatchObject({ reservation: RESA, terrain: "Terrain des Cocotiers", equipe: "Étoile de Bè", acompte: 500, reste: 9_500, valide: true });
    expect(reglement()).toMatchObject({ cloture: "joue" });
    expect(reglement()?.valide_le).toBeTruthy();
    expect(resa().reglement_vu).toBe("joue");
    expect(base.get(`dus/${RESA}_acompte`)).toMatchObject({ beneficiaire: "gerant", montant: 500 });
  });

  it("validé deux fois, ne change rien", async () => {
    await ouvrir();
    await payer();
    const code = reglement()?.code;

    await validerTicket("gerant", code, DANS_LA_FENETRE);
    await expect(validerTicket("gerant", code, DANS_LA_FENETRE + 60_000)).resolves.toMatchObject({ valide: true });

    expect(dus()).toHaveLength(1);
  });

  it("répond pareil à un code inconnu et au ticket d'un autre terrain, sans rien valider", async () => {
    await ouvrir();
    await payer();
    const code = reglement()?.code;

    const inconnu = await validerTicket("gerant", "ZZZZZZ", DANS_LA_FENETRE).catch((e: Error & { status: number }) => e);
    const dUnAutre = await validerTicket("autre-gerant", code, DANS_LA_FENETRE).catch((e: Error & { status: number }) => e);

    expect(inconnu).toMatchObject({ status: 404 });
    expect(dUnAutre).toMatchObject({ status: 404 });
    expect((dUnAutre as Error).message).toBe((inconnu as Error).message);
    expect(reglement()?.valide_le).toBeNull();
    expect(reglement()?.cloture).toBeNull();
  });

  it("refuse ce qui n'a pas la forme d'un code", async () => {
    await expect(validerTicket("gerant", "pas un code", DANS_LA_FENETRE)).rejects.toMatchObject({ status: 400 });
  });

  it("refuse trop tôt, et après la fenêtre", async () => {
    await ouvrir();
    await payer();
    const code = reglement()?.code;

    await expect(validerTicket("gerant", code, DEBUT - 2 * H)).rejects.toMatchObject({ status: 409 });
    await expect(validerTicket("gerant", code, DEBUT + 2 * H)).rejects.toMatchObject({ status: 409 });
    expect(reglement()?.valide_le).toBeNull();
  });

  it("accepte le battement : un quart d'heure après la fin du créneau", async () => {
    await ouvrir();
    await payer();
    await expect(validerTicket("gerant", reglement()?.code, DEBUT + H + 10 * 60_000)).resolves.toMatchObject({ valide: true });
  });

  it("compte les essais : le sixième de la minute est refusé", async () => {
    for (let i = 0; i < 5; i += 1) {
      await validerTicket("gerant", "ZZZZZZ", DANS_LA_FENETRE).catch(() => {});
    }
    await expect(validerTicket("gerant", "ZZZZZZ", DANS_LA_FENETRE)).rejects.toMatchObject({ status: 429 });
    await expect(validerTicket("gerant", "ZZZZZZ", DANS_LA_FENETRE + 61_000)).rejects.toMatchObject({ status: 404 });
  });

  it("se lit sans se valider", async () => {
    await ouvrir();
    await payer();

    expect(await lireTicket("gerant", reglement()?.code, DANS_LA_FENETRE)).toMatchObject({ acompte: 500, reste: 9_500, valide: false });
    expect(reglement()?.valide_le).toBeNull();
  });
});

describe("vuePour", () => {
  it("montre le code à l'équipe qui a payé, jamais au propriétaire", async () => {
    await ouvrir();
    await payer();

    const equipe = await vuePour("equipe", RESA);
    const gerant = await vuePour("gerant", RESA);

    expect(equipe).toMatchObject({ role: "equipe", etat: "acompte_paye", acompte: 500, frais: 20, total: 520, reste: 9_500 });
    expect(equipe?.code).toBe(reglement()?.code);
    expect(gerant).toMatchObject({ role: "proprietaire", etat: "acompte_paye", code: null });
  });

  it("dit au propriétaire ce qui lui est dû, puis quand cela a été versé", async () => {
    await ouvrir();
    await payer();
    await validerTicket("gerant", reglement()?.code, DEBUT - 10 * 60_000);

    expect(await vuePour("gerant", RESA)).toMatchObject({ etat: "joue", du: { montant: 500, verseLe: null } });

    base.set(`dus/${RESA}_acompte`, { ...base.get(`dus/${RESA}_acompte`), regle_le: { toMillis: () => 7_000 } });

    expect(await vuePour("gerant", RESA)).toMatchObject({ du: { montant: 500, verseLe: 7_000 } });
    expect((await vuePour("equipe", RESA))?.du).toBeNull();
  });

  it("ne dit rien à un tiers", async () => {
    await ouvrir();
    expect(await vuePour("curieux", RESA)).toBeNull();
  });
});

describe("suivreReglementsOuverts", () => {
  it("applique l'échéance et l'absence aux règlements ouverts, et laisse les autres", async () => {
    await ouvrir();
    expect(await suivreReglementsOuverts(J2 + H)).toEqual({ suivis: 1, clos: 0 });
    expect(await suivreReglementsOuverts(J2 + 25 * H)).toEqual({ suivis: 1, clos: 1 });
    expect(await suivreReglementsOuverts(J2 + 26 * H)).toEqual({ suivis: 0, clos: 0 });
  });
});
```

- [ ] **Step 2: Lancer, constater l'échec**

Run: `(cd mobile && npx jest src/__tests__/reglement-serveur.test.ts)`
Expected: FAIL, `Could not locate module @/lib/reglement-serveur`.

- [ ] **Step 3: Écrire le serveur des règlements**

Créer `src/lib/reglement-serveur.ts` :

```ts
import { randomInt } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { notifierCompte } from "@/lib/notifier-serveur";
import type { Effet } from "@/lib/paiement-serveur";
import {
  acompteDe, battementLu, codeSaisi, debutDuCreneau, echeanceAcompte, etatDuReglement, fenetreDeValidation,
  fraisDePaiement, nouveauCode, planReglement, prixDuCreneau,
  type Battement, type ClotureReglement, type FirestoreReglement, type ResumeTicket, type VueReglement,
} from "@/lib/reglement";
import { recopierSurLeMatch, surLeMatch } from "@/lib/reservations-server";
import { dateLongue } from "@/lib/terrains";
import { idDu, lireCompteVersement, preparerDu } from "@/lib/versements-serveur";
import type { FirestoreBooking } from "@/types";

// ============================================
// Les frais de réservation, côté serveur : ouvrir le règlement d'une
// réservation, le suivre, valider son ticket.
//
// UNE SEULE FONCTION SUIT UNE RÉSERVATION : `suivreReservation`. On l'appelle
// après chaque geste (confirmer, annuler, payer, valider) et chaque matin ;
// elle relit la réservation et son règlement, demande à `planReglement` quoi
// faire, et l'écrit dans une transaction. Aucun geste ne porte sa propre
// règle d'argent, et l'appeler une fois de trop ne change rien.
//
// L'ARGENT VIT ICI, PAS SUR LA RÉSERVATION. Le propriétaire peut écrire
// n'importe quel champ d'une réservation depuis son navigateur : le prix,
// l'acompte, le ticket et la clôture sont donc dans `reglements`, fermée. La
// réservation ne reçoit qu'une copie d'affichage (`reglement_vu`), que rien
// ici ne relit.
//
// LE PRIX SE FIGE À L'OUVERTURE. Un tarif changé après le oui du propriétaire
// ne touche pas une réservation acceptée.
//
// LES FRAIS NE SONT PAS RÉTROACTIFS. Une équipe paie ce qu'on lui a annoncé
// en demandant : un règlement ne s'ouvre que pour une demande faite APRÈS que
// le propriétaire a activé les frais sur son terrain. Sans cela, activer les
// frais donnerait vingt-quatre heures à des réservations déjà acceptées pour
// payer, ou perdre leur créneau.
// ============================================

const reglements = () => adminDb.collection("reglements");

const millis = (x: unknown): number =>
  x && typeof (x as { toMillis?: () => number }).toMillis === "function" ? (x as { toMillis: () => number }).toMillis() : 0;

export class ErreurReglement extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ErreurReglement";
  }
}

const fcfa = (n: number): string => `${n.toLocaleString("fr-FR")} FCFA`;
const quand = (r: { date: string; time: string }): string => `${dateLongue(r.date)} à ${r.time}`;
const instant = (ms: number): string =>
  new Date(ms).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const libelle = (r: FirestoreReglement): string => `${r.venue_name} · ${quand(r)}`;
/** Le téléphone donné dans la demande : c'est là qu'on rend un acompte à une équipe. */
const telephoneDe = (b: FirestoreBooking | null): string | null => {
  const t = (b as { contact?: { telephone?: unknown } | null } | null)?.contact?.telephone;
  return typeof t === "string" && t.trim() ? t.trim() : null;
};

/**
 * Le terrain fait-il payer ses frais de réservation dans l'application, et
 * depuis quand ? Sans date d'activation lisible, il ne les fait pas payer.
 */
export async function terrainPayant(
  venueId: string,
): Promise<{ payant: boolean; depuis: number; tarif: number; battement: Battement; nom: string }> {
  const v = (await adminDb.collection("venues").doc(venueId).get()).data();
  const proprietaire = typeof v?.owner_id === "string" ? v.owner_id : null;
  const tarif = typeof v?.price_per_hour === "number" ? v.price_per_hour : 0;
  const depuis = typeof v?.paiement_app_depuis === "number" ? v.paiement_app_depuis : 0;
  const actif = v?.paiement_app === true && depuis > 0 && tarif > 0 && proprietaire !== null;
  // Sans numéro où le verser, on n'encaisse rien pour lui.
  const compte = actif ? await lireCompteVersement(proprietaire!) : null;
  return {
    payant: actif && compte !== null,
    depuis,
    tarif,
    battement: battementLu(v?.battement_min),
    nom: String(v?.name ?? "Terrain"),
  };
}

async function lireTauxFrais(): Promise<number> {
  const t = (await adminDb.collection("settings").doc("paiement").get()).data()?.taux_frais;
  return typeof t === "number" && Number.isFinite(t) ? t : 0;
}

/** Ce qu'on dit à l'équipe quand le créneau est confirmé et l'acompte attendu. */
export function texteAcompteAttendu(r: FirestoreReglement): string {
  const frais = fraisDePaiement(r.acompte, r.taux_frais);
  return `Frais de réservation : ${fcfa(r.acompte)}${frais ? `, plus ${fcfa(frais)} de frais de paiement` : ""}, `
    + `à payer avant ${instant(r.echeance)} pour garder le créneau. `
    + "Remboursés si le match a lieu : ils sont déduits de ce que tu règles sur place.";
}

type Evenement = "ouvert" | ClotureReglement | null;

/** Les notifications d'un événement. Ne lève jamais : l'écriture est faite. */
async function annoncer(evenement: Evenement, r: FirestoreReglement, du: "proprietaire" | "equipe" | null): Promise<void> {
  const aLEquipe = (title: string, body: string) =>
    notifierCompte(r.user_id, { type: "booking_answer", title, body, link: "/mes-reservations" });
  const auGerant = (title: string, body: string) =>
    notifierCompte(r.owner_id, { type: "booking_answer", title, body, link: "/mes-terrains/reservations" });
  const envois: Promise<void>[] = [];
  switch (evenement) {
    case "ouvert":
      envois.push(aLEquipe("Créneau confirmé : frais de réservation à payer", `${libelle(r)}. ${texteAcompteAttendu(r)}`));
      break;
    case "libere":
      envois.push(aLEquipe("Créneau libéré", `Les frais de réservation de ${libelle(r)} n'ont pas été payés à temps : le créneau est libéré.`));
      envois.push(auGerant("Créneau libéré", `${r.demandeur} n'a pas payé ses frais de réservation : ${libelle(r)} est de nouveau libre.`));
      break;
    case "joue":
      envois.push(auGerant("Ticket validé", `${r.demandeur}, ${libelle(r)}. Les frais de réservation (${fcfa(r.acompte)}) te sont dus.`));
      break;
    case "absent":
      envois.push(auGerant("Équipe absente", `Aucun ticket présenté pour ${libelle(r)}. Les frais de réservation (${fcfa(r.acompte)}) te sont dus.`));
      envois.push(aLEquipe("Créneau passé", `Ton ticket pour ${libelle(r)} n'a pas été validé : les frais de réservation restent au propriétaire.`));
      break;
    case "annule_equipe":
      if (du) envois.push(auGerant("Réservation annulée", `${libelle(r)}. Les frais de réservation déjà payés (${fcfa(r.acompte)}) te restent dus.`));
      break;
    case "annule_proprietaire":
      if (du) envois.push(aLEquipe("Frais de réservation rendus", `Le propriétaire a annulé ${libelle(r)} : tes ${fcfa(r.acompte)} te seront rendus.`));
      break;
    default:
  }
  await Promise.allSettled(envois);
}

/**
 * Suit une réservation : ouvre son règlement s'il le faut, le clôt s'il le
 * faut, et sinon ne fait rien. Rend le règlement, ou `null` s'il n'y en a pas.
 *
 * `annoncer: false` : l'appelant prévient lui-même (la confirmation, qui a
 * déjà son message).
 */
export async function suivreReservation(
  id: string,
  options: { maintenant?: number; annoncer?: boolean } = {},
): Promise<(FirestoreReglement & { id: string }) | null> {
  const maintenant = options.maintenant ?? Date.now();
  const resaRef = adminDb.collection("bookings").doc(id);
  const regRef = reglements().doc(id);

  const [resaSnap, regSnap] = await Promise.all([resaRef.get(), regRef.get()]);
  const dAbord = resaSnap.exists ? (resaSnap.data() as FirestoreBooking) : null;

  // Ce qu'il faut pour ouvrir se lit avant la transaction : le terrain, son
  // tarif, le taux des frais. C'est ici que le prix se fige.
  let ouverture: { prix: number; acompte: number; taux: number; battement: Battement; nom: string } | null = null;
  if (!regSnap.exists) {
    if (!dAbord || dAbord.status !== "confirmed") return null;
    const terrain = await terrainPayant(dAbord.venue_id);
    const prix = prixDuCreneau(terrain.tarif, dAbord.duration);
    const acompte = acompteDe(prix);
    if (!terrain.payant || acompte === 0) return null;
    // Demandée avant l'activation des frais : elle se règle comme annoncé alors, sur place.
    if (millis(dAbord.created_at) < terrain.depuis) return null;
    ouverture = { prix, acompte, taux: await lireTauxFrais(), battement: terrain.battement, nom: terrain.nom };
  }

  const issue = await adminDb.runTransaction(async (tx) => {
    const [r, g] = await Promise.all([tx.get(resaRef), tx.get(regRef)]);
    const resa = r.exists ? (r.data() as FirestoreBooking) : null;
    const reg = g.exists ? (g.data() as FirestoreReglement) : null;
    const plan = planReglement({
      reservation: resa,
      reglement: reg
        ? { echeance: reg.echeance, fin_fenetre: reg.fin_fenetre, paye: Boolean(reg.paye_le), valide: Boolean(reg.valide_le), cloture: reg.cloture }
        : null,
      payant: ouverture !== null,
      maintenant,
    });

    if (plan.action === "ouvrir" && resa && ouverture) {
      const fenetre = fenetreDeValidation(resa, ouverture.battement);
      const nouveau: FirestoreReglement = {
        owner_id: resa.owner_id,
        user_id: resa.user_id,
        venue_id: resa.venue_id,
        venue_name: resa.venue_name || ouverture.nom,
        demandeur: resa.team_name || resa.user_name || "Une équipe",
        date: resa.date,
        time: resa.time,
        duration: resa.duration,
        prix: ouverture.prix,
        acompte: ouverture.acompte,
        taux_frais: ouverture.taux,
        echeance: echeanceAcompte(maintenant, debutDuCreneau(resa.date, resa.time)),
        ouvre_validation: fenetre.ouvre,
        fin_fenetre: fenetre.ferme,
        paye_le: null,
        paiement_id: null,
        disponible_le: null,
        code: null,
        valide_le: null,
        cloture: null,
        clos_le: null,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      };
      tx.set(regRef, nouveau);
      tx.update(resaRef, { reglement_vu: "acompte_attendu" });
      return { reglement: nouveau, resa, evenement: "ouvert" as Evenement, du: null };
    }

    if (plan.action === "clore" && reg) {
      // La somme due se lit avant toute écriture (versements-serveur, preparerDu).
      const auGerant = plan.du === "proprietaire";
      const ecrireLeDu = plan.du
        ? await preparerDu(tx, idDu(id, auGerant ? "acompte" : "remboursement", reg.paiement_id), {
          beneficiaire: auGerant ? reg.owner_id : reg.user_id,
          role: plan.du,
          montant: reg.acompte,
          motif: auGerant ? "acompte" : "remboursement",
          reservation_id: id,
          libelle: libelle(reg),
          telephone: auGerant ? null : telephoneDe(resa),
          disponible_le: reg.disponible_le,
        })
        : null;
      tx.update(regRef, { cloture: plan.cloture, clos_le: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp() });
      ecrireLeDu?.();
      if (resa) {
        tx.update(resaRef, plan.annulerReservation
          ? { status: "cancelled", cancelled_by: "systeme", reglement_vu: plan.cloture, updated_at: FieldValue.serverTimestamp() }
          : { reglement_vu: plan.cloture });
      }
      return { reglement: { ...reg, cloture: plan.cloture }, resa, evenement: plan.cloture as Evenement, du: plan.du };
    }

    return { reglement: reg, resa, evenement: null as Evenement, du: null };
  });

  if (issue.evenement && issue.reglement) {
    if (options.annoncer !== false) await annoncer(issue.evenement, issue.reglement, issue.du);
    // Le créneau libéré d'un match : sa carte doit le dire à son manager.
    if (issue.evenement === "libere" && issue.resa?.match_id) {
      await recopierSurLeMatch(
        { mid: issue.resa.match_id, cid: issue.resa.competition_id ?? null },
        surLeMatch(id, issue.resa, "cancelled"),
      ).catch((err) => console.error("[reglement] match non mis à jour:", id, err));
    }
  }
  return issue.reglement ? { id, ...issue.reglement } : null;
}

/**
 * L'effet d'un acompte réglé, appliqué par `reglerPaiement` dans la
 * transaction qui passe le paiement à « payé ».
 *
 * TROP TARD, OU PAYÉ DEUX FOIS : PAS DE TICKET, L'ACOMPTE EST RENDU. La page
 * de paiement FedaPay reste ouverte des heures : l'équipe peut payer un
 * créneau déjà libéré, ou payer deux fois. L'argent est alors chez nous sans
 * rien acheter : il devient une somme due à l'équipe, une fois.
 */
export const effetAcompte: Effet = async (tx, ligne, c) => {
  const idResa = ligne.reservation_id ?? "";
  const regRef = reglements().doc(idResa);
  const resaRef = adminDb.collection("bookings").doc(idResa);
  const [g, r] = await Promise.all([tx.get(regRef), tx.get(resaRef)]);
  const reg = g.exists ? (g.data() as FirestoreReglement) : null;

  if (!reg || reg.cloture !== null || reg.paye_le) {
    const montant = reg?.acompte ?? Math.max(0, ligne.montant - (ligne.frais_client ?? 0));
    const ecrire = await preparerDu(tx, idDu(idResa, "remboursement", c.id), {
      beneficiaire: ligne.uid,
      role: "equipe",
      montant,
      motif: "remboursement",
      reservation_id: idResa,
      libelle: reg ? libelle(reg) : "Frais de réservation",
      telephone: telephoneDe(r.exists ? (r.data() as FirestoreBooking) : null),
      disponible_le: c.collecte.disponibleLe,
    });
    return {
      ecrire,
      champs: {},
      apres: () => notifierCompte(ligne.uid, {
        type: "booking_answer",
        title: "Frais de réservation rendus",
        body: `Ton paiement${reg ? ` pour ${libelle(reg)}` : ""} est arrivé alors que le créneau n'était plus à réserver : tes ${fcfa(montant)} te seront rendus.`,
        link: "/mes-reservations",
      }),
    };
  }

  // Un tirage sûr : le code est ce qui prouve qu'on a payé.
  const code = nouveauCode(() => randomInt(0, 1_000_000) / 1_000_000);
  return {
    ecrire: () => {
      tx.update(regRef, {
        paye_le: FieldValue.serverTimestamp(),
        paiement_id: c.id,
        disponible_le: c.collecte.disponibleLe,
        code,
        updated_at: FieldValue.serverTimestamp(),
      });
      if (r.exists) tx.update(resaRef, { reglement_vu: "acompte_paye" });
    },
    champs: {},
    apres: async () => {
      await Promise.allSettled([
        notifierCompte(reg.user_id, {
          type: "booking_answer",
          title: "Frais payés : ton ticket est prêt",
          body: `${libelle(reg)}. Montre ton ticket au gérant en arrivant ; il te restera ${fcfa(reg.prix - reg.acompte)} à régler sur place.`,
          link: "/mes-reservations",
        }),
        notifierCompte(reg.owner_id, {
          type: "booking_answer",
          title: "Frais de réservation payés",
          body: `${reg.demandeur} a payé ses frais pour ${libelle(reg)}. Valide son ticket à son arrivée.`,
          link: "/mes-terrains/reservations",
        }),
      ]);
    },
  };
};

/** Cinq essais par minute et par compte : un code ne se devine pas à la chaîne. */
const ESSAIS_PAR_MINUTE = 5;

async function compterEssai(uid: string, maintenant: number): Promise<void> {
  const ref = adminDb.collection("essais_ticket").doc(uid);
  const minute = Math.floor(maintenant / 60_000);
  const trop = await adminDb.runTransaction(async (tx) => {
    const d = (await tx.get(ref)).data();
    const n = d?.minute === minute && typeof d.n === "number" ? d.n : 0;
    if (n >= ESSAIS_PAR_MINUTE) return true;
    tx.set(ref, { minute, n: n + 1 });
    return false;
  });
  if (trop) throw new ErreurReglement("Trop d'essais. Réessaie dans une minute.", 429);
}

function resume(id: string, r: FirestoreReglement, valide: boolean): ResumeTicket {
  return {
    reservation: id, terrain: r.venue_name, equipe: r.demandeur, date: r.date, time: r.time, duration: r.duration,
    acompte: r.acompte, reste: r.prix - r.acompte, valide,
  };
}

/**
 * Le ticket d'un de MES terrains. La même réponse pour un code inconnu et
 * pour le ticket d'un autre terrain : on n'apprend rien en essayant.
 */
async function trouverTicket(uid: string, brut: unknown, maintenant: number): Promise<{ id: string; reg: FirestoreReglement }> {
  const code = codeSaisi(brut);
  if (!code) throw new ErreurReglement("Ce n'est pas un code de ticket : six lettres ou chiffres.", 400);
  await compterEssai(uid, maintenant);
  const snap = await reglements().where("code", "==", code).get();
  const mien = snap.docs.find((d) => d.get("owner_id") === uid && d.get("paye_le"));
  if (!mien) throw new ErreurReglement("Aucun ticket à ce code sur tes terrains.", 404);
  return { id: mien.id, reg: mien.data() as FirestoreReglement };
}

/** Ce que dit un ticket, sans le valider : la page ouverte par le QR code. */
export async function lireTicket(uid: string, brut: unknown, maintenant: number = Date.now()): Promise<ResumeTicket> {
  const { id, reg } = await trouverTicket(uid, brut, maintenant);
  return resume(id, reg, Boolean(reg.valide_le));
}

/** Le gérant valide le ticket d'une équipe arrivée sur place. Sans effet la seconde fois. */
export async function validerTicket(uid: string, brut: unknown, maintenant: number = Date.now()): Promise<ResumeTicket> {
  const { id, reg } = await trouverTicket(uid, brut, maintenant);
  if (reg.valide_le) return resume(id, reg, true);
  if (reg.cloture !== null) throw new ErreurReglement("Cette réservation est close.", 409);
  if (maintenant < reg.ouvre_validation) {
    throw new ErreurReglement(`Ce ticket se valide à partir de ${instant(reg.ouvre_validation)}.`, 409);
  }
  if (maintenant > reg.fin_fenetre) throw new ErreurReglement("Ce créneau est passé.", 409);

  // Sur le règlement relu : une réservation annulée à l'instant ne se valide pas.
  const ref = reglements().doc(id);
  const ouvert = await adminDb.runTransaction(async (tx) => {
    const r = (await tx.get(ref)).data() as FirestoreReglement | undefined;
    if (!r || r.cloture !== null) return false;
    if (!r.valide_le) tx.update(ref, { valide_le: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp() });
    return true;
  });
  if (!ouvert) throw new ErreurReglement("Cette réservation est close.", 409);

  // Le ticket validé clôt la réservation : l'acompte devient dû au propriétaire.
  await suivreReservation(id, { maintenant });
  return resume(id, reg, true);
}

/** Ce que chacune des deux parties voit du règlement ; `null` pour tout autre, ou s'il n'y en a pas. */
export async function vuePour(uid: string, idReservation: string): Promise<VueReglement | null> {
  const reg = await suivreReservation(idReservation);
  if (!reg || (reg.owner_id !== uid && reg.user_id !== uid)) return null;
  const role = reg.user_id === uid ? "equipe" : "proprietaire";
  const frais = fraisDePaiement(reg.acompte, reg.taux_frais);

  let du: VueReglement["du"] = null;
  if (role === "proprietaire" && reg.cloture && reg.paye_le) {
    const d = await adminDb.collection("dus").doc(idDu(idReservation, "acompte")).get();
    if (d.exists) du = { montant: (d.get("montant") as number) ?? 0, verseLe: millis(d.get("regle_le")) || null };
  }
  return {
    role,
    etat: etatDuReglement(reg),
    terrain: reg.venue_name,
    date: reg.date,
    time: reg.time,
    duration: reg.duration,
    prix: reg.prix,
    acompte: reg.acompte,
    frais,
    total: reg.acompte + frais,
    reste: reg.prix - reg.acompte,
    echeance: reg.echeance,
    ouvre: reg.ouvre_validation,
    ferme: reg.fin_fenetre,
    // Le code est à l'équipe : c'est elle qui le montre, le gérant qui le lit.
    code: role === "equipe" && reg.cloture === null ? reg.code : null,
    valide: Boolean(reg.valide_le),
    du,
  };
}

/** La tâche du matin : l'échéance et l'absence ne se constatent que si quelqu'un regarde. */
export async function suivreReglementsOuverts(maintenant: number = Date.now()): Promise<{ suivis: number; clos: number }> {
  const snap = await reglements().where("cloture", "==", null).get();
  let clos = 0;
  for (const d of snap.docs) {
    try {
      if ((await suivreReservation(d.id, { maintenant }))?.cloture) clos += 1;
    } catch (err) {
      console.error("[reglement] suivi:", d.id, err);
    }
  }
  return { suivis: snap.size, clos };
}
```

- [ ] **Step 4: Brancher l'effet et démarrer un acompte**

Dans `src/lib/paiement-serveur.ts` :

- imports : ajouter

```ts
import { effetAcompte, suivreReservation } from "@/lib/reglement-serveur";
import { fraisDePaiement } from "@/lib/reglement";
```

et `ID_PAIEMENT` à l'import de `@/lib/paiement`. (Le fichier a déjà son propre `dateLongue`, « 17 octobre 2026 » : c'est lui qui sert plus bas, ne pas importer celui de `lib/terrains`.)

Les deux modules se connaissent : `reglement-serveur` n'importe de `paiement-serveur` qu'un **type** (`Effet`), effacé à la compilation. Ne pas y ajouter d'import de valeur, ce serait un cycle.

Dans `mobile/src/__tests__/paiement-serveur.test.ts`, à côté des autres `jest.mock`, ajouter (la suite du Pro n'a pas à charger le serveur des réservations) :

```ts
jest.mock("@/lib/reservations-server", () => ({ recopierSurLeMatch: jest.fn(async () => {}), surLeMatch: jest.fn() }));
```

- remplacer `export const EFFETS: Record<ObjetPaiement, Effet> = { pro: effetPro, acompte: sansEffet };` par `export const EFFETS: Record<ObjetPaiement, Effet> = { pro: effetPro, acompte: effetAcompte };`, et supprimer la constante `sansEffet`.

- ajouter `type EnvironnementPaiement` à l'import de `@/lib/paiement` s'il n'y est pas déjà (la tâche 3 l'y a mis).

- étendre `RefusPaiement` :

```ts
export type RefusPaiement =
  | "formule" | "non_configure" | "bac_a_sable" | "pas_en_vente" | "deja_illimite" | "trop_de_tentatives" | "fedapay"
  | "reservation" | "deja_paye" | "trop_tard";
```

- sortir de `demarrerPaiement` ce que les deux achats partagent. Remplacer la fonction `demarrerPaiement` entière par :

```ts
/**
 * La clé FedaPay est là, et ce compte a le droit de payer : le bac à sable est
 * réservé aux superadmins. `ferme` : ce qu'on répond aux autres.
 */
async function verifierAcces(
  uid: string,
  ferme: string,
): Promise<{ profil: Record<string, unknown>; environnement: EnvironnementPaiement }> {
  if (!fedapayConfigure()) throw new ErreurPaiement("non_configure", "Le paiement n'est pas disponible.");
  const environnement = environnementFedapay();
  const profil = (await adminDb.collection("users").doc(uid).get()).data() ?? {};
  if (environnement !== "live" && !estSuperadmin(profil)) throw new ErreurPaiement("bac_a_sable", ferme);
  return { profil, environnement };
}

/** Au plus cinq tentatives par compte et par heure. */
async function verifierTentatives(uid: string): Promise<void> {
  // Un compte a une poignée de lignes : on les lit toutes et on compte en
  // mémoire, ce qui évite un index composé (uid + created_at).
  const miennes = await paiements().where("uid", "==", uid).get();
  const ilYAUneHeure = Date.now() - 3_600_000;
  if (miennes.docs.filter((d) => millis(d.get("created_at")) > ilYAUneHeure).length >= TENTATIVES_PAR_HEURE) {
    throw new ErreurPaiement("trop_de_tentatives", "Trop de tentatives. Réessaie dans une heure.");
  }
}

/**
 * Écrit la ligne, crée la collecte chez FedaPay, rend sa page de paiement.
 * Si FedaPay refuse, rien ne reste.
 */
async function ouvrirCollecte(
  champs: Pick<FirestorePaiement, "uid" | "objet" | "formule" | "droit" | "montant" | "environnement"> & Partial<FirestorePaiement>,
  description: string,
  retour: (id: string) => string,
  profil: Record<string, unknown>,
): Promise<{ id: string; url: string }> {
  const ref = paiements().doc();
  const ligne: FirestorePaiement = {
    devise: "XOF",
    statut: "en_attente",
    fedapay_id: null,
    fedapay_statut: null,
    mode: null,
    frais: null,
    recu_url: null,
    echeance_avant: null,
    echeance_apres: null,
    applique_le: null,
    anomalie: null,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
    ...champs,
  };
  await ref.set(ligne);

  let idCollecte: number;
  let url: string;
  try {
    const collecte = await creerCollecte({
      reference: ref.id,
      description,
      montant: ligne.montant,
      retour: retour(ref.id),
      client: {
        prenom: typeof profil.first_name === "string" ? profil.first_name : "",
        nom: typeof profil.last_name === "string" ? profil.last_name : "",
        email: typeof profil.email === "string" ? profil.email : null,
      },
    });
    idCollecte = collecte.id;
    url = await lienDePaiement(collecte.id);
  } catch (err) {
    console.error("[paiements] création chez FedaPay:", err);
    // Rien n'a commencé : on ne laisse pas traîner une ligne sans collecte.
    await ref.delete().catch(() => {});
    throw new ErreurPaiement("fedapay", "Paiement indisponible pour l'instant. Réessaie dans un moment.");
  }

  // Un échec ici ne bloque pas l'achat : le règlement retrouvera la collecte
  // par la référence.
  await ref.update({ fedapay_id: idCollecte, fedapay_statut: "pending", updated_at: FieldValue.serverTimestamp() })
    .catch((err) => console.error("[paiements] identifiant FedaPay non rangé:", ref.id, err));

  return { id: ref.id, url };
}

/**
 * Démarre l'achat du Pro. `origine` : d'où vient la requête, pour le retour
 * en bac à sable (en réel, toujours le site).
 */
export async function demarrerPaiement(uid: string, formule: unknown, origine: string): Promise<{ id: string; url: string }> {
  if (!estFormule(formule)) throw new ErreurPaiement("formule", "Formule inconnue.");
  const { profil, environnement } = await verifierAcces(uid, "Le Pro n'est pas encore en vente.");

  const prix = (await lirePrixOffre())[formule];
  if (!prixValide(prix)) throw new ErreurPaiement("pas_en_vente", "Cette formule n'est pas en vente.");

  const droits = (await adminDb.collection("droits").doc(uid).get()).data() as FirestoreDroits | undefined;
  if (nouvelleEcheance(droits?.pro, jourDeLome(), FORMULES[formule].mois) === null) {
    throw new ErreurPaiement("deja_illimite", "Ton Pro n'a pas d'échéance : il n'y a rien à prolonger.");
  }
  await verifierTentatives(uid);

  const base = environnement === "live" ? APP_URL : origine;
  return ouvrirCollecte(
    { uid, objet: "pro", formule, droit: FORMULES[formule].droit, montant: prix, environnement },
    libelleFormule(formule),
    (id) => `${base}/offre?paiement=${id}`,
    profil,
  );
}

/**
 * Démarre le paiement des frais de réservation d'un terrain. Le montant vient
 * du règlement, figé à la confirmation : jamais de la réservation, jamais du
 * navigateur.
 */
export async function demarrerAcompte(uid: string, reservation: unknown, origine: string): Promise<{ id: string; url: string }> {
  if (typeof reservation !== "string" || !ID_PAIEMENT.test(reservation)) {
    throw new ErreurPaiement("reservation", "Réservation introuvable.");
  }
  const { profil, environnement } = await verifierAcces(uid, "Le paiement n'est pas encore ouvert.");

  // Ouvre le règlement s'il manque, et applique l'échéance si elle est passée.
  const reg = await suivreReservation(reservation);
  if (!reg || reg.user_id !== uid) throw new ErreurPaiement("reservation", "Réservation introuvable.");
  if (reg.paye_le) throw new ErreurPaiement("deja_paye", "Ces frais de réservation sont déjà payés.");
  if (reg.cloture !== null) throw new ErreurPaiement("trop_tard", "Ce créneau n'est plus réservé : il n'y a plus rien à payer.");
  await verifierTentatives(uid);

  const frais = fraisDePaiement(reg.acompte, reg.taux_frais);
  const base = environnement === "live" ? APP_URL : origine;
  return ouvrirCollecte(
    {
      uid, objet: "acompte", formule: null, droit: null, montant: reg.acompte + frais, environnement,
      reservation_id: reservation, frais_client: frais,
    },
    `Frais de réservation · ${reg.venue_name} · ${dateLongue(reg.date)} à ${reg.time}`,
    (id) => `${base}/mes-reservations?paiement=${id}`,
    profil,
  );
}
```

- [ ] **Step 5: Lancer, constater le succès**

Run: `(cd mobile && npx jest src/__tests__/reglement-serveur.test.ts src/__tests__/paiement-serveur.test.ts)`
Expected: PASS pour les deux suites. Les 44 tests du Pro passent toujours : `demarrerPaiement` a été découpé, pas changé.

Si « refuse sans clé FedaPay » ou « refuse une formule inconnue » échoue, c'est l'ordre des refus qui a bougé : la formule se vérifie avant l'accès, comme écrit ci-dessus.

Run: `npx tsc --noEmit`
Expected: aucune erreur.

Run: `npx eslint src/lib/reglement-serveur.ts src/lib/paiement-serveur.ts src/lib/versements-serveur.ts src/lib/reglement.ts`
Expected: aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add src/lib/reglement-serveur.ts src/lib/paiement-serveur.ts mobile/src/__tests__/reglement-serveur.test.ts
git commit -m "feat(reglement): ouvrir, suivre et clore les frais de réservation d'un terrain

suivreReservation est la seule fonction qui suit une réservation payée :
elle ouvre son règlement à la confirmation, libère le créneau si
l'acompte ne vient pas, constate l'absence, et écrit à qui l'acompte est
dû. Un acompte réglé pose un ticket ; payé trop tard ou deux fois, il
est rendu. Le gérant valide le ticket dans la fenêtre du créneau.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Les routes, les règles, la tâche du matin

**Files:**
- Create: `src/app/api/venues/[id]/paiement/route.ts`, `src/app/api/reservations/[id]/reglement/route.ts`, `src/app/api/reservations/ticket/route.ts`, `src/app/api/admin/versements/route.ts`
- Modify: `src/app/api/paiements/route.ts`, `src/app/api/bookings/[id]/route.ts`, `src/app/api/matches/[mid]/terrain/route.ts`, `src/app/api/competitions/[cid]/terrain/route.ts`, `src/app/api/public/venue/[id]/slots/route.ts`, `src/app/api/cron/scoreur-manquant/route.ts`, `firestore.rules`
- Test: `mobile/src/__tests__/paiement.test.ts` (règles)

**Interfaces:**
- Consumes: `appelant(req)`, `ErreurReservation` de `@/lib/reservations-server` ; `exigerSuperadmin` ; tout ce que les tâches 4 et 5 produisent.
- Produces:
  - `GET /api/venues/{id}/paiement` → `{ actif: boolean; numero: string | null; battement: 0 | 15 | 30; tarif: number }` (propriétaire seul) ; `PUT` avec `{ actif, numero, battement }` → la même forme.
  - `POST /api/paiements` accepte aussi `{ objet: "acompte", reservation }` → `{ id, url }`.
  - `GET /api/reservations/{id}/reglement` → `VueReglement`, 404 sinon.
  - `GET /api/reservations/ticket?code=…` et `POST /api/reservations/ticket { code }` → `ResumeTicket`.
  - `GET /api/admin/versements` → `{ tauxFrais: number; groupes }` ; `POST { ids }` → `{ regles, montant }` ; `PUT { tauxFrais }`.
  - `GET /api/public/venue/{id}/slots` : même réponse `{ slots }`, moins les créneaux dont les frais ne sont pas venus à temps.

- [ ] **Step 1: Le test des règles**

Dans `mobile/src/__tests__/paiement.test.ts`, suite `firestore.rules`, ajouter :

```ts
  it.each(["reglements", "dus", "depots", "comptes_versement", "essais_ticket"])(
    "ferme la collection %s aux navigateurs",
    (collection) => {
      const regles = readFileSync(join(__dirname, "../../../firestore.rules"), "utf8");
      const bloc = new RegExp(`match /${collection}/\\{[a-zA-Z]+\\} \\{([^}]*)\\}`).exec(regles)?.[1];
      expect(bloc).toBeDefined();
      expect(bloc).toContain("allow read, write: if false;");
      expect((bloc ?? "").match(/allow /g)).toHaveLength(1);
    },
  );
```

Run: `(cd mobile && npx jest src/__tests__/paiement.test.ts -t "firestore.rules")`
Expected: FAIL, cinq blocs introuvables.

Dans `firestore.rules`, après le bloc `match /paiements/{paiementId} { … }`, ajouter :

```
    // Les frais de réservation des terrains (lib/reglement) : le dossier
    // d'argent d'une réservation, ce qui est dû à chacun, ce qui a été versé,
    // le numéro où verser un propriétaire, et le compteur d'essais de ticket.
    // Tout passe par des routes, avec le SDK admin. Une réservation, elle,
    // reste écrite par ses deux parties : c'est pour cela qu'aucun montant ni
    // aucun état de paiement n'y vit.
    match /reglements/{reservationId} {
      allow read, write: if false;
    }
    match /dus/{duId} {
      allow read, write: if false;
    }
    match /depots/{depotId} {
      allow read, write: if false;
    }
    match /comptes_versement/{uid} {
      allow read, write: if false;
    }
    match /essais_ticket/{uid} {
      allow read, write: if false;
    }
```

Run: `(cd mobile && npx jest src/__tests__/paiement.test.ts)`
Expected: PASS.

- [ ] **Step 2: Activer le paiement sur un terrain**

Créer `src/app/api/venues/[id]/paiement/route.ts` :

```ts
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { battementLu } from "@/lib/reglement";
import { ErreurReservation, appelant } from "@/lib/reservations-server";
import { ErreurVersement, ecrireCompteVersement, lireCompteVersement } from "@/lib/versements-serveur";

// ============================================
// GET /api/venues/[id]/paiement, PUT /api/venues/[id]/paiement
//
// Le propriétaire décide, terrain par terrain, si les frais de réservation se
// paient dans l'application, où il veut être versé, et ce que son terrain
// garde après chaque créneau.
//
// POURQUOI LE SERVEUR. Le terrain est un document public : le numéro de
// versement n'y a pas sa place, il va dans `comptes_versement`, fermée. Et
// activer le paiement sans tarif ni numéro encaisserait de l'argent qu'on ne
// saurait ni calculer ni verser.
// ============================================

export const dynamic = "force-dynamic";

async function lire(id: string, uid: string) {
  const snap = await adminDb.collection("venues").doc(id).get();
  if (!snap.exists) throw new ErreurReservation("Terrain introuvable", 404);
  if (snap.data()?.owner_id !== uid) throw new ErreurReservation("Ce terrain n'est pas le tien", 403);
  return snap;
}

async function etat(id: string, uid: string) {
  const v = (await lire(id, uid)).data() ?? {};
  const compte = await lireCompteVersement(uid);
  return {
    actif: v.paiement_app === true,
    numero: compte?.numero ?? null,
    battement: battementLu(v.battement_min),
    tarif: typeof v.price_per_hour === "number" ? v.price_per_hour : 0,
  };
}

function echec(err: unknown, ou: string) {
  if (err instanceof ErreurReservation || err instanceof ErreurVersement) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(`${ou} failed:`, err);
  return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const uid = await appelant(req);
    const { id } = await params;
    return NextResponse.json(await etat(id, uid));
  } catch (err) {
    return echec(err, "GET /api/venues/[id]/paiement");
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const uid = await appelant(req);
    const { id } = await params;
    const snap = await lire(id, uid);
    const corps = (await req.json().catch(() => ({}))) as { actif?: unknown; numero?: unknown; battement?: unknown };
    const actif = corps.actif === true;

    if (typeof corps.numero === "string" && corps.numero.trim()) await ecrireCompteVersement(uid, corps.numero);

    if (actif) {
      const tarif = snap.data()?.price_per_hour;
      if (typeof tarif !== "number" || tarif <= 0) {
        throw new ErreurReservation("Indique d'abord le tarif horaire de ce terrain : les frais en sont 5 %.", 400);
      }
      if (!(await lireCompteVersement(uid))) {
        throw new ErreurReservation("Donne le numéro mobile money où te verser les frais.", 400);
      }
    }

    const etaitActif = snap.data()?.paiement_app === true && typeof snap.data()?.paiement_app_depuis === "number";
    await snap.ref.update({
      paiement_app: actif,
      // Les frais ne valent que pour les demandes faites à partir de maintenant
      // (lib/reglement-serveur) : on date l'activation, pas chaque enregistrement.
      ...(actif && !etaitActif ? { paiement_app_depuis: Date.now() } : {}),
      battement_min: battementLu(corps.battement),
      updated_at: FieldValue.serverTimestamp(),
    });
    return NextResponse.json(await etat(id, uid));
  } catch (err) {
    return echec(err, "PUT /api/venues/[id]/paiement");
  }
}
```

- [ ] **Step 3: Payer un acompte, lire un règlement, valider un ticket**

Dans `src/app/api/paiements/route.ts` : importer `demarrerAcompte`, ajouter les trois refus à `STATUT` (`reservation: 404, deja_paye: 409, trop_tard: 409,`), et remplacer les deux lignes du `try` qui lisent le corps et répondent par :

```ts
    const corps = (await req.json().catch(() => ({}))) as { formule?: unknown; objet?: unknown; reservation?: unknown };
    const origine = new URL(req.url).origin;
    return NextResponse.json(
      corps.objet === "acompte"
        ? await demarrerAcompte(uid, corps.reservation, origine)
        : await demarrerPaiement(uid, corps.formule, origine),
    );
```

Compléter le commentaire d'en-tête de la route : `POST /api/paiements { formule } pour le Pro, { objet: "acompte", reservation } pour les frais de réservation d'un terrain.`

Créer `src/app/api/reservations/[id]/reglement/route.ts` :

```ts
import { NextResponse } from "next/server";
import { uidAppelant } from "@/lib/appelant";
import { ID_PAIEMENT } from "@/lib/paiement";
import { vuePour } from "@/lib/reglement-serveur";

/**
 * GET /api/reservations/{id}/reglement, où en sont les frais de réservation.
 *
 * Les deux parties d'une réservation le lisent, chacune à sa façon : l'équipe
 * y trouve ce qu'elle doit et son ticket, le propriétaire ce qui lui est dû.
 * La lecture SUIT la réservation au passage : c'est elle qui ouvre un
 * règlement manquant et qui constate une échéance passée.
 *
 * 404 pour tout autre, et quand la réservation n'a pas de règlement.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const uid = await uidAppelant(req);
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  try {
    const vue = ID_PAIEMENT.test(id) ? await vuePour(uid, id) : null;
    if (!vue) return NextResponse.json({ error: "Pas de frais de réservation ici" }, { status: 404 });
    return NextResponse.json(vue);
  } catch (err) {
    console.error("GET /api/reservations/[id]/reglement:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
```

Créer `src/app/api/reservations/ticket/route.ts` :

```ts
import { NextResponse } from "next/server";
import { uidAppelant } from "@/lib/appelant";
import { ErreurReglement, lireTicket, validerTicket } from "@/lib/reglement-serveur";

/**
 * GET  /api/reservations/ticket?code=…, ce que dit un ticket.
 * POST /api/reservations/ticket { code }, le valider.
 *
 * Le gérant, et lui seul : le serveur ne reconnaît un ticket que sur les
 * terrains de celui qui le présente. LIRE N'EST PAS VALIDER : le QR code
 * ouvre une page, et un téléphone qui précharge un lien ne doit pas déclarer
 * une équipe présente. La validation est un geste, donc un POST.
 */

export const dynamic = "force-dynamic";

function echec(err: unknown) {
  if (err instanceof ErreurReglement) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error("/api/reservations/ticket:", err);
  return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
}

export async function GET(req: Request) {
  const uid = await uidAppelant(req);
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    return NextResponse.json(await lireTicket(uid, new URL(req.url).searchParams.get("code")));
  } catch (err) {
    return echec(err);
  }
}

export async function POST(req: Request) {
  const uid = await uidAppelant(req);
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    const { code } = (await req.json().catch(() => ({}))) as { code?: unknown };
    return NextResponse.json(await validerTicket(uid, code));
  } catch (err) {
    return echec(err);
  }
}
```

- [ ] **Step 4: L'administration des versements**

Créer `src/app/api/admin/versements/route.ts` :

```ts
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { ErreurVersement, reglerALaMain, sommesDues } from "@/lib/versements-serveur";

/**
 * Les versements, côté administration.
 *
 * GET              , ce qui est dû à chacun, et le taux des frais de paiement.
 * POST { ids }     , ces sommes ont été versées par mobile money : les marquer.
 * PUT  { tauxFrais }, le taux des frais de paiement ajoutés à ce que l'équipe paie.
 *
 * Les dépôts FedaPay sont fermés sur le compte tant que leur support ne les a
 * pas activés : en attendant, c'est ici qu'on lit qui verser, et qu'on le dit.
 */

export const dynamic = "force-dynamic";

const reglages = () => adminDb.collection("settings").doc("paiement");

export async function GET(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    const [r, groupes] = await Promise.all([reglages().get(), sommesDues()]);
    const taux = r.data()?.taux_frais;
    return NextResponse.json({ tauxFrais: typeof taux === "number" ? taux : 0, groupes });
  } catch (err) {
    console.error("[admin/versements GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    const { ids } = (await req.json().catch(() => ({}))) as { ids?: unknown };
    if (!Array.isArray(ids) || ids.some((i) => typeof i !== "string")) {
      return NextResponse.json({ error: "Sommes manquantes" }, { status: 400 });
    }
    return NextResponse.json(await reglerALaMain(ids as string[], appelant.uid));
  } catch (err) {
    if (err instanceof ErreurVersement) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[admin/versements POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    const { tauxFrais } = (await req.json().catch(() => ({}))) as { tauxFrais?: unknown };
    if (typeof tauxFrais !== "number" || !Number.isFinite(tauxFrais) || tauxFrais < 0 || tauxFrais > 20) {
      return NextResponse.json({ error: "Taux invalide : un nombre entre 0 et 20." }, { status: 400 });
    }
    await reglages().set(
      { taux_frais: tauxFrais, updated_by: appelant.uid, updated_at: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/versements PUT]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Greffer le suivi sur les gestes de réservation**

Dans `src/app/api/bookings/[id]/route.ts` :

- importer : `import { suivreReservation, texteAcompteAttendu } from "@/lib/reglement-serveur";`

- sous les imports, ajouter :

```ts
/**
 * Le règlement des frais de réservation suit la réservation. Ne fait jamais
 * échouer le geste : la réservation est écrite, et un suivi manqué se
 * rattrape à la lecture suivante ou le lendemain matin.
 */
const suivre = (id: string, annoncer = true) =>
  suivreReservation(id, { annoncer }).catch((err) => {
    console.error("[reglement] suivi après un geste:", id, err);
    return null;
  });
```

- action `confirmer` : remplacer la fin du cas, de `if (match) await recopierSurLeMatch(match, surLeMatch(id, b, "confirmed"));` jusqu'à son `return NextResponse.json({ ok: true });` compris, par :

```ts
        if (match) await recopierSurLeMatch(match, surLeMatch(id, b, "confirmed"));
        // Sur un terrain qui fait payer ses frais, la confirmation ouvre le
        // règlement : un seul message dit les deux, le oui et ce qu'il reste à faire.
        const reglement = await suivre(id, false);
        const pour = b.match_label ? ` pour ${b.match_label}` : "";
        await notifier(b.user_id, {
          type: "booking_answer",
          title: reglement ? "Créneau confirmé : frais de réservation à payer" : "Créneau confirmé",
          body: reglement
            ? `${b.venue_name}, le ${quand(b)}${pour}. ${texteAcompteAttendu(reglement)}`
            : `${b.venue_name} est à toi le ${quand(b)}${pour}.`,
          link: reglement ? "/mes-reservations" : lien,
        });
        return NextResponse.json({ ok: true });
```

- actions `refuser` / `annuler` : juste avant le `return NextResponse.json({ ok: true });` qui termine ce cas (celui qui suit les deux `notifier`, pas les `return` de l'annulation d'une série plus haut : une série ne contient que des créneaux bloqués, sans règlement), ajouter `await suivre(id);`.

- action `prendre-proposition` : juste avant `return NextResponse.json({ id: cree.id, status: nouvelle.status });`, ajouter `if (libre) await suivre(cree.id);`.

Dans `src/app/api/matches/[mid]/terrain/route.ts` : importer `suivreReservation`, et après `const reservation = await synchroniserTerrain(mid, uid);` ajouter :

```ts
    if (reservation?.booking_id) {
      await suivreReservation(reservation.booking_id).catch((err) => console.error("[reglement] suivi du match:", mid, err));
    }
```

Dans `src/app/api/competitions/[cid]/terrain/route.ts` : importer `suivreReservation`, et après `reservations[mid] = await synchroniserTerrain({ mid, cid }, uid, annonces);` ajouter :

```ts
            const idReservation = reservations[mid]?.booking_id;
            if (idReservation) {
              await suivreReservation(idReservation).catch((err) => console.error("[reglement] suivi du match:", mid, err));
            }
```

Ces deux routes ne suivent que la réservation que le match garde. Celle qu'un changement de terrain ou d'horaire vient d'annuler (`cancelled_by: "systeme"`) n'est pas rendue par `synchroniserTerrain` : son règlement se clôt à la lecture suivante par l'une des deux parties (`vuePour`), ou au plus tard le lendemain matin (`suivreReglementsOuverts`). C'est voulu : l'équipe a déplacé son match, l'acompte déjà payé reste au propriétaire, comme pour une annulation.

- [ ] **Step 6: Les créneaux publics et la tâche du matin**

Dans `src/app/api/public/venue/[id]/slots/route.ts`, remplacer le corps du `try` par :

```ts
    const [snap, ouverts] = await Promise.all([
      adminDb.collection("bookings").where("venue_id", "==", id).where("status", "==", "confirmed").get(),
      adminDb.collection("reglements").where("venue_id", "==", id).where("cloture", "==", null).get(),
    ]);

    // Un créneau confirmé dont les frais n'ont pas été payés à temps est déjà
    // libre, même si personne ne l'a encore libéré (lib/reglement-serveur).
    // L'échéance se lit dans le règlement, jamais sur la réservation.
    const maintenant = Date.now();
    const echus = new Set(ouverts.docs
      .filter((d) => !d.get("paye_le") && typeof d.get("echeance") === "number" && d.get("echeance") < maintenant)
      .map((d) => d.id));

    const slots = snap.docs
      .filter((d) => !echus.has(d.id))
      .flatMap((d) => {
        const b = d.data();
        const date = typeof b.date === "string" ? b.date : null;
        // Le passé n'intéresse personne qui cherche un créneau.
        if (!date || date < today) return [];
        return [{
          date,
          time: typeof b.time === "string" ? b.time : "",
          duration: typeof b.duration === "number" ? b.duration : 1,
        }];
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

    return NextResponse.json({ slots });
```

La forme de la réponse ne change pas. Les deux requêtes filtrent sur deux égalités : Firestore les sert avec ses index par champ, sans index composé, comme il sert déjà celle des réservations. Ajouter une phrase au commentaire d'en-tête : « Une réservation confirmée dont les frais de réservation ne sont pas venus à temps ne compte plus : son créneau est libre. »

Dans `src/app/api/cron/scoreur-manquant/route.ts` : importer `suivreReglementsOuverts` de `@/lib/reglement-serveur`, l'ajouter au `Promise.all` existant :

```ts
    const [paiements, echeancesPro, reglements] = await Promise.all([
      reverifierPaiementsOuverts().catch((err) => {
        console.error("[cron/scoreur-manquant] paiements:", err);
        return null;
      }),
      rappelerEcheancesPro().catch((err) => {
        console.error("[cron/scoreur-manquant] échéances Pro:", err);
        return null;
      }),
      suivreReglementsOuverts().catch((err) => {
        console.error("[cron/scoreur-manquant] frais de réservation:", err);
        return null;
      }),
    ]);
```

et ajouter `reglements,` à la réponse JSON. Compléter le commentaire d'en-tête d'une phrase : la tâche libère aussi les créneaux dont les frais de réservation ne sont pas venus, et constate les absences.

- [ ] **Step 7: Vérifier**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

Run: `npx eslint src/app/api/venues src/app/api/reservations src/app/api/admin/versements src/app/api/paiements src/app/api/bookings src/app/api/public/venue src/app/api/cron/scoreur-manquant "src/app/api/matches/[mid]/terrain" "src/app/api/competitions/[cid]/terrain"`
Expected: aucune erreur nouvelle (comparer avec `git stash` en cas de doute sur une erreur préexistante).

Sur le serveur de dev (`preview_start`), sans jeton :

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/reservations/AbCdEfGhIjKlMnOpQrSt/reglement`
Expected: `401`

Run: `curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/reservations/ticket -H "Content-Type: application/json" -d '{"code":"ZZZZZZ"}'`
Expected: `401`

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/admin/versements`
Expected: `401`

Run: `curl -s http://localhost:3000/api/public/venue/inconnu/slots`
Expected: `{"slots":[]}`

- [ ] **Step 8: Commit**

```bash
git add src/app/api firestore.rules mobile/src/__tests__/paiement.test.ts
git commit -m "feat(reglement): routes des frais de réservation, du ticket et des versements

Confirmer, annuler ou prendre une proposition suit désormais le
règlement de la réservation. Le QR d'un ticket ouvre une lecture, la
validation est un geste à part. Les créneaux publics ignorent une
réservation dont les frais ne sont pas venus à temps, et la tâche du
matin la libère.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: L'équipe paie et montre son ticket

**Files:**
- Modify: `package.json`, `package-lock.json` (dépendance `qrcode.react`)
- Create: `src/components/venue/ReglementEquipe.tsx`
- Modify: `src/app/(app)/mes-reservations/page.tsx`, `src/components/venue/BookingRequest.tsx`, `src/app/(marketing)/terrains/[id]/page.tsx`

**Interfaces:**
- Consumes: `appeler` de `@/lib/reservations-client` ; `VueReglement` de `@/lib/reglement` ; `GET /api/reservations/{id}/reglement`, `POST /api/paiements`, `GET /api/paiements/{id}` ; `acompteDe`, `prixDuCreneau` ; `idPaiementDuRetour` de `@/lib/paiement` ; `Booking.reglementVu`, `Venue.paiementApp` (tâche 1).
- Produces (de `@/components/venue/ReglementEquipe`) :
  - `useReglements(reservations: { id: string; reglementVu?: string | null }[]): Record<string, VueReglement>`
  - `<RetourPaiement />`
  - `<ReglementEquipe etat vue occupe onPayer />`

**Une contrainte de la page à connaître.** Dans `mes-reservations/page.tsx`, `Ligne` est un composant défini DANS la page : il est recréé, donc remonté, à chaque rendu de la page. Un composant qui lirait son règlement lui-même le relirait à chaque rendu et clignoterait. Les règlements sont donc lus au niveau de la page (`useReglements`), et `ReglementEquipe` ne fait qu'afficher.

- [ ] **Step 1: La bibliothèque du QR code**

Vérifier d'abord qu'elle accepte React 19 :

Run: `npm view qrcode.react version peerDependencies`
Expected: une version 4.x, et `react` qui inclut `^19`. Sinon s'arrêter et le signaler.

Run: `npm install qrcode.react`
Expected: `added 1 package`. `package.json` gagne une ligne dans `dependencies`.

- [ ] **Step 2: Le composant de l'équipe**

Créer `src/components/venue/ReglementEquipe.tsx` :

```tsx
"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";
import { CreditCard, Ticket } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { idPaiementDuRetour } from "@/lib/paiement";
import type { VueReglement } from "@/lib/reglement";
import { appeler } from "@/lib/reservations-client";
import { Bouton } from "@/components/venue/venue-ui";

// ============================================
// Les frais de réservation, vus de l'équipe : ce qu'il reste à payer, puis le
// ticket.
//
// LE TICKET EST CE QU'ON MONTRE. Un code de six caractères, qui se dicte, et
// un QR code que le gérant scanne avec l'appareil photo de son téléphone : il
// porte l'adresse de la page du ticket, rien d'autre.
//
// LES MOTS DE LA VIDÉO. Les frais sont annoncés comme elle les annonce,
// « remboursés si le match a lieu », avec ce que cela veut dire : ils sont
// déduits de ce qu'on règle sur place.
//
// LA RÉSERVATION DIT QUAND RELIRE, LE SERVEUR DIT QUOI. La liste écoute les
// réservations ; chacune porte une copie d'affichage de l'état de ses frais
// (`reglementVu`), que le serveur met à jour à chaque étape. Cette copie
// suffit à dire qu'une réservation est close, et comment. Tant qu'elle est
// ouverte, les montants, l'échéance et le code viennent du serveur, relus
// chaque fois que la copie change.
// ============================================

const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;
const instant = (ms: number) =>
  new Date(ms).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/** Les états où il reste quelque chose à lire au serveur. */
const OUVERTS = ["acompte_attendu", "acompte_paye"];

/** Comment une réservation payante a fini. (« libere » se dit déjà dans l'état de la réservation.) */
const CLOS: Record<string, string> = {
  joue: "Match joué. Tes frais de réservation ont été déduits de ce que tu as réglé sur place.",
  absent: "Ton ticket n'a pas été validé : les frais de réservation restent au propriétaire.",
  annule_equipe: "Les frais de réservation déjà payés restent au propriétaire.",
  annule_proprietaire: "Le propriétaire a annulé : les frais de réservation que tu as payés te sont rendus.",
};

/**
 * Les règlements des réservations dont les frais sont attendus ou payés.
 * Relus quand une de ces réservations change d'état, pas à chaque rendu.
 */
export function useReglements(reservations: { id: string; reglementVu?: string | null }[]): Record<string, VueReglement> {
  const [vues, setVues] = useState<Record<string, VueReglement>>({});
  const cle = reservations
    .filter((r) => OUVERTS.includes(r.reglementVu ?? ""))
    .map((r) => `${r.id}:${r.reglementVu}`)
    .join(",");

  useEffect(() => {
    if (!cle) return;
    let vivant = true;
    const ids = cle.split(",").map((paire) => paire.split(":")[0]);
    void Promise.all(ids.map((id) =>
      appeler<VueReglement>(`/api/reservations/${id}/reglement`, "GET")
        .then((vue) => [id, vue] as const)
        .catch(() => null),
    )).then((paires) => {
      if (vivant) setVues(Object.fromEntries(paires.filter((p): p is readonly [string, VueReglement] => p !== null)));
    });
    return () => { vivant = false; };
  }, [cle]);

  return vues;
}

/**
 * Au retour de la page de paiement : demander au serveur où en est le
 * paiement, et le dire. L'adresse ne prouve rien (lib/paiement) : on n'y lit
 * que l'identifiant. C'est cette question qui fait régler le paiement quand
 * le webhook n'est pas encore passé ; le ticket arrive ensuite tout seul, par
 * la réservation qui change.
 */
export function RetourPaiement() {
  const { firebaseUser } = useAuth();
  const [id] = useState(() =>
    typeof window === "undefined" ? null : idPaiementDuRetour(new URLSearchParams(window.location.search).get("paiement")));

  useEffect(() => {
    if (!firebaseUser || !id) return;
    let vivant = true;
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    let essais = 0;
    window.history.replaceState(null, "", window.location.pathname);

    const verifier = async () => {
      essais += 1;
      const etat = await appeler<{ statut?: string }>(`/api/paiements/${id}`, "GET").catch(() => null);
      if (!vivant) return;
      if (etat?.statut === "paye") {
        toast.success("Frais de réservation payés : ton ticket est prêt.");
        return;
      }
      if (etat?.statut === "echoue" || etat?.statut === "annule" || etat?.statut === "expire") {
        toast.error("Le paiement n'a pas abouti. Tu peux réessayer.");
        return;
      }
      if (essais >= 10) {
        toast("La confirmation tarde : ton ticket apparaîtra tout seul dès qu'elle arrive.");
        return;
      }
      minuterie = setTimeout(() => void verifier(), 3000);
    };
    void verifier();
    return () => { vivant = false; clearTimeout(minuterie); };
  }, [firebaseUser, id]);

  return null;
}

/**
 * `etat` : la copie d'affichage de la réservation. `vue` : ce que le serveur
 * en dit, tant qu'elle est ouverte (absente le temps de la lecture).
 */
export function ReglementEquipe({ etat, vue, occupe, onPayer }: {
  etat: string;
  vue: VueReglement | undefined;
  occupe: boolean;
  onPayer: () => void;
}) {
  const clos = CLOS[etat];
  if (clos) return <p className="mt-2 text-[11px] font-bold leading-relaxed text-gray-500">{clos}</p>;
  if (!vue || vue.role !== "equipe") return null;

  if (vue.etat === "acompte_attendu") {
    return (
      <div className="mt-3 border border-amber-300 bg-amber-50 px-4 py-3">
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-amber-900">
          Frais de réservation : {fcfa(vue.acompte)}
        </p>
        <p className="mt-1 text-[11px] font-bold leading-relaxed text-amber-900">
          À payer avant {instant(vue.echeance)} pour garder le créneau. Remboursés si le match a lieu : ils sont
          déduits de ce que tu règles sur place ({fcfa(vue.reste)} au lieu de {fcfa(vue.prix)}).
        </p>
        {vue.frais > 0 && (
          <p className="mt-1 text-[11px] text-amber-800">
            Avec {fcfa(vue.frais)} de frais de paiement, tu paies {fcfa(vue.total)}.
          </p>
        )}
        <Bouton petit Icon={CreditCard} occupe={occupe} onClick={onPayer} className="mt-2">
          Payer {fcfa(vue.total)}
        </Bouton>
      </div>
    );
  }

  if (vue.etat === "acompte_paye" && vue.code) {
    const adresse = `${window.location.origin}/ticket/${vue.code}`;
    return (
      <div className="mt-3 flex flex-wrap items-center gap-4 border border-emerald-300 bg-emerald-50 px-4 py-3">
        <div className="shrink-0 bg-white p-2">
          <QRCodeSVG value={adresse} size={96} marginSize={0} title="Ticket de réservation" />
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800">
            <Ticket size={12} /> Ton ticket
          </p>
          <p className="mt-1 font-display text-2xl font-black tracking-[0.2em] text-gray-900">{vue.code}</p>
          <p className="mt-1 text-[11px] font-bold leading-relaxed text-emerald-900">
            Montre-le au gérant en arrivant. Il te restera {fcfa(vue.reste)} à régler sur place.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
```

Si `QRCodeSVG` n'accepte pas `marginSize` ou `title` dans la version installée, lire ses types (`node_modules/qrcode.react/lib/index.d.ts`) et retirer la propriété refusée : aucune des deux n'est nécessaire.

- [ ] **Step 3: Brancher sur « Mes réservations »**

Dans `src/app/(app)/mes-reservations/page.tsx` :

- imports : ajouter

```tsx
import { ReglementEquipe, RetourPaiement, useReglements } from "@/components/venue/ReglementEquipe";
```

et `appeler` à l'import de `@/lib/reservations-client` (`import { agirSurReservation, appeler } from "@/lib/reservations-client";`).

- dans `MyBookingsPage`, après `const { demander, Dialogue } = useConfirmation();` :

```tsx
  // Les frais de réservation des créneaux confirmés, lus au serveur. Ici et pas
  // dans `Ligne` : elle est recréée à chaque rendu de la page.
  const reglements = useReglements(demandes ?? []);

  // Revenu de la page de paiement par le bouton « retour » du navigateur : le
  // bouton « Payer » ne doit pas rester grisé.
  useEffect(() => {
    const revenir = (e: PageTransitionEvent) => { if (e.persisted) setAgit(null); };
    window.addEventListener("pageshow", revenir);
    return () => window.removeEventListener("pageshow", revenir);
  }, []);
```

- à côté de la fonction `prendre`, ajouter :

```tsx
  const payer = async (b: Booking) => {
    setAgit(b.id);
    try {
      // Le montant n'est pas envoyé : le serveur le lit dans le règlement.
      const { url } = await appeler<{ url: string }>("/api/paiements", "POST", { objet: "acompte", reservation: b.id });
      window.location.assign(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Paiement indisponible pour l'instant.");
      setAgit(null);
    }
  };
```

- dans `Ligne`, la branche `b.cancelledBy === "systeme"` du calcul de `etat` devient :

```tsx
      : b.cancelledBy === "systeme" ? {
        ...base,
        label: "Libéré",
        sens: b.reglementVu === "libere"
          ? "Les frais de réservation n'ont pas été payés à temps : le créneau s'est libéré."
          : "Le match a changé : ce créneau s'est libéré.",
      }
```

- dans `Ligne`, juste après le bloc `{offre && ( … )}` (avant la fermeture du `<div className="min-w-0">`) :

```tsx
          {b.reglementVu && (
            <ReglementEquipe
              etat={b.reglementVu}
              vue={reglements[b.id]}
              occupe={agit === b.id}
              onPayer={() => void payer(b)}
            />
          )}
```

- dans le rendu de la page, juste après `<FilAriane … />` : `<RetourPaiement />`.

- dans l'en-tête de commentaire du fichier, ajouter un paragraphe :

```tsx
// LES FRAIS DE RÉSERVATION SE PAIENT ICI. Sur un terrain qui les demande, une
// réservation confirmée affiche ce qu'il reste à payer, puis le ticket à
// montrer au gérant (voir components/venue/ReglementEquipe). La liste ne lit
// que la copie d'affichage de la réservation ; les montants et le ticket
// viennent du serveur.
```

- [ ] **Step 4: Annoncer les frais avant la demande**

Dans `src/components/venue/BookingRequest.tsx` :

- ajouter la prop `paiementApp = false` à la déstructuration (à côté de `pricePerHour = 0`) et `paiementApp?: boolean;` à son type (à côté de `pricePerHour?: number;`) ;
- importer `acompteDe`, `prixDuCreneau` de `@/lib/reglement` ;
- remplacer le paragraphe `{aUnPrix(pricePerHour) && ( … )}` du récapitulatif par :

```tsx
              {aUnPrix(pricePerHour) && (
                <p className="mt-1 text-[11px] font-bold text-gray-500">
                  Soit environ{" "}
                  <strong className="font-black text-gray-900">
                    {(pricePerHour * heures).toLocaleString("fr-FR")} FCFA
                  </strong>
                  {paiementApp ? "." : ", à régler directement au propriétaire."}
                </p>
              )}
              {paiementApp && aUnPrix(pricePerHour) && (
                <p className="mt-2 border-t border-gray-200/70 pt-2 text-[11px] font-bold leading-relaxed text-gray-600">
                  Frais de réservation :{" "}
                  <strong className="font-black text-gray-900">
                    {acompteDe(prixDuCreneau(pricePerHour, heures)).toLocaleString("fr-FR")} FCFA
                  </strong>
                  , à payer dans l&apos;application une fois le créneau confirmé. Remboursés si le match a lieu : ils
                  sont déduits de ce que tu règles sur place.
                </p>
              )}
```

- dans l'en-tête de commentaire, le paragraphe qui commence par « Le geste reste volontairement pauvre : une date, une heure, une durée. » : garder cette première phrase, et remplacer la suite du paragraphe (ce qu'il dit du règlement) par :

```tsx
// Sur un terrain qui fait payer ses frais de réservation dans l'application
// (lib/reglement), la demande reste gratuite : les frais ne se paient qu'une
// fois le créneau confirmé. Ailleurs, tout se règle entre les deux parties.
```

Lire le paragraphe en entier avant de le récrire : s'il dit autre chose que le règlement, le garder.

Dans `src/app/(marketing)/terrains/[id]/page.tsx` : passer `paiementApp={venue.paiementApp}` à `<BookingRequest>` (la tâche 1 a mis `paiementApp` dans l'objet lu du terrain).

- [ ] **Step 5: Vérifier**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

Run: `npx eslint src/components/venue/ReglementEquipe.tsx "src/app/(app)/mes-reservations/page.tsx" src/components/venue/BookingRequest.tsx`
Expected: aucune erreur nouvelle.

Sur le serveur de dev, ouvrir `http://localhost:3000/mes-reservations` dans le volet navigateur, puis `read_console_messages` avec `onlyErrors: true`.
Expected: aucune erreur de rendu. Sans session, la page demande la connexion, comme avant.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/components/venue/ReglementEquipe.tsx "src/app/(app)/mes-reservations/page.tsx" src/components/venue/BookingRequest.tsx "src/app/(marketing)/terrains/[id]/page.tsx"
git commit -m "feat(reservations): l'équipe paie ses frais de réservation et reçoit son ticket

Une réservation confirmée sur un terrain qui les demande affiche ce
qu'il reste à payer, puis le ticket : un code qui se dicte et un QR que
le gérant scanne. Les frais sont annoncés dès la demande, avec les mots
de la vidéo.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Le gérant active, suit et valide

**Files:**
- Create: `src/components/venue/PaiementTerrain.tsx`, `src/components/venue/ValiderTicket.tsx`, `src/components/venue/FraisDus.tsx`, `src/app/(app)/ticket/[code]/page.tsx`
- Modify: `src/app/(app)/mes-terrains/page.tsx`, `src/app/(app)/mes-terrains/reservations/page.tsx`

**Interfaces:**
- Consumes: `GET`/`PUT /api/venues/{id}/paiement`, `GET`/`POST /api/reservations/ticket` ; `ResumeTicket` de `@/lib/reglement` ; `acompteDe` ; `appeler`.
- Produces: `<PaiementTerrain venueId tarif />`, `<ValiderTicket />`, `<TicketLu resume onValider occupe />`, `<FraisDus reservationId />`.

- [ ] **Step 1: Le bloc d'activation**

Créer `src/components/venue/PaiementTerrain.tsx` :

```tsx
"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { acompteDe } from "@/lib/reglement";
import { appeler } from "@/lib/reservations-client";
import { Bouton, classeChamp } from "@/components/venue/venue-ui";

// ============================================
// Les frais de réservation d'un terrain, côté propriétaire : les activer,
// dire où être versé, régler le battement.
//
// CE QU'IL FAUT QU'IL SACHE AVANT D'ACTIVER, dit ici et pas dans des
// conditions : l'équipe paie 5 % dans l'application, le reste en liquide chez
// lui ; les frais lui reviennent si l'équipe ne vient pas ; il les rend s'il
// annule. Son prix reste son prix.
// ============================================

interface Etat { actif: boolean; numero: string | null; battement: number; tarif: number }

export function PaiementTerrain({ venueId, tarif }: { venueId: string; tarif: number }) {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [actif, setActif] = useState(false);
  const [numero, setNumero] = useState("");
  const [battement, setBattement] = useState(0);
  const [envoi, setEnvoi] = useState(false);

  const poser = (e: Etat) => {
    setEtat(e);
    setActif(e.actif);
    setNumero(e.numero ?? "");
    setBattement(e.battement);
  };

  useEffect(() => {
    let vivant = true;
    appeler<Etat>(`/api/venues/${venueId}/paiement`, "GET")
      .then((e) => { if (vivant) poser(e); })
      .catch(() => {});
    return () => { vivant = false; };
  }, [venueId]);

  if (!etat) return null;

  const enregistrer = async () => {
    setEnvoi(true);
    try {
      poser(await appeler<Etat>(`/api/venues/${venueId}/paiement`, "PUT", { actif, numero, battement }));
      toast.success(actif ? "Frais de réservation activés" : "Réglages enregistrés");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "L'enregistrement a échoué");
    } finally {
      setEnvoi(false);
    }
  };

  const inchange = actif === etat.actif && numero.trim() === (etat.numero ?? "") && battement === etat.battement;
  const exemple = acompteDe(tarif);

  return (
    <div className="border-t border-gray-200/70 px-5 py-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">Frais de réservation et battement</p>

      <label className="mt-3 flex items-start gap-2.5 text-sm font-bold text-gray-900">
        <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} className="mt-1" />
        <span>
          Faire payer les frais de réservation dans l&apos;application
          <span className="mt-0.5 block text-[11px] font-semibold leading-relaxed text-gray-500">
            Une fois que tu as confirmé un créneau, l&apos;équipe paie 5 % du prix
            {exemple > 0 ? ` (${exemple.toLocaleString("fr-FR")} FCFA pour une heure)` : ""} et reçoit un ticket, que tu
            valides à son arrivée. Elle te règle le reste sur place : ton prix reste ton prix. Si elle ne vient pas ou
            annule, les frais te restent ; si c&apos;est toi qui annules, ils lui sont rendus.
          </span>
        </span>
      </label>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
            Numéro mobile money où te verser
          </span>
          <input
            inputMode="tel"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="90 12 34 56"
            className={classeChamp}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
            Battement après chaque créneau
          </span>
          <select value={battement} onChange={(e) => setBattement(Number(e.target.value))} className={classeChamp}>
            <option value={0}>Aucun</option>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
          </select>
        </label>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
        Le battement garde ton terrain après chaque créneau, pour qu&apos;un match parti en retard ne déborde pas sur
        le suivant. Les frais te sont versés après le match, quelques jours plus tard.
      </p>

      <Bouton petit occupe={envoi} disabled={inchange} onClick={() => void enregistrer()} className="mt-3">
        Enregistrer
      </Bouton>
    </div>
  );
}
```

Dans `src/app/(app)/mes-terrains/page.tsx` : importer `PaiementTerrain`, et dans `CarteTerrain`, juste avant `</article>` (après le paragraphe `aCompleter`) :

```tsx
      <PaiementTerrain venueId={v.id} tarif={v.pricePerHour} />
```

- [ ] **Step 2: Valider un ticket**

Créer `src/components/venue/ValiderTicket.tsx` :

```tsx
"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Check, Ticket } from "lucide-react";
import type { ResumeTicket } from "@/lib/reglement";
import { appeler } from "@/lib/reservations-client";
import { dateLongue, finCreneau } from "@/lib/terrains";
import { Bouton, classeChamp } from "@/components/venue/venue-ui";

// ============================================
// Valider le ticket d'une équipe arrivée sur place.
//
// DEUX PORTES, UN MÊME GESTE. Le gérant tape le code ici, ou scanne le QR
// avec l'appareil photo de son téléphone, qui ouvre /ticket/{code}. Les deux
// montrent d'abord ce que dit le ticket, puis demandent de valider : on ne
// déclare pas une équipe présente en ouvrant un lien.
// ============================================

const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

/** Ce que dit un ticket, et le bouton pour le valider. */
export function TicketLu({ resume, onValider, occupe }: { resume: ResumeTicket; onValider: () => void; occupe: boolean }) {
  return (
    <div className="border border-gray-200/70 bg-white p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">{resume.terrain}</p>
      <p className="mt-1 text-lg font-black text-gray-900">{resume.equipe}</p>
      <p className="mt-1 text-[11px] font-bold text-gray-500">
        {dateLongue(resume.date)} · {resume.time} → {finCreneau(resume.time, resume.duration)}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-px border border-gray-200/70 bg-gray-200/70">
        <div className="bg-white px-3 py-2.5">
          <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-400">Frais déjà payés</dt>
          <dd className="mt-0.5 text-sm font-black text-emerald-700">{fcfa(resume.acompte)}</dd>
        </div>
        <div className="bg-white px-3 py-2.5">
          <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-400">Reste à régler sur place</dt>
          <dd className="mt-0.5 text-sm font-black text-gray-900">{fcfa(resume.reste)}</dd>
        </div>
      </dl>
      {resume.valide ? (
        <p className="mt-4 flex items-center gap-1.5 text-sm font-black text-emerald-700">
          <Check size={15} /> Ticket validé
        </p>
      ) : (
        <Bouton Icon={Check} occupe={occupe} onClick={onValider} className="mt-4">
          Valider le ticket
        </Bouton>
      )}
    </div>
  );
}

export function ValiderTicket() {
  const [code, setCode] = useState("");
  const [resume, setResume] = useState<ResumeTicket | null>(null);
  const [occupe, setOccupe] = useState(false);

  const lire = async () => {
    setOccupe(true);
    try {
      setResume(await appeler<ResumeTicket>(`/api/reservations/ticket?code=${encodeURIComponent(code.trim())}`, "GET"));
    } catch (err) {
      setResume(null);
      toast.error(err instanceof Error ? err.message : "Ticket introuvable");
    } finally {
      setOccupe(false);
    }
  };

  const valider = async () => {
    setOccupe(true);
    try {
      setResume(await appeler<ResumeTicket>("/api/reservations/ticket", "POST", { code: code.trim() }));
      toast.success("Ticket validé");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "La validation a échoué");
    } finally {
      setOccupe(false);
    }
  };

  return (
    <div className="mt-6 border border-gray-200/70 bg-gray-50 p-5">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-gray-500">
        <Ticket size={12} /> Valider un ticket
      </p>
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => { e.preventDefault(); void lire(); }}
      >
        <input
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setResume(null); }}
          placeholder="Code à 6 caractères"
          maxLength={9}
          autoCapitalize="characters"
          autoComplete="off"
          className={`${classeChamp} max-w-[14rem] font-black tracking-[0.2em]`}
        />
        <Bouton petit variante="contour" occupe={occupe && !resume} disabled={code.trim().length < 6} type="submit">
          Lire le ticket
        </Bouton>
      </form>
      <p className="mt-2 text-[11px] text-gray-500">
        Ou scanne le QR code de l&apos;équipe avec l&apos;appareil photo de ton téléphone.
      </p>
      {resume && (
        <div className="mt-4">
          <TicketLu resume={resume} onValider={() => void valider()} occupe={occupe} />
        </div>
      )}
    </div>
  );
}
```

Créer `src/app/(app)/ticket/[code]/page.tsx` :

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { ResumeTicket } from "@/lib/reglement";
import { appeler } from "@/lib/reservations-client";
import { TicketLu } from "@/components/venue/ValiderTicket";
import { EnCours, FilAriane, LienBouton } from "@/components/venue/venue-ui";

// ============================================
// La page d'un ticket : celle que le QR code ouvre.
//
// LE GÉRANT SCANNE AVEC L'APPAREIL PHOTO DE SON TÉLÉPHONE, qui ouvre cette
// adresse dans son navigateur, où il est connecté. Aucun lecteur à installer.
//
// OUVRIR N'EST PAS VALIDER. La page montre ce que dit le ticket et demande le
// geste. Pour tout autre que le gérant du terrain, le serveur ne reconnaît
// pas le code : un ticket photographié ne sert à rien à qui n'a pas le terrain.
// ============================================

export default function PageTicket() {
  const { code } = useParams<{ code: string }>();
  const { user, loading } = useAuth();
  const [resume, setResume] = useState<ResumeTicket | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    if (!user) return;
    let vivant = true;
    appeler<ResumeTicket>(`/api/reservations/ticket?code=${encodeURIComponent(code)}`, "GET")
      .then((r) => { if (vivant) setResume(r); })
      .catch((err) => { if (vivant) setErreur(err instanceof Error ? err.message : "Ticket introuvable"); });
    return () => { vivant = false; };
  }, [user, code]);

  if (loading) return <EnCours hauteur="h-[60vh] items-center" />;
  if (!user) return null;

  const valider = async () => {
    setOccupe(true);
    try {
      setResume(await appeler<ResumeTicket>("/api/reservations/ticket", "POST", { code }));
      toast.success("Ticket validé");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "La validation a échoué");
    } finally {
      setOccupe(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl pb-24">
      <FilAriane items={[{ href: "/mes-terrains/reservations", label: "Réservations reçues" }, { label: "Ticket" }]} />
      <div className="mt-6">
        {resume ? (
          <TicketLu resume={resume} onValider={() => void valider()} occupe={occupe} />
        ) : erreur ? (
          <div className="border border-gray-200/70 bg-white p-5">
            <p className="text-sm font-black text-gray-900">{erreur}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
              Un ticket se valide par le gérant du terrain, connecté à son compte, le jour du match.
            </p>
            <LienBouton href="/mes-terrains/reservations" petit className="mt-4">
              Mes réservations reçues
            </LienBouton>
          </div>
        ) : (
          <EnCours />
        )}
      </div>
    </div>
  );
}
```

Créer `src/components/venue/FraisDus.tsx` :

```tsx
"use client";

import { useEffect, useState } from "react";
import type { VueReglement } from "@/lib/reglement";
import { appeler } from "@/lib/reservations-client";

// ============================================
// Ce qui est dû au gérant pour une réservation close, et si c'est versé.
//
// La liste des réservations dit comment une réservation a fini (sa copie
// d'affichage) ; ce qui est dû, et la date du versement, se lisent au
// serveur. Une ligne par réservation close : on ne lit que celles-là.
// ============================================

const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

export function FraisDus({ reservationId }: { reservationId: string }) {
  const [du, setDu] = useState<VueReglement["du"]>(null);

  useEffect(() => {
    let vivant = true;
    appeler<VueReglement>(`/api/reservations/${reservationId}/reglement`, "GET")
      .then((vue) => { if (vivant) setDu(vue.du); })
      .catch(() => {});
    return () => { vivant = false; };
  }, [reservationId]);

  if (!du) return null;
  return (
    <p className="mt-2 text-[11px] font-bold text-gray-500">
      {du.verseLe
        ? `Frais de réservation versés le ${new Date(du.verseLe).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} : ${fcfa(du.montant)}.`
        : `Frais de réservation dus : ${fcfa(du.montant)}. Ils te sont versés quelques jours après le match.`}
    </p>
  );
}
```

- [ ] **Step 3: Les réservations reçues**

Dans `src/app/(app)/mes-terrains/reservations/page.tsx` :

- importer `ValiderTicket` ;

- au-dessus de la fonction `Ligne`, ajouter :

```tsx
/** Où en sont les frais de réservation, d'après la copie d'affichage de la réservation. */
const FRAIS: Record<string, { label: string; ton: "attente" | "ok" | "refus" | "neutre" }> = {
  acompte_attendu: { label: "Frais attendus", ton: "attente" },
  acompte_paye: { label: "Frais payés", ton: "ok" },
  joue: { label: "Joué · frais dus", ton: "ok" },
  absent: { label: "Absence · frais dus", ton: "refus" },
  annule_equipe: { label: "Annulé par l'équipe", ton: "neutre" },
  annule_proprietaire: { label: "Frais rendus", ton: "neutre" },
  libere: { label: "Frais non payés", ton: "neutre" },
};
```

- dans `Ligne`, à côté du `Fanion` d'état (la ligne `{blocage ? <Fanion ton="neutre">Bloqué</Fanion> : <Fanion ton={etat.ton}>{etat.label}</Fanion>}`), ajouter juste après :

```tsx
              {!blocage && b.reglementVu && FRAIS[b.reglementVu] && (
                <Fanion ton={FRAIS[b.reglementVu].ton}>{FRAIS[b.reglementVu].label}</Fanion>
              )}
```

- dans `Ligne`, juste avant `{!blocage && <Contact b={b} />}`, ajouter (ici `Ligne` est une fonction du module, stable d'un rendu à l'autre : le composant peut lire lui-même) :

```tsx
      {(b.reglementVu === "joue" || b.reglementVu === "absent" || b.reglementVu === "annule_equipe") && (
        <FraisDus reservationId={b.id} />
      )}
```

La ligne empile ses blocs sous son en-tête (le message de l'équipe, puis le contact) : celui-ci s'y ajoute, au même niveau.

- importer `FraisDus` de `@/components/venue/FraisDus`.

- dans le rendu de la page, juste après `<Panneau … />`, ajouter : `{terrains.some((t) => t.paiementApp) && <ValiderTicket />}`.

- [ ] **Step 4: Vérifier**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

Run: `npx eslint src/components/venue/PaiementTerrain.tsx src/components/venue/ValiderTicket.tsx src/components/venue/FraisDus.tsx "src/app/(app)/ticket/[code]/page.tsx" "src/app/(app)/mes-terrains/page.tsx" "src/app/(app)/mes-terrains/reservations/page.tsx"`
Expected: aucune erreur nouvelle.

Sur le serveur de dev, ouvrir `http://localhost:3000/ticket/ZZZZZZ` puis `http://localhost:3000/mes-terrains` dans le volet navigateur, et lire la console (`read_console_messages`, `onlyErrors: true`).
Expected: aucune erreur de rendu ; sans session, « Connexion requise ».

- [ ] **Step 5: Commit**

```bash
git add src/components/venue/PaiementTerrain.tsx src/components/venue/ValiderTicket.tsx src/components/venue/FraisDus.tsx "src/app/(app)/ticket" "src/app/(app)/mes-terrains/page.tsx" "src/app/(app)/mes-terrains/reservations/page.tsx"
git commit -m "feat(terrains): le gérant active les frais de réservation et valide les tickets

Chaque terrain choisit s'il fait payer ses frais dans l'application, où
être versé, et son battement. Les réservations reçues disent où en sont
les frais ; un ticket se valide par son code ou par la page que son QR
ouvre, après l'avoir lu.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: L'administration verse

**Files:**
- Create: `src/app/(admin)/admin/versements/page.tsx`
- Modify: `src/components/layout/AdminSidebar.tsx`

**Interfaces:**
- Consumes: `GET`/`POST`/`PUT /api/admin/versements` (tâche 6) ; les composants de `@/components/admin/ui` (`BOUTON_VERT`, `BOUTON_CONTOUR`, `Carte`, `Chargement`, `Chiffre`, `EnTete`, `Erreur`, `Pastille`, `Titre`, `Vide`).

- [ ] **Step 1: La page**

Créer `src/app/(admin)/admin/versements/page.tsx` :

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  BOUTON_CONTOUR, BOUTON_VERT, Carte, Chargement, Chiffre, EnTete, Erreur, Pastille, Titre, Vide,
} from "@/components/admin/ui";

// ============================================
// Admin, les versements.
//
// CE QUE KOPPAFOOT DOIT. Les frais de réservation des terrains sont encaissés
// par KoppaFoot pour le compte des propriétaires : chaque réservation close
// laisse une somme due, au propriétaire le plus souvent, à l'équipe quand le
// propriétaire a annulé. Cette page dit à qui verser, combien, et sur quel
// numéro.
//
// LE VERSEMENT SE FAIT À LA MAIN, POUR L'INSTANT. Les dépôts FedaPay sont
// fermés sur le compte tant que leur support ne les a pas activés. On envoie
// l'argent par mobile money, puis on le marque ici : la somme ne peut l'être
// qu'une fois. Quand les dépôts seront automatiques, ce geste restera le
// filet d'un dépôt en échec.
//
// LES FONDS NE SONT PAS LIBRES TOUT DE SUITE. FedaPay les garde quelques
// jours après l'encaissement : chaque ligne dit depuis quand ils le sont.
// ============================================

interface Ligne {
  id: string;
  montant: number;
  motif: "acompte" | "remboursement";
  libelle: string;
  /** Pour un remboursement : le téléphone que l'équipe a donné dans sa demande. */
  telephone: string | null;
  disponible_le: string | null;
}

interface Groupe {
  beneficiaire: string;
  nom: string;
  numero: string | null;
  total: number;
  lignes: Ligne[];
}

const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;
const numeroLisible = (n: string) => n.replace(/(\d{2})(?=\d)/g, "$1 ");

function Liberation({ iso }: { iso: string | null }) {
  if (!iso) return <Pastille ton="gris">Libération inconnue</Pastille>;
  const libre = Date.parse(iso) <= Date.now();
  const jour = new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  return <Pastille ton={libre ? "vert" : "ambre"}>{libre ? "Fonds libérés" : `Fonds libérés le ${jour}`}</Pastille>;
}

export default function AdminVersementsPage() {
  const { firebaseUser } = useAuth();
  const [donnees, setDonnees] = useState<{ tauxFrais: number; groupes: Groupe[] } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [taux, setTaux] = useState("");
  const [envoi, setEnvoi] = useState<string | null>(null);

  const appel = useCallback(async (method: string, corps?: unknown) => {
    if (!firebaseUser) throw new Error("Session expirée");
    const rep = await fetch("/api/admin/versements", {
      method,
      headers: { Authorization: `Bearer ${await firebaseUser.getIdToken()}`, ...(corps ? { "Content-Type": "application/json" } : {}) },
      body: corps ? JSON.stringify(corps) : undefined,
    });
    const data = await rep.json().catch(() => ({}));
    if (!rep.ok) throw new Error(data.error ?? "Erreur serveur");
    return data;
  }, [firebaseUser]);

  const charger = useCallback(async () => {
    setErreur(null);
    try {
      const d = (await appel("GET")) as { tauxFrais: number; groupes: Groupe[] };
      setDonnees(d);
      setTaux(String(d.tauxFrais));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Chargement impossible");
    }
  }, [appel]);

  useEffect(() => { void charger(); }, [charger]);

  const enregistrerTaux = async () => {
    const valeur = Number(taux.replace(",", "."));
    if (taux.trim() === "" || !Number.isFinite(valeur) || valeur < 0 || valeur > 20) {
      toast.error("Un taux entre 0 et 20, par exemple 4.");
      return;
    }
    try {
      await appel("PUT", { tauxFrais: valeur });
      toast.success("Taux enregistré");
      await charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    }
  };

  const marquer = async (g: Groupe) => {
    const numero = g.numero ?? g.lignes.find((l) => l.telephone)?.telephone ?? null;
    const ou = numero ? ` au ${numeroLisible(numero)}` : "";
    if (!window.confirm(`As-tu bien envoyé ${fcfa(g.total)} à ${g.nom}${ou} ? Ce geste ne s'annule pas.`)) return;
    setEnvoi(g.beneficiaire);
    try {
      const r = (await appel("POST", { ids: g.lignes.map((l) => l.id) })) as { regles: number; montant: number };
      toast.success(r.regles ? `${fcfa(r.montant)} marqués versés` : "Ces sommes étaient déjà versées");
      await charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Le marquage a échoué");
    } finally {
      setEnvoi(null);
    }
  };

  if (erreur) return <Erreur message={erreur} onReessayer={charger} />;
  if (!donnees) return <Chargement />;

  const total = donnees.groupes.reduce((somme, g) => somme + g.total, 0);
  const tauxInchange = taux.trim() === String(donnees.tauxFrais);

  return (
    <div className="space-y-6">
      <EnTete
        titre="Versements"
        sousTitre="Les frais de réservation des terrains : ce que KoppaFoot doit, à qui, et sur quel numéro."
      />

      <div className="grid grid-cols-3 gap-px border border-gray-200/70 bg-gray-200/70">
        <Chiffre valeur={fcfa(total)} libelle="À verser" ton={total > 0 ? "text-amber-700" : "text-gray-400"} />
        <Chiffre valeur={donnees.groupes.length} libelle="Bénéficiaires" />
        <Chiffre valeur={`${donnees.tauxFrais} %`} libelle="Frais de paiement" />
      </div>

      <section>
        <Titre>Frais de paiement ajoutés à l&apos;équipe</Titre>
        <Carte className="space-y-3 px-4 py-4">
          <p className="text-sm text-gray-600">
            Chaque encaissement coûte des frais à FedaPay. Ce taux s&apos;ajoute à ce que l&apos;équipe paie pour ses
            frais de réservation, et lui est montré avant. {donnees.tauxFrais === 0 && (
              <strong>À 0 %, c&apos;est KoppaFoot qui supporte les frais de FedaPay.</strong>
            )}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label>
              <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-gray-500">Taux, en %</span>
              <input
                inputMode="decimal"
                value={taux}
                onChange={(e) => setTaux(e.target.value)}
                className="w-32 border border-gray-200/70 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
              />
            </label>
            <button onClick={() => void enregistrerTaux()} disabled={tauxInchange} className={BOUTON_VERT}>Enregistrer</button>
          </div>
        </Carte>
      </section>

      <section>
        <Titre compte={donnees.groupes.length}>Sommes dues</Titre>
        {donnees.groupes.length === 0 ? (
          <Vide titre="Rien à verser" texte="Une somme apparaît ici quand une réservation payée est jouée, manquée ou annulée." />
        ) : (
          <div className="space-y-3">
            {donnees.groupes.map((g) => (
              <Carte key={g.beneficiaire}>
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-gray-900">{g.nom}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {g.numero
                        ? `Mobile money : ${numeroLisible(g.numero)}`
                        : g.lignes.some((l) => l.telephone)
                          ? "Pas de compte de versement : rendre au téléphone de la demande, ligne par ligne"
                          : "Aucun numéro connu : à lui demander"}
                    </p>
                  </div>
                  <span className="font-display text-lg font-black tabular-nums text-gray-900">{fcfa(g.total)}</span>
                  <button onClick={() => void marquer(g)} disabled={envoi !== null} className={BOUTON_CONTOUR}>
                    {envoi === g.beneficiaire && <Loader2 size={14} className="animate-spin" />}
                    Marquer versé
                  </button>
                </div>
                <div className="divide-y divide-gray-200/70 border-t border-gray-200/70">
                  {g.lignes.map((l) => (
                    <div key={l.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                      <span className="min-w-0 flex-1 text-gray-700">{l.libelle}</span>
                      {l.motif === "remboursement" && (
                        <Pastille ton="bleu">
                          À rendre à l&apos;équipe{l.telephone ? ` au ${numeroLisible(l.telephone)}` : ""}
                        </Pastille>
                      )}
                      <Liberation iso={l.disponible_le} />
                      <span className="font-black tabular-nums text-gray-900">{fcfa(l.montant)}</span>
                    </div>
                  ))}
                </div>
              </Carte>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: L'entrée de menu**

Dans `src/components/layout/AdminSidebar.tsx`, juste après la ligne `{ href: "/admin/offre", label: "Offre", Icone: Gem },`, ajouter :

```tsx
      { href: "/admin/versements", label: "Versements", Icone: HandCoins },
```

et ajouter `HandCoins` à l'import de `lucide-react` de ce fichier.

- [ ] **Step 3: Vérifier**

Run: `npx tsc --noEmit`
Expected: aucune erreur. (Si `HandCoins` n'existe pas dans la version de `lucide-react` du projet, prendre `Banknote`.)

Run: `npx eslint "src/app/(admin)/admin/versements/page.tsx" src/components/layout/AdminSidebar.tsx`
Expected: aucune erreur.

Sur le serveur de dev, ouvrir `http://localhost:3000/admin/versements` dans le volet navigateur et lire la console.
Expected: aucune erreur de rendu.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/admin/versements" src/components/layout/AdminSidebar.tsx
git commit -m "feat(admin): les sommes dues et leur versement à la main

Ce que KoppaFoot doit pour les frais de réservation, regroupé par
bénéficiaire, avec le numéro où verser et la date de libération des
fonds. Marquer versé ne se fait qu'une fois. Le taux des frais de
paiement ajoutés à l'équipe se règle ici.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Les textes

**Files:**
- Modify: `src/app/(marketing)/conditions/page.tsx`, `src/app/(marketing)/confidentialite/page.tsx`, `src/app/(marketing)/terrains/page.tsx`, `src/app/(app)/mes-terrains/page.tsx`, `src/config/auth-contextes.ts`, `src/app/api/bookings/route.ts`, `src/lib/terrains.ts`, `docs/video-terrains/README.md`

**Interfaces:** aucune.

Rappel du piège de ce dépôt : un texte JSX qui suit une balise fermante, passe à la ligne et contient `&apos;` perd son espace de tête. Écrire `</strong>{" "}:` dans ce cas, et vérifier dans le HTML servi.

- [ ] **Step 1: Repérer chaque « n'encaisse rien »**

Run: `grep -rn "n'encaisse rien\|n&apos;encaisse rien" src docs/video-terrains/README.md`
Expected: sept lignes à reprendre (les conditions en comptent deux, plus `/terrains`, « Mes terrains », `auth-contextes` et deux commentaires), le README de la vidéo, et **deux lignes à ne pas toucher** : `src/components/competition/RegisterTeamButton.tsx` et `src/app/(organizer)/organizer/competitions/[cid]/page.tsx` parlent des frais d'inscription en compétition, que KoppaFoot n'encaisse toujours pas. C'est le lot 3.

- [ ] **Step 2: Les conditions**

Dans `src/app/(marketing)/conditions/page.tsx` :

- `MIS_A_JOUR` passe à `"13 octobre 2026"` ;

- dans le commentaire d'en-tête, les deux lignes « gratuité de l'accueil, « La plateforme n'encaisse rien et ne prend aucune » / « commission » de la page des terrains. » deviennent « gratuité de l'accueil, « aucune commission » de la page des terrains. » (la phrase suivante, sur le texte juridique et la vitrine, reste) ;

- dans la section `roles`, remplacer l'élément « Gérant de terrain » par :

```tsx
        <li>
          <strong>Gérant de terrain</strong>{" "}: il donne des informations exactes sur son terrain et ses tarifs.
          S&apos;il active les frais de réservation, KoppaFoot encaisse pour son compte 5 % du prix du créneau, payés par
          l&apos;équipe une fois le créneau confirmé, et les lui reverse ; le reste se règle sur place, entre eux.
          KoppaFoot ne prend aucune commission. Ces frais restent au gérant si l&apos;équipe annule ou ne se présente
          pas ; ils sont rendus à l&apos;équipe si c&apos;est le gérant qui annule.
        </li>
```

- dans la section `service`, à la fin du paragraphe sur le paiement du Pro (celui qui se termine par « nous prolongeons ta période ou nous te remboursons. »), ajouter un paragraphe :

```tsx
        <p>
          Sur certains terrains, des frais de réservation se paient aussi dans l&apos;application : leur montant, et les
          frais de paiement qui s&apos;y ajoutent, sont affichés avant tout paiement. Ils font partie du prix du
          terrain : si le match a lieu, ils sont déduits de ce que tu règles sur place.
        </p>
```

- [ ] **Step 3: La confidentialité**

Dans `src/app/(marketing)/confidentialite/page.tsx` : `MIS_A_JOUR` passe à `"13 octobre 2026"`, et l'élément FedaPay de la section `partage` devient :

```tsx
          <li>
            <strong>FedaPay</strong>{" "}: le paiement de KoppaFoot Pro et des frais de réservation d&apos;un terrain,
            seulement si tu paies. Nous lui transmettons ton prénom, ton nom et ton e-mail, pour ton reçu ; le numéro de
            ton portefeuille mobile ou de ta carte, tu le tapes sur sa page, et nous ne le voyons ni ne le gardons. Nous
            conservons la trace du paiement : son montant, sa date, son état. Si tu es gérant de terrain et que tu
            actives les frais de réservation, nous gardons le numéro mobile money où te les verser.
          </li>
```

- [ ] **Step 4: Les cinq autres endroits**

1. `src/app/(marketing)/terrains/page.tsx`, la phrase « La plateforme n'encaisse rien et ne prend aucune commission. Tu annonces ton tarif, le règlement reste ton affaire. » devient :

```
"KoppaFoot ne prend aucune commission. Tu annonces ton tarif ; si tu le veux, l'équipe paie 5 % de frais de réservation dans l'application pour bloquer son créneau, ils te sont reversés, et le reste se règle chez toi. Ton prix reste ton prix.",
```

2. `src/app/(app)/mes-terrains/page.tsx`, l'aide du champ tarif (« Laissé vide, la fiche affiche « prix à convenir ». La plateforme n'encaisse rien : le règlement se fait… ») devient :

```
aide="Laissé vide, la fiche affiche « prix à convenir ». Il sert aussi de base aux frais de réservation, si tu les actives : 5 % du prix du créneau."
```

3. `src/config/auth-contextes.ts` : dans la chaîne « Référence ton terrain, reçois les demandes de créneau des équipes, et réponds-y. La plateforme n'encaisse rien : le règlement reste entre vous. », remplacer la seconde phrase par `KoppaFoot ne prend aucune commission.`

4. `src/app/api/bookings/route.ts`, commentaire d'en-tête : la phrase « c'est avec lui que le propriétaire réglera le reste, le paiement compris, puisque la plateforme n'encaisse rien. » (à cheval sur deux lignes) devient « c'est avec lui que le propriétaire réglera le reste. Seuls les frais de réservation, quand il les a activés, passent par la plateforme (lib/reglement). » Recouper les lignes du commentaire à la largeur des voisines.

5. `src/lib/terrains.ts`, commentaire au-dessus de `prixHeure` : « Zéro n'est pas « 0 FCFA » mais « Prix à convenir » : la plateforme n'encaisse rien, un terrain sans tarif saisi n'est pas gratuit, il n'a simplement pas annoncé son prix. » devient « Zéro n'est pas « 0 FCFA » mais « Prix à convenir » : un terrain sans tarif saisi n'est pas gratuit, il n'a simplement pas annoncé son prix. »

- [ ] **Step 5: Le README de la vidéo**

Dans `docs/video-terrains/README.md`, remplacer toute la section « ## Elle annonce une fonctionnalité à venir » (jusqu'à la ligne qui précède « ## Ajouter une musique ») par :

```markdown
## Ce que l'application fait, et ce que la vidéo simplifie

La vidéo a été publiée avant la fonctionnalité. L'application fait ce qu'elle promet, à deux raccourcis près.

**Ce qui est vrai tel quel :**

- l'équipe paie des **frais de réservation** par **paiement mobile** ;
- si l'équipe ne vient pas, ils **reviennent au propriétaire** : « fini les lapins » ;
- KoppaFoot prend **0 % de commission**, et « ton prix reste ton prix » ;
- un terrain se référence gratuitement (`LIMITES_GRATUIT.terrains`, dans `lib/offre`).

**« Remboursés si le match a lieu » :** dans l'application, les frais font partie du prix. Si le match a lieu, ils sont déduits de ce que l'équipe règle sur place : pour elle, c'est le même argent. L'application reprend la formule de la vidéo et la précise : « Remboursés si le match a lieu : ils sont déduits de ce que tu règles sur place. »

**Les deux raccourcis :**

- la vidéo montre l'équipe **payer, puis le propriétaire confirmer**. Dans l'application c'est l'inverse : le propriétaire confirme, puis l'équipe paie. Un refus ne déplace ainsi aucun argent ;
- la vidéo prend **2 000 FCFA** en exemple (`FRAIS`, en haut du script de `source/animation.html`). Dans l'application, les frais valent **5 % du prix du créneau**.

Le reste du prix se règle en liquide chez le propriétaire, et un **ticket** (un code et un QR code) prouve sur place que les frais ont été payés. Le détail est dans `docs/plans/2026-10-13-paiement-terrains-design.md`.
```

- [ ] **Step 6: Vérifier**

Run: `grep -rn "n'encaisse rien\|n&apos;encaisse rien" src docs/video-terrains/README.md`
Expected: deux lignes, celles des compétitions (`RegisterTeamButton.tsx` et la page de l'organisateur).

Run: `npx tsc --noEmit`
Expected: aucune erreur.

Sur le serveur de dev :

Run: `curl -s http://localhost:3000/conditions | grep -o "Gérant de terrain</strong>.\{0,40\}"`
Expected: `Gérant de terrain</strong> <!-- -->: il donne…` — l'espace avant les deux-points est là.

Run: `curl -s http://localhost:3000/confidentialite | grep -o "FedaPay</strong>.\{0,40\}"`
Expected: `FedaPay</strong> <!-- -->: le paiement de KoppaFoot Pro et des frais…`

- [ ] **Step 7: Commit**

```bash
git add "src/app/(marketing)/conditions/page.tsx" "src/app/(marketing)/confidentialite/page.tsx" "src/app/(marketing)/terrains/page.tsx" "src/app/(app)/mes-terrains/page.tsx" src/config/auth-contextes.ts src/app/api/bookings/route.ts src/lib/terrains.ts docs/video-terrains/README.md
git commit -m "docs(terrains): la plateforme encaisse désormais les frais de réservation

« La plateforme n'encaisse rien » était écrit à six endroits : elle
encaisse 5 % pour le compte du gérant, sans commission. Les conditions
disent à qui reviennent les frais ; le README de la vidéo dit ce que
l'application fait et les deux raccourcis de la vidéo.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Vérification d'ensemble et bac à sable

**Files:**
- Modify: `docs/plans/2026-10-13-paiement-terrains-design.md` (ce qui a été constaté)

**Interfaces:** aucune.

Le parcours connecté a besoin du fondateur : un compte superadmin, propriétaire d'un terrain de test avec un tarif, et un second compte superadmin pour jouer l'équipe (en bac à sable, seul un superadmin peut payer). Sans eux, faire les étapes 1 et 2 et dire ce qui reste.

- [ ] **Step 1: Toutes les suites**

Run: `(cd mobile && npx jest)`
Expected: toutes les suites vertes.

Run: `npx tsc --noEmit`
Expected: aucune erreur.

Run: `(cd mobile && npx tsc --noEmit)`
Expected: les 3 erreurs préexistantes, pas une de plus.

- [ ] **Step 2: La construction**

Arrêter le serveur de dev (`preview_stop`).

Run: `npm run build`
Expected: construction réussie ; `/api/venues/[id]/paiement`, `/api/reservations/[id]/reglement`, `/api/reservations/ticket`, `/api/admin/versements`, `/ticket/[code]` et `/admin/versements` figurent dans la liste. Une seule fois.

- [ ] **Step 3: Bac à sable, le circuit entier**

Relancer le serveur de dev. Dans `/admin/versements`, régler le taux à `4`.

**L'ordre compte** : les frais ne valent que pour une demande faite APRÈS leur activation sur le terrain. Activer d'abord (étape 1), demander ensuite (étape 2). Une demande déjà en attente avant l'activation se confirme sans frais : c'est voulu, et c'est aussi à constater une fois.

1. **Gérant** : dans `/mes-terrains`, sur un terrain avec un tarif, cocher « Faire payer les frais de réservation », donner un numéro (`90 12 34 56`), battement 15 minutes, enregistrer.
2. **Équipe** : demander un créneau sur ce terrain depuis sa fiche. Le récapitulatif annonce les frais de réservation et la formule « Remboursés si le match a lieu ».
3. **Gérant** : confirmer la demande dans « Réservations reçues ». L'équipe reçoit « Créneau confirmé : frais de réservation à payer ».
4. **Équipe** : dans « Mes réservations », le bloc ambre dit le montant, l'échéance, le total avec les frais de paiement. Cliquer « Payer » : la page FedaPay s'ouvre (elle refuse les numéros de test, c'est connu). Relever l'identifiant du paiement dans la réponse de `POST /api/paiements` (`read_network_requests`).
5. Run: `npx tsx scripts/payer-fedapay-test.ts <idPaiement>` puis ouvrir `/mes-reservations?paiement=<idPaiement>`.
   Expected: « Frais de réservation payés : ton ticket est prêt », et le ticket (code et QR) sur la réservation.
6. **Gérant** : la réservation porte « Frais payés ». Taper le code dans « Valider un ticket » : hors de la fenêtre (plus d'une heure avant le créneau), le serveur répond « Ce ticket se valide à partir de … ». Pour valider, la réservation doit être dans sa fenêtre : la prendre sur un créneau qui commence dans l'heure.
7. Après validation : « Joué · frais dus » côté gérant, et dans `/admin/versements` une ligne au nom du gérant, avec son numéro et la date de libération des fonds. « Marquer versé » la fait disparaître ; un second clic répond « déjà versées ».

- [ ] **Step 4: Bac à sable, les sorties de route**

1. Confirmer une autre demande, **ne pas payer**, et constater par le script de lecture (`scratchpad`) ou en base que le règlement porte une échéance. Pour ne pas attendre 24 h : jouer `suivreReservation` avec un `maintenant` futur depuis un script `tsx` jetable, et constater la réservation « annulée par le système », `reglement_vu: "libere"`, aucune ligne due.
2. Payer une réservation, puis **l'annuler côté gérant** : `/admin/versements` montre une ligne « À rendre à l'équipe ».
3. Avec un compte non superadmin : « Payer » répond « Le paiement n'est pas encore ouvert. »

- [ ] **Step 5: Consigner et committer**

Dans `docs/plans/2026-10-13-paiement-terrains-design.md`, passer le **Statut** à « Temps 1 implémenté, validé en bac à sable le <date>. Reste : le temps 2 (dépôts automatiques), quand FedaPay les aura activés. » et ajouter sous « Ce que le compte FedaPay permet » ce que le bac à sable a montré de nouveau.

```bash
git add docs/plans/2026-10-13-paiement-terrains-design.md
git commit -m "docs(paiement): le temps 1 des frais de réservation, validé en bac à sable

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Ce que ce plan ne fait pas

- **Le temps 2** : les dépôts automatiques FedaPay (créer, envoyer, suivre, échecs). Son plan s'écrira quand leur support les aura activés, sur ce qu'un vrai dépôt de test montrera.
- La vidéo des terrains elle-même.
- La fusion : ce lot s'appuie sur `feat/paiement-fedapay`, à fusionner d'abord.
- Les frais d'inscription en compétition (lot 3).
