import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import { obstaclesDuCompte, purgerCompte } from "@/lib/account-purge";

/**
 * L'administration des enregistrements : corriger, ou effacer.
 *
 * POURQUOI CETTE ROUTE EXISTE. La base accumule ce qu'aucune règle ne peut
 * empêcher : une équipe créée pour tester, un compte au nom injurieux, un match
 * saisi trois fois, un dump d'import raté. Rien de tout ça ne se corrige depuis
 * le produit — le propriétaire d'une donnée non conforme n'a aucune raison de
 * la nettoyer, et souvent il n'existe plus.
 *
 * UNE SEULE ROUTE POUR TROIS RESSOURCES, et pas trois routes jumelles :
 * l'autorisation et la liste blanche des champs sont exactement les mêmes,
 * seule la cascade de suppression diffère.
 *
 * LA LISTE BLANCHE N'EST PAS UNE FORMALITÉ. Sans elle, cette route serait un
 * « écris n'importe quel champ sur n'importe quel document », c'est-à-dire de
 * quoi se donner `is_superadmin` en une requête. Le rôle et les casquettes ne
 * se touchent PAS ici : ils ont leur propre route, /api/admin/promote, avec ses
 * propres garde-fous.
 *
 * CE QU'UNE SUPPRESSION EMPORTE suit la règle déjà écrite pour la suppression
 * de compte : ce qui décrit l'entité part, ce qui décrit CE QUI S'EST PASSÉ
 * reste. Effacer une équipe ne réécrit pas les feuilles des matchs qu'elle a
 * joués : ces buts appartiennent aussi à l'adversaire.
 */

type Ressource = "team" | "user" | "match";

/** Ce qu'un administrateur peut corriger, ressource par ressource. */
const CHAMPS_MODIFIABLES: Record<Ressource, string[]> = {
  team: [
    "name", "city", "description", "level", "is_recruiting",
    "max_members", "slogan", "color",
  ],
  // Ni `user_type`, ni `is_superadmin`, ni les casquettes : voir plus haut.
  // `is_active` reste, c'est la suspension, et elle n'accorde rien.
  user: [
    "first_name", "last_name", "location_city", "bio",
    "position", "skill_level", "is_active",
  ],
  match: [
    "date", "time", "venue_name", "venue_city", "status",
    "score_home", "score_away", "format",
  ],
};

const COLLECTIONS: Record<Ressource, string> = {
  team: "teams",
  user: "users",
  match: "matches",
};

/** Firestore refuse plus de 500 écritures par lot. */
const TAILLE_LOT = 400;

/** Supprime en lots tous les documents d'une collection portant cette valeur. */
async function supprimerPar(collection: string, champ: string, valeur: string): Promise<number> {
  let total = 0;
  for (;;) {
    const snap = await adminDb
      .collection(collection)
      .where(champ, "==", valeur)
      .limit(TAILLE_LOT)
      .get();
    if (snap.empty) return total;

    const lot = adminDb.batch();
    snap.docs.forEach((d) => lot.delete(d.ref));
    await lot.commit();
    total += snap.size;

    if (snap.size < TAILLE_LOT) return total;
  }
}

/** Vide une sous-collection : supprimer un document ne l'emporte pas. */
async function viderSousCollection(
  parent: FirebaseFirestore.DocumentReference,
  nom: string,
): Promise<number> {
  const snap = await parent.collection(nom).get();
  if (snap.empty) return 0;
  const lot = adminDb.batch();
  snap.docs.forEach((d) => lot.delete(d.ref));
  await lot.commit();
  return snap.size;
}

