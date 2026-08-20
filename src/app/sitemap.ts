import type { MetadataRoute } from "next";
import { getPublicCompetitions } from "@/lib/competition-admin";
import { getWorldCompetitions } from "@/lib/football-data";

// Search-engine map of everything public. Matches the routes the (app) layout
// lets guests reach (isPublicPath): the direct home, the directory, each
// Koppafoot competition with its tabs, and each world competition page.
//
// Same canonical origin the transactional links use (lib/email, lib/invite-link).
const APP_URL = "https://www.koppafoot.com";

// Tabs every public competition has. /bracket is added only for the ones

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Degrade rather than fail the route: a sitemap missing a section beats a
  // 500 that costs the whole file.
  const [competitions, worldCompetitions] = await Promise.all([
    getPublicCompetitions().catch(() => []),
    getWorldCompetitions().catch(() => []),
  ]);

  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: APP_URL, lastModified: now, changeFrequency: "hourly", priority: 1 },
    {
      url: `${APP_URL}/competitions`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  const competitionRoutes: MetadataRoute.Sitemap = competitions.flatMap((c) => {
    // Une seule URL par competition : les onglets sont desormais des etats
    // de la meme page (?tab=), pas des routes a indexer separement.
    const tabs = [""];
    return tabs.map((tab) => ({
      url: `${APP_URL}/c/${c.slug}${tab}`,
      lastModified: c.updatedAt ? new Date(c.updatedAt) : now,
      changeFrequency: "daily" as const,
      priority: tab === "" ? 0.8 : 0.6,
    }));
  });

  // World competitions are listed by their hub only, not tab by tab. Which
  // tabs a competition has depends on live provider data, a league before
  // kickoff has no table, a dormant cup no scorers, and answering that here
  // would cost 39 API calls on a plan capped at ten a minute. The hub's tab bar
  // is server-rendered and links only the tabs that have content, so crawlers
  // reach exactly those and never a thin page.
  const worldRoutes: MetadataRoute.Sitemap = worldCompetitions.map((c) => ({
    url: `${APP_URL}/competitions/monde/${c.code}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  return [...staticRoutes, ...competitionRoutes, ...worldRoutes];
}
