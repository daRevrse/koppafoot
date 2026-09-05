import type { MatchPublic } from "@/lib/match-public";

// ============================================
// La bannière servie telle quelle, pour le partage.
//
// DEUX FORMATS, DEUX TRAITEMENTS, et ce n'est pas une incohérence.
//
// L'aperçu de lien annonce ses dimensions dans `og:image:width/height` : une
// bannière d'un autre format y est recadrée en 1200×630, sinon les balises
// mentent (voir AfficheBanniere). Ici, rien n'est annoncé — le PNG part
// directement dans `navigator.share`, donc dans une conversation ou un
// statut — et l'organisateur qui a choisi cette image l'a choisie entière.
// On la transmet sans y toucher.
//
// POURQUOI PASSER PAR NOTRE ORIGINE plutôt que laisser le navigateur aller
// la chercher : le Storage du projet ne déclare pas d'en-têtes CORS, donc un
// `fetch()` depuis la page échouerait — silencieusement, et le partage
// repartirait sans image sans que personne comprenne pourquoi.
//
// L'URL a déjà été filtrée sur l'hôte à la lecture du document, dans
// match-public : ce module ne va jamais chercher une adresse arbitraire.
// ============================================

/** Ce qu'on accepte de retransmettre : des images, et rien d'autre. */
const TYPES = /^image\/(png|jpeg|webp|gif|avif)$/;

/**
 * La bannière du match, prête à partir, ou `null` s'il n'y en a pas — ou si
 * elle ne répond pas.
 *
 * Rend `null` plutôt que de lever : une bannière introuvable doit faire
 * retomber l'appelant sur l'affiche dessinée, pas casser le partage.
 */
export async function banniereAPartager(match: MatchPublic): Promise<Response | null> {
  if (!match.bannerUrl) return null;
  try {
    const amont = await fetch(match.bannerUrl, { cache: "no-store" });
    if (!amont.ok) return null;

    const type = amont.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!TYPES.test(type)) return null;

    return new Response(amont.body, {
      headers: {
        "Content-Type": type,
        // Une bannière change quand un organisateur la remplace, c'est-à-dire
        // rarement. Une heure au bord, et le navigateur peut resservir la
        // sienne pendant qu'on revalide : le bouton Partager ne doit jamais
        // attendre le réseau.
        "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return null;
  }
}
