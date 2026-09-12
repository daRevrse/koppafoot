import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { peutGererEquipeServeur } from "@/lib/team-access-server";
import type { FirestoreMatch, FirestoreMatchValidation } from "@/types";
import { estSuperadmin } from "@/lib/admin-api-auth";
import { refValidation, validationInitiale } from "@/lib/validation-server";

/**
 * Renseigner un match DÉJÀ JOUÉ.
 *
 * Le troisième parcours, à côté du défi et de l'amical. Il ne programme rien :
 * il enregistre ce qui a eu lieu. Le formulaire de création interdit les dates
 * passées — un match qu'on programme est à venir — et un club n'avait donc
 * aucun moyen de porter son historique sur la plateforme.
 *
 * DEUX RÉGIMES, selon l'adversaire, et c'est toute la difficulté du parcours :
 *
 *  - hors plateforme : personne d'autre n'est engagé, on n'écrit que dans son
 *    propre bilan. Le match est enregistré et crédité tout de suite.
 *  - équipe KoppaFoot : le score écrit une victoire ou une défaite dans le
 *    bilan d'un club qui n'a rien demandé. Rien n'est crédité tant que SON
 *    manager n'a pas contresigné. Le match existe, il s'affiche, il ne compte
 *    pour personne.
 *
 * Le statut de la validation porte cette attente : « pending » tant que la
 * contresignature manque, « validated » une fois obtenue, « unverified » pour
 * un adversaire hors plateforme. Il vit dans `match_validations/{id}`, hors
 * du document public du match (voir lib/validation-server).
 *
 * CE QUI A ÉTÉ CRÉDITÉ SE LIT À `stats_credited_at`, posé au moment même où
 * les compteurs bougent — et non plus déduit du statut. La suppression
 * reprenait les compteurs de tout match qui n'était pas « pending » : un
 * score CONTESTÉ, qui n'avait jamais rien crédité, retirait donc à ses
 * joueurs des buts qu'ils n'avaient jamais reçus.
 *
 * CE QUI EST CRÉDITÉ, quand ça l'est : le bilan des clubs (V/N/D), et LA SEULE
 * PRÉSENCE des joueurs nommés — un match joué de plus, rien d'autre. Le reste
 * de l'effectif n'apparaît pas : ce parcours demande le score et les buteurs,
 * pas une feuille de match, et on ne crédite pas une présence qu'on ne connaît
 * pas.
 *
 * LES BUTS ET LES PASSES NE COMPTENT PAS, et ils comptaient. Un match renseigné
 * est saisi après coup, à la main, par un manager : c'est une déclaration, pas
 * un constat. Le direct, lui, est vu et noté minute par minute — c'est ce qui
 * fait un compteur de buts. Un match renseigné ne concerne donc que les clubs ;
 * chez un joueur, il ne laisse qu'un match de plus au compteur, même s'il a
 * marqué. Même règle que « Mes statistiques », qui n'a jamais lu ces matchs
 * faute de feuille (voir lib/player-stats).
 */

interface Buteur {
  playerId: string;
  /** Un joueur sans compte vit sur `teams/{id}/ghost_players`, pas sur `users`. */
  sansCompte: boolean;
  nom: string;
  buts: number;
  passes: number;
}

/**
 * Le crédit d'un match renseigné, appliqué ou repris.
 *
 * Repris à hauteur DE CE QUI A ÉTÉ DONNÉ, et non de ce qu'on donnerait
 * aujourd'hui : la règle a changé en cours de route, voir `reprendreLesStats`.
 */
