/**
 * KOPPAFOOT — Sortir la validation des matchs de leur document public.
 *
 * Jusqu'au 2026-09-11, le document `matches/{id}` portait, lisibles par
 * n'importe qui avec le SDK web : `validation_status`, `post_match_feedback`
 * (commentaires des managers, note donnée à l'arbitre) et, dans chaque
 * événement du direct, `contested_by_manager_id` / `contestation_reason`.
 *
 * Tout cela vit désormais dans `match_validations/{id}`, que seuls les deux
 * camps lisent (voir firestore.rules et lib/validation-server). Ce script y
 * recopie l'existant, puis efface les champs du document public.
 *
 * Ce qu'il fait, match par match :
 *  - crée la validation (statut, retours rangés par CAMP, contestations par
 *    identifiant d'événement, managers) ; si elle existe déjà — écrite par le
 *    nouveau code entre-temps —, il ne complète que ce qui lui manque ;
 *  - pose l'échéance de la validation tacite (fin du match + 12 h) sur un
 *    match joué en direct encore « en attente » : le cron corrigé la tranchera
 *    à son prochain passage si elle est dépassée ;
 *  - pose `stats_credited_at` sur un match RENSEIGNÉ qui avait crédité ses
 *    compteurs (validé, ou non vérifié), puisque c'est désormais ce champ qui
 *    décide si sa suppression les reprend ;
 *  - efface `validation_status`, `post_match_feedback` et les champs de
 *    contestation des événements.
 *
 * N'affiche jamais le contenu d'un retour (commentaire, note) : des nombres.
 *
 * Usage :
 *   npx tsx scripts/migrer-validations.ts            # lecture seule
 *   npx tsx scripts/migrer-validations.ts --ecrire   # écrit en base
 *
 * Rejouable : un match déjà migré n'a plus rien à migrer, il est ignoré.
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore(app);

const ECRIRE = process.argv.includes("--ecrire");
const DELAI_VALIDATION_TACITE_MS = 12 * 60 * 60 * 1000;

type Camp = "home" | "away";
type Donnees = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Le camp d'un compte sur ce match : manager créateur, manager d'en face, ou staff d'une équipe. */
async function campDe(m: Donnees, uid: string): Promise<Camp | null> {
  const campDuCreateur: Camp = m.is_home ? "home" : "away";
  if (uid === m.manager_id) return campDuCreateur;
  if (m.away_manager_id && uid === m.away_manager_id) {
    return campDuCreateur === "home" ? "away" : "home";
  }
  for (const [camp, teamId] of [["home", m.home_team_id], ["away", m.away_team_id]] as const) {
    if (!teamId) continue;
    const equipe = (await db.collection("teams").doc(teamId).get()).data();
    if (equipe && (equipe.manager_id === uid || (equipe.staff_manager_ids ?? []).includes(uid))) {
      return camp;
    }
  }
  return null;
}

function enMillis(v: unknown): number | null {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

async function main() {
  console.log(ECRIRE ? "Mode ÉCRITURE\n" : "Lecture seule — rien ne sera écrit (ajouter --ecrire)\n");

  const matchs = await db.collection("matches").get();
  let migres = 0;

  for (const doc of matchs.docs) {
    const m = doc.data();
    const evenements: Donnees[] = m.live_state?.events ?? [];
    const contestes = evenements.filter((e) => e.contested_by_manager_id || e.contestation_reason);
    const retours: Record<string, Donnees> = m.post_match_feedback ?? {};

    const aMigrer = "validation_status" in m || "post_match_feedback" in m || contestes.length > 0;
    if (!aMigrer) continue;
    migres += 1;

    // Les retours, rangés par camp. Un retour dont on ne retrouve pas le camp
    // (compte qui ne gère plus aucune des deux équipes) est compté, pas recopié.
    const feedback: Partial<Record<Camp, Donnees>> = {};
    let sansCamp = 0;
    for (const [uid, r] of Object.entries(retours)) {
      const camp = await campDe(m, uid);
      if (!camp) { sansCamp += 1; continue; }
      feedback[camp] = {
        validation: r.validation,
        by: uid,
        at: r.created_at ?? new Date().toISOString(),
        ...(r.comments ? { comments: r.comments } : {}),
        ...(r.referee_rating ? { referee_rating: r.referee_rating } : {}),
      };
    }

    const contested_events: Record<string, Donnees> = {};
    for (const e of contestes) {
      const par: string = e.contested_by_manager_id ?? "";
      const camp = par ? await campDe(m, par) : null;
      contested_events[e.id] = {
        by: par,
        side: camp ?? "home",
        reason: e.contestation_reason ?? "",
        at: e.created_at ?? new Date().toISOString(),
      };
    }

    const status: string = m.validation_status ?? (m.away_manager_id ? "pending" : "unverified");
    const fin = enMillis(m.completed_at);
    const echeance = status === "pending" && !m.recorded_at && m.status === "completed" && fin !== null
      ? Timestamp.fromMillis(fin + DELAI_VALIDATION_TACITE_MS)
      : null;
    const creditARetracer = !!m.recorded_at
      && (status === "validated" || status === "unverified")
      && !m.stats_credited_at;

    const refValidation = db.collection("match_validations").doc(doc.id);
    const existante = await refValidation.get();

    console.log(
      `- ${doc.id} : statut « ${status} », ${Object.keys(feedback).length} retour(s)`
      + `, ${Object.keys(contested_events).length} contestation(s)`
      + (sansCamp ? `, ${sansCamp} retour(s) sans camp identifiable (non recopiés)` : "")
      + (echeance ? `, validation tacite au ${echeance.toDate().toISOString()}` : "")
      + (creditARetracer ? ", stats_credited_at à poser" : "")
      + (existante.exists ? " — validation déjà présente : complétée seulement" : ""),
    );

    if (!ECRIRE) continue;

    const batch = db.batch();
    if (existante.exists) {
      // Écrite par le nouveau code : elle fait foi. On n'ajoute que les camps
      // et les contestations qu'elle n'a pas.
      const actuelle = existante.data() ?? {};
      const retoursManquants = Object.fromEntries(
        Object.entries(feedback).filter(([camp]) => !actuelle.feedback?.[camp]),
      );
      const contestationsManquantes = Object.fromEntries(
        Object.entries(contested_events).filter(([id]) => !actuelle.contested_events?.[id]),
      );
      batch.set(
        refValidation,
        {
          feedback: retoursManquants,
          contested_events: contestationsManquantes,
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } else {
      batch.set(refValidation, {
        match_id: doc.id,
        managers: [m.manager_id, m.away_manager_id].filter(Boolean),
        status,
        feedback,
        contested_events,
        ...(echeance ? { auto_validate_at: echeance } : {}),
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
    }

    batch.update(doc.ref, {
      validation_status: FieldValue.delete(),
      post_match_feedback: FieldValue.delete(),
      ...(contestes.length > 0
        ? {
            "live_state.events": evenements.map((e) => {
              const reste = { ...e };
              delete reste.contested_by_manager_id;
              delete reste.contestation_reason;
              return reste;
            }),
          }
        : {}),
      ...(creditARetracer
        ? { stats_credited_at: FieldValue.serverTimestamp(), stats_credited_by: "migration-validations" }
        : {}),
    });

    await batch.commit();
  }

  console.log(
    `\n${migres} match(s) ${ECRIRE ? "migré(s)" : "à migrer"} sur ${matchs.size}.`
    + (ECRIRE ? "" : "\nRelancer avec --ecrire pour appliquer."),
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("ERR", e instanceof Error ? e.message : e);
  process.exit(1);
});
