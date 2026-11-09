// ============================================
// Server-only. Publier le joueur de la semaine, le retirer, le relire.
//
// L'AFFICHE EST FIGÉE À LA PUBLICATION. Elle se dessine une fois, dans ses
// deux formats, et se range dans Storage (`joueurs-semaine/{lundi}/`) : le
// public partage exactement ce que l'administration a vu et validé. Recalculer
// à chaque partage relirait tous les matchs de la plateforme, et l'affiche
// changerait avec une feuille corrigée après coup.
//
// EN JPEG, PAS EN PNG : c'est l'image qu'on joint à un statut WhatsApp, depuis
// un forfait mobile. Le PNG de Satori pèse plusieurs fois plus, pour une
// différence qu'on ne voit pas sur un téléphone.
//
// Voir lib/joueur-semaine-publie pour ce que le public en lit.
// ============================================

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { jourDeLome } from "@/lib/jour";
import { donneesDeLAffiche, imagesDesCandidats, lireLaSemaine } from "@/lib/joueur-semaine-admin";
import { afficheJoueurSemaine } from "@/lib/og-joueur-semaine";
import type { DemandeAffiche } from "@/lib/joueur-semaine-requete";
import {
  COLLECTION_JOUEURS_SEMAINE, lireJoueurDeLaSemaine,
  type EquipeDuJoueurElu, type FormatAffichePubliee, type JoueurDeLaSemaine,
} from "@/lib/joueur-semaine-publie";

const FORMATS: FormatAffichePubliee[] = ["publication", "vertical"];

const dossier = (lundi: string) => `joueurs-semaine/${lundi}/`;
const reference = (lundi: string) => adminDb.collection(COLLECTION_JOUEURS_SEMAINE).doc(lundi);

/** L'élection d'une semaine, pour la page admin : qui, et depuis quand. */
export interface ElectionDeLaSemaine {
  cle: string;
  nom: string;
  publieLe: string;
}

/**
 * Publie le candidat de `demande` comme joueur de sa semaine, ou rend null
 * s'il n'en est pas candidat (avec ces compétitions écartées).
 *
 * REPUBLIER REMPLACE : un autre joueur, un nom corrigé, d'autres partenaires.
 * La date de PREMIÈRE publication reste, elle : corriger une faute le mardi
 * suivant ne doit pas rallonger d'une semaine la diapositive du Direct.
 */
export async function publierLeJoueur(demande: DemandeAffiche, parUid: string): Promise<JoueurDeLaSemaine | null> {
  const semaine = await lireLaSemaine(demande.lundi, demande.ecartees);
  const c = semaine.candidats.find((x) => x.cle === demande.cle);
  if (!c) return null;
  const donnees = await donneesDeLAffiche(demande, semaine);
  if (!donnees) return null;

  // Les affiches d'abord : un document qui pointerait vers des fichiers
  // absents montrerait une vignette cassée.
  const version = randomUUID().replace(/-/g, "").slice(0, 12);
  const bucket = adminStorage.bucket();
  const affiches = {} as Record<FormatAffichePubliee, string>;
  for (const format of FORMATS) {
    const png = await afficheJoueurSemaine(donnees, format);
    const jpeg = await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
    const chemin = `${dossier(demande.lundi)}${version}-${format}.jpg`;
    await bucket.file(chemin).save(jpeg, { contentType: "image/jpeg", resumable: false });
    affiches[format] = chemin;
  }

  // Une équipe par écusson, la plus récente d'abord, comme sur l'affiche.
  const vues = new Set<string>();
  const equipes: EquipeDuJoueurElu[] = [];
  for (const m of [...c.matchs].reverse()) {
    const cle = m.equipeId ?? m.equipe;
    if (vues.has(cle)) continue;
    vues.add(cle);
    equipes.push({ nom: m.equipe, logo: m.ecusson });
  }

  // Sa photo : celle de son profil pour un compte (et relue à chaque lecture,
  // voir `lireLesJoueursDeLaSemaine`) ; pour un joueur sans compte, celle que
  // l'affiche a le droit de montrer, sinon son avatar (voir `genre`).
  const photo = c.uid
    ? (((await adminDb.doc(`users/${c.uid}`).get()).data()?.profile_picture_url as string | undefined) || null)
    : ((await imagesDesCandidats([c])).get(c.cle)?.photo ?? null);

  const ref = reference(demande.lundi);
  const avant = await ref.get();
  const premierJour = (avant.data()?.publie_le_jour as string | undefined) ?? jourDeLome();
  const document = {
    lundi: demande.lundi,
    cle: c.cle,
    nom: demande.nom,
    uid: c.uid,
    equipes,
    matchs: c.matchs.length,
    buts: c.buts,
    passes: c.passes,
    note: c.note,
    homme_du_match: c.hommeDuMatch,
    lignes: c.matchs.map((m) => ({ jour: m.jour, affiche: m.affiche, buts: m.buts, passes: m.passes, homme: m.homme })),
    photo,
    // Celui de l'affiche : le site accorde son titre et choisit son avatar avec.
    genre: donnees.genre ?? null,
    ecartees: demande.ecartees,
    partenaires: demande.partenaires,
    affiches,
    version,
    publie_le_jour: premierJour,
    mis_a_jour_le: FieldValue.serverTimestamp(),
    publie_par: parUid,
  };
  await ref.set(document);

  // Les affiches d'une publication précédente, une fois le document à jour.
  const gardees = new Set(Object.values(affiches));
  const [fichiers] = await bucket.getFiles({ prefix: dossier(demande.lundi) });
  await Promise.all(fichiers.filter((f) => !gardees.has(f.name)).map((f) => f.delete().catch(() => {})));

  return lireJoueurDeLaSemaine(demande.lundi, document);
}

