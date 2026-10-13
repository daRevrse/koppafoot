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
   * Pour un remboursement : le numéro mobile money de l'équipe, celui du
   * règlement (lib/reglement). `null` pour un propriétaire, qui a son compte
   * de versement.
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
