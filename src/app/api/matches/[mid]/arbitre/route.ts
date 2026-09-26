import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { campDuCompte, managersDuMatch } from "@/lib/validation-server";
import { notifier } from "@/lib/reservations-server";
import {
  champsSansEquipe, estArbitreServeur, joueCeMatch, membresDeLEquipe, nomDuCompte,
} from "@/lib/arbitrage-server";
import { dateLongue } from "@/lib/terrains";
import type {
  FirestoreCorpsArbitral, FirestoreEquipeArbitrale, FirestoreMatch, MembreNomme,
} from "@/types";

// ============================================
// POST /api/matches/[mid]/arbitre, l'arbitrage d'un amical.
//
// POURQUOI UNE ROUTE. Chaque geste s'écrivait depuis le navigateur, sur trois
// champs du match, et une branche des règles Firestore laissait l'arbitre
// réécrire son propre statut. Un candidat pouvait donc se passer « confirmé »
// lui-même, sans l'accord du manager, et recevoir les commandes du match.
// Et personne n'était jamais prévenu : ni le manager d'une candidature, ni
// l'arbitre d'une réponse. Les champs de l'arbitre sont désormais réservés au
// serveur (voir firestore.rules), et chaque geste prévient celui qui doit agir.
//
// LES GESTES, ET QUI LES FAIT :
//  - l'ARBITRE : postuler (sur un match sans arbitre), retirer (sa
//    candidature), accepter ou décliner (une invitation), se désister (d'une
//    désignation confirmée, avant le coup d'envoi) ;
//  - un MANAGER ou le staff d'une des deux équipes : valider ou refuser une
//    candidature, inviter un arbitre, annuler (l'invitation, ou la
//    désignation d'un arbitre confirmé) ;
//  - l'ARBITRE CONFIRMÉ, encore : composer son équipe pour ce match, prise
//    dans son corps arbitral (voir /api/corps-arbitral) — jusqu'à deux
//    assistants, et un scoreur, qui reçoit la console : pendant le match,
//    l'arbitre a un sifflet en main, pas un téléphone.
//
// Tout passe par une transaction : deux arbitres qui postulent à la même
// seconde, un seul l'emporte, l'autre reçoit une réponse claire.
// ============================================

export const dynamic = "force-dynamic";

type Action =
  | "postuler" | "retirer" | "accepter" | "decliner" | "desister"
  | "valider" | "refuser" | "inviter" | "annuler" | "composer";

const ACTIONS: Action[] = [
  "postuler", "retirer", "accepter", "decliner", "desister",
  "valider", "refuser", "inviter", "annuler", "composer",
];

/** Le trio arbitral : l'arbitre et deux assistants. */
const ASSISTANTS_MAX = 2;

/** Un match qui se prépare : on peut encore y désigner quelqu'un. */
const EN_PREPARATION = ["pending", "upcoming", "delayed"];

class Refus extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
  }
}

/** Ce que la transaction a changé, pour prévenir la bonne personne ensuite. */
interface Issue {
  statut: FirestoreMatch["referee_status"];
  arbitre: { uid: string; nom: string };
  /** Pour `annuler` : retirait-on une invitation ou un arbitre confirmé ? */
  avant?: FirestoreMatch["referee_status"];
  /** L'équipe qui accompagnait l'arbitre et qui n'est plus attendue. */
  equipeLiberee?: MembreNomme[];
  /** Pour `composer` : qui arrive, qui s'en va, et dans quel rôle. */
  arrivees?: { membre: MembreNomme; role: "assistant" | "scoreur" }[];
  departs?: MembreNomme[];
}

/** La veille, pour ne pas refuser un match du jour à cause du fuseau. */
const aujourdhui = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