/** Retire l'élection d'une semaine, et ses affiches. Sans effet si elle n'existe pas. */
export async function retirerLeJoueur(lundi: string): Promise<void> {
  await reference(lundi).delete();
  await adminStorage.bucket().deleteFiles({ prefix: dossier(lundi) }).catch(() => {});
}

/** L'élection d'une semaine, ou null. */
export async function lireElection(lundi: string): Promise<ElectionDeLaSemaine | null> {
  const d = (await reference(lundi).get()).data();
  if (!d || typeof d.cle !== "string" || typeof d.nom !== "string") return null;
  return { cle: d.cle, nom: d.nom, publieLe: typeof d.publie_le_jour === "string" ? d.publie_le_jour : "" };
}

/**
 * Les derniers élus, la semaine la plus récente d'abord. Une lecture qui
 * échoue rend une liste vide : le Direct et le classement s'affichent sans.
 *
 * LA PHOTO D'UN COMPTE EST RELUE ICI, sur son profil : celle de la
 * publication a pu changer, ou disparaître, depuis. Une seule lecture groupée.
 */
export async function lireLesJoueursDeLaSemaine(max = 52): Promise<JoueurDeLaSemaine[]> {
  try {
    const snap = await adminDb.collection(COLLECTION_JOUEURS_SEMAINE).orderBy("lundi", "desc").limit(max).get();
    const elus = snap.docs.flatMap((d) => {
      const j = lireJoueurDeLaSemaine(d.id, d.data());
      return j ? [j] : [];
    });
    const uids = [...new Set(elus.flatMap((j) => (j.uid ? [j.uid] : [])))];
    if (uids.length) {
      const comptes = await adminDb.getAll(...uids.map((uid) => adminDb.doc(`users/${uid}`)));
      const photos = new Map(comptes.map((c) => [c.id, (c.data()?.profile_picture_url as string | undefined) || null]));
      for (const j of elus) if (j.uid && photos.has(j.uid)) j.photo = photos.get(j.uid) ?? null;
    }
    return elus;
  } catch (err) {
    console.error("lireLesJoueursDeLaSemaine", err);
    return [];
  }
}

/** L'affiche publiée d'une semaine, en JPEG, avec la version de sa publication ; ou null. */
export async function lireAffichePubliee(
  lundi: string,
  format: FormatAffichePubliee,
): Promise<{ contenu: Buffer; version: string } | null> {
  const d = (await reference(lundi).get()).data();
  const chemin = (d?.affiches as Record<string, unknown> | undefined)?.[format];
  if (typeof chemin !== "string" || !chemin.startsWith(dossier(lundi))) return null;
  try {
    const [contenu] = await adminStorage.bucket().file(chemin).download();
    return { contenu, version: typeof d?.version === "string" ? d.version : "" };
  } catch {
    return null;
  }
}
