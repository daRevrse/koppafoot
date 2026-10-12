# Paiement mobile, lot 1 : socle FedaPay et vente de KoppaFoot Pro — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vendre KoppaFoot Pro (1 mois ou 1 an) par la page de paiement FedaPay, le paiement confirmé écrivant `droits/{uid}` avec `source: "paiement"`.

**Architecture:** Un module pur (`lib/paiement`) porte les formules, le calcul d'échéance et la décision de règlement ; un client `fetch` (`lib/fedapay`) parle à FedaPay ; `lib/paiement-serveur` tient les écritures Firestore, dont `reglerPaiement`, seule fonction qui accorde le Pro. Trois routes l'appellent (démarrer, vérifier au retour, webhook signé), plus la tâche de 6 h et l'administration.

**Tech Stack:** Next.js 16.2.3 (App Router, route handlers), firebase-admin 13, React 19, Tailwind 4, jest (jest-expo, dans `mobile/`) pour les modules purs. Aucune dépendance ajoutée.

**Spec:** `docs/plans/2026-10-12-paiement-fedapay-pro-design.md`

## Global Constraints

- **Branche** `feat/paiement-fedapay`. Un commit par tâche, message en français, terminé par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Avant d'écrire une route** : lire `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` (AGENTS.md : cette version de Next diffère de celle qu'on connaît). Dans ce dépôt, `params` d'une route dynamique est une **promesse** : `{ params }: { params: Promise<{ id: string }> }`.
- **Aucune dépendance npm ajoutée.** Pas le SDK `fedapay`.
- **Le montant vient toujours de `settings/offre.prix`, lu par le serveur.** Le navigateur n'envoie que le nom de la formule.
- **Une seule fonction écrit `droits/{uid}` pour un paiement : `reglerPaiement`.**
- **Prix valide** : entier ≥ 100. **Devise** : `XOF`. **Tolérance de signature** : 300 s.
- **Variables** : `FEDAPAY_SECRET_KEY`, `FEDAPAY_WEBHOOK_SECRET`, `FEDAPAY_ENV` (`live` = réel ; tout le reste = bac à sable). Jamais de `NEXT_PUBLIC_`. **Ne jamais écrire de secret dans le dépôt ni l'afficher.**
- **Bac à sable** : seuls les superadmins (`estSuperadmin` de `lib/admin-api-auth`) voient les formules et peuvent acheter.
- **Tests** : les modules purs de `src/lib` se testent dans `mobile/src/__tests__/` (alias `@/` → `../src`). Lancer : `(cd mobile && npx jest src/__tests__/<fichier>)`. Un fichier de test ne doit importer aucun module qui importe `node:*` ou `firebase-admin` (la vérification de types de `mobile/` n'a pas les types Node) ; pour un module Node dans un test, faire comme `notifications.test.ts` : `require("fs") as { … }`.
- **Types** : `npx tsc --noEmit` à la racine doit passer. `(cd mobile && npx tsc --noEmit)` a **3 erreurs préexistantes** (`expo-notifications` ×2, `push.ts`) : n'en ajouter aucune.
- **Serveur de dev** : par `preview_start` (`koppafoot-dev` dans `.claude/launch.json`), jamais par Bash. **Ne jamais lancer `npm run build` pendant qu'il tourne**, et un seul `npm run build` en fin de plan (il consomme le quota API-Football).
- **Commentaires** : en français, dans le ton du dépôt (un en-tête qui dit le pourquoi, majuscules pour l'idée, pas de paraphrase du code).
- **Style d'interface** : celui des pages touchées (bords droits, `border-gray-200/70`, capitales grasses espacées, accent émeraude). Textes en français **et** en anglais sur « Mon offre » (`textes()`), français seul dans l'administration.

## Review Focus

1. **FedaPay ajoute `?id=…&status=…` à une adresse de retour qui porte déjà `?paiement=…`** → le paramètre peut arriver pollué (`XYZ?id=258`). L'identifiant doit quand même être retrouvé, et jamais un identifiant trop long accepté. → test `idPaiementDuRetour`, tâche 1.
2. **Le même paiement réglé deux fois** (webhook rejoué, webhook et retour en même temps) → une seule prolongation. → test `deciderReglement` (ligne déjà `paye`), tâche 1 ; relecture dans la transaction, tâche 3.
3. **Un compte connecté par SMS, sans e-mail ou sans nom** → la collecte doit se créer quand même, sans objet `customer` incomplet. → test `corpsCollecte`, tâche 2.
4. **Un Pro sans échéance accordé par l'admin entre le clic et le paiement** → le paiement ne doit pas l'écraser par un Pro d'un mois. → test `nouvelleEcheance` (rend `null`), tâche 1 ; branche dédiée dans la transaction, tâche 3.
5. **La tâche de 6 h de la production balaie des lignes créées en bac à sable** (même Firestore) → elle doit les ignorer, pas les signaler ni les fermer. → test `trierLignesOuvertes`, tâche 1.

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `src/lib/paiement.ts` (créé) | Pur : formules, prix, échéance, états, décision de règlement, identifiant du retour. |
| `src/lib/fedapay.ts` (créé) | Client `fetch` FedaPay + aides pures (enveloppe, normalisation, signature, cible d'un événement). Aucun import `node:*`. |
| `src/lib/paiement-serveur.ts` (créé) | Firestore : `demarrerPaiement`, `reglerPaiement`, balayage, rappels. |
| `src/app/api/paiements/route.ts` (créé) | `POST` démarrer. |
| `src/app/api/paiements/[id]/route.ts` (créé) | `GET` vérifier au retour. |
| `src/app/api/webhooks/fedapay/route.ts` (créé) | `POST` webhook signé. |
| `src/app/api/admin/paiements/route.ts` (créé) | `GET` liste, `POST` revérifier. |
| `scripts/webhook-fedapay.ts` (créé) | Outil de dev : envoie un événement signé à une adresse locale. |
| `mobile/src/__tests__/paiement.test.ts`, `fedapay.test.ts` (créés) | Tests. |
| `src/lib/offre.ts`, `src/types/index.ts`, `src/lib/push-categories.ts`, `src/lib/email.ts`, `src/app/(app)/notifications/page.tsx` | Type du réglage, notification `offre`, reçu. |
| `src/app/api/offre/route.ts`, `src/app/(app)/offre/page.tsx` | Formules en vente, achat, retour. |
| `src/app/api/admin/offre/route.ts`, `src/app/(admin)/admin/offre/page.tsx` | Prix, liste des paiements. |
| `src/app/api/cron/scoreur-manquant/route.ts` | Balayage et rappels. |
| `firestore.rules`, `.env.example`, conditions, confidentialité | Règle, variables, textes. |

---

### Task 1: Le module pur `lib/paiement`

**Files:**
- Create: `src/lib/paiement.ts`
- Modify: `src/lib/offre.ts` (interface `FirestoreReglageOffre`, en-tête)
- Test: `mobile/src/__tests__/paiement.test.ts`

**Interfaces:**
- Consumes: `droitActif`, `DroitAccorde`, `DroitOffre` de `@/lib/offre`.
- Produces (tout exporté de `@/lib/paiement`) :
  - `FORMULES`, `type IdFormule = "pro_mois" | "pro_an"`, `ID_FORMULES: IdFormule[]`, `estFormule(x: unknown): x is IdFormule`
  - `PRIX_PLANCHER = 100`, `type PrixOffre = Record<IdFormule, number | null>`, `prixValide(x: unknown): x is number`, `lirePrix(brut: unknown): PrixOffre`
  - `interface FormuleEnVente { id: IdFormule; mois: number; prix: number }`, `formulesEnVente(prix: PrixOffre): FormuleEnVente[]`
  - `ajouterMois(jour: string, mois: number): string`, `ajouterJours(jour: string, jours: number): string`
  - `nouvelleEcheance(actuel: DroitAccorde | null | undefined, jour: string, mois: number): { depuis: string; jusqu_au: string } | null`
  - `type StatutPaiement = "en_attente" | "paye" | "echoue" | "annule" | "expire"`, `STATUTS_OUVERTS: StatutPaiement[]`, `etatDepuisFedapay(statut: string | null | undefined): StatutPaiement`
  - `type EnvironnementPaiement = "sandbox" | "live"`, `type AnomaliePaiement = "montant" | "reference"`
  - `interface FirestorePaiement`, `interface Collecte { id: number; statut: string; montant: number; reference: string | null; mode: string | null; frais: number | null; recuUrl: string | null }`
  - `type Reglement`, `deciderReglement(ligne: Pick<FirestorePaiement, "statut" | "montant">, idLigne: string, collecte: Pick<Collecte, "statut" | "montant" | "reference">): Reglement`
  - `ID_PAIEMENT: RegExp`, `idPaiementDuRetour(valeur: string | null | undefined): string | null`
  - `joursDeRappel(jour: string): { demain: string; dansSeptJours: string }`
  - `HEURES_DE_SUIVI = 48`, `trierLignesOuvertes<T extends { environnement: EnvironnementPaiement; creeMs: number }>(lignes: T[], environnement: EnvironnementPaiement, maintenantMs: number): { recentes: T[]; perimees: T[] }`
  - `motifAchat(mois: number, environnement: EnvironnementPaiement): string`

- [ ] **Step 1: Écrire les tests**

Créer `mobile/src/__tests__/paiement.test.ts` :

```ts
import type { DroitAccorde } from "@/lib/offre";
import {
  ajouterJours, ajouterMois, deciderReglement, estFormule, etatDepuisFedapay, formulesEnVente, idPaiementDuRetour,
  joursDeRappel, lirePrix, motifAchat, nouvelleEcheance, prixValide, trierLignesOuvertes,
} from "@/lib/paiement";

// Le module vit côté site (src/lib/paiement) ; il est pur, et c'est ici que
// la suite de tests des modules partagés tourne.

const droit = (p: Partial<DroitAccorde> = {}): DroitAccorde => ({
  depuis: "2026-09-01", jusqu_au: null, source: "admin", accorde_par: "admin1", motif: null, ...p,
});

describe("estFormule", () => {
  it("reconnaît les deux formules", () => {
    expect(estFormule("pro_mois")).toBe(true);
    expect(estFormule("pro_an")).toBe(true);
  });

  it("refuse le reste, y compris les propriétés héritées d'un objet", () => {
    expect(estFormule("sans_pub")).toBe(false);
    expect(estFormule("toString")).toBe(false);
    expect(estFormule(null)).toBe(false);
    expect(estFormule(12)).toBe(false);
  });
});

describe("prixValide et lirePrix", () => {
  it("accepte un entier d'au moins 100", () => {
    expect(prixValide(100)).toBe(true);
    expect(prixValide(2500)).toBe(true);
  });

  it("refuse sous le plancher, non entier, ou pas un nombre", () => {
    expect(prixValide(99)).toBe(false);
    expect(prixValide(1500.5)).toBe(false);
    expect(prixValide("1500")).toBe(false);
    expect(prixValide(NaN)).toBe(false);
    expect(prixValide(null)).toBe(false);
  });

  it("assainit ce qui est rangé : tout ce qui n'est pas un prix vaut null", () => {
    expect(lirePrix({ pro_mois: 1500, pro_an: "15000" })).toEqual({ pro_mois: 1500, pro_an: null });
    expect(lirePrix(undefined)).toEqual({ pro_mois: null, pro_an: null });
    expect(lirePrix("n'importe quoi")).toEqual({ pro_mois: null, pro_an: null });
  });
});

describe("formulesEnVente", () => {
  it("ne garde que les formules qui ont un prix", () => {
    expect(formulesEnVente({ pro_mois: 1500, pro_an: null })).toEqual([{ id: "pro_mois", mois: 1, prix: 1500 }]);
  });

  it("rend le mois avant l'année", () => {
    expect(formulesEnVente({ pro_mois: 1500, pro_an: 15000 }).map((f) => f.id)).toEqual(["pro_mois", "pro_an"]);
  });

  it("ne vend rien tant que les prix sont vides", () => {
    expect(formulesEnVente({ pro_mois: null, pro_an: null })).toEqual([]);
  });
});

describe("ajouterMois", () => {
  it("garde le quantième", () => {
    expect(ajouterMois("2026-10-12", 1)).toBe("2026-11-12");
    expect(ajouterMois("2026-10-12", 12)).toBe("2027-10-12");
  });

  it("passe l'année", () => {
    expect(ajouterMois("2026-12-15", 1)).toBe("2027-01-15");
  });

  it("s'arrête au dernier jour quand le quantième n'existe pas", () => {
    expect(ajouterMois("2026-01-31", 1)).toBe("2026-02-28");
    expect(ajouterMois("2028-01-31", 1)).toBe("2028-02-29");
    expect(ajouterMois("2028-02-29", 12)).toBe("2029-02-28");
  });
});

describe("ajouterJours", () => {
  it("avance en passant le mois", () => {
    expect(ajouterJours("2026-10-31", 1)).toBe("2026-11-01");
    expect(ajouterJours("2026-10-12", 7)).toBe("2026-10-19");
  });
});

describe("nouvelleEcheance", () => {
  const jour = "2026-10-12";

  it("premier achat : du jour au même quantième, inclus", () => {
    expect(nouvelleEcheance(null, jour, 1)).toEqual({ depuis: jour, jusqu_au: "2026-11-12" });
    expect(nouvelleEcheance(undefined, jour, 12)).toEqual({ depuis: jour, jusqu_au: "2027-10-12" });
  });

  it("prolongation : la période s'ajoute à la fin en cours, depuis ne bouge pas", () => {
    const actuel = droit({ depuis: "2026-09-20", jusqu_au: "2026-10-20", source: "paiement" });
    expect(nouvelleEcheance(actuel, jour, 1)).toEqual({ depuis: "2026-09-20", jusqu_au: "2026-11-20" });
  });

  it("le dernier jour d'un Pro compte encore comme en cours", () => {
    const actuel = droit({ depuis: "2026-09-12", jusqu_au: jour });
    expect(nouvelleEcheance(actuel, jour, 1)).toEqual({ depuis: "2026-09-12", jusqu_au: "2026-11-12" });
  });

  it("un Pro expiré repart du jour de l'achat", () => {
    const actuel = droit({ depuis: "2026-08-01", jusqu_au: "2026-09-01" });
    expect(nouvelleEcheance(actuel, jour, 1)).toEqual({ depuis: jour, jusqu_au: "2026-11-12" });
  });

  it("un Pro accordé par l'admin avec une échéance se prolonge pareil", () => {
    const actuel = droit({ depuis: "2026-10-01", jusqu_au: "2026-12-31", source: "admin" });
    expect(nouvelleEcheance(actuel, jour, 12)).toEqual({ depuis: "2026-10-01", jusqu_au: "2027-12-31" });
  });

  it("un Pro en cours sans échéance : rien à prolonger", () => {
    expect(nouvelleEcheance(droit({ jusqu_au: null }), jour, 1)).toBeNull();
  });
});

describe("etatDepuisFedapay", () => {
  it("paie sur approved et transferred, et sur rien d'autre", () => {
    expect(etatDepuisFedapay("approved")).toBe("paye");
    expect(etatDepuisFedapay("transferred")).toBe("paye");
  });

  it("traduit les états qui n'aboutissent pas", () => {
    expect(etatDepuisFedapay("pending")).toBe("en_attente");
    expect(etatDepuisFedapay("declined")).toBe("echoue");
    expect(etatDepuisFedapay("canceled")).toBe("annule");
    expect(etatDepuisFedapay("expired")).toBe("expire");
  });

  it("un remboursement n'ouvre aucun droit", () => {
    expect(etatDepuisFedapay("refunded")).toBe("annule");
    expect(etatDepuisFedapay("approved_partially_refunded")).toBe("annule");
    expect(etatDepuisFedapay("transferred_partially_refunded")).toBe("annule");
  });

  it("un état inconnu ou absent attend, il n'accorde jamais", () => {
    expect(etatDepuisFedapay("quelque_chose_de_nouveau")).toBe("en_attente");
    expect(etatDepuisFedapay(null)).toBe("en_attente");
    expect(etatDepuisFedapay(undefined)).toBe("en_attente");
  });
});

describe("deciderReglement", () => {
  const id = "AbCdEfGhIjKlMnOpQrSt";
  const ligne = { statut: "en_attente" as const, montant: 1500 };
  const collecte = { statut: "approved", montant: 1500, reference: id };

  it("accorde quand la collecte est la nôtre, au bon montant, approuvée", () => {
    expect(deciderReglement(ligne, id, collecte)).toEqual({ anomalie: null, statut: "paye", accorder: true });
  });

  it("n'accorde pas deux fois : une ligne déjà payée le reste, sans octroi", () => {
    expect(deciderReglement({ ...ligne, statut: "paye" }, id, collecte))
      .toEqual({ anomalie: null, statut: "paye", accorder: false });
  });

  it("signale un montant qui n'est pas celui demandé", () => {
    expect(deciderReglement(ligne, id, { ...collecte, montant: 100 })).toEqual({ anomalie: "montant" });
  });

  it("signale une collecte qui n'est pas celle de la ligne", () => {
    expect(deciderReglement(ligne, id, { ...collecte, reference: "ZZZZZZZZZZZZZZZZZZZZ" })).toEqual({ anomalie: "reference" });
    expect(deciderReglement(ligne, id, { ...collecte, reference: null })).toEqual({ anomalie: "reference" });
  });

  it("suit un refus sans accorder", () => {
    expect(deciderReglement(ligne, id, { ...collecte, statut: "declined" }))
      .toEqual({ anomalie: null, statut: "echoue", accorder: false });
  });

  it("une approbation tardive s'applique après un refus ou une expiration de notre côté", () => {
    expect(deciderReglement({ ...ligne, statut: "echoue" }, id, collecte))
      .toEqual({ anomalie: null, statut: "paye", accorder: true });
    expect(deciderReglement({ ...ligne, statut: "expire" }, id, collecte))
      .toEqual({ anomalie: null, statut: "paye", accorder: true });
  });
});

describe("idPaiementDuRetour", () => {
  const id = "AbCdEfGhIjKlMnOpQrSt";

  it("lit l'identifiant seul", () => {
    expect(idPaiementDuRetour(id)).toBe(id);
  });

  it("le retrouve quand FedaPay a collé ses propres paramètres derrière", () => {
    expect(idPaiementDuRetour(`${id}?id=258&status=approved`)).toBe(id);
    expect(idPaiementDuRetour(`${id}&id=258`)).toBe(id);
  });

  it("refuse ce qui n'est pas un identifiant", () => {
    expect(idPaiementDuRetour(`${id}X`)).toBeNull();
    expect(idPaiementDuRetour("court")).toBeNull();
    expect(idPaiementDuRetour("../../admin/offre?x=1234567")).toBeNull();
    expect(idPaiementDuRetour("")).toBeNull();
    expect(idPaiementDuRetour(null)).toBeNull();
  });
});

describe("joursDeRappel", () => {
  it("demain et dans sept jours", () => {
    expect(joursDeRappel("2026-10-30")).toEqual({ demain: "2026-10-31", dansSeptJours: "2026-11-06" });
  });
});

describe("trierLignesOuvertes", () => {
  const maintenant = Date.parse("2026-10-12T06:00:00Z");
  const heures = (h: number) => maintenant - h * 3_600_000;

  it("sépare les lignes de moins de 48 h des plus vieilles", () => {
    const lignes = [
      { id: "a", environnement: "live" as const, creeMs: heures(1) },
      { id: "b", environnement: "live" as const, creeMs: heures(47) },
      { id: "c", environnement: "live" as const, creeMs: heures(49) },
    ];
    const { recentes, perimees } = trierLignesOuvertes(lignes, "live", maintenant);
    expect(recentes.map((l) => l.id)).toEqual(["a", "b"]);
    expect(perimees.map((l) => l.id)).toEqual(["c"]);
  });

  it("ignore les lignes d'un autre environnement : la production ne touche pas au bac à sable", () => {
    const lignes = [
      { id: "essai", environnement: "sandbox" as const, creeMs: heures(1) },
      { id: "vieux", environnement: "sandbox" as const, creeMs: heures(100) },
    ];
    expect(trierLignesOuvertes(lignes, "live", maintenant)).toEqual({ recentes: [], perimees: [] });
  });
});

describe("motifAchat", () => {
  it("dit la durée, et le bac à sable quand c'en est un", () => {
    expect(motifAchat(1, "live")).toBe("Achat Pro 1 mois");
    expect(motifAchat(12, "sandbox")).toBe("Achat Pro 12 mois (bac à sable)");
  });
});
```

- [ ] **Step 2: Lancer les tests, constater l'échec**

Run: `(cd mobile && npx jest src/__tests__/paiement.test.ts)`
Expected: FAIL, `Cannot find module '@/lib/paiement'`.

- [ ] **Step 3: Écrire le module**

Créer `src/lib/paiement.ts` :

```ts
import { droitActif, type DroitAccorde, type DroitOffre } from "@/lib/offre";

// ============================================
// Le paiement : ce qui s'achète, pour combien de temps, et ce qu'un paiement
// FedaPay change.
//
// UNE PÉRIODE, PAS UN ABONNEMENT. Le mobile money ne prélève pas tout seul :
// on paie, le Pro court jusqu'à une date, et rien ne se renouvelle. Racheter
// avant la fin ajoute la période à la fin en cours.
//
// LES PRIX SONT UN RÉGLAGE (`settings/offre.prix`), saisi dans
// l'administration. Une formule sans prix n'est pas en vente : c'est ainsi
// qu'on ouvre la vente, et qu'on la referme.
//
// LE NAVIGATEUR NE DIT JAMAIS COMBIEN. Il envoie le nom d'une formule ; le
// serveur lit le prix, crée la collecte, et n'accorde le droit qu'après avoir
// relu chez FedaPay que le montant demandé a bien été payé (deciderReglement).
//
// Module pur : aucun SDK. Le serveur (lib/paiement-serveur, les routes
// /api/paiements) et le navigateur (« Mon offre », l'administration) le
// partagent ; ses tests tournent dans mobile/src/__tests__/paiement.test.ts.
// ============================================

/** Ce qui s'achète : le droit accordé, et pour combien de mois. */
export const FORMULES = {
  pro_mois: { droit: "pro", mois: 1 },
  pro_an: { droit: "pro", mois: 12 },
} as const satisfies Record<string, { droit: DroitOffre; mois: number }>;

export type IdFormule = keyof typeof FORMULES;

/** Dans l'ordre où on les montre : le mois avant l'année. */
export const ID_FORMULES = Object.keys(FORMULES) as IdFormule[];

export function estFormule(x: unknown): x is IdFormule {
  return typeof x === "string" && Object.prototype.hasOwnProperty.call(FORMULES, x);
}

/** Le plancher de FedaPay : pas de collecte sous 100 XOF. */
export const PRIX_PLANCHER = 100;

/** `settings/offre.prix` : `null`, la formule n'est pas en vente. */
export type PrixOffre = Record<IdFormule, number | null>;

export function prixValide(x: unknown): x is number {
  return typeof x === "number" && Number.isInteger(x) && x >= PRIX_PLANCHER;
}

/** Les prix tels que rangés, assainis : tout ce qui n'est pas un prix vaut `null`. */
export function lirePrix(brut: unknown): PrixOffre {
  const p = (brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>;
  return {
    pro_mois: prixValide(p.pro_mois) ? p.pro_mois : null,
    pro_an: prixValide(p.pro_an) ? p.pro_an : null,
  };
}

export interface FormuleEnVente {
  id: IdFormule;
  mois: number;
  prix: number;
}

export function formulesEnVente(prix: PrixOffre): FormuleEnVente[] {
  return ID_FORMULES.flatMap((id) => {
    const p = prix[id];
    return prixValide(p) ? [{ id, mois: FORMULES[id].mois, prix: p }] : [];
  });
}

/**
 * `jour` plus `mois` mois, au même quantième ; au dernier jour du mois quand
 * le quantième n'y existe pas (le 31 janvier donne le 28 ou le 29 février).
 */
export function ajouterMois(jour: string, mois: number): string {
  const [annee, moisDuJour, quantieme] = jour.split("-").map(Number);
  const cible = new Date(Date.UTC(annee, moisDuJour - 1 + mois, 1));
  const dernier = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
  cible.setUTCDate(Math.min(quantieme, dernier));
  return cible.toISOString().slice(0, 10);
}

export function ajouterJours(jour: string, jours: number): string {
  return new Date(Date.parse(`${jour}T00:00:00Z`) + jours * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Le Pro après un achat de `mois` mois fait ce `jour`.
 *
 * Acheté le 12 octobre pour un mois : jusqu'au 12 novembre inclus. Racheté
 * pendant que le Pro court : la période s'ajoute à la fin en cours, d'où
 * qu'il vienne (un Pro d'essai accordé par l'administration se prolonge
 * pareil). Un Pro expiré repart du jour de l'achat.
 *
 * `null` : le Pro court sans échéance, il n'y a rien à prolonger — et surtout
 * rien à écraser par un Pro d'un mois.
 */
export function nouvelleEcheance(
  actuel: DroitAccorde | null | undefined,
  jour: string,
  mois: number,
): { depuis: string; jusqu_au: string } | null {
  if (!actuel || !droitActif(actuel, jour)) return { depuis: jour, jusqu_au: ajouterMois(jour, mois) };
  if (actuel.jusqu_au === null) return null;
  return { depuis: actuel.depuis, jusqu_au: ajouterMois(actuel.jusqu_au, mois) };
}

/** Où en est une ligne de `paiements`. Seul `paye` est définitif chez nous. */
export type StatutPaiement = "en_attente" | "paye" | "echoue" | "annule" | "expire";

/** Les états qu'une relecture chez FedaPay peut encore faire bouger. */
export const STATUTS_OUVERTS: StatutPaiement[] = ["en_attente", "echoue", "annule"];

/**
 * L'état d'une collecte FedaPay, dans nos mots.
 *
 * `declined` et `canceled` ne sont pas finaux chez FedaPay : le client peut
 * réessayer sur la même page, d'où des états qu'on continue de relire. Un
 * état qu'on ne connaît pas attend : on n'accorde jamais sur un mot nouveau.
 */
export function etatDepuisFedapay(statut: string | null | undefined): StatutPaiement {
  switch (statut) {
    case "approved":
    case "transferred":
      return "paye";
    case "declined":
      return "echoue";
    case "canceled":
    case "refunded":
    case "approved_partially_refunded":
    case "transferred_partially_refunded":
      return "annule";
    case "expired":
      return "expire";
    default:
      return "en_attente";
  }
}

export type EnvironnementPaiement = "sandbox" | "live";

/** Ce qui ne colle pas entre la ligne et la collecte relue chez FedaPay. */
export type AnomaliePaiement = "montant" | "reference";

/** Une tentative d'achat — `paiements/{id}`. Écrite par le serveur seul. */
export interface FirestorePaiement {
  uid: string;
  formule: IdFormule;
  droit: DroitOffre;
  /** En XOF, entier : le prix lu par le serveur au moment du clic. */
  montant: number;
  devise: "XOF";
  statut: StatutPaiement;
  /** Le poste de dev et les aperçus écrivent dans la même base que la production. */
  environnement: EnvironnementPaiement;
  fedapay_id: number | null;
  /** L'état brut chez FedaPay, recopié à chaque relecture, même après `paye`. */
  fedapay_statut: string | null;
  mode: string | null;
  frais: number | null;
  recu_url: string | null;
  echeance_avant: string | null;
  echeance_apres: string | null;
  applique_le: unknown;
  anomalie: AnomaliePaiement | null;
  created_at: unknown;
  updated_at: unknown;
}

/** Ce qu'on lit d'une collecte FedaPay (lib/fedapay la normalise). */
export interface Collecte {
  id: number;
  statut: string;
  montant: number;
  /** Notre identifiant de ligne, tel que FedaPay le renvoie. */
  reference: string | null;
  mode: string | null;
  frais: number | null;
  recuUrl: string | null;
}

export type Reglement =
  | { anomalie: AnomaliePaiement }
  | { anomalie: null; statut: StatutPaiement; accorder: boolean };

/**
 * Que faire d'une ligne, une fois sa collecte relue chez FedaPay ?
 *
 * La collecte doit être la nôtre et au montant demandé : sinon aucun droit,
 * et l'écart est noté pour l'administration. Une ligne déjà payée ne
 * s'accorde pas une seconde fois, quel que soit le nombre d'appels.
 */
export function deciderReglement(
  ligne: Pick<FirestorePaiement, "statut" | "montant">,
  idLigne: string,
  collecte: Pick<Collecte, "statut" | "montant" | "reference">,
): Reglement {
  if (collecte.reference !== idLigne) return { anomalie: "reference" };
  if (collecte.montant !== ligne.montant) return { anomalie: "montant" };
  if (ligne.statut === "paye") return { anomalie: null, statut: "paye", accorder: false };
  const statut = etatDepuisFedapay(collecte.statut);
  return { anomalie: null, statut, accorder: statut === "paye" };
}

/** Un identifiant de ligne : vingt caractères, ceux des identifiants Firestore. */
export const ID_PAIEMENT = /^[A-Za-z0-9]{20}$/;

/**
 * L'identifiant du paiement, lu dans l'adresse de retour (`?paiement=…`).
 *
 * FedaPay ajoute `id` et `status` à l'adresse qu'on lui a donnée. Elle porte
 * déjà un paramètre : s'il les colle avec un second « ? », le nôtre arrive
 * sous la forme « XYZ?id=258&status=approved ». On garde les vingt premiers
 * caractères quand ce qui suit commence par un séparateur, rien sinon.
 */
export function idPaiementDuRetour(valeur: string | null | undefined): string | null {
  const brut = valeur ?? "";
  const debut = brut.slice(0, 20);
  const suite = brut.slice(20);
  if (!ID_PAIEMENT.test(debut)) return null;
  return suite === "" || suite.startsWith("?") || suite.startsWith("&") ? debut : null;
}

/** Les deux échéances qu'on rappelle ce jour-là : la veille, et sept jours avant. */
export function joursDeRappel(jour: string): { demain: string; dansSeptJours: string } {
  return { demain: ajouterJours(jour, 1), dansSeptJours: ajouterJours(jour, 7) };
}

/** Au-delà, une ligne jamais payée ne le sera plus : FedaPay expire une collecte en 24 h. */
export const HEURES_DE_SUIVI = 48;

/**
 * Les lignes encore ouvertes que la tâche du matin relit (`recentes`), et
 * celles qu'elle relit une dernière fois avant de les fermer (`perimees`).
 * Celles d'un autre environnement ne la regardent pas : la production partage
 * sa base avec le bac à sable et ne peut pas relire ses collectes.
 */
export function trierLignesOuvertes<T extends { environnement: EnvironnementPaiement; creeMs: number }>(
  lignes: T[],
  environnement: EnvironnementPaiement,
  maintenantMs: number,
): { recentes: T[]; perimees: T[] } {
  const limite = maintenantMs - HEURES_DE_SUIVI * 3_600_000;
  const miennes = lignes.filter((l) => l.environnement === environnement);
  return {
    recentes: miennes.filter((l) => l.creeMs >= limite),
    perimees: miennes.filter((l) => l.creeMs < limite),
  };
}

/** Le motif écrit sur le droit, pour l'administration. */
export function motifAchat(mois: number, environnement: EnvironnementPaiement): string {
  return `Achat Pro ${mois} mois${environnement === "live" ? "" : " (bac à sable)"}`;
}
```

- [ ] **Step 4: Lancer les tests, constater le succès**

Run: `(cd mobile && npx jest src/__tests__/paiement.test.ts)`
Expected: PASS, toutes les suites vertes.

- [ ] **Step 5: Le réglage de l'offre connaît les prix**

Dans `src/lib/offre.ts`, remplacer le deuxième paragraphe de l'en-tête :

```ts
// DES DROITS AVANT LE PAIEMENT. Rien ne s'achète encore : l'administration
// accorde le Pro (ou l'option sans pub) à la main, pour une durée, à qui elle
// veut le faire essayer. Le jour où le paiement mobile money arrivera, il
// écrira le même document (`source: "paiement"`), et rien d'autre ne changera.
```

par :

```ts
// UN SEUL DOCUMENT DIT QUI EST PRO, d'où que le droit vienne. L'administration
// l'accorde à la main (`source: "admin"`), pour une durée, à qui elle veut le
// faire essayer ; un achat par mobile money écrit le même document
// (`source: "paiement"`, voir lib/paiement). Rien d'autre ne distingue les
// deux : les limites, le club, le sans pub lisent ce document et lui seul.
```

Et dans `FirestoreReglageOffre`, ajouter le champ `prix` :

```ts
/** Le réglage de l'offre — `settings/offre`, lecture publique. */
export interface FirestoreReglageOffre {
  /** À partir de ce jour, les limites s'appliquent ; `null` = pas encore. */
  limites_depuis: string | null;
  /** Le prix de chaque formule, en XOF ; vide = pas en vente (lib/paiement). */
  prix?: { pro_mois?: number | null; pro_an?: number | null };
  updated_by: string | null;
  updated_at: unknown;
}
```

Dans la même interface `DroitAccorde`, remplacer le commentaire de `source` :

```ts
  /** « admin » : accordé à la main ; « paiement » : acheté (lib/paiement). */
  source: "admin" | "paiement";
```

- [ ] **Step 6: Vérifier les types**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 7: Commit**

```bash
git add src/lib/paiement.ts src/lib/offre.ts mobile/src/__tests__/paiement.test.ts
git commit -m "feat(paiement): formules, échéances et décision de règlement

Module pur partagé par le serveur et le navigateur. Le prix est un
réglage, l'échéance s'ajoute à la fin en cours, et un paiement déjà
réglé ne s'accorde pas deux fois.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Le client FedaPay

**Files:**
- Create: `src/lib/fedapay.ts`
- Test: `mobile/src/__tests__/fedapay.test.ts`

**Interfaces:**
- Consumes: `ID_PAIEMENT`, `type Collecte`, `type EnvironnementPaiement` de `@/lib/paiement`.
- Produces (tout exporté de `@/lib/fedapay`) :
  - `environnementFedapay(): EnvironnementPaiement`, `fedapayConfigure(): boolean`
  - `class ErreurFedapay extends Error { readonly status: number }`
  - `deballer(corps: unknown, nom: string): Record<string, unknown>`
  - `normaliserCollecte(brut: Record<string, unknown>): Collecte | null`
  - `interface DemandeCollecte { reference: string; description: string; montant: number; retour: string; client: { prenom: string; nom: string; email: string | null } }`
  - `corpsCollecte(d: DemandeCollecte): Record<string, unknown>`
  - `creerCollecte(d: DemandeCollecte): Promise<Collecte>`, `lienDePaiement(idCollecte: number): Promise<string>`, `lireCollecte(idCollecte: number): Promise<Collecte | null>`, `lireCollecteParReference(reference: string): Promise<Collecte | null>`
  - `TOLERANCE_SIGNATURE_S = 300`, `signatureValide(corps: string, entete: string | null | undefined, hmacHex: (message: string) => string, maintenantS?: number): boolean`
  - `cibleDeLEvenement(evenement: unknown): { reference: string | null; idCollecte: number | null } | null`

Ce fichier ne doit importer **aucun** module `node:*` : le HMAC est fourni par l'appelant (la route du webhook), ce qui laisse le fichier importable par les tests.

- [ ] **Step 1: Écrire les tests**

Créer `mobile/src/__tests__/fedapay.test.ts` :

```ts
import {
  TOLERANCE_SIGNATURE_S, cibleDeLEvenement, corpsCollecte, deballer, normaliserCollecte, signatureValide,
} from "@/lib/fedapay";

// Le module vit côté site (src/lib/fedapay). Ses appels réseau ne se testent
// pas ici ; ce qui lit une réponse, construit une requête ou vérifie une
// signature est pur, et c'est ce que cette suite tient.

// `require`, comme les autres suites qui ont besoin d'un module Node : la
// vérification de types de l'application mobile n'a pas ceux de Node.
const { createHmac } = require("crypto") as {
  createHmac: (algo: "sha256", cle: string) => { update: (m: string, e: "utf8") => { digest: (f: "hex") => string } };
};

const SECRET = "wh_sandbox_secret";
const hmac = (secret: string) => (message: string) => createHmac("sha256", secret).update(message, "utf8").digest("hex");
const signer = (t: number, corps: string, secret = SECRET) => `t=${t},s=${hmac(secret)(`${t}.${corps}`)}`;

const ID = "AbCdEfGhIjKlMnOpQrSt";

describe("deballer", () => {
  const collecte = { id: 258, status: "pending" };

  it("ouvre l'enveloppe versionnée de l'API", () => {
    expect(deballer({ "v1/transaction": collecte }, "transaction")).toEqual(collecte);
  });

  it("ouvre l'enveloppe sans version", () => {
    expect(deballer({ transaction: collecte }, "transaction")).toEqual(collecte);
  });

  it("rend l'objet tel quel quand il arrive à plat", () => {
    expect(deballer(collecte, "transaction")).toEqual(collecte);
  });

  it("ne casse pas sur une réponse vide", () => {
    expect(deballer(null, "transaction")).toEqual({});
  });

  it("ne prend pas un champ du même nom pour une enveloppe : le lien de paiement a un champ token", () => {
    const lien = { token: "abc123", url: "https://exemple.test/payer/abc123" };
    expect(deballer(lien, "token")).toEqual(lien);
  });
});

describe("normaliserCollecte", () => {
  it("lit ce dont on a besoin", () => {
    expect(normaliserCollecte({
      id: 258, status: "approved", amount: 1500, merchant_reference: ID, mode: "togocel", fees: 26,
      receipt_url: "https://exemple.test/recu", custom_metadata: { paiement_id: ID },
    })).toEqual({ id: 258, statut: "approved", montant: 1500, reference: ID, mode: "togocel", frais: 26, recuUrl: "https://exemple.test/recu" });
  });

  it("retrouve la référence dans les métadonnées si merchant_reference manque", () => {
    expect(normaliserCollecte({ id: 258, status: "pending", amount: 1500, custom_metadata: { paiement_id: ID } })?.reference).toBe(ID);
  });

  it("laisse la référence vide quand rien ne la donne", () => {
    expect(normaliserCollecte({ id: 258, status: "pending", amount: 1500 })?.reference).toBeNull();
  });

  it("rend les champs absents à null", () => {
    expect(normaliserCollecte({ id: 258, status: "pending", amount: 1500 }))
      .toEqual({ id: 258, statut: "pending", montant: 1500, reference: null, mode: null, frais: null, recuUrl: null });
  });

  it("refuse ce qui n'est pas une collecte", () => {
    expect(normaliserCollecte({})).toBeNull();
    expect(normaliserCollecte({ id: "abc", status: "pending" })).toBeNull();
    expect(normaliserCollecte({ id: 258 })).toBeNull();
  });

  it("un montant illisible ne vaut jamais le montant demandé", () => {
    expect(Number.isNaN(normaliserCollecte({ id: 258, status: "approved" })?.montant)).toBe(true);
  });
});

describe("corpsCollecte", () => {
  const demande = {
    reference: ID, description: "KoppaFoot Pro, 1 mois", montant: 1500, retour: `https://www.koppafoot.com/offre?paiement=${ID}`,
    client: { prenom: "Ama", nom: "Koffi", email: "ama@exemple.test" },
  };

  it("demande le montant en XOF, sous notre référence", () => {
    expect(corpsCollecte(demande)).toEqual({
      description: "KoppaFoot Pro, 1 mois",
      amount: 1500,
      currency: { iso: "XOF" },
      callback_url: `https://www.koppafoot.com/offre?paiement=${ID}`,
      merchant_reference: ID,
      custom_metadata: { paiement_id: ID },
      customer: { firstname: "Ama", lastname: "Koffi", email: "ama@exemple.test" },
    });
  });

  it("n'envoie pas de client incomplet : un compte créé par SMS n'a pas d'e-mail", () => {
    expect(corpsCollecte({ ...demande, client: { prenom: "Ama", nom: "Koffi", email: null } })).not.toHaveProperty("customer");
    expect(corpsCollecte({ ...demande, client: { prenom: "", nom: "Koffi", email: "ama@exemple.test" } })).not.toHaveProperty("customer");
    expect(corpsCollecte({ ...demande, client: { prenom: "Ama", nom: "  ", email: "ama@exemple.test" } })).not.toHaveProperty("customer");
    expect(corpsCollecte({ ...demande, client: { prenom: "Ama", nom: "Koffi", email: "pas-un-email" } })).not.toHaveProperty("customer");
  });

  it("n'envoie jamais de téléphone", () => {
    expect(JSON.stringify(corpsCollecte(demande))).not.toContain("phone");
  });
});

describe("signatureValide", () => {
  const corps = JSON.stringify({ name: "transaction.approved", entity: { id: 258 } });
  const t = 1_800_000_000;

  it("accepte la signature de FedaPay", () => {
    expect(signatureValide(corps, signer(t, corps), hmac(SECRET), t)).toBe(true);
  });

  it("refuse un autre secret", () => {
    expect(signatureValide(corps, signer(t, corps, "autre_secret"), hmac(SECRET), t)).toBe(false);
  });

  it("refuse un corps altéré", () => {
    expect(signatureValide(corps.replace("258", "259"), signer(t, corps), hmac(SECRET), t)).toBe(false);
  });

  it("refuse un horodatage trop vieux, accepte la limite", () => {
    expect(signatureValide(corps, signer(t, corps), hmac(SECRET), t + TOLERANCE_SIGNATURE_S)).toBe(true);
    expect(signatureValide(corps, signer(t, corps), hmac(SECRET), t + TOLERANCE_SIGNATURE_S + 1)).toBe(false);
  });

  it("refuse un en-tête absent ou illisible", () => {
    expect(signatureValide(corps, null, hmac(SECRET), t)).toBe(false);
    expect(signatureValide(corps, "", hmac(SECRET), t)).toBe(false);
    expect(signatureValide(corps, "n'importe quoi", hmac(SECRET), t)).toBe(false);
    expect(signatureValide(corps, `s=${hmac(SECRET)(`${t}.${corps}`)}`, hmac(SECRET), t)).toBe(false);
    expect(signatureValide(corps, `t=${t}`, hmac(SECRET), t)).toBe(false);
    expect(signatureValide(corps, `t=${t},s=zz`, hmac(SECRET), t)).toBe(false);
  });

  it("accepte si l'une des signatures présentes est la bonne", () => {
    const bonne = hmac(SECRET)(`${t}.${corps}`);
    const fausse = "0".repeat(64);
    expect(signatureValide(corps, `t=${t},s=${fausse},s=${bonne}`, hmac(SECRET), t)).toBe(true);
  });

  it("ne tient pas compte de la casse de l'hexadécimal", () => {
    const bonne = hmac(SECRET)(`${t}.${corps}`).toUpperCase();
    expect(signatureValide(corps, `t=${t},s=${bonne}`, hmac(SECRET), t)).toBe(true);
  });
});

describe("cibleDeLEvenement", () => {
  it("lit notre référence sur la collecte de l'événement", () => {
    expect(cibleDeLEvenement({ name: "transaction.approved", entity: { id: 258, merchant_reference: ID } }))
      .toEqual({ reference: ID, idCollecte: 258 });
  });

  it("se replie sur les métadonnées, puis sur l'identifiant FedaPay seul", () => {
    expect(cibleDeLEvenement({ name: "transaction.approved", entity: { id: 258, custom_metadata: { paiement_id: ID } } }))
      .toEqual({ reference: ID, idCollecte: 258 });
    expect(cibleDeLEvenement({ name: "transaction.canceled", entity: { id: 258 } }))
      .toEqual({ reference: null, idCollecte: 258 });
  });

  it("n'accepte comme référence qu'un identifiant de ligne", () => {
    expect(cibleDeLEvenement({ name: "transaction.approved", entity: { id: 258, merchant_reference: "../droits/x" } }))
      .toEqual({ reference: null, idCollecte: 258 });
  });

  it("ignore ce qui ne concerne pas une collecte", () => {
    expect(cibleDeLEvenement({ name: "customer.created", entity: { id: 4 } })).toBeNull();
    expect(cibleDeLEvenement({ name: "transaction.approved" })).toBeNull();
    expect(cibleDeLEvenement({ name: "transaction.approved", entity: {} })).toBeNull();
    expect(cibleDeLEvenement(null)).toBeNull();
    expect(cibleDeLEvenement("texte")).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer les tests, constater l'échec**

Run: `(cd mobile && npx jest src/__tests__/fedapay.test.ts)`
Expected: FAIL, `Cannot find module '@/lib/fedapay'`.

- [ ] **Step 3: Écrire le client**

Créer `src/lib/fedapay.ts` :

```ts
import { ID_PAIEMENT, type Collecte, type EnvironnementPaiement } from "@/lib/paiement";

// ============================================
// FedaPay : créer une collecte, obtenir sa page de paiement, la relire.
//
// TROIS APPELS, EN `fetch`. Le SDK officiel apporte axios et une clé rangée
// dans un état global (`FedaPay.setApiKey`), pour ce qui tient ici en une
// fonction : on s'en passe.
//
// L'ENVELOPPE DES RÉPONSES N'EST PAS DOCUMENTÉE. La référence d'API montre la
// collecte à plat, le SDK la lit sous une clé `transaction` après avoir retiré
// un préfixe de version (`v1/transaction`). `deballer` accepte les trois.
//
// ON NE CROIT QUE CE QU'ON RELIT. Le retour du client sur le site ne prouve
// rien (la doc le dit), et le contenu d'un webhook, même signé, ne sert qu'à
// savoir quelle collecte relire : `lireCollecte` est la seule source de l'état.
//
// AUCUN MODULE NODE ICI : le HMAC de la signature est fourni par l'appelant
// (la route du webhook). Le fichier reste ainsi importable par les tests, qui
// tournent dans mobile/src/__tests__/fedapay.test.ts.
// ============================================

/** `live` seulement quand la variable le dit ; tout le reste est le bac à sable. */
export function environnementFedapay(): EnvironnementPaiement {
  return process.env.FEDAPAY_ENV === "live" ? "live" : "sandbox";
}

/** Sans clé secrète, rien n'est en vente. */
export function fedapayConfigure(): boolean {
  return Boolean(process.env.FEDAPAY_SECRET_KEY);
}

const base = (): string =>
  environnementFedapay() === "live" ? "https://api.fedapay.com/v1" : "https://sandbox-api.fedapay.com/v1";

/** Un refus ou une panne de FedaPay. `status` : le code HTTP, 0 si l'appel n'est pas parti. */
export class ErreurFedapay extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ErreurFedapay";
  }
}

async function appel(methode: "GET" | "POST", chemin: string, corps?: unknown): Promise<unknown> {
  const cle = process.env.FEDAPAY_SECRET_KEY;
  if (!cle) throw new ErreurFedapay("FEDAPAY_SECRET_KEY absente", 0);
  let res: Response;
  try {
    res = await fetch(`${base()}${chemin}`, {
      method: methode,
      headers: {
        Authorization: `Bearer ${cle}`,
        Accept: "application/json",
        ...(corps ? { "Content-Type": "application/json" } : {}),
      },
      body: corps ? JSON.stringify(corps) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new ErreurFedapay(`FedaPay injoignable : ${err instanceof Error ? err.message : String(err)}`, 0);
  }
  const texte = await res.text();
  if (!res.ok) throw new ErreurFedapay(`FedaPay ${res.status} sur ${methode} ${chemin} : ${texte.slice(0, 300)}`, res.status);
  try {
    return JSON.parse(texte) as unknown;
  } catch {
    throw new ErreurFedapay(`Réponse FedaPay illisible sur ${methode} ${chemin}`, res.status);
  }
}

/** L'objet utile d'une réponse, qu'il arrive sous `v1/<nom>`, sous `<nom>`, ou à plat. */
export function deballer(corps: unknown, nom: string): Record<string, unknown> {
  const c = (corps && typeof corps === "object" ? corps : {}) as Record<string, unknown>;
  const dedans = c[`v1/${nom}`] ?? c[nom];
  return (dedans && typeof dedans === "object" ? dedans : c) as Record<string, unknown>;
}

const texte = (x: unknown): string | null => (typeof x === "string" && x ? x : null);
const nombre = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

/** Notre identifiant de ligne, là où FedaPay le renvoie. */
function referenceDe(brut: Record<string, unknown>): string | null {
  const meta = (brut.custom_metadata && typeof brut.custom_metadata === "object" ? brut.custom_metadata : {}) as Record<string, unknown>;
  return texte(brut.merchant_reference) ?? texte(meta.paiement_id);
}

/** Une collecte telle que l'API la rend, réduite à ce qu'on en lit ; `null` si ce n'en est pas une. */
export function normaliserCollecte(brut: Record<string, unknown>): Collecte | null {
  const id = Number(brut.id);
  if (!Number.isInteger(id) || id <= 0 || typeof brut.status !== "string") return null;
  return {
    id,
    statut: brut.status,
    // Illisible, il vaut NaN : jamais égal au montant demandé, donc jamais d'octroi.
    montant: typeof brut.amount === "number" ? brut.amount : Number.NaN,
    reference: referenceDe(brut),
    mode: texte(brut.mode),
    frais: nombre(brut.fees),
    recuUrl: texte(brut.receipt_url),
  };
}

export interface DemandeCollecte {
  /** L'identifiant de la ligne `paiements` : unique chez FedaPay, un doublon fait échouer la création. */
  reference: string;
  description: string;
  /** En XOF, entier. */
  montant: number;
  /** Où FedaPay renvoie le client. */
  retour: string;
  client: { prenom: string; nom: string; email: string | null };
}

/**
 * Le corps de `POST /transactions`.
 *
 * LE CLIENT N'EST ENVOYÉ QUE COMPLET. Un compte créé par SMS n'a pas
 * d'e-mail : plutôt qu'un client à moitié rempli que FedaPay refuserait, on
 * n'en envoie pas, et la page de paiement le demande elle-même.
 *
 * JAMAIS LE TÉLÉPHONE : celui du profil n'est pas forcément celui du
 * portefeuille. Le client le tape sur la page de paiement.
 */
export function corpsCollecte(d: DemandeCollecte): Record<string, unknown> {
  const prenom = d.client.prenom.trim();
  const nom = d.client.nom.trim();
  const email = d.client.email?.trim() ?? "";
  const complet = Boolean(prenom && nom && /^\S+@\S+\.\S+$/.test(email));
  return {
    description: d.description,
    amount: d.montant,
    currency: { iso: "XOF" },
    callback_url: d.retour,
    merchant_reference: d.reference,
    custom_metadata: { paiement_id: d.reference },
    ...(complet ? { customer: { firstname: prenom, lastname: nom, email } } : {}),
  };
}

export async function creerCollecte(d: DemandeCollecte): Promise<Collecte> {
  const collecte = normaliserCollecte(deballer(await appel("POST", "/transactions", corpsCollecte(d)), "transaction"));
  if (!collecte) throw new ErreurFedapay("Collecte FedaPay illisible à la création", 200);
  return collecte;
}

/** L'adresse de la page de paiement d'une collecte. */
export async function lienDePaiement(idCollecte: number): Promise<string> {
  const corps = deballer(await appel("POST", `/transactions/${idCollecte}/token`), "token");
  const url = texte(corps.url);
  if (!url || !url.startsWith("https://")) throw new ErreurFedapay("Lien de paiement FedaPay illisible", 200);
  return url;
}

async function lire(chemin: string): Promise<Collecte | null> {
  try {
    return normaliserCollecte(deballer(await appel("GET", chemin), "transaction"));
  } catch (err) {
    if (err instanceof ErreurFedapay && err.status === 404) return null;
    throw err;
  }
}

/** La collecte, relue chez FedaPay ; `null` si elle n'existe pas. */
export function lireCollecte(idCollecte: number): Promise<Collecte | null> {
  return lire(`/transactions/${idCollecte}`);
}

/** La même, retrouvée par notre référence : pour une ligne qui n'a pas encore son identifiant FedaPay. */
export function lireCollecteParReference(reference: string): Promise<Collecte | null> {
  return lire(`/transactions/merchant/${encodeURIComponent(reference)}`);
}

/** L'écart toléré entre l'horodatage d'un webhook et maintenant, en secondes (celui du SDK). */
export const TOLERANCE_SIGNATURE_S = 300;

/** Compare deux chaînes sans s'arrêter au premier écart. */
function egalATempsConstant(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let ecart = 0;
  for (let i = 0; i < a.length; i += 1) ecart |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return ecart === 0;
}

/**
 * Ce webhook vient-il de FedaPay ?
 *
 * L'en-tête `X-FEDAPAY-SIGNATURE` vaut `t=<secondes>,s=<hex>` : `s` est le
 * HMAC-SHA256 de `<t>.<corps brut>` avec le secret de l'endpoint. Le corps
 * doit être celui reçu, octet pour octet : le relire après `JSON.parse` le
 * changerait.
 *
 * `hmacHex` calcule ce HMAC pour le secret ; il est fourni par l'appelant
 * pour que ce fichier n'importe aucun module Node.
 */
export function signatureValide(
  corps: string,
  entete: string | null | undefined,
  hmacHex: (message: string) => string,
  maintenantS: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!entete) return false;
  let t: string | null = null;
  const signatures: string[] = [];
  for (const morceau of entete.split(",")) {
    const i = morceau.indexOf("=");
    if (i < 0) continue;
    const cle = morceau.slice(0, i).trim();
    const valeur = morceau.slice(i + 1).trim();
    if (cle === "t" && /^\d+$/.test(valeur)) t = valeur;
    if (cle === "s" && /^[0-9a-fA-F]{64}$/.test(valeur)) signatures.push(valeur.toLowerCase());
  }
  if (t === null || signatures.length === 0) return false;
  if (maintenantS - Number(t) > TOLERANCE_SIGNATURE_S) return false;
  const attendue = hmacHex(`${t}.${corps}`).toLowerCase();
  return signatures.some((s) => egalATempsConstant(s, attendue));
}

/**
 * De quelle collecte parle cet événement ? `null` s'il ne nous concerne pas.
 *
 * On n'y lit que de quoi retrouver la ligne : notre référence, à défaut
 * l'identifiant FedaPay. L'état, lui, se relit toujours chez FedaPay.
 */
export function cibleDeLEvenement(evenement: unknown): { reference: string | null; idCollecte: number | null } | null {
  const e = (evenement && typeof evenement === "object" ? evenement : {}) as Record<string, unknown>;
  if (typeof e.name !== "string" || !e.name.startsWith("transaction.")) return null;
  const brut = e.entity ?? e.object ?? e.data;
  if (!brut || typeof brut !== "object") return null;
  const entite = brut as Record<string, unknown>;
  const ref = referenceDe(entite);
  const reference = ref && ID_PAIEMENT.test(ref) ? ref : null;
  const id = Number(entite.id);
  const idCollecte = Number.isInteger(id) && id > 0 ? id : null;
  return reference || idCollecte ? { reference, idCollecte } : null;
}
```

- [ ] **Step 4: Lancer les tests, constater le succès**

Run: `(cd mobile && npx jest src/__tests__/fedapay.test.ts)`
Expected: PASS.

- [ ] **Step 5: Vérifier les types des deux côtés**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

Run: `(cd mobile && npx tsc --noEmit)`
Expected: exactement les 3 erreurs préexistantes (`expo-notifications` dans `_layout.tsx` et `push.ts`, `data` implicite dans `push.ts`), aucune dans `fedapay` ni `paiement`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/fedapay.ts mobile/src/__tests__/fedapay.test.ts
git commit -m "feat(paiement): client FedaPay en fetch et vérification de signature

Créer une collecte, obtenir sa page de paiement, la relire. La signature
du webhook suit le schéma du SDK (t=…,s=…, HMAC-SHA256 du corps brut,
300 s de tolérance), sans dépendre du SDK.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Le serveur des paiements

**Files:**
- Create: `src/lib/paiement-serveur.ts`
- Modify: `src/types/index.ts` (`NotificationType`), `src/lib/push-categories.ts` (`categorieDuType`), `src/app/(app)/notifications/page.tsx` (`TYPE_META`), `src/lib/email.ts` (reçu), `firestore.rules`, `.env.example`
- Test: `mobile/src/__tests__/paiement.test.ts` (règle Firestore)

**Interfaces:**
- Consumes: tout `@/lib/paiement` et `@/lib/fedapay` (tâches 1 et 2) ; `adminDb` de `@/lib/firebase-admin` ; `estSuperadmin(data)` de `@/lib/admin-api-auth` ; `notifierCompte(uid, { type, title, body, link })` de `@/lib/notifier-serveur` ; `sendNotificationEmail(to, subject, html)` de `@/lib/email` ; `droitActif`, `jourDeLome`, `DroitAccorde`, `FirestoreDroits` de `@/lib/offre` ; `APP_URL` de `@/lib/partage`.
- Produces (tout exporté de `@/lib/paiement-serveur`) :
  - `lirePrixOffre(): Promise<PrixOffre>`
  - `formulesPour(profil: Record<string, unknown> | undefined): Promise<FormuleEnVente[]>`
  - `type RefusPaiement = "formule" | "non_configure" | "bac_a_sable" | "pas_en_vente" | "deja_illimite" | "trop_de_tentatives" | "fedapay"`
  - `class ErreurPaiement extends Error { readonly code: RefusPaiement }`
  - `demarrerPaiement(uid: string, formule: unknown, origine: string): Promise<{ id: string; url: string }>`
  - `interface EtatPaiement { statut: StatutPaiement; formule: IdFormule; montant: number; jusquAu: string | null; aVerifier: boolean }`
  - `vueEtat(ligne: FirestorePaiement): EtatPaiement`
  - `reglerPaiement(id: string): Promise<EtatPaiement | null>` (`null` : ligne inconnue ; lève `ErreurFedapay` si FedaPay est injoignable)
  - `paiementParCollecte(idCollecte: number): Promise<string | null>`
  - `reverifierPaiementsOuverts(maintenantMs?: number): Promise<{ revus: number; payes: number; fermes: number }>`
  - `rappelerEcheancesPro(jour?: string): Promise<number>`
- Produces aussi : `NotificationType` contient `"offre"` ; `recuPaiementHtml(p: { prenom: string; formule: string; montant: number; jusquAu: string; recuUrl: string | null }): string` dans `@/lib/email`.

- [ ] **Step 1: Le test de la règle Firestore**

Ajouter à la fin de `mobile/src/__tests__/paiement.test.ts` :

```ts
// `require`, comme les autres suites qui lisent firestore.rules : la
// vérification de types de l'application mobile n'a pas ceux de Node.
const { readFileSync } = require("fs") as { readFileSync: (chemin: string, encodage: "utf8") => string };
const { join } = require("path") as { join: (...morceaux: string[]) => string };

describe("firestore.rules", () => {
  it("ferme la collection paiements aux navigateurs", () => {
    const regles = readFileSync(join(__dirname, "../../../firestore.rules"), "utf8");
    const bloc = /match \/paiements\/\{paiementId\} \{([^}]*)\}/.exec(regles)?.[1];
    expect(bloc).toBeDefined();
    expect(bloc).toContain("allow read, write: if false;");
    expect((bloc ?? "").match(/allow /g)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Lancer, constater l'échec**

Run: `(cd mobile && npx jest src/__tests__/paiement.test.ts -t "firestore.rules")`
Expected: FAIL, `expect(received).toBeDefined()` (le bloc n'existe pas).

- [ ] **Step 3: La règle**

Dans `firestore.rules`, juste après le bloc `match /droits/{uid} { … }` (vers la ligne 694), ajouter :

```
    // Les paiements (lib/paiement) : une ligne par tentative d'achat du Pro.
    // Tout passe par /api/paiements et par le webhook FedaPay, avec le SDK
    // admin : un navigateur n'a rien à y lire ni à y écrire, et surtout pas
    // l'état « payé ».
    match /paiements/{paiementId} {
      allow read, write: if false;
    }
```

Run: `(cd mobile && npx jest src/__tests__/paiement.test.ts)`
Expected: PASS.

- [ ] **Step 4: Le type de notification `offre`**

Dans `src/types/index.ts`, à la fin de `NotificationType`, remplacer :

```ts
  /** Quelqu'un a commenté ma publication dans la Tribune. Envoyée à
   *  l'AUTEUR, jamais à celui qui commente sa propre publication. */
  | "tribune_comment";
```

par :

```ts
  /** Quelqu'un a commenté ma publication dans la Tribune. Envoyée à
   *  l'AUTEUR, jamais à celui qui commente sa propre publication. */
  | "tribune_comment"
  /** L'offre du compte : paiement reçu, Pro qui arrive à échéance. Envoyée au
   *  TITULAIRE. C'est son reçu et son rappel, jamais une annonce. */
  | "offre";
```

Dans `src/lib/push-categories.ts`, dans `categorieDuType`, ajouter le cas au groupe « perso », juste avant `return "perso";` :

```ts
    // L'arbitrage aussi : on t'invite, on te répond, on se désiste — c'est à
    // toi qu'on parle, jamais une annonce.
    case "arbitrage":
    // Le reçu d'un paiement et le rappel d'une échéance : on parle de ton
    // argent. Les ranger en annonces les ferait taire chez qui a coupé la pub.
    case "offre":
      return "perso";
```

Dans `src/app/(app)/notifications/page.tsx`, ajouter `Gem` à l'import de `lucide-react`, et une ligne à `TYPE_META` après `tribune_comment` :

```ts
  offre:                 { label: "Offre",       Icon: Gem,            tone: "bg-emerald-50 text-emerald-600" },
```

- [ ] **Step 5: Le reçu par e-mail**

Dans `src/lib/email.ts`, ajouter à la fin du fichier (la fonction `echapper` et `ctaButton` existent déjà dans ce fichier) :

```ts
// ── Paiement ────────────────────────────────────────────────

/**
 * Le reçu d'un achat du Pro : ce qui a été payé, et jusqu'à quand il court.
 *
 * IL DIT QUE RIEN NE SE RENOUVELLE. C'est la question que se pose quiconque
 * vient de payer en ligne, et la réponse est une promesse des conditions :
 * une période, pas un abonnement.
 */
export function recuPaiementHtml(p: {
  prenom: string;
  formule: string;
  montant: number;
  jusquAu: string;
  recuUrl: string | null;
}): string {
  const bonjour = p.prenom.trim() ? `Bonjour ${echapper(p.prenom.trim())},` : "Bonjour,";
  const recu = p.recuUrl && p.recuUrl.startsWith("https://")
    ? `<p style="margin:16px 0 0;"><a href="${echapper(p.recuUrl)}" style="color:#059669;">Le reçu FedaPay</a></p>`
    : "";
  return emailLayout(`
    <h2 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#1e293b;">Paiement reçu</h2>
    <p style="margin:0 0 12px;color:#475569;">${bonjour}</p>
    <p style="margin:0 0 12px;color:#475569;">
      Nous avons bien reçu <strong>${p.montant.toLocaleString("fr-FR")} FCFA</strong> pour
      <strong>${echapper(p.formule)}</strong>. Ton Pro court jusqu'au <strong>${echapper(p.jusquAu)}</strong> inclus.
    </p>
    <p style="margin:0;color:#475569;">Rien ne se renouvelle tout seul : nous te préviendrons avant la fin.</p>
    ${recu}
    ${ctaButton("Voir mon offre", `${APP_URL}/offre`)}
  `);
}
```

- [ ] **Step 6: Le module serveur**

Créer `src/lib/paiement-serveur.ts` :

```ts
import { FieldValue } from "firebase-admin/firestore";
import { estSuperadmin } from "@/lib/admin-api-auth";
import { recuPaiementHtml, sendNotificationEmail } from "@/lib/email";
import {
  creerCollecte, environnementFedapay, fedapayConfigure, lienDePaiement, lireCollecte, lireCollecteParReference,
} from "@/lib/fedapay";
import { adminDb } from "@/lib/firebase-admin";
import { notifierCompte } from "@/lib/notifier-serveur";
import { droitActif, jourDeLome, type DroitAccorde, type FirestoreDroits } from "@/lib/offre";
import {
  FORMULES, STATUTS_OUVERTS, deciderReglement, estFormule, formulesEnVente, joursDeRappel, lirePrix, motifAchat,
  nouvelleEcheance, prixValide, trierLignesOuvertes,
  type FirestorePaiement, type FormuleEnVente, type IdFormule, type PrixOffre, type StatutPaiement,
} from "@/lib/paiement";
import { APP_URL } from "@/lib/partage";

// ============================================
// Les paiements, côté serveur : démarrer un achat, et le régler.
//
// UNE SEULE FONCTION ACCORDE LE PRO : `reglerPaiement`. Le webhook, la
// vérification au retour du client, la tâche du matin et le bouton
// « Revérifier » de l'administration l'appellent tous, et elle ne croit
// aucun d'eux : elle relit la collecte chez FedaPay, vérifie que c'est la
// nôtre et au bon montant (lib/paiement, deciderReglement), puis écrit le
// droit et l'état « payé » dans la même transaction. Dix appels pour le même
// paiement prolongent une fois.
//
// LE BAC À SABLE ÉCRIT DANS LA VRAIE BASE. Le poste de développement et les
// aperçus partagent le Firestore de la production : avec des clés de test,
// quiconque trouve une adresse d'aperçu s'offrirait le Pro en monnaie
// fictive. Hors `FEDAPAY_ENV=live`, seul un superadmin peut donc acheter, et
// chaque ligne dit d'où elle vient.
//
// LA LIGNE EST ÉCRITE AVANT L'APPEL À FEDAPAY, sous l'identifiant qui lui sert
// de référence chez eux : si l'écriture suivante échoue, le webhook retrouve
// quand même la ligne.
// ============================================

const paiements = () => adminDb.collection("paiements");

const millis = (x: unknown): number =>
  x && typeof (x as { toMillis?: () => number }).toMillis === "function" ? (x as { toMillis: () => number }).toMillis() : 0;

/** « 12 novembre 2026 », pour une journée « 2026-11-12 ». */
const dateLongue = (jour: string): string =>
  new Date(`${jour}T00:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const libelleFormule = (formule: IdFormule): string =>
  FORMULES[formule].mois === 12 ? "KoppaFoot Pro, 1 an" : "KoppaFoot Pro, 1 mois";

export async function lirePrixOffre(): Promise<PrixOffre> {
  const snap = await adminDb.collection("settings").doc("offre").get();
  return lirePrix(snap.data()?.prix);
}

/**
 * Les formules que CE compte peut acheter : aucune sans clé FedaPay, et en
 * bac à sable seulement pour un superadmin.
 */
export async function formulesPour(profil: Record<string, unknown> | undefined): Promise<FormuleEnVente[]> {
  if (!fedapayConfigure()) return [];
  if (environnementFedapay() !== "live" && !estSuperadmin(profil)) return [];
  return formulesEnVente(await lirePrixOffre());
}

export type RefusPaiement =
  | "formule" | "non_configure" | "bac_a_sable" | "pas_en_vente" | "deja_illimite" | "trop_de_tentatives" | "fedapay";

/** Un achat qui ne peut pas démarrer. `message` est en français ; le navigateur traduit d'après `code`. */
export class ErreurPaiement extends Error {
  constructor(readonly code: RefusPaiement, message: string) {
    super(message);
    this.name = "ErreurPaiement";
  }
}

/** Au-delà, on arrête de créer des collectes pour ce compte : chacune est un appel à FedaPay. */
const TENTATIVES_PAR_HEURE = 5;

/**
 * Démarre un achat : la ligne, la collecte chez FedaPay, l'adresse de sa page
 * de paiement. `origine` : d'où vient la requête, pour le retour en bac à
 * sable (en réel, toujours le site).
 */
export async function demarrerPaiement(uid: string, formule: unknown, origine: string): Promise<{ id: string; url: string }> {
  if (!estFormule(formule)) throw new ErreurPaiement("formule", "Formule inconnue.");
  if (!fedapayConfigure()) throw new ErreurPaiement("non_configure", "Le paiement n'est pas disponible.");

  const environnement = environnementFedapay();
  const profil = (await adminDb.collection("users").doc(uid).get()).data() ?? {};
  if (environnement !== "live" && !estSuperadmin(profil)) {
    throw new ErreurPaiement("bac_a_sable", "Le Pro n'est pas encore en vente.");
  }

  const prix = (await lirePrixOffre())[formule];
  if (!prixValide(prix)) throw new ErreurPaiement("pas_en_vente", "Cette formule n'est pas en vente.");

  const jour = jourDeLome();
  const droits = (await adminDb.collection("droits").doc(uid).get()).data() as FirestoreDroits | undefined;
  if (nouvelleEcheance(droits?.pro, jour, FORMULES[formule].mois) === null) {
    throw new ErreurPaiement("deja_illimite", "Ton Pro n'a pas d'échéance : il n'y a rien à prolonger.");
  }

  // Un compte a une poignée de lignes : on les lit toutes et on compte en
  // mémoire, ce qui évite un index composé (uid + created_at).
  const miennes = await paiements().where("uid", "==", uid).get();
  const ilYAUneHeure = Date.now() - 3_600_000;
  if (miennes.docs.filter((d) => millis(d.get("created_at")) > ilYAUneHeure).length >= TENTATIVES_PAR_HEURE) {
    throw new ErreurPaiement("trop_de_tentatives", "Trop de tentatives. Réessaie dans une heure.");
  }

  const ref = paiements().doc();
  const ligne: FirestorePaiement = {
    uid,
    formule,
    droit: FORMULES[formule].droit,
    montant: prix,
    devise: "XOF",
    statut: "en_attente",
    environnement,
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
  };
  await ref.set(ligne);

  let idCollecte: number;
  let url: string;
  try {
    const collecte = await creerCollecte({
      reference: ref.id,
      description: libelleFormule(formule),
      montant: prix,
      retour: `${environnement === "live" ? APP_URL : origine}/offre?paiement=${ref.id}`,
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

/** Ce que le titulaire apprend de son paiement. */
export interface EtatPaiement {
  statut: StatutPaiement;
  formule: IdFormule;
  montant: number;
  /** L'échéance du Pro après ce paiement ; `null` tant qu'il n'est pas réglé. */
  jusquAu: string | null;
  /** Un écart entre la ligne et la collecte : l'administration doit regarder. */
  aVerifier: boolean;
}

export function vueEtat(ligne: FirestorePaiement): EtatPaiement {
  return {
    statut: ligne.statut,
    formule: ligne.formule,
    montant: ligne.montant,
    jusquAu: ligne.echeance_apres,
    aVerifier: ligne.anomalie !== null,
  };
}

/** Le reçu : cloche, téléphone, e-mail. Ne lève jamais, et ne remet rien en cause. */
async function accuserReception(ligne: FirestorePaiement, jusquAu: string, recuUrl: string | null): Promise<void> {
  const profil = (await adminDb.collection("users").doc(ligne.uid).get().catch(() => null))?.data() ?? {};
  const email = typeof profil.email === "string" ? profil.email : null;
  await Promise.allSettled([
    notifierCompte(ligne.uid, {
      type: "offre",
      title: "Paiement reçu",
      body: `Tu es Pro jusqu'au ${dateLongue(jusquAu)}.`,
      link: "/offre",
    }),
    email
      ? sendNotificationEmail(email, "Ton reçu KoppaFoot Pro", recuPaiementHtml({
          prenom: typeof profil.first_name === "string" ? profil.first_name : "",
          formule: libelleFormule(ligne.formule),
          montant: ligne.montant,
          jusquAu: dateLongue(jusquAu),
          recuUrl,
        }))
      : null,
  ]);
}

/**
 * Règle un paiement : relit sa collecte chez FedaPay et, si elle est payée,
 * accorde le Pro. Sans effet la seconde fois.
 *
 * `null` : la ligne n'existe pas. Lève `ErreurFedapay` si FedaPay ne répond
 * pas : à l'appelant de dire s'il réessaie (le webhook répond 500, FedaPay
 * rappellera).
 */
export async function reglerPaiement(id: string): Promise<EtatPaiement | null> {
  const ref = paiements().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const ligne = snap.data() as FirestorePaiement;

  // Une ligne du bac à sable vue depuis la production (ou l'inverse) : ses
  // collectes vivent sur l'autre serveur FedaPay, on ne peut pas la relire.
  const environnement = environnementFedapay();
  if (ligne.environnement !== environnement) return vueEtat(ligne);

  const collecte = ligne.fedapay_id !== null ? await lireCollecte(ligne.fedapay_id) : await lireCollecteParReference(id);
  if (!collecte) return vueEtat(ligne);

  const suivi = {
    fedapay_id: collecte.id,
    fedapay_statut: collecte.statut,
    mode: collecte.mode,
    frais: collecte.frais,
    recu_url: collecte.recuUrl,
    updated_at: FieldValue.serverTimestamp(),
  };

  const decision = deciderReglement(ligne, id, collecte);
  if (decision.anomalie) {
    console.error("[paiements] écart avec FedaPay:", id, decision.anomalie, { collecte: collecte.id });
    await ref.update({ ...suivi, anomalie: decision.anomalie });
    return vueEtat({ ...ligne, anomalie: decision.anomalie });
  }
  if (!decision.accorder) {
    // Une ligne payée ne change plus d'état : on ne recopie que le suivi.
    const statut = ligne.statut === "paye" ? "paye" : decision.statut;
    await ref.update({ ...suivi, statut });
    return vueEtat({ ...ligne, statut });
  }

  const jour = jourDeLome();
  const droitsRef = adminDb.collection("droits").doc(ligne.uid);
  const resultat = await adminDb.runTransaction(async (tx) => {
    const [l, d] = await Promise.all([tx.get(ref), tx.get(droitsRef)]);
    const courante = l.data() as FirestorePaiement;
    // Un autre appel a réglé cette ligne entre notre lecture et maintenant.
    if (courante.statut === "paye") return { accorde: false, jusquAu: courante.echeance_apres };

    const actuel = (d.data() as FirestoreDroits | undefined)?.pro ?? null;
    const mois = FORMULES[courante.formule].mois;
    const suite = nouvelleEcheance(actuel, jour, mois);
    const regle = { ...suivi, statut: "paye" as const, applique_le: FieldValue.serverTimestamp() };
    if (!suite) {
      // Un Pro sans échéance a été accordé entre le clic et le paiement : on
      // ne l'écrase pas. La ligne est payée, sans échéance : l'administration
      // la voit « payée sans effet » et rembourse à la main.
      tx.update(ref, { ...regle, echeance_avant: null, echeance_apres: null });
      return { accorde: false, jusquAu: null };
    }
    const accorde: DroitAccorde = {
      depuis: suite.depuis,
      jusqu_au: suite.jusqu_au,
      source: "paiement",
      accorde_par: null,
      motif: motifAchat(mois, environnement),
    };
    tx.set(droitsRef, { pro: accorde, updated_at: FieldValue.serverTimestamp() }, { merge: true });
    tx.update(ref, {
      ...regle,
      echeance_avant: actuel && droitActif(actuel, jour) ? actuel.jusqu_au : null,
      echeance_apres: suite.jusqu_au,
    });
    return { accorde: true, jusquAu: suite.jusqu_au };
  });

  if (resultat.accorde && resultat.jusquAu) await accuserReception(ligne, resultat.jusquAu, collecte.recuUrl);
  return vueEtat({ ...ligne, statut: "paye", echeance_apres: resultat.jusquAu });
}

/** La ligne d'une collecte FedaPay, pour un webhook qui n'aurait pas notre référence. */
export async function paiementParCollecte(idCollecte: number): Promise<string | null> {
  const snap = await paiements().where("fedapay_id", "==", idCollecte).limit(1).get();
  return snap.empty ? null : snap.docs[0].id;
}

/**
 * La tâche du matin : relire les paiements encore ouverts.
 *
 * Le webhook et le retour du client ont pu manquer tous les deux ; quelqu'un
 * qui a payé ne doit pas rester sans son Pro plus d'une nuit. Les lignes de
 * plus de 48 h sont relues une dernière fois puis fermées : FedaPay expire une
 * collecte en 24 h, et sans cela la liste des lignes ouvertes ne ferait que
 * grossir.
 */
export async function reverifierPaiementsOuverts(maintenantMs: number = Date.now()): Promise<{ revus: number; payes: number; fermes: number }> {
  if (!fedapayConfigure()) return { revus: 0, payes: 0, fermes: 0 };
  const snap = await paiements().where("statut", "in", STATUTS_OUVERTS).get();
  const lignes = snap.docs.map((d) => ({
    id: d.id,
    environnement: (d.data() as FirestorePaiement).environnement,
    creeMs: millis(d.get("created_at")),
  }));
  const { recentes, perimees } = trierLignesOuvertes(lignes, environnementFedapay(), maintenantMs);

  let payes = 0;
  let fermes = 0;
  const relire = async (id: string): Promise<EtatPaiement | null> => {
    try {
      const etat = await reglerPaiement(id);
      if (etat?.statut === "paye") payes += 1;
      return etat;
    } catch (err) {
      console.error("[paiements] revérification:", id, err);
      return null;
    }
  };

  for (const l of recentes) await relire(l.id);
  for (const l of perimees) {
    // On ne ferme que ce qu'on a réussi à relire : FedaPay en panne ce
    // matin-là ne doit pas enterrer un paiement abouti.
    const etat = await relire(l.id);
    if (!etat || etat.statut === "paye" || etat.aVerifier) continue;
    const ferme = await adminDb.runTransaction(async (tx) => {
      const s = await tx.get(paiements().doc(l.id));
      if (!s.exists || !STATUTS_OUVERTS.includes(s.get("statut") as StatutPaiement)) return false;
      tx.update(s.ref, { statut: "expire", updated_at: FieldValue.serverTimestamp() });
      return true;
    });
    if (ferme) fermes += 1;
  }
  return { revus: recentes.length + perimees.length, payes, fermes };
}

/**
 * La tâche du matin : prévenir que le Pro se termine, sept jours avant et la
 * veille.
 *
 * POUR TOUT PRO QUI A UNE ÉCHÉANCE, d'où qu'il vienne : celui à qui
 * l'administration l'a fait essayer est le premier à convaincre.
 *
 * SEULEMENT S'IL PEUT LE PROLONGER : en réel, et avec une formule en vente.
 * Un rappel sans bouton derrière n'apprend rien à personne.
 *
 * UNE FOIS PAR JOUR : `rappel_pro_le` marque le passage, pour qu'une tâche
 * rejouée ne sonne pas deux fois.
 */
export async function rappelerEcheancesPro(jour: string = jourDeLome()): Promise<number> {
  if (!fedapayConfigure() || environnementFedapay() !== "live") return 0;
  if (formulesEnVente(await lirePrixOffre()).length === 0) return 0;

  const { demain, dansSeptJours } = joursDeRappel(jour);
  const snap = await adminDb.collection("droits").where("pro.jusqu_au", "in", [demain, dansSeptJours]).get();
  let rappels = 0;
  for (const d of snap.docs) {
    const fin = (d.data() as FirestoreDroits).pro?.jusqu_au;
    if (!fin || d.get("rappel_pro_le") === jour) continue;
    await notifierCompte(d.id, {
      type: "offre",
      title: fin === demain ? "Ton Pro se termine demain" : "Ton Pro se termine dans 7 jours",
      body: `KoppaFoot Pro court jusqu'au ${dateLongue(fin)}. Tu peux le prolonger dès maintenant : la période s'ajoute à la fin.`,
      link: "/offre",
    });
    await d.ref.update({ rappel_pro_le: jour });
    rappels += 1;
  }
  return rappels;
}
```

- [ ] **Step 7: Les variables d'environnement**

Ajouter à la fin de `.env.example` :

```
# FedaPay (server-side only) — paiement mobile (lib/fedapay, lib/paiement-serveur).
# Sans clé secrète, rien n'est en vente. FEDAPAY_ENV=live en production
# seulement ; toute autre valeur vaut bac à sable, où seul un superadmin peut
# acheter (le poste de dev et les aperçus écrivent dans la base de production).
# Le secret du webhook est celui de l'endpoint créé dans le tableau de bord
# FedaPay : un par endpoint, différent en test et en réel.
FEDAPAY_SECRET_KEY=
FEDAPAY_WEBHOOK_SECRET=
FEDAPAY_ENV=sandbox
```

- [ ] **Step 8: Vérifier**

Run: `npx tsc --noEmit`
Expected: aucune erreur. (Si `TYPE_META` ou `categorieDuType` se plaint d'un cas manquant, c'est que l'étape 4 est incomplète.)

Run: `(cd mobile && npx jest src/__tests__/paiement.test.ts src/__tests__/notifications.test.ts)`
Expected: PASS (la suite des notifications lit `NotificationType` et les règles : elle doit rester verte).

Run: `npx eslint src/lib/paiement-serveur.ts src/lib/fedapay.ts src/lib/paiement.ts`
Expected: aucune erreur.

- [ ] **Step 9: Commit**

```bash
git add src/lib/paiement-serveur.ts src/types/index.ts src/lib/push-categories.ts "src/app/(app)/notifications/page.tsx" src/lib/email.ts firestore.rules .env.example mobile/src/__tests__/paiement.test.ts
git commit -m "feat(paiement): démarrer un achat et le régler, côté serveur

reglerPaiement est la seule fonction qui accorde le Pro : elle relit la
collecte chez FedaPay, vérifie référence et montant, puis écrit le droit
et l'état payé dans la même transaction. En bac à sable, seul un
superadmin peut acheter : le dev et les aperçus écrivent dans la base de
production.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Les trois routes

**Files:**
- Create: `src/app/api/paiements/route.ts`, `src/app/api/paiements/[id]/route.ts`, `src/app/api/webhooks/fedapay/route.ts`, `scripts/webhook-fedapay.ts`

**Interfaces:**
- Consumes: `uidAppelant(req: Request): Promise<string | null>` de `@/lib/appelant` ; `demarrerPaiement`, `ErreurPaiement`, `RefusPaiement`, `reglerPaiement`, `vueEtat`, `paiementParCollecte` de `@/lib/paiement-serveur` ; `signatureValide`, `cibleDeLEvenement` de `@/lib/fedapay` ; `ID_PAIEMENT`, `FirestorePaiement` de `@/lib/paiement`.
- Produces:
  - `POST /api/paiements` — corps `{ formule }`, jeton `Bearer`. 200 `{ id, url }`. Refus : `{ error, code }` avec 400 (`formule`), 403 (`bac_a_sable`), 409 (`pas_en_vente`, `deja_illimite`), 429 (`trop_de_tentatives`), 502 (`fedapay`), 503 (`non_configure`) ; 401 sans jeton.
  - `GET /api/paiements/{id}` — jeton `Bearer`. 200 `EtatPaiement` (`{ statut, formule, montant, jusquAu, aVerifier }`) ; 404 pour tout autre que le titulaire.
  - `POST /api/webhooks/fedapay` — 200 `{ ok: true, … }` ; 400 signature invalide ; 500 relecture impossible ; 503 secret absent.

- [ ] **Step 1: Lire le guide des routes de cette version de Next**

Run: lire `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` en entier.
À vérifier : la signature des méthodes exportées, `params` en promesse, la lecture du corps brut par `await request.text()`.

- [ ] **Step 2: Démarrer un achat**

Créer `src/app/api/paiements/route.ts` :

```ts
import { NextResponse } from "next/server";
import { uidAppelant } from "@/lib/appelant";
import { ErreurPaiement, demarrerPaiement, type RefusPaiement } from "@/lib/paiement-serveur";

/**
 * POST /api/paiements { formule }, démarrer l'achat du Pro.
 *
 * Rend l'adresse de la page de paiement FedaPay ; le navigateur y va. Le corps
 * ne porte que le nom de la formule : le montant est lu par le serveur dans
 * `settings/offre`, jamais reçu du navigateur.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const STATUT: Record<RefusPaiement, number> = {
  formule: 400,
  bac_a_sable: 403,
  pas_en_vente: 409,
  deja_illimite: 409,
  trop_de_tentatives: 429,
  fedapay: 502,
  non_configure: 503,
};

export async function POST(req: Request) {
  const uid = await uidAppelant(req);
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    const { formule } = (await req.json().catch(() => ({}))) as { formule?: unknown };
    return NextResponse.json(await demarrerPaiement(uid, formule, new URL(req.url).origin));
  } catch (err) {
    if (err instanceof ErreurPaiement) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: STATUT[err.code] });
    }
    console.error("POST /api/paiements:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Vérifier au retour**

Créer `src/app/api/paiements/[id]/route.ts` :

```ts
import { NextResponse } from "next/server";
import { uidAppelant } from "@/lib/appelant";
import { adminDb } from "@/lib/firebase-admin";
import { ID_PAIEMENT, type FirestorePaiement } from "@/lib/paiement";
import { reglerPaiement, vueEtat } from "@/lib/paiement-serveur";

/**
 * GET /api/paiements/{id}, où en est ce paiement ?
 *
 * C'est la vérification au retour du client : la page « Mon offre » l'appelle
 * avec l'identifiant lu dans l'adresse. Elle ne lit pas le `status` que
 * FedaPay y a mis (il ne prouve rien) : elle relit la collecte, et règle le
 * paiement s'il est abouti. Le webhook fait la même chose de son côté ; le
 * premier arrivé accorde, le second ne change rien.
 *
 * 404 pour tout autre que le titulaire : on ne dit même pas que la ligne existe.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const uid = await uidAppelant(req);
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  const introuvable = () => NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
  if (!ID_PAIEMENT.test(id)) return introuvable();

  try {
    const snap = await adminDb.collection("paiements").doc(id).get();
    const ligne = snap.data() as FirestorePaiement | undefined;
    if (!ligne || ligne.uid !== uid) return introuvable();
    try {
      return NextResponse.json((await reglerPaiement(id)) ?? vueEtat(ligne));
    } catch (err) {
      // FedaPay ne répond pas : on dit ce qu'on sait, la page redemandera.
      console.error("GET /api/paiements/[id], relecture:", id, err);
      return NextResponse.json(vueEtat(ligne));
    }
  } catch (err) {
    console.error("GET /api/paiements/[id]:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Le webhook**

Créer `src/app/api/webhooks/fedapay/route.ts` :

```ts
import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { cibleDeLEvenement, signatureValide } from "@/lib/fedapay";
import { paiementParCollecte, reglerPaiement } from "@/lib/paiement-serveur";

/**
 * POST /api/webhooks/fedapay, ce que FedaPay nous annonce.
 *
 * LA SIGNATURE D'ABORD, sur le corps BRUT : `req.text()`, jamais `req.json()`,
 * qui rendrait un objet dont la réécriture ne serait plus celle qui a été
 * signée.
 *
 * ON N'APPLIQUE PAS CE QUE L'ÉVÉNEMENT DIT. On y lit seulement de quelle
 * collecte il parle ; `reglerPaiement` la relit chez FedaPay et décide. Un
 * événement rejoué, en retard, ou arrivé dans le désordre ne peut donc rien
 * fausser.
 *
 * CE QUI NE NOUS CONCERNE PAS REÇOIT 200. FedaPay désactive un webhook après
 * dix échecs : un événement d'un autre type, ou d'une collecte qu'on ne
 * connaît pas, n'est pas une erreur. Seule une vraie panne (FedaPay ou
 * Firestore injoignable pendant la relecture) répond 500, pour qu'il réessaie.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  const secret = process.env.FEDAPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook non configuré" }, { status: 503 });

  const corps = await req.text();
  const hmac = (message: string) => createHmac("sha256", secret).update(message, "utf8").digest("hex");
  if (!signatureValide(corps, req.headers.get("x-fedapay-signature"), hmac)) {
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  let evenement: unknown;
  try {
    evenement = JSON.parse(corps);
  } catch {
    return NextResponse.json({ ok: true, ignore: "corps illisible" });
  }
  const cible = cibleDeLEvenement(evenement);
  if (!cible) return NextResponse.json({ ok: true, ignore: "hors sujet" });

  try {
    const id = cible.reference ?? (cible.idCollecte !== null ? await paiementParCollecte(cible.idCollecte) : null);
    const etat = id ? await reglerPaiement(id) : null;
    if (!etat) return NextResponse.json({ ok: true, ignore: "paiement inconnu" });
    return NextResponse.json({ ok: true, statut: etat.statut });
  } catch (err) {
    console.error("[webhooks/fedapay]", cible, err);
    return NextResponse.json({ error: "Relecture impossible" }, { status: 500 });
  }
}
```

- [ ] **Step 5: L'outil pour jouer un webhook en local**

FedaPay ne joint pas `localhost` : cet outil envoie à sa place un événement signé avec le secret de `.env.local`. Il ne peut rien accorder par lui-même, la route relisant toujours la collecte chez FedaPay.

Créer `scripts/webhook-fedapay.ts` :

```ts
/**
 * KOPPAFOOT — Jouer un webhook FedaPay contre une adresse locale (outil de dev).
 *
 * FedaPay ne joint pas localhost. Ce script envoie à sa place un événement
 * signé avec FEDAPAY_WEBHOOK_SECRET (.env.local), pour exercer la route
 * /api/webhooks/fedapay : signature, relecture de la collecte, octroi unique.
 * Il ne peut rien accorder par lui-même : la route ne croit pas l'événement,
 * elle relit la collecte chez FedaPay.
 *
 * Usage: npx tsx scripts/webhook-fedapay.ts <idPaiement> [origine] [evenement]
 *        origine   : http://localhost:3000 par défaut
 *        evenement : transaction.approved par défaut
 */
import { createHmac } from "node:crypto";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

const [id, origine = "http://localhost:3000", nom = "transaction.approved"] = process.argv.slice(2);
const secret = process.env.FEDAPAY_WEBHOOK_SECRET;

if (!id) {
  console.error("Usage: npx tsx scripts/webhook-fedapay.ts <idPaiement> [origine] [evenement]");
  process.exit(1);
}
if (!secret) {
  console.error("FEDAPAY_WEBHOOK_SECRET est absent de .env.local");
  process.exit(1);
}

async function main() {
  const corps = JSON.stringify({ name: nom, entity: { merchant_reference: id } });
  const t = Math.floor(Date.now() / 1000);
  const s = createHmac("sha256", secret as string).update(`${t}.${corps}`, "utf8").digest("hex");
  const res = await fetch(`${origine}/api/webhooks/fedapay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-FEDAPAY-SIGNATURE": `t=${t},s=${s}` },
    body: corps,
  });
  console.log(res.status, await res.text());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 6: Vérifier les types et le style**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

Run: `npx eslint src/app/api/paiements src/app/api/webhooks scripts/webhook-fedapay.ts`
Expected: aucune erreur.

- [ ] **Step 7: Vérifier les routes sur le serveur de dev**

Démarrer le serveur par `preview_start` avec `{ name: "koppafoot-dev" }` (jamais `npm run dev` en Bash). Noter le port annoncé (3000 s'il est libre), puis :

Run: `curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/paiements -H "Content-Type: application/json" -d '{"formule":"pro_mois"}'`
Expected: `401`

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/paiements/AbCdEfGhIjKlMnOpQrSt`
Expected: `401`

Run: `curl -s -w "\n%{http_code}\n" -X POST http://localhost:3000/api/webhooks/fedapay -H "Content-Type: application/json" -d '{"name":"transaction.approved"}'`
Expected : `503` et `Webhook non configuré` si `FEDAPAY_WEBHOOK_SECRET` est absent de `.env.local` ; sinon `400` et `Signature invalide`.

Si le secret est présent dans `.env.local` :

Run: `npx tsx scripts/webhook-fedapay.ts AbCdEfGhIjKlMnOpQrSt`
Expected: `200 {"ok":true,"ignore":"paiement inconnu"}` (signature acceptée, ligne inexistante, rien d'écrit).

Si une route répond 404 alors que son fichier existe : manifeste Turbopack périmé. Arrêter le serveur, supprimer `.next`, relancer.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/paiements src/app/api/webhooks scripts/webhook-fedapay.ts
git commit -m "feat(paiement): routes d'achat, de vérification au retour et webhook FedaPay

Le webhook vérifie la signature sur le corps brut, puis ne lit dans
l'événement que de quoi retrouver la ligne : l'état se relit toujours
chez FedaPay. Ce qui ne nous concerne pas reçoit 200, pour que FedaPay
ne désactive pas l'endpoint.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: « Mon offre » vend le Pro

**Files:**
- Modify: `src/app/api/offre/route.ts`
- Modify: `src/app/(app)/offre/page.tsx`

**Interfaces:**
- Consumes: `formulesPour(profil)` de `@/lib/paiement-serveur` ; `idPaiementDuRetour`, `FormuleEnVente`, `IdFormule`, `StatutPaiement` de `@/lib/paiement` ; `POST /api/paiements`, `GET /api/paiements/{id}` (tâche 4).
- Produces: `GET /api/offre` renvoie en plus `formules: FormuleEnVente[]` (celles que l'appelant peut acheter) et `proIllimite: boolean`.

- [ ] **Step 1: La route dit ce qui est en vente**

Dans `src/app/api/offre/route.ts`, ajouter l'import :

```ts
import { formulesPour } from "@/lib/paiement-serveur";
```

Remplacer le paragraphe de l'en-tête qui commence par « Les casquettes disent » par :

```ts
 * Les casquettes disent quelles lignes concernent la personne : un joueur qui
 * ne gère rien n'a pas à lire un compteur de terrains.
 *
 * `formules` : ce que CE compte peut acheter, avec le prix. Vide tant que rien
 * n'est en vente — et, en bac à sable, pour tout autre qu'un superadmin.
```

Et remplacer le `return NextResponse.json({ … })` par :

```ts
    const pro = estPro(droits, jour);
    return NextResponse.json({
      jour,
      estPro: pro,
      estSansPub: estSansPub(droits, jour),
      pro: vue(droits?.pro, jour),
      sansPub: vue(droits?.sans_pub, jour),
      limitesDepuis,
      limitesActives: limitesEnVigueur(limitesDepuis, jour),
      limites: LIMITES_GRATUIT,
      usage,
      casquettes: {
        manager: profil.user_type === "manager" || usage.equipes > 0,
        organisateur: profil.is_organizer === true,
        gerant: profil.is_venue_owner === true,
      },
      formules: await formulesPour(profil),
      // Un Pro sans échéance n'a rien à prolonger : la page ne lui vend rien.
      proIllimite: pro && droits?.pro?.jusqu_au === null,
    });
```

- [ ] **Step 2: La page**

Remplacer tout le contenu de `src/app/(app)/offre/page.tsx` par :

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { motion } from "motion/react";
import { Check, Gem, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale, useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import type { CleLimite } from "@/lib/offre";
import { idPaiementDuRetour, type FormuleEnVente, type IdFormule, type StatutPaiement } from "@/lib/paiement";

// ============================================
// Mon offre.
//
// Ce que la personne a (gratuit, ou Pro jusqu'à telle date), ce que l'offre
// gratuite compte chez ELLE (seulement les lignes qui la concernent : un
// joueur qui ne gère rien ne lit pas de compteur), et ce qui reste gratuit
// pour tout le monde. La date d'entrée en vigueur des limites est dite ici
// avant d'arriver : c'est la promesse des conditions d'utilisation.
//
// LE PRO S'ACHÈTE ICI, quand il est en vente : une formule, un prix, un bouton
// qui mène à la page de paiement FedaPay. Tant qu'aucune formule n'a de prix,
// la page dit « écris-nous », comme avant.
//
// AU RETOUR DU PAIEMENT, LA PAGE NE CROIT PAS L'ADRESSE. FedaPay y écrit un
// `status` qui ne prouve rien ; on n'y lit que l'identifiant de notre
// paiement, et c'est le serveur qui dit où il en est (lib/paiement-serveur).
// ============================================

interface VueDroit {
  actif: boolean;
  jusquAu: string | null;
}

interface Offre {
  jour: string;
  estPro: boolean;
  estSansPub: boolean;
  pro: VueDroit | null;
  sansPub: VueDroit | null;
  limitesDepuis: string | null;
  limitesActives: boolean;
  limites: Record<CleLimite, number>;
  usage: Record<"equipes" | "terrains" | "competitions", number>;
  casquettes: { manager: boolean; organisateur: boolean; gerant: boolean };
  formules: FormuleEnVente[];
  proIllimite: boolean;
}

/** Où en est le paiement dont on revient. `aucun` : l'identifiant ne nous dit rien. */
type Retour =
  | { etat: "recu"; jusquAu: string | null }
  | { etat: "echec" | "lent" | "verifier" | "aucun" };

/** Dix fois, toutes les trois secondes : le temps que la confirmation de l'opérateur arrive. */
const ESSAIS_RETOUR = 10;
const PAUSE_RETOUR_MS = 3000;

const T = textes(
  {
    titre: "Mon offre",
    sousTitre: "Jouer, suivre un match, s'inscrire à une compétition, arbitrer : c'est gratuit et ça le reste.",
    gratuit: "Offre gratuite",
    pro: "KoppaFoot Pro",
    jusquAu: (date: string) => `jusqu'au ${date}`,
    sansEcheance: "sans échéance",
    proActif: "Aucune limite ne s'applique à ce que tu crées.",
    sansPubSeul: (fin: string) => `Option sans pub, ${fin}.`,
    pasEncore: "Les limites de l'offre gratuite ne s'appliquent pas encore. Tu seras prévenu avant.",
    aPartirDu: (date: string) => `À partir du ${date}, l'offre gratuite comptera ce qui suit.`,
    depuis: (date: string) => `En vigueur depuis le ${date}.`,
    garde: "Ce que tu as déjà créé reste à toi, même au-delà : une limite empêche seulement de créer plus.",
    chezToi: "Chez toi",
    equipes: "Équipes que tu gères",
    terrains: "Terrains référencés",
    competitions: "Compétitions en cours",
    competitionsDetail: "brouillons compris",
    tailleComp: "Équipes par compétition",
    illimite: "illimité",
    rienAGerer: "Tu ne gères ni équipe, ni terrain, ni compétition : rien ne te limite.",
    proDebloque: "Ce que le Pro débloque",
    avantage1: "Équipes illimitées, pour les managers et les clubs",
    avantage2: "Compétitions en cours illimitées, et plus de 16 équipes par compétition",
    avantage3: "Terrains illimités, pour les gérants",
    avantage4: "Aucune publicité",
    avantage5: "Club multi-équipes : réunis tes équipes sous un même club, avec sa page et son encadrement",
    gererClub: "Gérer mon Club multi-équipes",
    pasEnVente: "Le Pro n'est pas encore en vente. Pour l'essayer avec ton équipe, ta compétition ou ton terrain, écris-nous.",
    ecrire: "Nous écrire",
    erreur: "Impossible de charger ton offre.",
    prolonger: "Prolonger mon Pro",
    prolongerDetail: "La période achetée s'ajoute à la fin de celle en cours.",
    unMois: "1 mois",
    unAn: "1 an",
    parMois: (montant: string) => `soit ${montant} FCFA par mois`,
    payer: "Payer",
    redirection: "Redirection…",
    moyens: "Mobile money ou carte, sur la page de paiement sécurisée de FedaPay. Tu achètes une période : rien ne se renouvelle tout seul.",
    retourAttente: "Paiement en cours de confirmation…",
    retourRecu: (date: string) => `Paiement reçu. Tu es Pro jusqu'au ${date}.`,
    retourRecuSimple: "Paiement reçu.",
    retourEchec: "Le paiement n'a pas abouti. Tu peux réessayer.",
    retourLent: "La confirmation tarde. Ton Pro s'activera tout seul dès qu'elle arrive : tu peux fermer cette page.",
    retourVerifier: "Ce paiement demande une vérification de notre part. Écris-nous, on règle ça.",
    refusPasEnVente: "Le Pro n'est pas en vente pour l'instant.",
    refusIllimite: "Ton Pro n'a pas d'échéance : il n'y a rien à prolonger.",
    refusTentatives: "Trop de tentatives. Réessaie dans une heure.",
    refusIndisponible: "Paiement indisponible pour l'instant. Réessaie dans un moment.",
  },
  {
    titre: "My plan",
    sousTitre: "Playing, following a match, entering a competition, refereeing: it's free and it stays free.",
    gratuit: "Free plan",
    pro: "KoppaFoot Pro",
    jusquAu: (date: string) => `until ${date}`,
    sansEcheance: "no end date",
    proActif: "No limit applies to what you create.",
    sansPubSeul: (fin: string) => `Ad-free option, ${fin}.`,
    pasEncore: "The free plan's limits don't apply yet. You'll be told beforehand.",
    aPartirDu: (date: string) => `From ${date}, the free plan will count the following.`,
    depuis: (date: string) => `In force since ${date}.`,
    garde: "What you've already created stays yours, even beyond: a limit only stops you creating more.",
    chezToi: "Your usage",
    equipes: "Teams you manage",
    terrains: "Listed venues",
    competitions: "Running competitions",
    competitionsDetail: "drafts included",
    tailleComp: "Teams per competition",
    illimite: "unlimited",
    rienAGerer: "You don't manage a team, a venue or a competition: nothing limits you.",
    proDebloque: "What Pro unlocks",
    avantage1: "Unlimited teams, for managers and clubs",
    avantage2: "Unlimited running competitions, and more than 16 teams per competition",
    avantage3: "Unlimited venues, for venue owners",
    avantage4: "No ads",
    avantage5: "Multi-team club: bring your teams together under one club, with its page and staff",
    gererClub: "Manage my multi-team club",
    pasEnVente: "Pro isn't on sale yet. To try it with your team, competition or venue, write to us.",
    ecrire: "Write to us",
    erreur: "Couldn't load your plan.",
    prolonger: "Extend my Pro",
    prolongerDetail: "The period you buy is added to the end of the current one.",
    unMois: "1 month",
    unAn: "1 year",
    parMois: (montant: string) => `that's ${montant} FCFA a month`,
    payer: "Pay",
    redirection: "Redirecting…",
    moyens: "Mobile money or card, on FedaPay's secure payment page. You buy a period: nothing renews by itself.",
    retourAttente: "Confirming your payment…",
    retourRecu: (date: string) => `Payment received. You're Pro until ${date}.`,
    retourRecuSimple: "Payment received.",
    retourEchec: "The payment didn't go through. You can try again.",
    retourLent: "Confirmation is taking a while. Pro will switch on by itself when it arrives: you can close this page.",
    retourVerifier: "This payment needs a check on our side. Write to us and we'll sort it out.",
    refusPasEnVente: "Pro isn't on sale right now.",
    refusIllimite: "Your Pro has no end date: there's nothing to extend.",
    refusTentatives: "Too many attempts. Try again in an hour.",
    refusIndisponible: "Payment is unavailable right now. Try again in a moment.",
  },
);

function Jauge({ libelle, detail, usage, max, illimite }: {
  libelle: string; detail?: string; usage: number; max: number; illimite: string | null;
}) {
  const plein = !illimite && usage >= max;
  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-gray-800">
          {libelle}
          {detail && <span className="ml-1 text-xs font-normal text-gray-400">({detail})</span>}
        </span>
        <span className={`shrink-0 whitespace-nowrap font-display text-lg font-black tabular-nums ${plein ? "text-amber-600" : "text-gray-900"}`}>
          {usage}
          <span className="text-sm font-bold text-gray-400"> / {illimite ?? max}</span>
        </span>
      </div>
      {!illimite && (
        <div className="mt-2 h-1.5 bg-gray-100">
          <div className={`h-full ${plein ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, (usage / max) * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

/** Les formules en vente, côte à côte : la durée, le prix, le bouton. */
function Formules({ formules, enCours, onPayer, locale, libelles }: {
  formules: FormuleEnVente[];
  enCours: IdFormule | null;
  onPayer: (formule: IdFormule) => void;
  locale: string;
  libelles: { unMois: string; unAn: string; parMois: (montant: string) => string; payer: string; redirection: string; moyens: string };
}) {
  return (
    <>
      <div className={`grid gap-px border border-gray-200/70 bg-gray-200/70 ${formules.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {formules.map((f) => (
          <div key={f.id} className="flex flex-col gap-3 bg-white p-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
                {f.mois === 12 ? libelles.unAn : libelles.unMois}
              </p>
              <p className="mt-1 font-display text-2xl font-black tabular-nums text-gray-900">
                {f.prix.toLocaleString(locale)}
                <span className="ml-1 text-sm font-bold text-gray-400">FCFA</span>
              </p>
              {f.mois > 1 && (
                <p className="mt-0.5 text-xs text-gray-500">{libelles.parMois(Math.round(f.prix / f.mois).toLocaleString(locale))}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onPayer(f.id)}
              disabled={enCours !== null}
              className="mt-auto inline-flex items-center justify-center gap-2 border border-gray-900 bg-gray-900 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {enCours === f.id && <Loader2 size={14} className="animate-spin" />}
              {enCours === f.id ? libelles.redirection : libelles.payer}
            </button>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-500">{libelles.moyens}</p>
    </>
  );
}

export default function OffrePage() {
  const t = useTextes(T);
  const locale = useLocale();
  const { firebaseUser } = useAuth();
  const [offre, setOffre] = useState<Offre | null>(null);
  const [erreur, setErreur] = useState(false);
  const [achat, setAchat] = useState<IdFormule | null>(null);
  // Lu une fois, au premier rendu dans le navigateur : le paiement dont on
  // revient. Tant que l'offre charge, la page n'affiche que son squelette,
  // côté serveur comme côté navigateur : les deux rendus restent identiques.
  const [idRetour] = useState(() =>
    typeof window === "undefined" ? null : idPaiementDuRetour(new URLSearchParams(window.location.search).get("paiement")));
  const [retour, setRetour] = useState<Retour | null>(null);

  const charger = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const r = await fetch("/api/offre", { headers: { Authorization: `Bearer ${await firebaseUser.getIdToken()}` } });
      if (!r.ok) throw new Error(String(r.status));
      setOffre((await r.json()) as Offre);
    } catch {
      setErreur(true);
    }
  }, [firebaseUser]);

  useEffect(() => { void charger(); }, [charger]);

  useEffect(() => {
    if (!firebaseUser || !idRetour) return;
    let vivant = true;
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    let essais = 0;
    // L'adresse garde « ?paiement=… » : on l'enlève, pour qu'un rechargement
    // ne rejoue pas l'attente d'un paiement déjà réglé.
    window.history.replaceState(null, "", window.location.pathname);

    const verifier = async () => {
      essais += 1;
      let etat: { statut?: StatutPaiement; jusquAu?: string | null; aVerifier?: boolean } | null = null;
      let inconnu = false;
      try {
        const r = await fetch(`/api/paiements/${idRetour}`, { headers: { Authorization: `Bearer ${await firebaseUser.getIdToken()}` } });
        inconnu = r.status === 404;
        etat = r.ok ? await r.json() : null;
      } catch {
        etat = null;
      }
      if (!vivant) return;
      if (inconnu) return setRetour({ etat: "aucun" });
      if (etat?.aVerifier) return setRetour({ etat: "verifier" });
      if (etat?.statut === "paye") {
        setRetour({ etat: "recu", jusquAu: etat.jusquAu ?? null });
        void charger();
        return;
      }
      if (etat?.statut === "echoue" || etat?.statut === "annule" || etat?.statut === "expire") return setRetour({ etat: "echec" });
      if (essais >= ESSAIS_RETOUR) return setRetour({ etat: "lent" });
      minuterie = setTimeout(() => void verifier(), PAUSE_RETOUR_MS);
    };
    void verifier();
    return () => { vivant = false; clearTimeout(minuterie); };
  }, [firebaseUser, idRetour, charger]);

  // Revenu de la page de paiement par le bouton « retour » du navigateur : la
  // page ressort du cache telle qu'on l'a quittée, bouton grisé sur
  // « Redirection… ». On le rend.
  useEffect(() => {
    const revenir = (e: PageTransitionEvent) => { if (e.persisted) setAchat(null); };
    window.addEventListener("pageshow", revenir);
    return () => window.removeEventListener("pageshow", revenir);
  }, []);

  const date = (jour: string) =>
    new Date(`${jour}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  const fin = (d: VueDroit | null) => (d?.jusquAu ? t.jusquAu(date(d.jusquAu)) : t.sansEcheance);

  const refus = (code: string): string =>
    code === "deja_illimite" ? t.refusIllimite
      : code === "trop_de_tentatives" ? t.refusTentatives
        : code === "fedapay" || code === "" ? t.refusIndisponible
          : t.refusPasEnVente;

  const payer = async (formule: IdFormule) => {
    if (!firebaseUser || achat) return;
    setAchat(formule);
    try {
      const r = await fetch("/api/paiements", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await firebaseUser.getIdToken()}` },
        body: JSON.stringify({ formule }),
      });
      const d = (await r.json().catch(() => ({}))) as { url?: string; code?: string };
      if (!r.ok || typeof d.url !== "string") throw new Error(d.code ?? "");
      // On quitte la page : le bouton reste sur « Redirection… » jusque-là.
      window.location.assign(d.url);
    } catch (e) {
      toast.error(refus(e instanceof Error ? e.message : ""));
      setAchat(null);
    }
  };

  if (erreur) return <p className="mx-auto max-w-2xl py-16 text-center text-sm text-gray-500">{t.erreur}</p>;
  if (!offre) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 py-6">
        {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse bg-gray-100" />)}
      </div>
    );
  }

  const illimite = offre.estPro ? t.illimite : null;
  const { casquettes: c } = offre;
  const enVente = offre.formules.length > 0 && !offre.proIllimite;
  const libellesFormules = {
    unMois: t.unMois, unAn: t.unAn, parMois: t.parMois, payer: t.payer, redirection: t.redirection, moyens: t.moyens,
  };
  const etatRetour = retour?.etat ?? (idRetour ? "attente" : "aucun");
  const lignes = [
    c.manager && <Jauge key="e" libelle={t.equipes} usage={offre.usage.equipes} max={offre.limites.equipes} illimite={illimite} />,
    c.gerant && <Jauge key="t" libelle={t.terrains} usage={offre.usage.terrains} max={offre.limites.terrains} illimite={illimite} />,
    c.organisateur && (
      <Jauge key="c" libelle={t.competitions} detail={t.competitionsDetail} usage={offre.usage.competitions}
        max={offre.limites.competitions} illimite={illimite} />
    ),
    c.organisateur && (
      <div key="taille" className="flex items-baseline justify-between gap-3 px-4 py-3">
        <span className="text-sm font-semibold text-gray-800">{t.tailleComp}</span>
        <span className="font-display text-lg font-black tabular-nums text-gray-900">
          {illimite ?? offre.limites.equipesParCompetition}
        </span>
      </div>
    ),
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24">
      <div>
        <motion.h1
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="font-display text-2xl font-extrabold text-gray-900 sm:text-3xl"
        >
          {t.titre}
        </motion.h1>
        <p className="mt-1 text-sm text-gray-500">{t.sousTitre}</p>
      </div>

      {etatRetour !== "aucun" && (
        <p
          role="status"
          className={`flex items-center gap-2 border px-4 py-3 text-sm font-semibold ${
            etatRetour === "recu" ? "border-emerald-600 bg-emerald-50 text-emerald-900"
              : etatRetour === "echec" || etatRetour === "verifier" ? "border-amber-500 bg-amber-50 text-amber-900"
                : "border-gray-200/70 bg-white text-gray-700"
          }`}
        >
          {etatRetour === "attente" && <Loader2 size={16} className="shrink-0 animate-spin" />}
          {etatRetour === "recu" && <Check size={16} className="shrink-0" />}
          {etatRetour === "attente" && t.retourAttente}
          {retour?.etat === "recu" && (retour.jusquAu ? t.retourRecu(date(retour.jusquAu)) : t.retourRecuSimple)}
          {etatRetour === "echec" && t.retourEchec}
          {etatRetour === "lent" && t.retourLent}
          {etatRetour === "verifier" && t.retourVerifier}
        </p>
      )}

      <section className={`border p-5 ${offre.estPro ? "border-emerald-600 bg-emerald-950 text-white" : "border-gray-200/70 bg-white"}`}>
        <p className="flex items-center gap-2">
          {offre.estPro && <Gem size={18} className="shrink-0 text-emerald-400" />}
          <span className="font-display text-xl font-black uppercase tracking-tight">
            {offre.estPro ? t.pro : t.gratuit}
          </span>
        </p>
        {offre.estPro && (
          <>
            <p className="mt-0.5 text-xs font-bold uppercase tracking-[0.14em] text-emerald-300">{fin(offre.pro)}</p>
            <p className="mt-2 text-sm text-emerald-100">{t.proActif}</p>
            <Link href="/mon-club" className="mt-3 inline-flex text-xs font-black uppercase tracking-[0.12em] text-emerald-300 hover:text-white">
              {t.gererClub} →
            </Link>
          </>
        )}
        {!offre.estPro && offre.estSansPub && <p className="mt-1 text-sm text-gray-600">{t.sansPubSeul(fin(offre.sansPub))}</p>}
      </section>

      {offre.estPro && enVente && (
        <section>
          <h2 className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">{t.prolonger}</h2>
          <p className="mb-3 text-sm text-gray-600">{t.prolongerDetail}</p>
          <Formules formules={offre.formules} enCours={achat} onPayer={(f) => void payer(f)} locale={locale} libelles={libellesFormules} />
        </section>
      )}

      <section>
        <h2 className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">{t.chezToi}</h2>
        <div className="border border-gray-200/70 bg-white">
          <p className="border-b border-gray-200/70 px-4 py-3 text-sm text-gray-600">
            {offre.limitesActives
              ? t.depuis(date(offre.limitesDepuis!))
              : offre.limitesDepuis ? t.aPartirDu(date(offre.limitesDepuis)) : t.pasEncore}
            {" "}{t.garde}
          </p>
          {lignes.length
            ? <div className="divide-y divide-gray-200/70">{lignes}</div>
            : <p className="px-4 py-3 text-sm text-gray-500">{t.rienAGerer}</p>}
        </div>
      </section>

      {!offre.estPro && (
        <section>
          <h2 className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">{t.proDebloque}</h2>
          <div className="border border-gray-200/70 bg-white p-4">
            <ul className="space-y-2">
              {[t.avantage5, t.avantage1, t.avantage2, t.avantage3, t.avantage4].map((a) => (
                <li key={a} className="flex items-start gap-2 text-sm text-gray-700">
                  <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                  {a}
                </li>
              ))}
            </ul>
            {enVente ? (
              <div className="mt-4">
                <Formules formules={offre.formules} enCours={achat} onPayer={(f) => void payer(f)} locale={locale} libelles={libellesFormules} />
              </div>
            ) : (
              <>
                <p className="mt-4 text-sm text-gray-500">{t.pasEnVente}</p>
                <Link
                  href="/aide"
                  className="mt-3 inline-flex items-center border border-gray-900 bg-gray-900 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-gray-700"
                >
                  {t.ecrire}
                </Link>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Vérifier types et style**

Run: `npx tsc --noEmit`
Expected: aucune erreur. (`useLocale()` rend un `string` ; le conteneur de `react-hot-toast` est monté dans `src/app/layout.tsx`, les messages d'erreur du bouton s'afficheront donc.)

Run: `npx eslint "src/app/(app)/offre/page.tsx" src/app/api/offre/route.ts`
Expected: aucune erreur.

- [ ] **Step 4: Vérifier que rien ne change tant que rien n'est en vente**

Sur le serveur de dev (`preview_start`), sans clé FedaPay ou sans prix :

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/offre`
Expected: `401` (la route exige toujours un jeton).

Ouvrir `http://localhost:3000/offre` dans le volet navigateur, puis `read_console_messages` avec `onlyErrors: true`.
Expected: aucune erreur de rendu ni d'hydratation. Sans session, la page demande la connexion, comme avant ce changement.

Le parcours connecté (formules affichées, bouton, retour) se vérifie à la tâche 9, avec les clés de test.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/offre/route.ts "src/app/(app)/offre/page.tsx"
git commit -m "feat(offre): acheter et prolonger KoppaFoot Pro depuis Mon offre

Les formules en vente s'affichent avec leur prix ; le bouton mène à la
page de paiement FedaPay. Au retour, la page demande au serveur où en
est le paiement : le status de l'adresse ne prouve rien. Sans formule en
vente, la page est celle d'avant.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: L'administration fixe les prix et voit les paiements

**Files:**
- Modify: `src/app/api/admin/offre/route.ts`
- Create: `src/app/api/admin/paiements/route.ts`
- Modify: `src/app/(admin)/admin/offre/page.tsx`

**Interfaces:**
- Consumes: `exigerSuperadmin(req)` de `@/lib/admin-api-auth` ; `ID_FORMULES`, `ID_PAIEMENT`, `PRIX_PLANCHER`, `lirePrix`, `prixValide`, `FirestorePaiement`, `IdFormule`, `PrixOffre`, `StatutPaiement` de `@/lib/paiement` ; `environnementFedapay`, `fedapayConfigure`, `ErreurFedapay` de `@/lib/fedapay` ; `reglerPaiement` de `@/lib/paiement-serveur`.
- Produces:
  - `GET /api/admin/offre` renvoie en plus `prix: PrixOffre` et `fedapay: { configure: boolean; environnement: "sandbox" | "live" }`.
  - `PUT /api/admin/offre` accepte `{ limitesDepuis }`, `{ prix: { pro_mois, pro_an } }`, ou les deux ; 400 si aucun des deux.
  - `GET /api/admin/paiements` → `{ paiements: VuePaiement[] }` (100 derniers) ; `POST /api/admin/paiements { id }` → `{ ok: true, statut, … }`, 404 ligne inconnue, 502 FedaPay injoignable.

- [ ] **Step 1: La route de l'offre lit et écrit les prix**

Dans `src/app/api/admin/offre/route.ts` :

Ajouter aux imports :

```ts
import { environnementFedapay, fedapayConfigure } from "@/lib/fedapay";
import { ID_FORMULES, PRIX_PLANCHER, lirePrix, prixValide } from "@/lib/paiement";
```

Remplacer le commentaire d'en-tête par :

```ts
/**
 * L'offre, côté administration.
 *
 * GET                                    , le réglage, les prix, et les comptes qui ont un droit.
 * PUT    { limitesDepuis } et/ou { prix } , fixer l'entrée en vigueur des limites, les prix du Pro.
 * POST   { compte, droit, jusquAu, motif } , accorder le Pro ou l'option sans pub.
 * DELETE { uid, droit }                   , retirer un droit.
 *
 * Superadmin seulement. `settings/offre` ne s'écrit que par ici ;
 * `droits/{uid}` s'écrit par ici (à la main) et par un paiement réglé
 * (lib/paiement-serveur). Les navigateurs n'écrivent ni l'un ni l'autre
 * (firestore.rules).
 *
 * UNE FORMULE EST EN VENTE DÈS QU'ELLE A UN PRIX. Vider un prix la retire de
 * la vente, sur-le-champ : c'est l'interrupteur.
 */
```

Dans `GET`, remplacer la ligne du `return` par :

```ts
    return NextResponse.json({
      jour,
      limitesDepuis: reglage.data()?.limites_depuis ?? null,
      prix: lirePrix(reglage.data()?.prix),
      fedapay: { configure: fedapayConfigure(), environnement: environnementFedapay() },
      comptes,
    });
```

Remplacer toute la fonction `PUT` par :

```ts
export async function PUT(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    const corps = (await req.json()) as { limitesDepuis?: unknown; prix?: unknown };
    const maj: Record<string, unknown> = { updated_by: appelant.uid, updated_at: FieldValue.serverTimestamp() };

    if ("limitesDepuis" in corps) {
      if (corps.limitesDepuis !== null && !jourValide(corps.limitesDepuis)) {
        return NextResponse.json({ error: "Date invalide" }, { status: 400 });
      }
      maj.limites_depuis = corps.limitesDepuis;
    }

    if ("prix" in corps) {
      const saisi = (corps.prix && typeof corps.prix === "object" ? corps.prix : {}) as Record<string, unknown>;
      const prix: Record<string, number | null> = {};
      for (const id of ID_FORMULES) {
        const v = saisi[id];
        if (v === null || v === undefined) prix[id] = null;
        else if (prixValide(v)) prix[id] = v;
        else {
          return NextResponse.json(
            { error: `Prix invalide : un nombre entier d'au moins ${PRIX_PLANCHER} FCFA, ou vide.` },
            { status: 400 },
          );
        }
      }
      maj.prix = prix;
    }

    if (!("limitesDepuis" in corps) && !("prix" in corps)) {
      return NextResponse.json({ error: "Rien à enregistrer" }, { status: 400 });
    }
    await adminDb.collection("settings").doc("offre").set(maj, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/offre PUT]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
```

- [ ] **Step 2: La route des paiements**

Créer `src/app/api/admin/paiements/route.ts` :

```ts
import { NextRequest, NextResponse } from "next/server";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import { ErreurFedapay } from "@/lib/fedapay";
import { adminDb } from "@/lib/firebase-admin";
import { ID_PAIEMENT, type FirestorePaiement } from "@/lib/paiement";
import { reglerPaiement } from "@/lib/paiement-serveur";

/**
 * Les paiements, côté administration.
 *
 * GET          , les cent derniers, du plus récent au plus ancien.
 * POST { id }  , revérifier : relire la collecte chez FedaPay et régler.
 *
 * « Revérifier » ne force rien : c'est `reglerPaiement`, la même fonction que
 * le webhook. Elle n'accorde que si FedaPay dit que c'est payé, au bon montant.
 * C'est le geste pour le client qui écrit « j'ai payé et je n'ai rien ».
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const iso = (x: unknown): string | null =>
  x && typeof (x as { toDate?: () => Date }).toDate === "function" ? (x as { toDate: () => Date }).toDate().toISOString() : null;

export async function GET(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    const snap = await adminDb.collection("paiements").orderBy("created_at", "desc").limit(100).get();
    const uids = [...new Set(snap.docs.map((d) => (d.data() as FirestorePaiement).uid))];
    const profils = uids.length ? await adminDb.getAll(...uids.map((u) => adminDb.collection("users").doc(u))) : [];
    const parUid = new Map(profils.map((p) => [p.id, p.data() ?? {}]));
    const paiements = snap.docs.map((d) => {
      const l = d.data() as FirestorePaiement;
      const p = parUid.get(l.uid) ?? {};
      return {
        id: d.id,
        uid: l.uid,
        nom: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Compte sans nom",
        email: (p.email as string | undefined) ?? null,
        formule: l.formule,
        montant: l.montant,
        statut: l.statut,
        environnement: l.environnement,
        fedapayStatut: l.fedapay_statut,
        mode: l.mode,
        frais: l.frais,
        anomalie: l.anomalie,
        echeanceApres: l.echeance_apres,
        creeLe: iso(l.created_at),
      };
    });
    return NextResponse.json({ paiements });
  } catch (err) {
    console.error("[admin/paiements GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    const { id } = (await req.json().catch(() => ({}))) as { id?: unknown };
    if (typeof id !== "string" || !ID_PAIEMENT.test(id)) {
      return NextResponse.json({ error: "Paiement manquant" }, { status: 400 });
    }
    const etat = await reglerPaiement(id);
    if (!etat) return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
    return NextResponse.json({ ok: true, ...etat });
  } catch (err) {
    if (err instanceof ErreurFedapay) {
      console.error("[admin/paiements POST] FedaPay:", err);
      return NextResponse.json({ error: "FedaPay ne répond pas. Réessaie dans un moment." }, { status: 502 });
    }
    console.error("[admin/paiements POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
```

- [ ] **Step 3: La page d'administration**

Dans `src/app/(admin)/admin/offre/page.tsx` :

**a.** Remplacer les imports de `@/components/admin/ui` et `@/lib/offre` par :

```tsx
import {
  BOUTON_CONTOUR, BOUTON_VERT, Carte, Chargement, Chiffre, EnTete, Erreur, MenuActions, Modale, Pastille, Titre, Vide,
  type Ton,
} from "@/components/admin/ui";
import { LIMITES_GRATUIT, limitesEnVigueur, type CleLimite, type DroitOffre } from "@/lib/offre";
import { ID_FORMULES, PRIX_PLANCHER, type IdFormule, type PrixOffre, type StatutPaiement } from "@/lib/paiement";
```

**b.** Remplacer le commentaire d'en-tête par :

```tsx
// ============================================
// Admin, l'offre.
//
// Quatre gestes :
//
// - FIXER LA DATE D'ENTRÉE EN VIGUEUR des limites de l'offre gratuite. Avant
//   elle, personne n'est limité. Les conditions d'utilisation promettent de
//   prévenir : la date se fixe donc à l'avance, et s'annonce.
// - FIXER LES PRIX du Pro. Une formule est en vente dès qu'elle a un prix ;
//   vider les deux ferme la vente sur-le-champ.
// - ACCORDER LE PRO (ou l'option sans pub) à la main, pour une durée, à qui
//   on veut le faire essayer : un organisateur, un gérant, un club.
// - SUIVRE LES PAIEMENTS, et revérifier celui d'un client qui dit avoir payé :
//   la relecture chez FedaPay accorde le Pro si le paiement a bien abouti,
//   et seulement dans ce cas.
// ============================================
```

**c.** Après l'interface `Compte`, ajouter :

```tsx
interface VuePaiement {
  id: string;
  nom: string;
  email: string | null;
  formule: IdFormule;
  montant: number;
  statut: StatutPaiement;
  environnement: "sandbox" | "live";
  fedapayStatut: string | null;
  mode: string | null;
  anomalie: string | null;
  echeanceApres: string | null;
  creeLe: string | null;
}

interface Donnees {
  jour: string;
  limitesDepuis: string | null;
  prix: PrixOffre;
  fedapay: { configure: boolean; environnement: "sandbox" | "live" };
  comptes: Compte[];
}

const LIBELLE_FORMULE: Record<IdFormule, string> = { pro_mois: "Pro, 1 mois", pro_an: "Pro, 1 an" };

const STATUT_PAIEMENT: Record<StatutPaiement, { label: string; ton: Ton }> = {
  paye: { label: "Payé", ton: "vert" },
  en_attente: { label: "En attente", ton: "ambre" },
  echoue: { label: "Refusé", ton: "gris" },
  annule: { label: "Annulé", ton: "gris" },
  expire: { label: "Expiré", ton: "gris" },
};

/** Les prix rangés, tels qu'on les saisit : vide quand la formule n'est pas en vente. */
const versSaisie = (prix: PrixOffre): Record<IdFormule, string> => ({
  pro_mois: prix.pro_mois === null ? "" : String(prix.pro_mois),
  pro_an: prix.pro_an === null ? "" : String(prix.pro_an),
});
```

**d.** Dans le composant, remplacer la déclaration de `donnees`, et ajouter trois états :

```tsx
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [paiements, setPaiements] = useState<VuePaiement[]>([]);
  const [saisiePrix, setSaisiePrix] = useState<Record<IdFormule, string>>({ pro_mois: "", pro_an: "" });
  const [revue, setRevue] = useState<string | null>(null);
```

**e.** Remplacer `appel` et `charger` par :

```tsx
  const appel = useCallback(async (method: string, corps?: unknown, url = "/api/admin/offre") => {
    if (!firebaseUser) throw new Error("Session expirée");
    const rep = await fetch(url, {
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
      const [d, p] = await Promise.all([
        appel("GET") as Promise<Donnees>,
        appel("GET", undefined, "/api/admin/paiements") as Promise<{ paiements: VuePaiement[] }>,
      ]);
      setDonnees(d);
      setDate(d.limitesDepuis ?? "");
      setSaisiePrix(versSaisie(d.prix));
      setPaiements(p.paiements);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Chargement impossible");
    }
  }, [appel]);
```

**f.** Après la fonction `retirer`, ajouter :

```tsx
  const enregistrerPrix = async () => {
    const prix: Record<string, number | null> = {};
    for (const id of ID_FORMULES) {
      const brut = saisiePrix[id].trim();
      // Vérifié ici aussi : `Number("abc")` vaut NaN, que JSON écrit `null`,
      // et le serveur y lirait « pas en vente » sans rien dire.
      if (brut !== "" && (!/^\d+$/.test(brut) || Number(brut) < PRIX_PLANCHER)) {
        toast.error(`${LIBELLE_FORMULE[id]} : un nombre entier d'au moins ${PRIX_PLANCHER} FCFA, ou vide.`);
        return;
      }
      prix[id] = brut === "" ? null : Number(brut);
    }
    try {
      await appel("PUT", { prix });
      toast.success(Object.values(prix).some((p) => p !== null) ? "Prix enregistrés" : "Vente fermée");
      await charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    }
  };

  const reverifier = async (id: string) => {
    setRevue(id);
    try {
      const etat = (await appel("POST", { id }, "/api/admin/paiements")) as { statut: StatutPaiement };
      toast.success(etat.statut === "paye" ? "Paiement confirmé, Pro accordé" : `Chez FedaPay : ${STATUT_PAIEMENT[etat.statut].label.toLowerCase()}`);
      await charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Revérification impossible");
    } finally {
      setRevue(null);
    }
  };
```

**g.** Juste avant le `return (` du rendu, après `const joursAvant = …`, ajouter :

```tsx
  const prixInchanges = ID_FORMULES.every((id) => saisiePrix[id].trim() === versSaisie(donnees.prix)[id]);
```

**h.** Dans `EnTete`, remplacer le `sousTitre` par :

```tsx
        sousTitre="Les limites de l'offre gratuite, les prix de KoppaFoot Pro, les comptes qui l'ont, et les paiements."
```

**i.** Entre la section « Limites de l'offre gratuite » (`</section>`) et la section « Comptes avec un droit », insérer :

```tsx
      <section>
        <Titre>Vente de KoppaFoot Pro</Titre>
        <Carte className="space-y-3 px-4 py-4">
          <p className="text-sm text-gray-600">
            {!donnees.fedapay.configure
              ? <>La clé FedaPay n&apos;est pas configurée : rien n&apos;est en vente, quels que soient les prix.</>
              : donnees.fedapay.environnement === "live"
                ? <>Une formule est en vente dès qu&apos;elle a un prix. Vide les deux pour fermer la vente.</>
                : <><strong>Bac à sable.</strong> Seuls les administrateurs voient les formules, et l&apos;argent est fictif.</>}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            {ID_FORMULES.map((id) => (
              <label key={id}>
                <span className={ETIQUETTE}>{LIBELLE_FORMULE[id]} (FCFA)</span>
                <input
                  inputMode="numeric"
                  value={saisiePrix[id]}
                  onChange={(e) => setSaisiePrix({ ...saisiePrix, [id]: e.target.value })}
                  placeholder="Pas en vente"
                  className={CHAMP}
                />
              </label>
            ))}
            <button onClick={() => void enregistrerPrix()} disabled={prixInchanges} className={BOUTON_VERT}>
              Enregistrer
            </button>
          </div>
        </Carte>
      </section>
```

**j.** Entre la fin de la section « Comptes avec un droit » (`</section>`) et `{accord && (`, insérer :

```tsx
      <section>
        <Titre compte={paiements.length}>Paiements</Titre>
        {paiements.length === 0 ? (
          <Vide titre="Aucun paiement" texte="Les achats du Pro apparaîtront ici, du plus récent au plus ancien." />
        ) : (
          <Carte className="divide-y divide-gray-200/70">
            {paiements.map((p) => {
              const rembourse = p.statut === "paye" && (p.fedapayStatut ?? "").includes("refunded");
              const sansEffet = p.statut === "paye" && !p.echeanceApres;
              const revoir = p.statut !== "paye" && p.environnement === donnees.fedapay.environnement;
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-gray-900">{p.nom}</span>
                      <Pastille ton={STATUT_PAIEMENT[p.statut].ton}>{STATUT_PAIEMENT[p.statut].label}</Pastille>
                      {p.environnement === "sandbox" && <Pastille ton="bleu">Bac à sable</Pastille>}
                      {p.anomalie && <Pastille ton="rouge">Écart : {p.anomalie}</Pastille>}
                      {rembourse && <Pastille ton="rouge">Remboursé chez FedaPay</Pastille>}
                      {sansEffet && <Pastille ton="rouge" title="Le compte avait déjà un Pro sans échéance : à rembourser.">Payé sans effet</Pastille>}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {LIBELLE_FORMULE[p.formule]} · {p.montant.toLocaleString("fr-FR")} FCFA
                      {p.mode && <> · {p.mode}</>}
                      {p.creeLe && <> · {new Date(p.creeLe).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</>}
                      {p.echeanceApres && <> · Pro jusqu&apos;au {jourCourt(p.echeanceApres)}</>}
                      {" "}· {p.email ?? p.id}
                    </p>
                  </div>
                  {revoir && (
                    <button onClick={() => void reverifier(p.id)} disabled={revue !== null} className={BOUTON_CONTOUR}>
                      {revue === p.id && <Loader2 size={14} className="animate-spin" />}
                      Revérifier
                    </button>
                  )}
                </div>
              );
            })}
          </Carte>
        )}
      </section>
```

- [ ] **Step 4: Vérifier**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

Run: `npx eslint "src/app/(admin)/admin/offre/page.tsx" src/app/api/admin/offre/route.ts src/app/api/admin/paiements/route.ts`
Expected: aucune erreur.

Sur le serveur de dev :

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/admin/paiements`
Expected: `401`

Run: `curl -s -o /dev/null -w "%{http_code}\n" -X PUT http://localhost:3000/api/admin/offre -H "Content-Type: application/json" -d '{"prix":{"pro_mois":1}}'`
Expected: `401`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/offre/route.ts src/app/api/admin/paiements/route.ts "src/app/(admin)/admin/offre/page.tsx"
git commit -m "feat(admin): prix du Pro et suivi des paiements

Une formule est en vente dès qu'elle a un prix ; vider les deux ferme la
vente. La liste des paiements signale les écarts avec FedaPay, et
« Revérifier » rejoue la relecture qui accorde le Pro, sans rien forcer.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: La tâche de 6 h rattrape et rappelle

**Files:**
- Modify: `src/app/api/cron/scoreur-manquant/route.ts`

**Interfaces:**
- Consumes: `reverifierPaiementsOuverts(): Promise<{ revus: number; payes: number; fermes: number }>`, `rappelerEcheancesPro(): Promise<number>` de `@/lib/paiement-serveur`.
- Produces: la réponse JSON de la tâche gagne `paiements` et `echeancesPro` (`null` si la partie a échoué).

- [ ] **Step 1: Brancher les deux appels**

Dans `src/app/api/cron/scoreur-manquant/route.ts`, ajouter l'import :

```ts
import { rappelerEcheancesPro, reverifierPaiementsOuverts } from "@/lib/paiement-serveur";
```

Dans le commentaire d'en-tête, après le paragraphe « LA MÊME TÂCHE RAPPELLE LES MATCHS DU JOUR… », ajouter :

```ts
 *
 * ELLE RATTRAPE AUSSI LES PAIEMENTS (lib/paiement-serveur) : quelqu'un qui a
 * payé et dont ni le webhook ni le retour sur le site n'ont abouti ne reste
 * pas sans son Pro plus d'une nuit. Et elle prévient de la fin d'un Pro, sept
 * jours avant et la veille. Ces deux parties ne font jamais échouer la tâche :
 * une panne de FedaPay ne doit pas priver un joueur de son rappel de match.
```

Remplacer :

```ts
    const rappels = await rappelerLesMatchsDuJour();

    return NextResponse.json({
      success: true,
      jour,
      examines: snap.size,
      relances,
      dejaRelances: ignores.length,
      rappels,
    });
```

par :

```ts
    const rappels = await rappelerLesMatchsDuJour();

    const [paiements, echeancesPro] = await Promise.all([
      reverifierPaiementsOuverts().catch((err) => {
        console.error("[cron/scoreur-manquant] paiements:", err);
        return null;
      }),
      rappelerEcheancesPro().catch((err) => {
        console.error("[cron/scoreur-manquant] échéances Pro:", err);
        return null;
      }),
    ]);

    return NextResponse.json({
      success: true,
      jour,
      examines: snap.size,
      relances,
      dejaRelances: ignores.length,
      rappels,
      paiements,
      echeancesPro,
    });
```

- [ ] **Step 2: Vérifier**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

Run: `npx eslint src/app/api/cron/scoreur-manquant/route.ts`
Expected: aucune erreur.

Ne **pas** appeler la tâche sur le serveur de dev pour la tester : elle envoie de vraies notifications aux joueurs qui ont un match (le dev écrit dans la base de production). Les deux fonctions ajoutées sont sans effet hors `FEDAPAY_ENV=live` pour les rappels, et le balayage se vérifie à la tâche 9.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/scoreur-manquant/route.ts
git commit -m "feat(paiement): la tâche de 6 h rattrape les paiements et rappelle les échéances

Un paiement abouti dont le webhook et le retour ont manqué est réglé le
lendemain matin au plus tard. Le Pro qui se termine est annoncé sept
jours avant et la veille, une fois par jour.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Les textes qui engagent

**Files:**
- Modify: `src/app/(marketing)/conditions/page.tsx`
- Modify: `src/app/(marketing)/confidentialite/page.tsx`

**Interfaces:** aucune.

- [ ] **Step 1: Les conditions**

Dans `src/app/(marketing)/conditions/page.tsx` :

Remplacer `const MIS_A_JOUR = "6 octobre 2026";` par `const MIS_A_JOUR = "12 octobre 2026";`.

Dans l'en-tête du fichier, remplacer le paragraphe :

```tsx
// L'AVENIR PAYANT Y EST ÉCRIT HONNÊTEMENT : des options pourront apparaître,
// annoncées avant, jamais imposées pour finir ce qui est commencé. C'est ce
// qui permet plus tard des limites d'usage sans trahir personne.
```

par :

```tsx
// CE QUI SE PAIE Y EST ÉCRIT HONNÊTEMENT : KoppaFoot Pro, son prix affiché
// avant de payer, une période et non un abonnement, rien de prélevé à
// l'échéance, jamais exigé pour finir ce qui est commencé. C'est ce qui
// permet des limites d'usage sans trahir personne.
```

Dans la section `service`, remplacer :

```tsx
        <p>
          L&apos;utilisation de KoppaFoot est gratuite. Si des options payantes apparaissent, elles seront annoncées à
          l&apos;avance, leur prix sera affiché avant tout paiement, et aucune ne sera exigée pour terminer un match ou une
          compétition déjà commencés.
        </p>
```

par :

```tsx
        <p>
          L&apos;utilisation de KoppaFoot est gratuite. KoppaFoot Pro est une option payante : son prix est affiché avant
          tout paiement, et elle n&apos;est jamais exigée pour terminer un match ou une compétition déjà commencés.
        </p>
        <p>
          Le Pro s&apos;achète pour une période, un mois ou un an, <strong>sans renouvellement automatique</strong> : à
          l&apos;échéance, rien n&apos;est prélevé, et tu es prévenu avant. Le paiement se fait par mobile money ou par
          carte, sur la page de notre prestataire FedaPay. Une période commencée n&apos;est pas remboursée ; en cas de
          double paiement ou d&apos;erreur, écris-nous : nous prolongeons ta période ou nous te remboursons.
        </p>
```

Ne pas toucher à la section `roles` : l'organisateur et le gérant de terrain encaissent toujours eux-mêmes, ce lot ne change rien pour eux.

- [ ] **Step 2: La confidentialité**

Dans `src/app/(marketing)/confidentialite/page.tsx` :

Remplacer `const MIS_A_JOUR = "6 octobre 2026";` par `const MIS_A_JOUR = "12 octobre 2026";`.

Dans l'en-tête du fichier, remplacer les deux lignes :

```tsx
// chaque prestataire est réellement appelé (Firebase, Vercel, Brevo ou
// Resend, et YouTube dès qu'un tutoriel a sa vidéo : voir
```

par :

```tsx
// chaque prestataire est réellement appelé (Firebase, Vercel, Brevo ou
// Resend, FedaPay à l'achat du Pro, et YouTube dès qu'un tutoriel a sa vidéo : voir
```

Dans la section `partage`, après la ligne `<li><strong>Brevo</strong> ou <strong>Resend</strong> : envoi des e-mails.</li>`, ajouter :

```tsx
          <li>
            <strong>FedaPay</strong> : le paiement de KoppaFoot Pro, seulement si tu l&apos;achètes. Nous lui transmettons
            ton prénom, ton nom et ton e-mail, pour ton reçu ; le numéro de ton portefeuille mobile ou de ta carte, tu le
            tapes sur sa page, et nous ne le voyons ni ne le gardons. Nous conservons la trace du paiement : son montant,
            sa date, son état.
          </li>
```

- [ ] **Step 3: Vérifier**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

Run: `npx eslint "src/app/(marketing)/conditions/page.tsx" "src/app/(marketing)/confidentialite/page.tsx"`
Expected: aucune erreur.

Sur le serveur de dev, ouvrir `http://localhost:3000/conditions` puis `http://localhost:3000/confidentialite` dans le volet navigateur et lire le texte (`get_page_text`).
Expected: « 12 octobre 2026 », le paragraphe « sans renouvellement automatique » dans les conditions, la ligne FedaPay dans la confidentialité.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(marketing)/conditions/page.tsx" "src/app/(marketing)/confidentialite/page.tsx"
git commit -m "docs(legal): KoppaFoot Pro payant, sans renouvellement automatique, payé chez FedaPay

Les conditions disent ce qui se paie et ce qui ne se rembourse pas ; la
confidentialité nomme FedaPay et ce qu'il reçoit.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Vérification d'ensemble et bac à sable

**Files:**
- Modify: `docs/plans/2026-10-12-paiement-fedapay-pro-design.md` (ce qui a été constaté)

**Interfaces:** aucune.

Cette tâche a besoin du fondateur : les clés de test FedaPay dans `.env.local` (jamais dans le chat), et un compte superadmin pour dérouler le parcours connecté. Sans elles, faire les étapes 1 à 3 et s'arrêter en disant ce qui reste.

- [ ] **Step 1: Toutes les suites**

Run: `(cd mobile && npx jest)`
Expected: toutes les suites vertes, dont `paiement.test.ts` et `fedapay.test.ts`.

Run: `npx tsc --noEmit`
Expected: aucune erreur.

Run: `(cd mobile && npx tsc --noEmit)`
Expected: les 3 erreurs préexistantes, pas une de plus.

- [ ] **Step 2: La construction**

Arrêter le serveur de dev (`preview_stop`) avant : une construction pendant qu'il tourne corrompt le cache Turbopack.

Run: `npm run build`
Expected: construction réussie ; `/api/paiements`, `/api/paiements/[id]`, `/api/webhooks/fedapay`, `/api/admin/paiements` figurent dans la liste des routes. Une seule fois : chaque construction consomme le quota API-Football.

- [ ] **Step 3: Les règles**

Aucune règle générale n'ouvre les collections non déclarées (`grep -n "document=\*\*" firestore.rules` ne rend rien) : `paiements` est déjà fermée en production sans déploiement. La règle ajoutée la documente. La déployer avec les autres, en suivant la procédure du projet (comparer avec ce qui est en production avant, `--project koppafoot` obligatoire) :

Run: `npx firebase deploy --only firestore:rules --project koppafoot`
Expected: `Deploy complete!`

- [ ] **Step 4: Bac à sable, le chemin du retour (avec les clés de test)**

Prérequis dans `.env.local` : `FEDAPAY_SECRET_KEY` (clé secrète de test), `FEDAPAY_ENV=sandbox`. Relancer le serveur de dev.

1. Connecté en superadmin, ouvrir `/admin/offre` : la carte « Vente de KoppaFoot Pro » dit « Bac à sable ». Saisir `1500` et `15000`, enregistrer.
2. Ouvrir `/offre` : les deux formules s'affichent, « soit 1 250 FCFA par mois » sous l'année.
3. Cliquer « Payer » sur 1 mois : redirection vers la page FedaPay. Choisir le mobile money de test, numéro **`64000001`**, valider.
4. Retour sur `/offre` : « Paiement en cours de confirmation… » puis « Paiement reçu. Tu es Pro jusqu'au … » (le même quantième du mois suivant). L'adresse ne porte plus `?paiement=`.
5. Dans `/admin/offre` : le compte apparaît Pro avec le motif « Achat Pro 1 mois (bac à sable) » ; la ligne de paiement est « Payé », « Bac à sable ».
6. **Noter la forme réelle des réponses** : lire dans les journaux du serveur (`preview_logs`) qu'aucune erreur « illisible » n'est sortie. Si la création échoue avec « Collecte FedaPay illisible », afficher une fois la réponse brute de `POST /transactions` et corriger `deballer`.

Expected: les cinq constats ci-dessus.

- [ ] **Step 5: Bac à sable, l'échec**

Racheter 1 mois, payer avec un autre numéro (par exemple `60000000`).
Expected: au retour, « Le paiement n'a pas abouti. Tu peux réessayer. » ; l'échéance du Pro n'a pas bougé ; la ligne est « Refusé » ou « Annulé ».

- [ ] **Step 6: Bac à sable, le webhook et l'octroi unique**

Prérequis : `FEDAPAY_WEBHOOK_SECRET` dans `.env.local` (n'importe quelle valeur en local, l'outil signe avec la même).

1. Racheter 1 mois, payer avec `64000001`, mais **fermer l'onglet sur la page FedaPay après validation, sans revenir** sur le site. L'identifiant du paiement est le champ `id` de la réponse de `POST /api/paiements` : le lire avant de quitter la page, avec `read_network_requests` (filtre `/api/paiements`). Dans `/admin/offre`, la ligne est « En attente ».
2. Run: `npx tsx scripts/webhook-fedapay.ts <idPaiement>`
   Expected: `200 {"ok":true,"statut":"paye"}`. L'échéance du Pro a avancé d'un mois.
3. Run: la même commande une seconde fois.
   Expected: `200 {"ok":true,"statut":"paye"}`, et **l'échéance n'a pas bougé**.
4. Run: `curl -s -w "\n%{http_code}\n" -X POST http://localhost:3000/api/webhooks/fedapay -H "Content-Type: application/json" -H "X-FEDAPAY-SIGNATURE: t=1,s=00" -d '{"name":"transaction.approved"}'`
   Expected: `400`, `Signature invalide`.

- [ ] **Step 7: Bac à sable, le compte ordinaire ne voit rien**

Avec un compte **non** superadmin (ou sans compte de test disponible, le vérifier par la route) : `/offre` affiche « Le Pro n'est pas encore en vente… », et `POST /api/paiements` avec son jeton répond `403`, `code: "bac_a_sable"`.

- [ ] **Step 8: Refermer**

Dans `/admin/offre`, vider les deux prix (« Vente fermée ») et retirer le Pro de test du compte superadmin si on ne veut pas le garder.

- [ ] **Step 9: Consigner ce qui a été constaté**

Dans `docs/plans/2026-10-12-paiement-fedapay-pro-design.md`, remplacer le paragraphe « **Non documenté, à constater au premier appel en bac à sable** … » par ce qui a été observé : la forme de l'enveloppe des réponses, le champ de l'événement qui porte la collecte (à lire dans le journal du tableau de bord FedaPay, onglet Webhooks ou Évènements), si `merchant_reference` est bien renvoyé, et si FedaPay a ajouté ses paramètres au retour avec `&` ou avec un second `?`. Passer le **Statut** en tête à « Implémenté, validé en bac à sable le <date>. Reste : la mise en service réelle (section Mise en service, points 5 à 8). »

- [ ] **Step 10: Commit**

```bash
git add docs/plans/2026-10-12-paiement-fedapay-pro-design.md
git commit -m "docs(paiement): ce que le bac à sable FedaPay a montré

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Ce que ce plan ne fait pas

- La mise en service réelle (compte FedaPay validé et de type Business, webhook réel vers `https://www.koppafoot.com/api/webhooks/fedapay`, clés dans Vercel, premier vrai paiement) : c'est la section « Mise en service » de la spec, points 5 à 8, à faire avec le fondateur.
- La fusion dans `master` et la pull request : sur demande.
- Réservations de terrain et inscriptions en compétition : lots suivants, voir la fin de la spec.
