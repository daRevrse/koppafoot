import { adminAuth, adminDb, adminStorage } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// ============================================
// Effacer un compte, et tout ce qui le décrit.
//
// EXTRAIT DE /api/account/delete pour une raison précise : l'administration a
// besoin du MÊME effacement, sur le compte de quelqu'un d'autre. Deux copies
// de cette cascade auraient dérivé au premier ajout de collection, et la
// seconde aurait laissé des documents orphelins que personne n'aurait
// cherchés.
//
// Ce qui reste propre à chaque appelant n'est PAS ici : la reconnexion récente
// et le mot à taper protègent quelqu'un qui efface son propre compte, le
// contrôle superadmin protège l'autre chemin. Ce module ne pose aucune
// question, il exécute.
//
// LA RÈGLE, elle, est unique : ce qui décrit LA PERSONNE part, ce qui décrit
// CE QUI S'EST PASSÉ reste. Les feuilles de match gardent les buts, elles
// portent le nom du joueur en copie et restent lisibles sans sa fiche.
// ============================================

/** Firestore refuse plus de 500 écritures par lot. */
const TAILLE_LOT = 400;

type Suppression = { collection: string; champ: string };

/**
 * Tout ce qui décrit la personne, et qui part avec elle.
 *
 * Les `invitations` et les `join_requests` apparaissent des deux côtés :
 * celles qu'on a reçues comme celles qu'on a envoyées. En laisser un côté
 * afficherait une demande venant d'un compte qui n'existe plus.
 */
const A_SUPPRIMER: Suppression[] = [
  { collection: "notifications", champ: "user_id" },
  { collection: "bookings", champ: "user_id" },
  { collection: "shortlists", champ: "manager_id" },
  { collection: "shortlists", champ: "player_id" },
  { collection: "join_requests", champ: "player_id" },
  { collection: "invitations", champ: "receiver_id" },
  { collection: "invitations", champ: "sender_id" },
  { collection: "player_ratings", champ: "rated_by" },
  { collection: "match_predictions", champ: "uid" },
];

/**
 * Les publications, et ce qui pend dessous.
 *
 * Supprimer un document ne supprime pas ses sous-collections : les
 * commentaires d'un post effacé resteraient dans la base, invisibles et
 * inatteignables. Ils partent avec lui.
 *
 * Les commentaires laissés SOUS LES POSTS DES AUTRES sont un cas distinct :
 * ils portent le nom de leur auteur et vivent dans la conversation de
 * quelqu'un d'autre. Ils partent aussi, une phrase signée par un compte qui
 * n'existe plus n'ayant plus de répondant.
 */
async function supprimerPublications(uid: string): Promise<{ posts: number; commentaires: number }> {
  let posts = 0;
  let commentaires = 0;

  for (;;) {
    const snap = await adminDb
      .collection("posts")
      .where("author_id", "==", uid)
      .limit(50)
      .get();
    if (snap.empty) break;

    for (const d of snap.docs) {
      const sous = await d.ref.collection("comments").get();
      const lot = adminDb.batch();
      sous.docs.forEach((c) => lot.delete(c.ref));
      lot.delete(d.ref);
      await lot.commit();
      commentaires += sous.size;
      posts += 1;
    }
    if (snap.size < 50) break;
  }

  // Ses commentaires ailleurs. La requête traverse toutes les sous-collections
  // « comments » à la fois ; si l'index de groupe manque, l'appelant le voit
  // dans les journaux et le reste de la suppression se poursuit.
  const ailleurs = await adminDb
    .collectionGroup("comments")
    .where("author_id", "==", uid)
    .get();
  for (const c of ailleurs.docs) {
    const lot = adminDb.batch();
    lot.delete(c.ref);
    const post = c.ref.parent.parent;
    if (post) lot.update(post, { comment_count: FieldValue.increment(-1) });
    await lot.commit().catch(() => {});
    commentaires += 1;
  }

  return { posts, commentaires };
}