export async function POST(req: Request, { params }: { params: Promise<{ mid: string }> }) {
  const entete = req.headers.get("authorization");
  if (!entete?.startsWith("Bearer ")) return NextResponse.json({ error: "Compte requis" }, { status: 401 });
  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(entete.split("Bearer ")[1])).uid;
  } catch {
    return NextResponse.json({ error: "Session expirée" }, { status: 401 });
  }

  const { mid } = await params;
  const corps = (await req.json().catch(() => ({}))) as {
    action?: unknown; arbitreId?: unknown; assistants?: unknown; scoreur?: unknown;
  };
  const action = corps.action as Action;
  if (!ACTIONS.includes(action)) return NextResponse.json({ error: "Action inconnue" }, { status: 400 });

  const ref = adminDb.collection("matches").doc(mid);
  const avant = await ref.get();
  if (!avant.exists) return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  const m0 = avant.data() as FirestoreMatch;
  const appelant = (await adminDb.collection("users").doc(uid).get()).data();
  const camp = await campDuCompte(m0, uid);

  // Les vérifications qui lisent ailleurs que sur le match se font AVANT la
  // transaction : elle ne doit relire que le match.
  let cible: { uid: string; nom: string } | null = null;
  if (action === "postuler") {
    if (!estArbitreServeur(appelant)) {
      return NextResponse.json({ error: "Active le rôle Arbitre pour te porter candidat." }, { status: 403 });
    }
    if (camp) {
      return NextResponse.json({ error: "Tu gères une des deux équipes : tu ne peux pas arbitrer ce match." }, { status: 403 });
    }
    if (await joueCeMatch(mid, uid, m0)) {
      return NextResponse.json({ error: "Tu joues ce match : tu ne peux pas l'arbitrer." }, { status: 403 });
    }
  }
  if (action === "inviter") {
    const arbitreId = typeof corps.arbitreId === "string" ? corps.arbitreId : "";
    const d = arbitreId ? (await adminDb.collection("users").doc(arbitreId).get()).data() : undefined;
    if (!d || !estArbitreServeur(d) || d.is_active === false) {
      return NextResponse.json({ error: "Ce compte n'est pas un arbitre." }, { status: 400 });
    }
    if (managersDuMatch(m0).includes(arbitreId) || (await campDuCompte(m0, arbitreId))) {
      return NextResponse.json({ error: "Il gère une des deux équipes : il ne peut pas arbitrer ce match." }, { status: 400 });
    }
    if (await joueCeMatch(mid, arbitreId, m0)) {
      return NextResponse.json({ error: "Il joue ce match : il ne peut pas l'arbitrer." }, { status: 400 });
    }
    cible = { uid: arbitreId, nom: nomDuCompte(d) };
  }

  // COMPOSER : l'équipe se choisit dans le corps arbitral du chef, et chacun
  // de ses membres passe les mêmes gardes que l'arbitre lui-même.
  let composition: { corpsId: string; corpsNom: string; assistants: MembreNomme[]; scoreur: MembreNomme | null } | null = null;
  if (action === "composer") {
    const corpsSnap = await adminDb.collection("corps_arbitraux").where("chef_id", "==", uid).limit(1).get();
    if (corpsSnap.empty) {
      return NextResponse.json({ error: "Crée d'abord ton corps arbitral pour y choisir ton équipe." }, { status: 409 });
    }
    const ca = corpsSnap.docs[0].data() as FirestoreCorpsArbitral;
    const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
    const assistantsIds = [...new Set(ids(corps.assistants))];
    const scoreurId = typeof corps.scoreur === "string" && corps.scoreur ? corps.scoreur : null;
    if (assistantsIds.length > ASSISTANTS_MAX) {
      return NextResponse.json({ error: `Deux assistants au plus.` }, { status: 400 });
    }
    for (const a of assistantsIds) {
      if (ca.membres?.[a]?.role !== "arbitre") {
        return NextResponse.json({ error: "Un assistant doit être un arbitre de ton corps arbitral." }, { status: 400 });
      }
    }
    if (scoreurId && ca.membres?.[scoreurId]?.role !== "scoreur") {
      return NextResponse.json({ error: "Le scoreur doit être un scoreur de ton corps arbitral." }, { status: 400 });
    }
    for (const u of [...assistantsIds, ...(scoreurId ? [scoreurId] : [])]) {
      const nom = ca.membres[u].nom;
      if (managersDuMatch(m0).includes(u) || (await campDuCompte(m0, u))) {
        return NextResponse.json({ error: `${nom} gère une des deux équipes : il ne peut pas officier sur ce match.` }, { status: 400 });
      }
      if (await joueCeMatch(mid, u, m0)) {
        return NextResponse.json({ error: `${nom} joue ce match : il ne peut pas officier.` }, { status: 400 });
      }
    }
    composition = {
      corpsId: corpsSnap.docs[0].id,
      corpsNom: ca.nom,
      assistants: assistantsIds.map((a) => ({ uid: a, nom: ca.membres[a].nom })),
      scoreur: scoreurId ? { uid: scoreurId, nom: ca.membres[scoreurId].nom } : null,
    };
  }

  try {
    const r = await adminDb.runTransaction<Issue>(async (tx) => {
      const snap = await tx.get(ref);
      const m = snap.data() as FirestoreMatch;
      const statut = m.referee_status ?? "none";
      const cEstLui = m.referee_id === uid;
      const estManager = !!camp;
      const enPrep = EN_PREPARATION.includes(m.status);
      const pasCommence = m.status !== "live" && m.status !== "completed" && m.status !== "cancelled";
      const libre = { referee_id: null, referee_name: null, referee_status: "none" as const };

      const ecrire = (champs: Record<string, unknown>) =>
        tx.update(ref, { ...champs, updated_at: FieldValue.serverTimestamp() });

      switch (action) {
        case "postuler":
          if (!enPrep) throw new Refus("Ce match ne cherche plus d'arbitre.");
          if (m.date < aujourdhui()) throw new Refus("Ce match est déjà passé.");
          if (statut !== "none" || m.referee_id) throw new Refus("Un arbitre est déjà sur ce match.");
          ecrire({ referee_id: uid, referee_name: nomDuCompte(appelant), referee_status: "pending" });
          return { statut: "pending", arbitre: { uid, nom: nomDuCompte(appelant) } };

        case "retirer":
          if (!cEstLui || statut !== "pending") throw new Refus("Aucune candidature à retirer.");
          ecrire(libre);
          return { statut: "none", arbitre: { uid, nom: m.referee_name ?? nomDuCompte(appelant) } };

        case "accepter":
        case "decliner":
          if (!cEstLui || statut !== "invited") throw new Refus("Aucune invitation en attente.");
          if (action === "accepter" && !enPrep) throw new Refus("Ce match ne se prépare plus.");
          ecrire(action === "accepter" ? { referee_status: "confirmed" } : libre);
          return { statut: action === "accepter" ? "confirmed" : "none", arbitre: { uid, nom: m.referee_name ?? nomDuCompte(appelant) } };

        case "desister":
          if (!cEstLui || statut !== "confirmed") throw new Refus("Tu n'es pas désigné sur ce match.");
          if (!pasCommence) throw new Refus("Le match a commencé : il est trop tard pour te désister.");
          // Son équipe part avec lui : elle venait pour lui.
          ecrire({ ...libre, ...champsSansEquipe(m) });
          return {
            statut: "none",
            arbitre: { uid, nom: m.referee_name ?? nomDuCompte(appelant) },
            equipeLiberee: membresDeLEquipe(m.equipe_arbitrale),
          };

        case "composer": {
          if (!cEstLui || statut !== "confirmed") throw new Refus("Tu n'es pas désigné sur ce match.", 403);
          if (!enPrep) throw new Refus("Ce match ne se prépare plus : son équipe arbitrale est figée.");
          const c = composition!;
          const avant = m.equipe_arbitrale ?? null;
          const mods = new Set(m.moderator_ids ?? []);
          // Le scoreur d'avant rend la console, si c'est l'équipe qui la lui avait donnée.
          if (avant?.scoreur && avant.scoreur_ajoute && avant.scoreur.uid !== c.scoreur?.uid) {
            mods.delete(avant.scoreur.uid);
          }
          // Deux consoles pour un match, c'est deux saisies du même but.
          const autres = [...mods].filter((u) => u !== c.scoreur?.uid);
          if (c.scoreur && autres.length > 0) {
            throw new Refus("Ce match a déjà un scoreur : compose ton équipe sans scoreur.");
          }
          let ajoute = false;
          if (c.scoreur) {
            const garde = avant?.scoreur?.uid === c.scoreur.uid && avant.scoreur_ajoute;
            ajoute = garde ? true : !mods.has(c.scoreur.uid);
            mods.add(c.scoreur.uid);
          }
          const vide = c.assistants.length === 0 && !c.scoreur;
          const equipe: FirestoreEquipeArbitrale | null = vide ? null : {
            corps_id: c.corpsId,
            corps_nom: c.corpsNom,
            assistants: c.assistants,
            scoreur: c.scoreur,
            scoreur_ajoute: ajoute,
          };
          ecrire({
            equipe_arbitrale: equipe,
            equipe_arbitrale_ids: membresDeLEquipe(equipe).map((x) => x.uid),
            moderator_ids: [...mods],
          });
          const avantIds = new Set(membresDeLEquipe(avant).map((x) => x.uid));
          const apresIds = new Set(membresDeLEquipe(equipe).map((x) => x.uid));
          return {
            statut: "confirmed",
            arbitre: { uid, nom: m.referee_name ?? nomDuCompte(appelant) },
            arrivees: [
              ...c.assistants.filter((a) => !avantIds.has(a.uid)).map((membre) => ({ membre, role: "assistant" as const })),
              ...(c.scoreur && !avantIds.has(c.scoreur.uid) ? [{ membre: c.scoreur, role: "scoreur" as const }] : []),
            ],
            departs: membresDeLEquipe(avant).filter((x) => !apresIds.has(x.uid)),
          };
        }

        case "valider":
        case "refuser":
          if (!estManager) throw new Refus("Seuls les managers du match répondent aux candidatures.", 403);
          if (statut !== "pending" || !m.referee_id) throw new Refus("Aucune candidature en attente.");
          if (action === "valider" && !enPrep) throw new Refus("Ce match ne se prépare plus.");
          ecrire(action === "valider" ? { referee_status: "confirmed" } : libre);
          return {
            statut: action === "valider" ? "confirmed" : "none",
            arbitre: { uid: m.referee_id, nom: m.referee_name ?? "L'arbitre" },
          };

        case "inviter":
          if (!estManager) throw new Refus("Seuls les managers du match invitent un arbitre.", 403);
          if (!enPrep) throw new Refus("Ce match ne se prépare plus.");
          if (m.date < aujourdhui()) throw new Refus("Ce match est déjà passé.");
          if (statut !== "none" || m.referee_id) throw new Refus("Ce match a déjà un arbitre, ou une candidature à traiter.");
          ecrire({ referee_id: cible!.uid, referee_name: cible!.nom, referee_status: "invited" });
          return { statut: "invited", arbitre: cible! };

        case "annuler":
          if (!estManager) throw new Refus("Seuls les managers du match peuvent retirer l'arbitre.", 403);
          if (statut !== "invited" && statut !== "confirmed") throw new Refus("Aucun arbitre à retirer.");
          if (!pasCommence) throw new Refus("Le match a commencé : l'arbitre ne peut plus être retiré.");
          ecrire({ ...libre, ...champsSansEquipe(m) });
          return {
            statut: "none",
            avant: statut,
            arbitre: { uid: m.referee_id!, nom: m.referee_name ?? "L'arbitre" },
            equipeLiberee: membresDeLEquipe(m.equipe_arbitrale),
          };
      }
    });

    await prevenir(action, m0, r, uid, appelant);
    return NextResponse.json({ ok: true, statut: r.statut });
  } catch (err) {
    if (err instanceof Refus) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("POST /api/matches/[mid]/arbitre failed:", err);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}

