import { adminDb } from "@/lib/firebase-admin";
import { sendPushToUsers } from "@/lib/fcm-server";
import { estAVenir, texteAnnonceChaud, texteRappelChaud } from "@/lib/chauds";
import { jourDeMatch } from "@/lib/rappels-serveur";
import type { CompetitionStatus, FirestoreCompetition, FirestoreCompMatch } from "@/types";

// ============================================
// Les notifications d'avant match des matchs chauds (lib/chauds).
//
// QUI LES REÇOIT : ceux qui ont déjà dit vouloir le direct de ce match — ses
// abonnés (`match_follows`, la cloche de sa fiche ou le « Me prévenir » de
// l'accueil) et ceux de sa compétition. Les mêmes listes, le même plafond et
// la même catégorie (« competitions ») que les buts : qui coupe le direct
// des compétitions coupe aussi ceci. Personne d'autre : un match chaud n'est
// pas une campagne.
//
// UNE FOIS, ET MARQUÉ AVANT D'ENVOYER. Le marqueur se pose dans une
// transaction, puis l'envoi part : une tâche rejouée (Vercel réessaie une
// exécution en échec) ou un double clic ne sonnent pas deux fois. Un envoi
// qui échoue après le marqueur est perdu — c'est le bon côté de l'erreur.
//
// Une compétition d'entraînement ne sort jamais d'ici.
// ============================================

const MAX_ABONNES = 500;

/** Les compétitions où un match peut encore se jouer. */
const EN_COURS: CompetitionStatus[] = ["registration", "registration_closed", "group_stage", "knockout"];

async function destinataires(cid: string, mid: string): Promise<string[]> {
  const [duMatch, deLaCompetition] = await Promise.all([
    adminDb.collection("match_follows").where("match_id", "==", mid).limit(MAX_ABONNES).get(),
    adminDb.collection("users").where("followed_competition_ids", "array-contains", cid).limit(MAX_ABONNES).select().get(),
  ]);
  return [
    ...duMatch.docs.map((d) => String(d.data().user_id ?? "")),
    ...deLaCompetition.docs.map((d) => d.id),
  ];
}

const lienDuMatch = (comp: FirestoreCompetition, mid: string) =>
  comp.slug ? `/c/${comp.slug}/matches/${mid}` : "/";

const versAffiche = (m: FirestoreCompMatch) => ({
  homeTeamName: m.home_team_name,
  awayTeamName: m.away_team_name,
  date: m.date,
  time: m.time,
  venueName: m.venue_name,
});

export type BilanAnnonce =
  | { envoye: true; destinataires: number; envoyes: number }
  | { envoye: false; raison: "introuvable" | "pas-chaud" | "deja-annonce" | "date-passee" | "sandbox" };

/**
 * L'annonce d'un match chaud, à la flamme allumée. L'appelant a vérifié que
 * c'est bien le staff de la compétition qui la demande.
 */
export async function annoncerMatchChaud(cid: string, mid: string, maintenant = new Date()): Promise<BilanAnnonce> {
  const compRef = adminDb.collection("competitions").doc(cid);
  const compSnap = await compRef.get();
  if (!compSnap.exists) return { envoye: false, raison: "introuvable" };
  const comp = compSnap.data() as FirestoreCompetition;
  if (comp.is_sandbox) return { envoye: false, raison: "sandbox" };

  const aujourdhui = jourDeMatch(maintenant);
  const ref = compRef.collection("comp_matches").doc(mid);
  type Raison = Extract<BilanAnnonce, { envoye: false }>["raison"];
  const verdict = await adminDb.runTransaction(async (tx): Promise<{ raison: Raison } | { match: FirestoreCompMatch }> => {
    const snap = await tx.get(ref);
    const m = snap.data() as FirestoreCompMatch | undefined;
    if (!m) return { raison: "introuvable" };
    if (m.chaud !== true || !estAVenir(m)) return { raison: "pas-chaud" };
    if (m.chaud_annonce_le) return { raison: "deja-annonce" };
    if (m.status === "scheduled" && m.date && m.date < aujourdhui) return { raison: "date-passee" };
    tx.update(ref, { chaud_annonce_le: maintenant.toISOString() });
    return { match: m };
  });
  if (!("match" in verdict)) return { envoye: false, raison: verdict.raison };

  const texte = texteAnnonceChaud(versAffiche(verdict.match), comp.name, aujourdhui);
  const bilan = await sendPushToUsers(await destinataires(cid, mid), {
    ...texte,
    link: lienDuMatch(comp, mid),
    category: "competitions",
  });
  return { envoye: true, ...bilan };
}

/**
 * Le rappel du matin : chaque match chaud qui se joue aujourd'hui, une fois
 * par date. Pas celui dont l'annonce est partie aujourd'hui même.
 *
 * UNE BOUCLE SUR LES COMPÉTITIONS EN COURS, et pas un `collectionGroup` :
 * il demanderait un index de groupe de collections qui n'existe pas en
 * production (même raison que lib/bilan-club-serveur). Une requête par
 * compétition, une fois par jour.
 */
export async function rappelerLesMatchsChaudsDuJour(
  maintenant = new Date(),
): Promise<{ matchs: number; destinataires: number; envoyes: number }> {
  const jour = jourDeMatch(maintenant);
  const comps = await adminDb.collection("competitions").where("status", "in", EN_COURS).get();

  let matchs = 0;
  let total = 0;
  let envoyes = 0;
  for (const compDoc of comps.docs) {
    const comp = compDoc.data() as FirestoreCompetition;
    if (comp.is_sandbox) continue;

    const duJour = await compDoc.ref.collection("comp_matches").where("date", "==", jour).get();
    for (const doc of duJour.docs) {
      const brut = doc.data() as FirestoreCompMatch;
      if (brut.chaud !== true || brut.status !== "scheduled") continue;

      const m = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(doc.ref);
        const d = snap.data() as FirestoreCompMatch | undefined;
        if (!d || d.chaud !== true || d.status !== "scheduled" || d.date !== jour) return null;
        if (d.chaud_rappel_pour === jour) return null;
        // Annoncé aujourd'hui même : l'annonce disait déjà « aujourd'hui ».
        if (d.chaud_annonce_le && jourDeMatch(new Date(d.chaud_annonce_le)) === jour) return null;
        tx.update(doc.ref, { chaud_rappel_pour: jour });
        return d;
      });
      if (!m) continue;

      const bilan = await sendPushToUsers(await destinataires(compDoc.id, doc.id), {
        ...texteRappelChaud(versAffiche(m), comp.name),
        link: lienDuMatch(comp, doc.id),
        category: "competitions",
      });
      matchs += 1;
      total += bilan.destinataires;
      envoyes += bilan.envoyes;
    }
  }
  return { matchs, destinataires: total, envoyes };
}