function crediter(
  tx: Transaction,
  m: FirestoreMatch,
  matchId: string,
  buteurs: Buteur[],
  equipeReelle: string,
  sens: 1 | -1,
) {
  const scoreHome = m.score_home ?? 0;
  const scoreAway = m.score_away ?? 0;
  const resultatHome = scoreHome > scoreAway ? "win" : scoreHome < scoreAway ? "loss" : "draw";
  const resultatAway = resultatHome === "win" ? "loss" : resultatHome === "loss" ? "win" : "draw";

  const bilan = (r: "win" | "loss" | "draw") => ({
    matches_played: FieldValue.increment(sens),
    wins: FieldValue.increment(r === "win" ? sens : 0),
    losses: FieldValue.increment(r === "loss" ? sens : 0),
    draws: FieldValue.increment(r === "draw" ? sens : 0),
    updated_at: FieldValue.serverTimestamp(),
  });

  // Un identifiant vide, c'est le camp hors plateforme : il n'a pas de club.
  if (m.home_team_id) tx.update(adminDb.collection("teams").doc(m.home_team_id), bilan(resultatHome));
  if (m.away_team_id) tx.update(adminDb.collection("teams").doc(m.away_team_id), bilan(resultatAway));

  // ON NE CRÉDITE PLUS LES BUTS (voir l'en-tête), MAIS ON REND CE QU'ON A PRIS.
  // Les matchs renseignés avant ce changement ont bel et bien crédité buts et
  // passes ; les reprendre à la suppression demande de savoir ce qui a été
  // donné. Leur document ne porte pas `recorded_scorer_stats`, et cette absence
  // est la réponse : ancien régime. Un match crédité depuis le porte à `false`,
  // et sa reprise ne touche donc que la présence — symétrique, comme il faut.
  const reprendreLesStats = sens === -1 && m.recorded_scorer_stats !== false;

  for (const b of buteurs) {
    const compteurs = {
      matches_played: FieldValue.increment(sens),
      updated_at: FieldValue.serverTimestamp(),
      ...(reprendreLesStats
        ? {
          goals: FieldValue.increment(b.buts * sens),
          assists: FieldValue.increment(b.passes * sens),
        }
        : {}),
    };
    if (b.sansCompte) {
      tx.update(
        adminDb.collection("teams").doc(equipeReelle).collection("ghost_players").doc(b.playerId),
        compteurs,
      );
    } else {
      tx.update(adminDb.collection("users").doc(b.playerId), {
        ...compteurs,
        last_match_id: sens === 1 ? matchId : FieldValue.delete(),
      });
    }
  }
}