async function supprimerPar(collection: string, champ: string, uid: string): Promise<number> {
  let total = 0;
  for (;;) {
    const snap = await adminDb
      .collection(collection)
      .where(champ, "==", uid)
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

/**
 * Les abonnements tiennent des compteurs sur la fiche d'en face. Les effacer
 * sans décrémenter laisserait des comptes avec « 12 abonnés » et onze fiches
 * en face.
 */
async function defaireAbonnements(uid: string): Promise<{ suivis: number; abonnes: number; equipes: number }> {
  const bilan = { suivis: 0, abonnes: 0, equipes: 0 };

  const suivis = await adminDb.collection("follows").where("follower_id", "==", uid).get();
  for (const d of suivis.docs) {
    const cible = d.data().following_id as string | undefined;
    const lot = adminDb.batch();
    lot.delete(d.ref);
    if (cible) {
      lot.update(adminDb.collection("users").doc(cible), {
        followers_count: FieldValue.increment(-1),
      });
    }
    await lot.commit().catch(() => {});
    bilan.suivis += 1;
  }

  const abonnes = await adminDb.collection("follows").where("following_id", "==", uid).get();
  for (const d of abonnes.docs) {
    const suiveur = d.data().follower_id as string | undefined;
    const lot = adminDb.batch();
    lot.delete(d.ref);
    if (suiveur) {
      lot.update(adminDb.collection("users").doc(suiveur), {
        following_count: FieldValue.increment(-1),
      });
    }
    await lot.commit().catch(() => {});
    bilan.abonnes += 1;
  }

  const equipes = await adminDb.collection("team_follows").where("follower_id", "==", uid).get();
  for (const d of equipes.docs) {
    const equipe = d.data().team_id as string | undefined;
    const lot = adminDb.batch();
    lot.delete(d.ref);
    if (equipe) {
      lot.update(adminDb.collection("teams").doc(equipe), {
        followers_count: FieldValue.increment(-1),
      });
    }
    await lot.commit().catch(() => {});
    bilan.equipes += 1;
  }

  return bilan;
}

/**
 * Ce que le compte tient et qui appartient à d'autres.
 *
 * Un compte qui gère une équipe, organise une compétition ou possède un
 * terrain tient quelque chose dont d'autres dépendent. L'effacer laisserait
 * une équipe sans manager, une compétition sans organisateur, un terrain sans
 * personne pour répondre. L'appelant décide quoi en faire : le propriétaire du
 * compte doit passer la main d'abord, l'administration peut passer outre en le
 * sachant.
 */
export async function obstaclesDuCompte(uid: string): Promise<string[]> {
  const [equipes, competitions, terrains] = await Promise.all([
    adminDb.collection("teams").where("manager_id", "==", uid).limit(5).get(),
    adminDb.collection("competitions").where("organizer_id", "==", uid).limit(5).get(),
    adminDb.collection("venues").where("owner_id", "==", uid).limit(5).get(),
  ]);

  const liste: string[] = [];
  if (!equipes.empty) {
    const noms = equipes.docs.map((d) => (d.data().name as string) ?? "une équipe").join(", ");
    liste.push(
      `Vous gérez ${equipes.size > 1 ? "les équipes" : "l'équipe"} ${noms}. ` +
        "Confiez la gestion à un autre membre avant de partir.",
    );
  }
  if (!competitions.empty) {
    const noms = competitions.docs.map((d) => (d.data().name as string) ?? "une compétition").join(", ");
    liste.push(
      `Vous organisez ${noms}. Nommez un autre organisateur, ou clôturez la ` +
        "compétition, avant de supprimer votre compte.",
    );
  }
  if (!terrains.empty) {
    const noms = terrains.docs.map((d) => (d.data().name as string) ?? "un terrain").join(", ");
    liste.push(
      `Vous êtes propriétaire de ${noms}. Retirez la fiche du terrain, ou ` +
        "transférez-la, avant de supprimer votre compte.",
    );
  }
  return liste;
}

/**
 * La cascade. Rend le bilan de ce qui est parti, collection par collection.
 *
 * CHAQUE ÉTAPE EST INDÉPENDANTE et rattrape ses propres erreurs : une
 * collection absente ou un index manquant ne doit pas laisser un compte à
 * moitié supprimé, dans un état que personne ne saurait décrire.
 *
 * L'ORDRE COMPTE, à deux endroits. La fiche part en dernier parmi les données :
 * tant qu'elle existe, une suppression interrompue reste rattrapable. Le compte
 * d'authentification part après tout le reste : c'est lui qui rend l'adresse ou
 * le numéro réutilisable.
 */
export async function purgerCompte(uid: string): Promise<Record<string, number>> {
  const bilan: Record<string, number> = {};

  try {
    const pub = await supprimerPublications(uid);
    bilan.publications = pub.posts;
    bilan.commentaires = pub.commentaires;
  } catch (err) {
    console.error("Publications non supprimees:", err);
  }

  for (const { collection, champ } of A_SUPPRIMER) {
    try {
      const n = await supprimerPar(collection, champ, uid);
      if (n > 0) bilan[`${collection}.${champ}`] = n;
    } catch (err) {
      // Une collection absente ou un index manquant ne doit pas laisser le
      // compte à moitié supprimé : on note et on continue.
      console.error(`Suppression ${collection}.${champ} échouée:`, err);
    }
  }

  try {
    const ab = await defaireAbonnements(uid);
    Object.assign(bilan, { suivis: ab.suivis, abonnes: ab.abonnes, equipesSuivies: ab.equipes });
  } catch (err) {
    console.error("Abonnements non défaits:", err);
  }

  // Sortir des effectifs. Les feuilles de match déjà jouées, elles, gardent
  // le passage du joueur : ce sont deux choses différentes.
  try {
    const equipes = await adminDb.collection("teams").where("member_ids", "array-contains", uid).get();
    for (const d of equipes.docs) {
      await d.ref.update({
        member_ids: FieldValue.arrayRemove(uid),
        members_count: FieldValue.increment(-1),
      }).catch(() => {});
    }
    bilan.equipesQuittees = equipes.size;
  } catch (err) {
    console.error("Sortie des effectifs échouée:", err);
  }

  // Les fichiers : photo de profil, couverture, galerie, tous sous le même
  // préfixe.
  try {
    await adminStorage.bucket().deleteFiles({ prefix: `users/${uid}/` });
  } catch (err) {
    console.error("Fichiers non supprimés:", err);
  }

  // La fiche en dernier parmi les données : tant qu'elle existe, une
  // suppression interrompue reste rattrapable.
  try {
    await adminDb.collection("users").doc(uid).delete();
    bilan.fiche = 1;
  } catch (err) {
    console.error("Fiche non supprimée:", err);
    // Seul échec qui interrompt : sans lui le compte resterait visible et à
    // moitié vidé. L'appelant traduit ça en message.
    throw new Error("FICHE_NON_SUPPRIMEE");
  }

  // Le compte d'authentification en tout dernier : c'est lui qui rend l'adresse
  // ou le numéro réutilisable, et il ne doit l'être qu'une fois le reste parti.
  try {
    await adminAuth.deleteUser(uid);
  } catch (err) {
    console.error("Compte d'authentification non supprimé:", err);
  }


  // Le compte d'authentification en tout dernier : c'est lui qui rend l'adresse
  // ou le numéro réutilisable, et il ne doit l'être qu'une fois le reste parti.
  try {
    await adminAuth.deleteUser(uid);
  } catch (err) {
    console.error("Compte d'authentification non supprimé:", err);
  }

  return bilan;
}
