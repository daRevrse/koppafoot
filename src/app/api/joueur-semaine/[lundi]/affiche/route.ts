import { NextRequest, NextResponse } from "next/server";
import { lireAffichePubliee } from "@/lib/joueur-semaine-publie-serveur";
import type { FormatAffichePubliee } from "@/lib/joueur-semaine-publie";

/**
 * GET /api/joueur-semaine/{lundi}/affiche?format=publication|vertical[&v=…]
 *
 * L'affiche publiée d'un joueur de la semaine, en JPEG : celle que
 * « Partager » joint au message. La diapositive du Direct et l'historique,
 * eux, montrent le joueur, pas l'affiche. Servie par le site, et non par Storage directement : le
 * navigateur la télécharge par `fetch` pour la partager, ce qu'un bucket sans
 * réglage CORS refuse.
 *
 * `v` (la version de la publication) change à chaque republication : la
 * réponse peut donc se garder longtemps en cache.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ lundi: string }> }) {
  const { lundi } = await params;
  const p = req.nextUrl.searchParams;
  const format = p.get("format") as FormatAffichePubliee | null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lundi) || (format !== "publication" && format !== "vertical")) {
    return NextResponse.json({ error: "Affiche introuvable" }, { status: 404 });
  }

  try {
    const publiee = await lireAffichePubliee(lundi, format);
    if (!publiee) return NextResponse.json({ error: "Affiche introuvable" }, { status: 404 });
    return new NextResponse(new Uint8Array(publiee.contenu), {
      headers: {
        "Content-Type": "image/jpeg",
        // Avec la bonne version, l'adresse ne désigne qu'une seule image ;
        // sans elle, ou avec une ancienne, un cache court : une republication
        // doit se voir.
        "Cache-Control": p.get("v") === publiee.version
          ? "public, max-age=31536000, immutable"
          : "public, max-age=300, s-maxage=86400",
      },
    });
  } catch (err) {
    console.error("GET /api/joueur-semaine/affiche", err);
    return NextResponse.json({ error: "Affiche indisponible" }, { status: 500 });
  }
}