async function identifier(req: NextRequest): Promise<string | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  try {
    return (await adminAuth.verifyIdToken(header.split("Bearer ")[1])).uid;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const callerUid = await identifier(req);
  if (!callerUid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    teamId?: string;
    isHome?: boolean;
    opponentTeamId?: string;
    opponentManagerId?: string;
    opponentName?: string;
    date?: string;
    time?: string;
    venueName?: string;
    venueCity?: string;
    format?: string;
    scoreUs?: number;
    scoreThem?: number;
    buteurs?: Buteur[];
  };

  const {
    teamId, isHome = true, opponentTeamId = "", opponentManagerId = "",
    opponentName, date, time = "", venueName = "", venueCity = "",
    format = "11v11", scoreUs, scoreThem, buteurs = [],
  } = body;

  if (!teamId || !opponentName?.trim() || !date) {
    return NextResponse.json({ error: "Équipe, adversaire et date requis" }, { status: 400 });
  }
  if (typeof scoreUs !== "number" || typeof scoreThem !== "number" || scoreUs < 0 || scoreThem < 0) {
    return NextResponse.json({ error: "Score invalide" }, { status: 400 });
  }

  // La fenêtre de saisie, bornée des deux côtés.
  //
  // En avant : un match « déjà joué » qui se joue demain n'est pas un
  // historique, c'est une programmation qui contourne le parcours prévu.
  //
  // En arrière : QUATRE-VINGT-DIX JOURS. Un club amateur rattrape le match de
  // dimanche dernier, pas la saison d'il y a deux ans — et plus la date est
  // lointaine, moins il reste de quelqu'un pour démentir un score. La borne
  // est vérifiée ICI et pas seulement à l'écran : le formulaire est une
  // commodité, la règle est au serveur.
  const jour = (d: Date) => {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const aujourdhui = jour(new Date());
  const limite = jour(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));

  if (date >= aujourdhui) {
    return NextResponse.json(
      { error: "Ce parcours ne sert qu'aux matchs déjà joués : choisis une date passée." },
      { status: 400 },
    );
  }
  if (date < limite) {
    return NextResponse.json(
      { error: `Trop ancien : on ne renseigne un match que dans les 90 jours qui suivent (soit depuis le ${limite}).` },
      { status: 400 },
    );
  }

  if (!(await peutGererEquipeServeur(teamId, callerUid))) {
    return NextResponse.json({ error: "Tu ne diriges pas cette équipe" }, { status: 403 });
  }

  const equipeSnap = await adminDb.collection("teams").doc(teamId).get();
  if (!equipeSnap.exists) {
    return NextResponse.json({ error: "Équipe introuvable" }, { status: 404 });
  }
  const nomEquipe = (equipeSnap.data()?.name as string) ?? "Mon équipe";
  const logoEquipe = (equipeSnap.data()?.logo_url as string) ?? null;

  // L'écusson de l'adversaire, quand c'en est un vrai. Une équipe hors
  // plateforme n'a pas de fiche, donc pas de blason : le Direct affichera son
  // initiale, ce qui est la vérité sur elle.
  const logoAdverse = opponentTeamId
    ? ((await adminDb.collection("teams").doc(opponentTeamId).get()).data()?.logo_url as string) ?? null
    : null;

  // On ne se renseigne pas un match contre soi-même.
  if (opponentTeamId && opponentTeamId === teamId) {
    return NextResponse.json({ error: "L'adversaire ne peut pas être cette équipe" }, { status: 400 });
  }

  const contreUnCompte = !!opponentManagerId && !!opponentTeamId;
  const buteursValides = buteurs.filter((b) => b.playerId && (b.buts > 0 || b.passes > 0));

  const doc = {
    home_team_id: isHome ? teamId : opponentTeamId,
    away_team_id: isHome ? opponentTeamId : teamId,
    home_team_name: isHome ? nomEquipe : opponentName.trim(),
    away_team_name: isHome ? opponentName.trim() : nomEquipe,
    home_team_logo: isHome ? logoEquipe : logoAdverse,
    away_team_logo: isHome ? logoAdverse : logoEquipe,
    manager_id: callerUid,
    away_manager_id: contreUnCompte ? opponentManagerId : "",
    date, time,
    venue_name: venueName, venue_city: venueCity,
    status: "completed" as const,
    result: null,
    score_home: isHome ? scoreUs : scoreThem,
    score_away: isHome ? scoreThem : scoreUs,
    referee_id: null, referee_name: null, referee_status: "none" as const,
    local_referee_name: null,
    format, is_home: isHome,
    players_confirmed: 0, players_total: 0,
    confirmed_home: 0, confirmed_away: 0,
    auto_accept_players: false,
    // Ce qui distingue un match renseigné d'un match couvert : il n'a pas de
    // console derrière lui, et l'écran doit pouvoir le dire.
    recorded_at: FieldValue.serverTimestamp(),
    recorded_by: callerUid,
    recorded_scorers: buteursValides,
    // Ce match ne créditera pas les buts de ses buteurs, et sa suppression ne
    // devra donc pas les reprendre. Voir `crediter`.
    recorded_scorer_stats: false,
    // Contre une équipe hors plateforme, tout est crédité d'office, et tout
    // de suite : la trace se pose avec le match.
    ...(contreUnCompte
      ? {}
      : { stats_credited_at: FieldValue.serverTimestamp(), stats_credited_by: callerUid }),
    completed_at: FieldValue.serverTimestamp(),
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };

  const ref = adminDb.collection("matches").doc();

  try {
    await adminDb.runTransaction(async (tx) => {
      tx.set(ref, doc);
      tx.set(
        refValidation(ref.id),
        validationInitiale(ref.id, doc, contreUnCompte ? "pending" : "unverified", null),
      );
      // Contre une équipe KoppaFoot, rien ne compte tant qu'elle n'a pas
      // contresigné : on écrit le match, pas ses conséquences.
      if (!contreUnCompte) {
        crediter(tx, doc as unknown as FirestoreMatch, ref.id, buteursValides, teamId, 1);
      }
    });
  } catch (err) {
    console.error("Enregistrement d'un match joué :", err);
    return NextResponse.json({ error: "L'enregistrement a échoué" }, { status: 500 });
  }

  if (contreUnCompte) {
    try {
      await adminDb.collection("notifications").add({
        user_id: opponentManagerId,
        type: "match_update",
        title: "Un résultat à confirmer",
        body: `${doc.home_team_name} ${doc.score_home} – ${doc.score_away} ${doc.away_team_name}, le ${date}. Confirme ou conteste ce score.`,
        link: `/matches/${ref.id}`,
        read: false,
        created_at: FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.error("Notification de contresignature :", e);
    }
  }

  return NextResponse.json({ id: ref.id, enAttente: contreUnCompte });
}

/**
 * La contresignature de l'adversaire.
 *
 * Un match renseigné contre une équipe KoppaFoot n'a rien crédité : il attend
 * que SON manager dise si le score est le bon. C'est ici que ça se décide, et
 * c'est ici seulement que les compteurs bougent — accepter, c'est valider un
 * résultat qui entre dans son propre bilan.
 */
export async function PATCH(req: NextRequest) {
  const callerUid = await identifier(req);
  if (!callerUid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { matchId, accepte } = (await req.json().catch(() => ({}))) as {
    matchId?: string;
    accepte?: boolean;
  };
  if (!matchId || typeof accepte !== "boolean") {
    return NextResponse.json({ error: "matchId et accepte requis" }, { status: 400 });
  }

  const ref = adminDb.collection("matches").doc(matchId);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  const m = snap.data() as FirestoreMatch & { recorded_scorers?: Buteur[] };

  if (!m.recorded_at) {
    return NextResponse.json({ error: "Ce match n'attend aucune contresignature" }, { status: 400 });
  }
  const validation = await refValidation(matchId).get();
  if ((validation.data() as FirestoreMatchValidation | undefined)?.status !== "pending") {
    return NextResponse.json({ error: "Ce match est déjà tranché" }, { status: 409 });
  }

  // Celui qui contresigne, c'est le manager d'EN FACE — jamais celui qui a
  // saisi : signer son propre résultat ne vaut rien.
  const equipeAdverse = m.is_home ? m.away_team_id : m.home_team_id;
  const autorise = m.away_manager_id === callerUid
    || (await peutGererEquipeServeur(equipeAdverse, callerUid));
  if (!autorise) {
    return NextResponse.json({ error: "Ce résultat ne t'attend pas" }, { status: 403 });
  }

  const equipeQuiSaisit = m.is_home ? m.home_team_id : m.away_team_id;
  // Le camp de celui qui contresigne : celui d'en face, par construction.
  const campAdverse = m.is_home ? "away" : "home";

  try {
    await adminDb.runTransaction(async (tx) => {
      const frais = await tx.get(ref);
      const v = await tx.get(refValidation(matchId));
      const d = frais.data() as FirestoreMatch & { recorded_scorers?: Buteur[] };
      if ((v.data() as FirestoreMatchValidation | undefined)?.status !== "pending") {
        throw new Error("DEJA");
      }

      if (accepte) {
        crediter(tx, d, matchId, d.recorded_scorers ?? [], equipeQuiSaisit, 1);
      }
      tx.update(ref, {
        ...(accepte
          ? {
              stats_credited_at: FieldValue.serverTimestamp(),
              stats_credited_by: callerUid,
              // Un match saisi avant ce changement mais contresigné après vient
              // d'être crédité sous la règle nouvelle : son document doit le dire,
              // sinon sa suppression reprendrait des buts jamais donnés.
              recorded_scorer_stats: false,
            }
          : {}),
        updated_at: FieldValue.serverTimestamp(),
      });
      // La contresignature EST le retour du camp d'en face : on garde qui l'a
      // donnée, et quand.
      tx.update(refValidation(matchId), {
        status: accepte ? "validated" : "contested",
        [`feedback.${campAdverse}`]: {
          validation: accepte ? "validated" : "contested",
          by: callerUid,
          at: new Date().toISOString(),
        },
        updated_at: FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "DEJA") {
      return NextResponse.json({ error: "Ce match est déjà tranché" }, { status: 409 });
    }
    console.error("Contresignature :", err);
    return NextResponse.json({ error: "L'opération a échoué" }, { status: 500 });
  }

  try {
    await adminDb.collection("notifications").add({
      user_id: m.manager_id,
      type: "match_update",
      title: accepte ? "Résultat confirmé" : "Résultat contesté",
      body: `${m.home_team_name} ${m.score_home} – ${m.score_away} ${m.away_team_name}` +
        (accepte ? " : le score est validé et compte." : " : l'adversaire conteste ce score."),
      link: `/matches/${matchId}`,
      read: false,
      created_at: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error("Notification de contresignature :", e);
  }

  return NextResponse.json({ ok: true, valide: accepte });
}

/**
 * Supprimer un match renseigné, en REPRENANT ce qu'il avait crédité.
 *
 * Sans cette reprise, supprimer puis ressaisir doublerait chaque compteur — et
 * c'est précisément le geste qu'on attend de quelqu'un qui s'est trompé de
 * score. Les incréments ne se corrigent pas, ils s'annulent.
 */
export async function DELETE(req: NextRequest) {
  const callerUid = await identifier(req);
  if (!callerUid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { matchId } = (await req.json().catch(() => ({}))) as { matchId?: string };
  if (!matchId) return NextResponse.json({ error: "matchId requis" }, { status: 400 });

  const ref = adminDb.collection("matches").doc(matchId);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  const m = snap.data() as FirestoreMatch & { recorded_scorers?: Buteur[] };

  if (!m.recorded_at) {
    return NextResponse.json(
      { error: "Ce match n'a pas été renseigné à la main" },
      { status: 400 },
    );
  }

  const equipeReelle = m.is_home ? m.home_team_id : m.away_team_id;
  let autorise = m.manager_id === callerUid || (await peutGererEquipeServeur(equipeReelle, callerUid));
  if (!autorise) {
    const caller = await adminDb.collection("users").doc(callerUid).get();
    autorise = caller.exists && estSuperadmin(caller.data());
  }
  if (!autorise) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  try {
    await adminDb.runTransaction(async (tx) => {
      const frais = await tx.get(ref);
      if (!frais.exists) throw new Error("DISPARU");
      const d = frais.data() as FirestoreMatch & { recorded_scorers?: Buteur[] };
      // On ne reprend que ce qui a été effectivement crédité, et c'est
      // `stats_credited_at` qui le dit : un match en attente de contresignature,
      // ou contesté, n'a jamais rien donné à personne.
      if (d.stats_credited_at) {
        crediter(tx, d, matchId, d.recorded_scorers ?? [], equipeReelle, -1);
      }
      tx.delete(ref);
      tx.delete(refValidation(matchId));
    });
  } catch (err) {
    if (err instanceof Error && err.message === "DISPARU") {
      return NextResponse.json({ ok: true });
    }
    console.error("Suppression d'un match renseigné :", err);
    return NextResponse.json({ error: "La suppression a échoué" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
