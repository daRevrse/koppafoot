// Les types que la console live et ses pièces partagent.

import type { CompMatch } from "@/types";

/** One entry of the live feed. */
export type LiveEvent = NonNullable<CompMatch["liveState"]>["events"][number];
export type Side = "home" | "away";
export type SheetRole = "out" | "starter" | "substitute";
