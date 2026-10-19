// ============================================
// Server-only. Le joueur de la semaine côté serveur : lire la semaine, les
// photos des candidats, les partenaires du jour.
//
// LA MÊME LECTURE QUE LE CLASSEMENT (`matchsDeLaPlateforme`) : les
// compétitions publiques hors entraînement et hors exhibition, et les amicaux.
// Lue à la demande de l'administration, jamais à l'affichage d'une page.
// ============================================

import { adminDb } from "@/lib/firebase-admin";
import { matchsDeLaPlateforme } from "@/lib/classement-admin";
import {
  classerLaSemaine, detailDePerformance, semaineDu, type CandidatDeLaSemaine, type ClassementDeLaSemaine,
} from "@/lib/joueur-semaine";
import { etatDuConsentement, photoAutorisee, type EtatConsentement } from "@/lib/consentement-image";
import type { DemandeAffiche } from "@/lib/joueur-semaine-requete";
import sharp from "sharp";
import { imageSure } from "@/lib/image-sure";
import { preparerPhoto, type DonneesAffiche } from "@/lib/og-joueur-semaine";
import { cleDeLaLigne, cleSansCompte } from "@/lib/photos-sans-compte";
import type { CompPlayer, FirestoreCompTeam } from "@/types";
import type { LigneSansCompte } from "@/lib/classement";
import {
  formatDe, jourDeLome, partenairesDeLAffiche,
  type FirestorePartenariat, type FormatPartenaire,
} from "@/lib/partenaires";

/** Un partenaire que le pied de l'affiche peut montrer. */
export interface PartenaireDAffiche {
  id: string;
  annonceur: string;
  imageUrl: string | null;
  format: FormatPartenaire;
}

/** La semaine qui commence `lundi`, sans les compétitions écartées. */
export async function lireLaSemaine(lundi: string, ecartees: string[]): Promise<ClassementDeLaSemaine> {
  const matchs = await matchsDeLaPlateforme();
  return classerLaSemaine(matchs, semaineDu(lundi), new Set(ecartees));
}

/**
 * UNE IMAGE DISTANTE, TOUJOURS RÉDUITE. `imageDistante` (lib/og-da) ne réduit
 * que le WebP et coupe à 4 s : le logo PNG de 1,4 Mo d'un club arrivait tel
 * quel en 2 à 4 s, manquait l'affiche quand le réseau traînait, et pesait
 * 1,9 Mo quand il passait. Ici, l'outil d'administration peut attendre 15 s, et
 * l'image repart en PNG à `cote` pixels au plus, quel que soit son format.
 *
 * Seuls les hôtes du Storage du projet sont acceptés (voir `imageSure`).
 */
