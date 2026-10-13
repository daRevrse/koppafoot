import { FieldValue } from "firebase-admin/firestore";
import { estSuperadmin } from "@/lib/admin-api-auth";
import { recuPaiementHtml, sendNotificationEmail } from "@/lib/email";
import {
  creerCollecte, environnementFedapay, fedapayConfigure, lienDePaiement, lireCollecte, lireCollecteParReference,
} from "@/lib/fedapay";
import { adminDb } from "@/lib/firebase-admin";
import { notifierCompte } from "@/lib/notifier-serveur";
import {
  aDroitAKoppaFootPlus, droitActif, estPro, jourDeLome, titresDuProfil,
  type DroitAccorde, type DroitOffre, type FirestoreDroits,
} from "@/lib/offre";
import {
  FORMULES, ID_PAIEMENT, NOM_OFFRE, STATUTS_OUVERTS, deciderReglement, estFormule, formulesEnVente, joursDeRappel, libelleFormule, lirePrix,
  motifAchat, nouvelleEcheance, objetDe, prixValide, trierLignesOuvertes,
  type Collecte, type EnvironnementPaiement, type FirestorePaiement, type FormuleEnVente, type IdFormule,
  type ObjetPaiement, type PrixOffre, type StatutPaiement,
} from "@/lib/paiement";
import { APP_URL } from "@/lib/partage";
import { fraisDePaiement, numeroTogolais } from "@/lib/reglement";
import { effetAcompte, suivreReservation } from "@/lib/reglement-serveur";

// ============================================
// Les paiements, côté serveur : démarrer un achat, et le régler.
//
// UNE SEULE FONCTION ACCORDE UN DROIT ACHETÉ : `reglerPaiement`. Le webhook, la
// vérification au retour du client, la tâche du matin et le bouton
// « Revérifier » de l'administration l'appellent tous, et elle ne croit
// aucun d'eux : elle relit la collecte chez FedaPay, vérifie que c'est la
// nôtre et au bon montant (lib/paiement, deciderReglement), puis écrit le
// droit et l'état « payé » dans la même transaction. Dix appels pour le même
// paiement prolongent une fois.
//
// LE BAC À SABLE ÉCRIT DANS LA VRAIE BASE. Le poste de développement et les
// aperçus partagent le Firestore de la production : avec des clés de test,
// quiconque trouve une adresse d'aperçu s'offrirait KoppaFoot+ en monnaie
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

export async function lirePrixOffre(): Promise<PrixOffre> {
  const snap = await adminDb.collection("settings").doc("offre").get();
  return lirePrix(snap.data()?.prix);
}

/**
 * Les formules que CE compte peut acheter.
 *
 * Aucune sans clé FedaPay, et en bac à sable seulement pour un superadmin.
 * Ensuite, l'offre suit le profil (lib/offre) :
 *  - KoppaFoot+ : aux managers, organisateurs et propriétaires de terrain ;
 *  - « Pas de pubs » : à tout le monde, sauf tant que KoppaFoot+ court, qui
 *    retire déjà la publicité. On ne vend pas deux fois la même chose.
 * Un droit sans échéance n'a rien à prolonger : sa formule ne se montre pas.
 */
export async function formulesPour(
  profil: Record<string, unknown> | undefined,
  droits: Pick<FirestoreDroits, "pro" | "sans_pub"> | null = null,
): Promise<FormuleEnVente[]> {
  if (!fedapayConfigure()) return [];
  if (environnementFedapay() !== "live" && !estSuperadmin(profil)) return [];

  const jour = jourDeLome();
  const plus = aDroitAKoppaFootPlus(titresDuProfil(profil));
  const plusActif = estPro(droits, jour);
  return formulesEnVente(await lirePrixOffre()).filter((f) => {
    const actuel = droits?.[f.droit];
    if (droitActif(actuel, jour) && actuel?.jusqu_au === null) return false;
    return f.droit === "pro" ? plus : !plusActif;
  });
}

