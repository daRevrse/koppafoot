import { NextResponse } from "next/server";
import { uidAppelant } from "@/lib/appelant";
import { estLienCourt, hoteGoogle, lirePosition, type Position } from "@/lib/carte";

/**
 * POST /api/venues/position, lire le point d'un lien Google Maps.
 *
 * Le bouton « Partager » de Maps donne un lien court (maps.app.goo.gl/…) qui
 * ne porte aucune coordonnée : il faut le suivre pour voir où il mène, et un
 * navigateur ne peut pas le faire (les redirections d'un autre site lui sont
 * cachées). Le serveur le fait à sa place.
 *
 * CE N'EST PAS UN RELAIS OUVERT. On ne suit que des hôtes de Google, en
 * HTTPS, sur quelques sauts, et il faut un compte : sans ces bornes, la route
 * irait chercher n'importe quelle adresse pour n'importe qui.
 *
 * Elle n'écrit rien : elle rend un point, que le formulaire montre au
 * propriétaire avant qu'il enregistre sa fiche.
 */

const SAUTS_MAX = 5;

async function suivre(depart: string): Promise<Position | null> {
  let adresse = depart;
  for (let i = 0; i < SAUTS_MAX; i++) {
    const url = new URL(adresse);
    if (url.protocol !== "https:" || !hoteGoogle(url.hostname)) return null;

    const res = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KoppaFoot)", "Accept-Language": "fr" },
      signal: AbortSignal.timeout(5000),
    });

    const suivante = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && suivante) {
      adresse = new URL(suivante, url).toString();
      const p = lirePosition(adresse);
      if (p) return p;
      continue;
    }

    // Arrivé sans point en chemin : le lien menait à une recherche par nom,
    // dont la page ne donne que le centre par défaut de Maps (voir lirePosition).
    return null;
  }
  return null;
}

export async function POST(req: Request) {
  const uid = await uidAppelant(req);
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const c = (await req.json().catch(() => ({}))) as { lien?: unknown };
  const lien = typeof c.lien === "string" ? c.lien.trim().slice(0, 2000) : "";
  if (!lien) return NextResponse.json({ error: "Colle le lien du terrain." }, { status: 400 });

  const directe = lirePosition(lien);
  if (directe) return NextResponse.json({ position: directe });

  if (estLienCourt(lien)) {
    try {
      const p = await suivre(lien.replace(/^http:/, "https:"));
      if (p) return NextResponse.json({ position: p });
    } catch (err) {
      console.error("POST /api/venues/position:", err);
    }
  }

  return NextResponse.json(
    { error: "Ce lien ne donne pas de position. Ouvre le terrain dans Google Maps, touche « Partager » et colle le lien, ou utilise « Je suis sur le terrain »." },
    { status: 422 },
  );
}