async function imageReduite(url: string | null | undefined, cote: number): Promise<string | null> {
  const sure = imageSure(url);
  if (!sure) return null;
  try {
    const r = await fetch(sure, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok || !(r.headers.get("content-type") ?? "").startsWith("image/")) return null;
    const png = await sharp(Buffer.from(await r.arrayBuffer()))
      .resize(cote, cote, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Ce qu'on peut montrer d'un candidat : l'état de son consentement, et sa photo si elle est autorisée. */
export interface ImageDuCandidat {
  etat: EtatConsentement;
  /** Seulement si `etat` vaut « oui ». */
  photo: string | null;
}

const AMICAL = "friendly";

/**
 * L'image de chaque candidat, par clé, selon son consentement (voir
 * lib/consentement-image) : jamais une photo sans un « oui » pour elle.
 *
 * Un compte : sa photo de profil, sa réponse, sa date de naissance. Un joueur
 * sans compte : la photo posée sur sa ligne d'effectif, sinon celle de sa
 * fiche de club — le même ordre que `photosSansCompte` —, et la réponse de
 * celui qui l'a posée. Toutes les lectures sont groupées.
 */
export async function imagesDesCandidats(candidats: CandidatDeLaSemaine[]): Promise<Map<string, ImageDuCandidat>> {
  const jour = jourDeLome();
  const images = new Map<string, ImageDuCandidat>();
  const aucune: ImageDuCandidat = { etat: "aucun", photo: null };
  const juger = (photo: string | null, consentement: unknown, dateNaissance?: string | null): ImageDuCandidat => {
    const sujet = { photo, consentement, dateNaissance };
    return { etat: etatDuConsentement(sujet, jour), photo: photoAutorisee(sujet, jour) };
  };

  // Les comptes.
  const uids = [...new Set(candidats.flatMap((c) => (c.uid ? [c.uid] : [])))];
  const comptes = new Map<string, FirebaseFirestore.DocumentData | undefined>();
  if (uids.length) {
    const docs = await adminDb.getAll(...uids.map((uid) => adminDb.doc(`users/${uid}`)));
    for (const d of docs) comptes.set(d.id, d.data());
  }

  // Les équipes de compétition des joueurs sans compte.
  const chemin = (l: LigneSansCompte) => `competitions/${l.competitionId}/comp_teams/${l.teamId}`;
  const sansCompte = candidats.filter((c) => !c.uid && c.ligneSansCompte);
  const chemins = [...new Set(sansCompte.flatMap((c) =>
    c.ligneSansCompte!.competitionId !== AMICAL && c.ligneSansCompte!.teamId ? [chemin(c.ligneSansCompte!)] : []))];
  const equipes = new Map(
    (chemins.length ? await adminDb.getAll(...chemins.map((p) => adminDb.doc(p))) : [])
      .map((d) => [d.ref.path, d.data() as FirestoreCompTeam | undefined]),
  );

  // Pour chacun : la ligne qui porte sa photo, ou la fiche de club où la lire.
  const fiches = new Map<string, string>();
  for (const c of candidats) {
    if (c.uid) {
      const u = comptes.get(c.uid);
      images.set(c.cle, juger((u?.profile_picture_url as string | undefined) || null, u?.consentement_image, u?.date_of_birth as string | undefined));
      continue;
    }
    const l = c.ligneSansCompte;
    images.set(c.cle, aucune);
    if (!l) continue;
    if (l.competitionId === AMICAL) {
      const fiche = cleSansCompte(l.teamId, l.playerId);
      if (fiche) fiches.set(c.cle, fiche);
      continue;
    }
    const equipe = equipes.get(chemin(l));
    const ligne = equipe?.players?.find((p) => p.id === l.playerId) as (CompPlayer & { photo_consentement?: unknown }) | undefined;
    if (!ligne || ligne.user_id) continue;
    if (ligne.photo_url) {
      images.set(c.cle, juger(ligne.photo_url, ligne.photo_consentement));
      continue;
    }
    const fiche = cleDeLaLigne(equipe?.claimed_by_team_id, ligne);
    if (fiche) fiches.set(c.cle, fiche);
  }

  const aLire = [...new Set(fiches.values())];
  if (aLire.length) {
    const docs = await adminDb.getAll(...aLire.map((f) => {
      const [clubId, ghostId] = f.split(":");
      return adminDb.doc(`teams/${clubId}/ghost_players/${ghostId}`);
    }));
    const parFiche = new Map(docs.map((d, i) => [aLire[i], d.data()]));
    for (const [cle, fiche] of fiches) {
      const g = parFiche.get(fiche);
      const photo = typeof g?.photo_url === "string" && g.photo_url ? g.photo_url : null;
      images.set(cle, juger(photo, g?.photo_consentement));
    }
  }
  return images;
}

/**
 * De quoi dessiner l'affiche d'un candidat, d'après ce que la base en dit et
 * les deux choix de l'admin (le nom affiché, les partenaires). Null : ce joueur
 * n'est pas candidat cette semaine-là, avec ces compétitions écartées.
 *
 * Toutes les images sont téléchargées ici (`imageReduite`) : Satori échouerait
 * sur une adresse qui ne répond pas, et ne lit pas le WebP. Une photo qui
 * n'est pas autorisée n'est même pas téléchargée.
 */
export async function donneesDeLAffiche(demande: DemandeAffiche): Promise<DonneesAffiche | null> {
  const semaine = await lireLaSemaine(demande.lundi, demande.ecartees);
  const c = semaine.candidats.find((x) => x.cle === demande.cle);
  if (!c) return null;

  const autorisee = (await imagesDesCandidats([c])).get(c.cle)?.photo ?? null;
  const distante = await imageReduite(autorisee, 1200);
  const photo = distante ? await preparerPhoto(Buffer.from(distante.split(",")[1], "base64")) : null;

  const logos = new Map<string, string | null>();
  const logo = async (url: string | null) => {
    if (!url) return null;
    if (!logos.has(url)) logos.set(url, await imageReduite(url, 200));
    return logos.get(url) ?? null;
  };

  const lignes: DonneesAffiche["lignes"] = [];
  for (const m of c.matchs) {
    lignes.push({
      jour: m.jour, competition: m.competition, equipe: m.equipe, ecusson: await logo(m.ecusson),
      affiche: m.affiche, detail: detailDePerformance(m.buts, m.passes),
    });
  }
  // Une équipe par écusson, la plus récente d'abord.
  const vues = new Set<string>();
  const ecussons: DonneesAffiche["ecussons"] = [];
  for (const m of [...c.matchs].reverse()) {
    const cle = m.equipeId ?? m.equipe;
    if (vues.has(cle)) continue;
    vues.add(cle);
    ecussons.push({ equipe: m.equipe, logo: await logo(m.ecusson) });
  }

  const retenus = (await partenairesDuJour()).filter((p) => demande.partenaires.includes(p.id)).slice(0, 2);
  const partenaires = await Promise.all(
    retenus.map(async (p) => ({ annonceur: p.annonceur, image: await imageReduite(p.imageUrl, 1200) })),
  );

  return { nom: demande.nom, numeroSemaine: semaine.semaine.numero, photo, lignes, ecussons, partenaires };
}

/** Les partenaires de l'emplacement `affiche_semaine` à l'affiche aujourd'hui, dans l'ordre proposé. */
export async function partenairesDuJour(): Promise<PartenaireDAffiche[]> {
  const snap = await adminDb.collection("partenariats").where("emplacements", "array-contains", "affiche_semaine").get();
  const candidats = snap.docs.map((d) => ({ id: d.id, ...(d.data() as FirestorePartenariat) }));
  return partenairesDeLAffiche(candidats, jourDeLome()).map((p) => ({
    id: p.id,
    annonceur: p.annonceur,
    imageUrl: p.image_url ?? null,
    format: formatDe(p),
  }));
}