export type RefusPaiement =
  | "formule" | "non_configure" | "bac_a_sable" | "pas_en_vente" | "deja_illimite" | "trop_de_tentatives" | "fedapay"
  | "reservation" | "deja_paye" | "trop_tard" | "telephone"
  | "profil" | "deja_compris";

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
 * Démarre l'achat d'une formule : KoppaFoot+ ou « Pas de pubs ». `origine` :
 * d'où vient la requête, pour le retour en bac à sable (en réel, toujours le
 * site).
 *
 * L'OFFRE D'UN PROFIL SE DÉCIDE ICI, pas à l'écran. La page ne montre que les
 * formules du compte (`formulesPour`) ; un appel direct est refusé de même.
 */
export async function demarrerPaiement(uid: string, formule: unknown, origine: string): Promise<{ id: string; url: string }> {
  if (!estFormule(formule)) throw new ErreurPaiement("formule", "Formule inconnue.");
  const { droit, mois } = FORMULES[formule];
  const { profil, environnement } = await verifierAcces(uid, `${NOM_OFFRE[droit]} n'est pas encore en vente.`);

  if (droit === "pro" && !aDroitAKoppaFootPlus(titresDuProfil(profil))) {
    throw new ErreurPaiement("profil", "KoppaFoot+ est réservé aux managers, organisateurs et propriétaires de terrain.");
  }

  const prix = (await lirePrixOffre())[formule];
  if (!prixValide(prix)) throw new ErreurPaiement("pas_en_vente", "Cette formule n'est pas en vente.");

  const jour = jourDeLome();
  const droits = (await adminDb.collection("droits").doc(uid).get()).data() as FirestoreDroits | undefined;
  if (droit === "sans_pub" && estPro(droits, jour)) {
    throw new ErreurPaiement("deja_compris", "Ton KoppaFoot+ retire déjà la publicité.");
  }
  if (nouvelleEcheance(droits?.[droit], jour, mois) === null) {
    throw new ErreurPaiement("deja_illimite", `${NOM_OFFRE[droit]} est déjà à toi sans échéance : il n'y a rien à prolonger.`);
  }
  await verifierTentatives(uid);

  const base = environnement === "live" ? APP_URL : origine;
  return ouvrirCollecte(
    // L'objet « pro » est l'achat d'une formule, quel que soit son droit.
    { uid, objet: "pro", formule, droit, montant: prix, environnement },
    libelleFormule(formule),
    (id) => `${base}/offre?paiement=${id}`,
    profil,
  );
}

/**
 * Démarre le paiement des frais de réservation d'un terrain. Le montant vient
 * du règlement, figé à la confirmation : jamais de la réservation, jamais du
 * navigateur.
 *
 * PAS DE PAIEMENT SANS NUMÉRO OÙ RENDRE. Si le propriétaire annule, l'acompte
 * revient à l'équipe par mobile money : il faut savoir où. `telephone` est le
 * numéro qu'elle donne en payant ; à défaut, celui de sa demande, déjà sur le
 * règlement. Sans l'un ni l'autre, on n'encaisse pas.
 */
