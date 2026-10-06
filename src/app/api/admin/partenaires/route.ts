import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import { effacerVisuels, stockerVisuel } from "@/lib/visuel-serveur";
import {
  EMPLACEMENTS, FORMATS, jourValide, lienValide,
  type EmplacementPartenaire, type FirestorePartenariat, type FormatPartenaire,
} from "@/lib/partenaires";

/**
 * Les partenaires, côté administration.
 *
 * GET                       , tous les partenariats, compteurs compris.
 * POST   { …champs, image? } , en créer un.
 * PATCH  { id, …champs, image?, retirerImage? } , le modifier.
 * DELETE { id }              , le supprimer, visuel compris.
 *
 * Superadmin seulement. La collection est fermée aux navigateurs
 * (firestore.rules), et le visuel s'écrit par le SDK admin, comme l'avatar de
 * la Tribune : une règle Storage ne sait pas vérifier qui est administrateur.
 */

const COLLECTION = "partenariats";

interface Champs {
  annonceur?: string;
  accroche?: string | null;
  format?: string;
  lien?: string | null;
  emplacements?: string[];
  /** L'adresse de la compétition, son identifiant ou son slug ; vide = toutes. */
  competition?: string | null;
  debut?: string;
  fin?: string;
  actif?: boolean;
  /** Nouveau visuel, en base64 : le navigateur ne peut pas écrire le bucket. */
  image?: { data?: string; contentType?: string } | null;
  retirerImage?: boolean;
  /** Le visuel vertical d'une bannière (1:2), facultatif, même transport. */
  imageVerticale?: { data?: string; contentType?: string } | null;
  retirerImageVerticale?: boolean;
}

type Erreur = { erreur: string };
const estErreur = (x: unknown): x is Erreur => typeof x === "object" && x !== null && "erreur" in x;

