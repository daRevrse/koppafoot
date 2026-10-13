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
  nouvelleEcheance, objetDe, prixValide, trierLignesOuvertes,
  type Collecte, type EnvironnementPaiement, type FirestorePaiement, type FormuleEnVente, type IdFormule,
  type ObjetPaiement, type PrixOffre, type StatutPaiement,
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
    objet: "pro",
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
  /** `null` : le paiement n'achète pas une formule (les frais de réservation d'un terrain). */
  formule: IdFormule | null;
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
          // Appelé pour un achat du Pro seulement (effetPro) : la formule y est toujours.
          formule: ligne.formule ? libelleFormule(ligne.formule) : "KoppaFoot Pro",
          montant: ligne.montant,
          jusquAu: dateLongue(jusquAu),
          recuUrl,
        }))
      : null,
  ]);
}

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

  // TOUT SE DÉCIDE DANS LA TRANSACTION, sur la ligne qu'elle relit. La
  // collecte, elle, a été lue avant, et peut déjà dater : la page qui
  // redemande toutes les trois secondes lit « en attente » juste avant
  // l'approbation, pendant que le webhook lit « approuvée » et règle. Écrite
  // hors transaction, cette relecture en retard repassait la ligne payée à
  // « en attente », et la suivante accordait le Pro une seconde fois.
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
