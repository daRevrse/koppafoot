"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Tab bar for /competitions/monde/[code]/**, mirroring CompetitionPublicNav on
// the Koppafoot competition pages. Which tabs exist is decided by the layout —
// it has already fetched the data and drops any tab that would land on an empty
// page — so this component only resolves the active one from the path.
export default function WorldCompetitionNav({
  tabs,
}: {
  tabs: { href: string; label: string; exact?: boolean }[];
}) {
  const pathname = usePathname();

  // A single tab is not a navigation — it is a title the reader cannot act on.
  if (tabs.length < 2) return null;

  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto px-4">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
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