/** Une compétition à partir de ce que l'administrateur a collé : adresse, slug ou identifiant. */
async function resoudreCompetition(saisie: string | null | undefined): Promise<{ id: string; nom: string } | null | Erreur> {
  const brut = (saisie ?? "").trim();
  if (!brut) return null;
  const cle = brut.includes("/c/") ? brut.split("/c/")[1].split(/[/?#]/)[0] : brut;
  const parId = await adminDb.collection("competitions").doc(cle).get();
  if (parId.exists) return { id: parId.id, nom: String(parId.data()?.name ?? "") };
  const parSlug = await adminDb.collection("competitions").where("slug", "==", cle).limit(1).get();
  if (!parSlug.empty) return { id: parSlug.docs[0].id, nom: String(parSlug.docs[0].data().name ?? "") };
  return { erreur: `Aucune compétition ne correspond à « ${brut} ».` };
}

/** Les champs reçus, vérifiés et mis au format du document. `partiel` : seuls ceux qui sont là. */
async function nettoyer(c: Champs, partiel: boolean): Promise<Partial<FirestorePartenariat> | Erreur> {
  const out: Partial<FirestorePartenariat> = {};

  if (!partiel || c.annonceur !== undefined) {
    const annonceur = (c.annonceur ?? "").trim();
    if (!annonceur || annonceur.length > 80) return { erreur: "Le nom de l'annonceur est requis (80 caractères au plus)." };
    out.annonceur = annonceur;
  }
  if (!partiel || c.accroche !== undefined) {
    const accroche = (c.accroche ?? "").trim();
    if (accroche.length > 120) return { erreur: "L'accroche tient en 120 caractères." };
    out.accroche = accroche || null;
  }
  if (!partiel || c.format !== undefined) {
    const format = c.format ?? "logo";
    if (!(FORMATS as readonly string[]).includes(format)) return { erreur: "Format inconnu." };
    out.format = format as FormatPartenaire;
  }
  if (!partiel || c.lien !== undefined) {
    const brut = (c.lien ?? "").trim();
    const lien = lienValide(brut);
    if (brut && !lien) return { erreur: "Le lien doit être une adresse complète en https://." };
    out.lien = lien;
  }
  if (!partiel || c.emplacements !== undefined) {
    const emplacements = (c.emplacements ?? []).filter((e): e is EmplacementPartenaire =>
      (EMPLACEMENTS as readonly string[]).includes(e));
    if (!emplacements.length) return { erreur: "Choisis au moins un emplacement." };
    out.emplacements = [...new Set(emplacements)];
  }
  if (!partiel || c.competition !== undefined) {
    const comp = await resoudreCompetition(c.competition);
    if (estErreur(comp)) return comp;
    out.competition_id = comp?.id ?? null;
    out.competition_nom = comp?.nom ?? null;
  }
  if (!partiel || c.debut !== undefined || c.fin !== undefined) {
    if (!jourValide(c.debut) || !jourValide(c.fin)) return { erreur: "Les dates de début et de fin sont requises." };
    if (c.fin! < c.debut!) return { erreur: "La fin ne peut pas précéder le début." };
    out.debut = c.debut!;
    out.fin = c.fin!;
  }
  if (!partiel || c.actif !== undefined) out.actif = c.actif !== false;
  return out;
}

/**
 * Une bannière sans image n'a rien à montrer. Vérifié AVANT d'envoyer quoi que
 * ce soit à Storage : un refus ne laisse pas de fichier orphelin.
 */
const SANS_VISUEL = "Une bannière a besoin de son visuel : ajoute l'image, ou choisis le format « Logo et nom ».";

/**
 * Les visuels d'un partenaire, sous `partenaires/{id}/` : la bannière (ou le
 * logo) en `visuel-…`, le vertical en `verticale-…`. Chacun remplace SON
 * ancien fichier, et lui seul : effacer tout le dossier, comme avant le
 * vertical, emporterait l'autre visuel à chaque changement.
 */
const visuel = (id: string) => `partenaires/${id}/visuel-`;
const verticale = (id: string) => `partenaires/${id}/verticale-`;
const stockerVisuelPartenaire = (id: string, image: NonNullable<Champs["image"]>) =>
  stockerVisuel(visuel(id), image, visuel(id));
const stockerVerticalePartenaire = (id: string, image: NonNullable<Champs["image"]>) =>
  stockerVisuel(verticale(id), image, verticale(id));

export async function GET(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    const snap = await adminDb.collection(COLLECTION).orderBy("created_at", "desc").limit(200).get();
    return NextResponse.json({
      partenaires: snap.docs.map((d) => {
        const p = d.data() as FirestorePartenariat;
        return {
          id: d.id,
          annonceur: p.annonceur,
          accroche: p.accroche ?? null,
          format: p.format ?? "logo",
          imageUrl: p.image_url ?? null,
          imageVerticaleUrl: p.image_verticale_url ?? null,
          lien: p.lien ?? null,
          emplacements: p.emplacements ?? [],
          competitionId: p.competition_id ?? null,
          competitionNom: p.competition_nom ?? null,
          debut: p.debut,
          fin: p.fin,
          actif: p.actif !== false,
          vues: p.vues ?? 0,
          clics: p.clics ?? 0,
        };
      }),
    });
  } catch (err) {
    console.error("[admin/partenaires GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    const corps = (await req.json()) as Champs;
    const champs = await nettoyer(corps, false);
    if (estErreur(champs)) return NextResponse.json({ error: champs.erreur }, { status: 400 });
    if (champs.format === "banniere" && !corps.image?.data) {
      return NextResponse.json({ error: SANS_VISUEL }, { status: 400 });
    }

    const ref = adminDb.collection(COLLECTION).doc();
    let imageUrl: string | null = null;
    if (corps.image?.data) {
      const url = await stockerVisuelPartenaire(ref.id, corps.image);
      if (estErreur(url)) return NextResponse.json({ error: url.erreur }, { status: 400 });
      imageUrl = url;
    }
    // Le vertical ne sert qu'une bannière : envoyé avec un logo, il est ignoré.
    let imageVerticaleUrl: string | null = null;
    if (champs.format === "banniere" && corps.imageVerticale?.data) {
      const url = await stockerVerticalePartenaire(ref.id, corps.imageVerticale);
      if (estErreur(url)) return NextResponse.json({ error: url.erreur }, { status: 400 });
      imageVerticaleUrl = url;
    }
    await ref.set({
      ...champs,
      image_url: imageUrl,
      image_verticale_url: imageVerticaleUrl,
      vues: 0,
      clics: 0,
      created_by: appelant.uid,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (err) {
    console.error("[admin/partenaires POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    const corps = (await req.json()) as Champs & { id?: string };
    if (!corps.id) return NextResponse.json({ error: "Identifiant manquant" }, { status: 400 });
    const ref = adminDb.collection(COLLECTION).doc(corps.id);
    const avant = await ref.get();
    if (!avant.exists) return NextResponse.json({ error: "Partenariat introuvable" }, { status: 404 });

    const champs = await nettoyer(corps, true);
    if (estErreur(champs)) return NextResponse.json({ error: champs.erreur }, { status: 400 });

    // Le format et le visuel tels qu'ils seront APRÈS la modification : un
    // changement de format, un visuel retiré, ou les deux à la fois.
    const actuel = avant.data() as FirestorePartenariat;
    const format = champs.format ?? actuel.format ?? "logo";
    const aUnVisuel = Boolean(corps.image?.data) || (!corps.retirerImage && Boolean(actuel.image_url));
    if (format === "banniere" && !aUnVisuel) {
      return NextResponse.json({ error: SANS_VISUEL }, { status: 400 });
    }

    const maj: Record<string, unknown> = { ...champs, updated_at: FieldValue.serverTimestamp() };
    if (corps.image?.data) {
      const url = await stockerVisuelPartenaire(ref.id, corps.image);
      if (estErreur(url)) return NextResponse.json({ error: url.erreur }, { status: 400 });
      maj.image_url = url;
    } else if (corps.retirerImage) {
      await effacerVisuels(visuel(ref.id));
      maj.image_url = null;
    }
    // Passé en logo, le vertical n'a plus d'usage : il part avec.
    if (format !== "banniere" && actuel.image_verticale_url) {
      await effacerVisuels(verticale(ref.id));
      maj.image_verticale_url = null;
    } else if (format === "banniere" && corps.imageVerticale?.data) {
      const url = await stockerVerticalePartenaire(ref.id, corps.imageVerticale);
      if (estErreur(url)) return NextResponse.json({ error: url.erreur }, { status: 400 });
      maj.image_verticale_url = url;
    } else if (corps.retirerImageVerticale) {
      await effacerVisuels(verticale(ref.id));
      maj.image_verticale_url = null;
    }
    await ref.update(maj);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/partenaires PATCH]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    const { id } = (await req.json()) as { id?: string };
    if (!id) return NextResponse.json({ error: "Identifiant manquant" }, { status: 400 });
    await effacerVisuels(`partenaires/${id}/`);
    await adminDb.collection(COLLECTION).doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/partenaires DELETE]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
