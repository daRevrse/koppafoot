"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

// Public hub navigation for /c/[slug]/** pages. Client component so it can
// resolve the active tab from the current path. No auth — purely presentational.
export default function CompetitionPublicNav() {
  const params = useParams();
  const pathname = usePathname();
  const slug = typeof params.slug === "string" ? params.slug : null;
  if (!slug) return null;

  const base = `/c/${slug}`;
  const tabs: { href: string; label: string; exact?: boolean }[] = [
    { href: base, label: "Accueil", exact: true },
    { href: `${base}/calendar`, label: "Calendrier" },
    { href: `${base}/standings`, label: "Classement" },
    { href: `${base}/bracket`, label: "Tableau" },
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