export async function demarrerAcompte(
  uid: string,
  reservation: unknown,
  origine: string,
  telephone?: unknown,
): Promise<{ id: string; url: string }> {
  if (typeof reservation !== "string" || !ID_PAIEMENT.test(reservation)) {
    throw new ErreurPaiement("reservation", "Réservation introuvable.");
  }
  const { profil, environnement } = await verifierAcces(uid, "Le paiement n'est pas encore ouvert.");

  // Ouvre le règlement s'il manque, et applique l'échéance si elle est passée.
  const reg = await suivreReservation(reservation);
  if (!reg || reg.user_id !== uid) throw new ErreurPaiement("reservation", "Réservation introuvable.");
  if (reg.paye_le) throw new ErreurPaiement("deja_paye", "Ces frais de réservation sont déjà payés.");
  if (reg.cloture !== null) throw new ErreurPaiement("trop_tard", "Ce créneau n'est plus réservé : il n'y a plus rien à payer.");

  // Un numéro illisible n'efface pas celui qu'on a déjà.
  const numero = numeroTogolais(telephone) ?? reg.telephone;
  if (!numero) {
    throw new ErreurPaiement("telephone", "Donne le numéro mobile money où te rendre les frais si le propriétaire annule.");
  }
  await verifierTentatives(uid);
  if (numero !== reg.telephone) {
    await adminDb.collection("reglements").doc(reservation)
      .update({ telephone: numero, updated_at: FieldValue.serverTimestamp() });
  }

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

/** Ce que le titulaire apprend de son paiement. */
export interface EtatPaiement {
  statut: StatutPaiement;
  /** `null` : le paiement n'achète pas une formule (les frais de réservation d'un terrain). */
  formule: IdFormule | null;
  /** Ce que la formule accorde ; `null` de même. */
  droit: DroitOffre | null;
  montant: number;
  /** L'échéance du droit acheté après ce paiement ; `null` tant qu'il n'est pas réglé. */
  jusquAu: string | null;
  /** Un écart entre la ligne et la collecte : l'administration doit regarder. */
  aVerifier: boolean;
}

export function vueEtat(ligne: FirestorePaiement): EtatPaiement {
  return {
    statut: ligne.statut,
    formule: ligne.formule,
    droit: ligne.droit,
    montant: ligne.montant,
    jusquAu: ligne.echeance_apres,
    aVerifier: ligne.anomalie !== null,
  };
}

/** Ce qu'on dit à qui vient de payer, selon ce qu'il a acheté. */
const ACCUSE: Record<DroitOffre, (date: string) => string> = {
  pro: (date) => `Tu as KoppaFoot+ jusqu'au ${date}.`,
  sans_pub: (date) => `Plus de publicité jusqu'au ${date}.`,
};

/** Le reçu : cloche, téléphone, e-mail. Ne lève jamais, et ne remet rien en cause. */
async function accuserReception(
  ligne: FirestorePaiement,
  droit: DroitOffre,
  jusquAu: string,
  recuUrl: string | null,
): Promise<void> {
  const profil = (await adminDb.collection("users").doc(ligne.uid).get().catch(() => null))?.data() ?? {};
  const email = typeof profil.email === "string" ? profil.email : null;
  await Promise.allSettled([
    notifierCompte(ligne.uid, {
      type: "offre",
      title: "Paiement reçu",
      body: ACCUSE[droit](dateLongue(jusquAu)),
      link: "/offre",
    }),
    email
      ? sendNotificationEmail(email, `Ton reçu ${NOM_OFFRE[droit]}`, recuPaiementHtml({
          prenom: typeof profil.first_name === "string" ? profil.first_name : "",
          formule: ligne.formule ? libelleFormule(ligne.formule) : NOM_OFFRE[droit],
          droit,
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

/**
 * L'achat d'une formule : sa période s'ajoute à la fin en cours du droit
 * qu'elle accorde (lib/paiement, nouvelleEcheance).
 *
 * LE DROIT VIENT DE LA LIGNE, écrite au clic. On ne revérifie pas ici que le
 * compte y a encore droit : l'argent est reçu. Un manager devenu joueur entre
 * le clic et le paiement a son KoppaFoot+, limité à ce que son profil ouvre
 * (lib/offre) ; garder un paiement sans rien donner serait pire.
 */
const effetFormule: Effet = async (tx, ligne, c) => {
  // Une ligne d'avant les deux offres ne porte que `pro`.
  const droit: DroitOffre = ligne.droit ?? "pro";
  const droitsRef = adminDb.collection("droits").doc(ligne.uid);
  const actuel = ((await tx.get(droitsRef)).data() as FirestoreDroits | undefined)?.[droit] ?? null;
  const mois = ligne.formule ? FORMULES[ligne.formule].mois : 0;
  const suite = mois > 0 ? nouvelleEcheance(actuel, c.jour, mois) : null;
  if (!suite) {
    // Le même droit, sans échéance, a été accordé entre le clic et le
    // paiement : on ne l'écrase pas. La ligne est payée, sans échéance :
    // l'administration la voit « payée sans effet » et rembourse à la main.
    return { ecrire: () => {}, champs: { echeance_avant: null, echeance_apres: null }, apres: null };
  }
  const accorde: DroitAccorde = {
    depuis: suite.depuis,
    jusqu_au: suite.jusqu_au,
    source: "paiement",
    accorde_par: null,
    motif: motifAchat(droit, mois, c.environnement),
  };
  return {
    ecrire: () => tx.set(droitsRef, { [droit]: accorde, updated_at: FieldValue.serverTimestamp() }, { merge: true }),
    champs: {
      echeance_avant: actuel && droitActif(actuel, c.jour) ? actuel.jusqu_au : null,
      echeance_apres: suite.jusqu_au,
    },
    apres: () => accuserReception(ligne, droit, suite.jusqu_au, c.collecte.recuUrl),
  };
};

export const EFFETS: Record<ObjetPaiement, Effet> = { pro: effetFormule, acompte: effetAcompte };

/**
 * Règle un paiement : relit sa collecte chez FedaPay et, si elle est payée,
 * accorde ce qu'il achète. Sans effet la seconde fois.
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
  // « en attente », et la suivante accordait le droit une seconde fois.
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
 * qui a payé ne doit pas rester sans ce qu'il a acheté plus d'une nuit. Les lignes de
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

const RAPPEL: Record<DroitOffre, { marque: string; nom: string; corps: (date: string) => string }> = {
  pro: {
    marque: "rappel_pro_le",
    nom: "Ton KoppaFoot+",
    corps: (date) => `KoppaFoot+ court jusqu'au ${date}. Tu peux le prolonger dès maintenant : la période s'ajoute à la fin.`,
  },
  sans_pub: {
    marque: "rappel_sans_pub_le",
    nom: "Ton option Pas de pubs",
    corps: (date) => `La publicité reste retirée jusqu'au ${date}. Tu peux prolonger dès maintenant : la période s'ajoute à la fin.`,
  },
};

/**
 * Prévient de la fin d'un droit acheté, sept jours avant et la veille. Rend le
 * nombre de rappels envoyés.
 *
 * SEULEMENT EN RÉEL, et seulement pour une offre en vente : un rappel qui ne
 * mène à rien à prolonger n'apprend qu'à ignorer les notifications. Chaque
 * droit a sa marque du jour : la tâche rejouée ne sonne pas deux fois.
 *
 * « PAS DE PUBS » NE SE RAPPELLE PAS SOUS KOPPAFOOT+ : tant qu'il court, la
 * publicité ne revient pas, il n'y a rien à annoncer.
 *
 * KOPPAFOOT+ NE SE PROLONGE QUE POUR QUI Y A DROIT. Un joueur sans casquette
 * peut l'avoir (acheté avant la règle, ou accordé à la main), mais sa page ne
 * lui en vend pas la suite : on ne lui annonce pas un bouton qu'il n'aura
 * pas. Pour lui, la suite s'appelle « Pas de pubs », et le rappel le dit.
 */
export async function rappelerEcheances(jour: string = jourDeLome()): Promise<number> {
  if (!fedapayConfigure() || environnementFedapay() !== "live") return 0;
  const enVente = new Set(formulesEnVente(await lirePrixOffre()).map((f) => f.droit));
  if (enVente.size === 0) return 0;

  const { demain, dansSeptJours } = joursDeRappel(jour);
  let rappels = 0;
  for (const droit of ["pro", "sans_pub"] as const) {
    const { marque, nom, corps } = RAPPEL[droit];
    const snap = await adminDb.collection("droits").where(`${droit}.jusqu_au`, "in", [demain, dansSeptJours]).get();
    for (const d of snap.docs) {
      const droits = d.data() as FirestoreDroits;
      const fin = droits[droit]?.jusqu_au;
      if (!fin || d.get(marque) === jour) continue;
      if (droit === "sans_pub" && estPro(droits, jour)) continue;
      const horsProfil = droit === "pro"
        && !aDroitAKoppaFootPlus(titresDuProfil((await adminDb.collection("users").doc(d.id).get()).data()));
      // Ce que ce compte pourra acheter ensuite : s'il n'est pas en vente, on se tait.
      if (!enVente.has(horsProfil ? "sans_pub" : droit)) continue;
      await notifierCompte(d.id, {
        type: "offre",
        title: `${nom} se termine ${fin === demain ? "demain" : "dans 7 jours"}`,
        body: horsProfil
          ? `KoppaFoot+ court jusqu'au ${dateLongue(fin)}. Ensuite, la publicité revient : « Pas de pubs » te sera proposé pour la retirer.`
          : corps(dateLongue(fin)),
        link: "/offre",
      });
      await d.ref.update({ [marque]: jour });
      rappels += 1;
    }
  }
  return rappels;
}
