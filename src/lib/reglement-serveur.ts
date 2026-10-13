import { randomInt } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { estSuperadmin } from "@/lib/admin-api-auth";
import { environnementFedapay, fedapayConfigure } from "@/lib/fedapay";
import { adminDb } from "@/lib/firebase-admin";
import { notifierCompte } from "@/lib/notifier-serveur";
import { paiementOuvert } from "@/lib/paiement";
import type { Effet } from "@/lib/paiement-serveur";
import {
  acompteDe, battementLu, codeSaisi, debutDuCreneau, echeanceAcompte, etatDuReglement, fenetreDeValidation,
  fraisDePaiement, nouveauCode, numeroTogolais, planReglement, prixDuCreneau,
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
/**
 * Le téléphone donné dans la demande, s'il est un numéro mobile money : c'est
 * là qu'on rendrait son acompte à l'équipe. La réservation d'un match n'en
 * porte pas : l'équipe le donne alors en payant (paiement-serveur,
 * demarrerAcompte), et sans lui elle ne paie pas.
 */
const telephoneDe = (b: FirestoreBooking | null): string | null =>
  numeroTogolais((b as { contact?: { telephone?: unknown } | null } | null)?.contact?.telephone);

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
  // Sans numéro où le verser, pas d'encaissement pour lui.
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
    // Personne n'est mis en demeure de payer ce qu'il ne peut pas payer : sans
    // clé FedaPay, ou en bac à sable pour un compte ordinaire, le créneau
    // serait libéré au bout de vingt-quatre heures, sans issue. Il se règle
    // alors sur place, comme sur un terrain sans frais.
    const demandeur = (await adminDb.collection("users").doc(dAbord.user_id).get()).data();
    if (!paiementOuvert({
      configure: fedapayConfigure(),
      environnement: environnementFedapay(),
      superadmin: estSuperadmin(demandeur),
    })) return null;
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
        telephone: telephoneDe(resa),
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
          telephone: auGerant ? null : reg.telephone,
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
      telephone: reg?.telephone ?? null,
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
    // Son numéro de remboursement ne regarde qu'elle.
    telephone: role === "equipe" ? reg.telephone : null,
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
