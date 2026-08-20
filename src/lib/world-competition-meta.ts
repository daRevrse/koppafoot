import type { Metadata } from "next";
import { getWorldCompetitionSummary, isWorldCode } from "./football-data";

// Per-tab page metadata for /competitions/monde/[code]/**. Each tab gets its own
// title and description, four distinct, indexable pages per competition rather
// than four variations of the same one.
//
// Reuses the cached summary fetch the page itself makes, so this costs nothing.
export async function worldCompetitionMetadata(
  code: string,
  tab: { label: string; describe: (name: string) => string },
): Promise<Metadata> {
  const summary = isWorldCode(code) ? await getWorldCompetitionSummary(code) : null;
  if (!summary) return { title: "Compétition introuvable, Koppafoot" };

  const { name } = summary.competition;
  return {
    title: `${name}, ${tab.label} | Koppafoot`,
    description: tab.describe(name),
  };
}
