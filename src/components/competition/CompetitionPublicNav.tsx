"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { getCompetitionBySlug } from "@/lib/competition-firestore";
import { hasGroupStage, hasKnockout } from "@/lib/competition-format";
import type { CompetitionType } from "@/types";

// Public hub navigation for /c/[slug]/** pages. Client component so it can
// resolve the active tab from the current path. No auth — purely presentational.
// It reads the competition once to know which tabs the format actually has:
// a cup has no classement, a championnat has no tableau.
export default function CompetitionPublicNav() {
  const params = useParams();
  const pathname = usePathname();
  const slug = typeof params.slug === "string" ? params.slug : null;
  const [type, setType] = useState<CompetitionType | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    getCompetitionBySlug(slug)
      .then((c) => {
        if (!cancelled) setType(c?.competitionType ?? null);
      })
      .catch(() => {
        // Keep every tab visible rather than hiding content on a read error.
        if (!cancelled) setType(null);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!slug) return null;

  // The join page is a conversion page: it argues for entering the
  // competition, and a tab bar offering four ways to wander off before the
  // CTA works against that. It carries its own link to the scores instead.
  if (pathname.endsWith("/rejoindre")) return null;

  // Until the type is known, show everything — hiding then re-adding tabs
  // would make the bar jump on every page load.
  const showStandings = type === null || hasGroupStage(type);
  const showBracket = type === null || hasKnockout(type);

  const base = `/c/${slug}`;
  const tabs: { href: string; label: string; exact?: boolean }[] = [
    { href: base, label: "Accueil", exact: true },
    { href: `${base}/calendar`, label: "Calendrier" },
    ...(showStandings ? [{ href: `${base}/standings`, label: "Classement" }] : []),
    ...(showBracket
      ? [{ href: `${base}/bracket`, label: type === "league_playoffs" ? "Play-offs" : "Tableau" }]
      : []),
    { href: `${base}/scorers`, label: "Buteurs" },
  ];

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto px-4">
      {tabs.map((tab) => {
        const active = isActive(tab.href, tab.exact);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
              active
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