async function supprimerEquipe(id: string): Promise<Record<string, number>> {
  const ref = adminDb.collection("teams").doc(id);
  const bilan: Record<string, number> = {};

  // L'effectif fantôme vit sous l'équipe : sans ça, il resterait dans la base,
  // invisible et inatteignable.
  bilan.joueursFantomes = await viderSousCollection(ref, "ghost_players").catch(() => 0);
  bilan.abonnements = await supprimerPar("team_follows", "team_id", id).catch(() => 0);
  bilan.candidatures = await supprimerPar("join_requests", "team_id", id).catch(() => 0);
  bilan.entrainements = await supprimerPar("trainings", "team_id", id).catch(() => 0);

  // Les matchs joués restent : ils portent les noms en copie et racontent ce
  // qui s'est passé, y compris pour l'équipe d'en face.
  await ref.delete();
  bilan.equipe = 1;
  return bilan;
}

async function supprimerMatch(id: string): Promise<Record<string, number>> {
  const ref = adminDb.collection("matches").doc(id);
  const bilan: Record<string, number> = {};

  // Ici, au contraire d'une équipe, la feuille de match n'a plus de match à
  // décrire : elle part avec lui, sinon elle survivrait comme une ligne de
  // statistiques sans rencontre.
  bilan.feuilles = await supprimerPar("participations", "match_id", id).catch(() => 0);
  bilan.pronostics = await supprimerPar("match_predictions", "match_id", id).catch(() => 0);
  bilan.messages = await viderSousCollection(ref, "messages").catch(() => 0);

  await ref.delete();
  bilan.match = 1;
  return bilan;
}

export async function POST(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;

  const { resource, id, action, data, force } = (await req.json().catch(() => ({}))) as {
    resource?: Ressource;
    id?: string;
    action?: "update" | "delete";
    data?: Record<string, unknown>;
    force?: boolean;
  };

  if (!resource || !(resource in COLLECTIONS)) {
    return NextResponse.json({ error: "Ressource inconnue" }, { status: 400 });
  }
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  if (action !== "update" && action !== "delete") {
    return NextResponse.json({ error: "Action invalide (update|delete)" }, { status: 400 });
  }

  const ref = adminDb.collection(COLLECTIONS[resource]).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }

  if (action === "update") {
    const permis = CHAMPS_MODIFIABLES[resource];
    const propre: Record<string, unknown> = {};
    for (const [cle, valeur] of Object.entries(data ?? {})) {
      if (permis.includes(cle) && valeur !== undefined) propre[cle] = valeur;
    }
    if (!Object.keys(propre).length) {
      return NextResponse.json({ error: "Aucun champ modifiable fourni" }, { status: 400 });
    }
    propre.updated_at = FieldValue.serverTimestamp();
    await ref.update(propre);
    return NextResponse.json({ ok: true, champs: Object.keys(propre).length - 1 });
  }

  // --- Suppression -------------------------------------------------------
  //
  // Un administrateur ne s'efface pas lui-même par ce chemin : la route
  // s'authentifie avec SON jeton, et le compte disparaîtrait au milieu de sa
  // propre requête.
  if (resource === "user" && id === appelant.uid) {
    return NextResponse.json(
      { error: "Utilisez la suppression de compte depuis votre profil." },
      { status: 400 },
    );
  }

  try {
    if (resource === "user") {
      // Ce que le compte tient et qui appartient à d'autres. On le dit, et on
      // laisse passer outre : l'équipe d'un compte de test n'a personne à qui
      // être confiée, et c'est précisément ce qu'on vient nettoyer.
      if (!force) {
        const empeche = await obstaclesDuCompte(id);
        if (empeche.length > 0) {
          return NextResponse.json({ error: "obstacles", obstacles: empeche }, { status: 409 });
        }
      }
      const bilan = await purgerCompte(id);
      return NextResponse.json({ ok: true, bilan });
    }

    const bilan = resource === "team" ? await supprimerEquipe(id) : await supprimerMatch(id);
    return NextResponse.json({ ok: true, bilan });
  } catch (err) {
    console.error(`[admin/records] suppression ${resource}/${id} echouee :`, err);
    return NextResponse.json({ error: "La suppression a échoué" }, { status: 500 });
  }
}