/**
 * Prévenir celui qui doit agir, ou qui attendait une réponse.
 *
 * Aux managers ce qui vient de l'arbitre, à l'arbitre ce qui vient d'un
 * manager. Celui qui fait le geste n'est jamais prévenu de son propre geste.
 */
async function prevenir(
  action: Action,
  m: FirestoreMatch,
  r: Issue,
  auteur: string,
  profilAuteur: Record<string, unknown> | undefined,
): Promise<void> {
  const match = `${m.home_team_name} vs ${m.away_team_name}`;
  const quand = m.date ? `${dateLongue(m.date)}${m.time ? ` à ${m.time}` : ""}` : "";
  const le = quand ? `, le ${quand}` : "";
  const auxManagers = (title: string, body: string) =>
    Promise.all(managersDuMatch(m).filter((u) => u !== auteur).map((u) =>
      notifier(u, { type: "arbitrage", title, body, link: "/matches" })));
  const alArbitre = (title: string, body: string) =>
    notifier(r.arbitre.uid, { type: "arbitrage", title, body, link: "/designations" });
  const qui = r.arbitre.nom;
  const manager = nomDuCompte(profilAuteur, "Le manager");

  // L'équipe de l'arbitre n'est plus attendue : elle venait pour lui.
  if (r.equipeLiberee?.length) {
    await Promise.all(r.equipeLiberee.map((x) => notifier(x.uid, {
      type: "arbitrage",
      title: "Match libéré",
      body: `${qui} n'arbitre plus ${match}${le} : tu n'y es plus attendu.`,
      link: "/corps-arbitral",
    })));
  }

  switch (action) {
    case "postuler":
      return void (await auxManagers("Un arbitre se propose", `${qui} se propose pour arbitrer ${match}${le}. Accepte ou refuse sur la carte du match.`));
    case "retirer":
      return void (await auxManagers("Candidature retirée", `${qui} ne se propose plus pour arbitrer ${match}.`));
    case "accepter":
      return void (await auxManagers("Arbitre confirmé", `${qui} a accepté d'arbitrer ${match}${le}.`));
    case "decliner":
      return void (await auxManagers("Invitation déclinée", `${qui} ne pourra pas arbitrer ${match}. Invite un autre arbitre.`));
    case "desister":
      return void (await auxManagers("Arbitre désisté", `${qui} ne pourra finalement pas arbitrer ${match}${le}. Trouve un autre arbitre.`));
    case "valider":
      return void (await alArbitre("Tu arbitres ce match", `${manager} a validé ta candidature : tu arbitres ${match}${le}.`));
    case "refuser":
      return void (await alArbitre("Candidature non retenue", `Ta candidature pour ${match} n'a pas été retenue.`));
    case "inviter":
      return void (await alArbitre("On te propose un match", `${manager} te propose d'arbitrer ${match}${le}. Accepte ou décline dans tes désignations.`));
    case "composer":
      await Promise.all([
        ...(r.arrivees ?? []).map(({ membre, role }) => notifier(membre.uid, {
          type: "arbitrage",
          title: role === "scoreur" ? "Tu tiens la console" : "Tu es arbitre assistant",
          body: role === "scoreur"
            ? `${qui} te confie la console de ${match}${le}. Le match t'attend dans tes directs.`
            : `${qui} t'emmène comme assistant sur ${match}${le}.`,
          link: role === "scoreur" ? "/live-ops" : "/designations",
        })),
        ...(r.departs ?? []).map((membre) => notifier(membre.uid, {
          type: "arbitrage",
          title: "Changement d'équipe",
          body: `${qui} a recomposé son équipe pour ${match} : tu n'y es plus attendu.`,
          link: "/corps-arbitral",
        })),
      ]);
      return;
    case "annuler":
      return void (await alArbitre(
        r.avant === "confirmed" ? "Désignation annulée" : "Invitation annulée",
        r.avant === "confirmed"
          ? `${manager} t'a retiré du match ${match}${le} : tu ne l'arbitres plus.`
          : `${manager} a retiré son invitation pour ${match}.`,
      ));
  }
}
