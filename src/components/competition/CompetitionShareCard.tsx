"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Share2, Check, ExternalLink, Users, UserPlus, Radio, Copy,
} from "lucide-react";
import type { Competition } from "@/types";

// ============================================
// CompetitionShareCard, the payoff, shown to the organizer.
//
// A competition on KoppaFoot produces a public page, and that page is the
// organizer's recruiting tool: it is what they send to a club president on
// WhatsApp to get a team signed up, and what a supporter opens to follow the
// scores. The organizer space never said so, it opened on a list of admin
// screens (teams, poules, calendrier), so the one asset worth sharing stayed
// invisible.
//
// So this sits at the top of the competition hub, and it hands over the JOIN
// page (/c/slug/rejoindre) rather than the scores page: what an organizer
// sends to a club president has to argue for entering, not list fixtures.
// The scores page stays one tap away for whoever only wants to watch.
// ============================================

const APP_URL = "https://www.koppafoot.com";

export default function CompetitionShareCard({
  competition, teamCount,
}: {
  competition: Competition;
  teamCount: number;
}) {
  const [feedback, setFeedback] = useState<"copied" | null>(null);

  const path = `/c/${competition.slug}/rejoindre`;
  const url = `${APP_URL}${path}`;
  const open = competition.status === "registration";

  const share = async () => {
    const text = open
      ? `${competition.name}, les inscriptions sont ouvertes. Inscris ton équipe :`
      : `Suis ${competition.name} en direct sur KoppaFoot :`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: competition.name, text, url });
        return;
      } catch (err) {
        // AbortError = the share sheet was dismissed, not a failure.
        if ((err as DOMException)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setFeedback("copied");
      setTimeout(() => setFeedback(null), 2500);
    } catch {
      /* nothing more to offer, the address is on screen to copy by hand */
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setFeedback("copied");
      setTimeout(() => setFeedback(null), 2500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wide text-emerald-600">
            Ta page publique
          </p>
          <p className="mt-1 text-sm font-bold text-gray-900">
            C&apos;est le lien à envoyer pour remplir ta compétition.
          </p>

          <button
            type="button"
            onClick={copyUrl}
            title="Copier l'adresse"
            className="group mt-2 flex max-w-full items-center gap-2 rounded-lg bg-white px-3 py-2 text-left ring-1 ring-emerald-100 transition-colors hover:ring-emerald-300"
          >
            <span className="truncate font-mono text-xs font-bold text-gray-600">
              koppafoot.com{path}
            </span>
            <Copy size={13} className="shrink-0 text-gray-300 group-hover:text-emerald-500" />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={path}
            className="flex items-center gap-1.5 rounded-xl border-2 border-emerald-100 bg-white px-3 py-2.5 text-sm font-bold text-emerald-700 transition-colors hover:border-emerald-300"
          >
            <ExternalLink size={15} />
            Voir
          </Link>
          <button
            type="button"
            onClick={share}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            {feedback === "copied" ? <Check size={15} /> : <Share2 size={15} />}
            {feedback === "copied" ? "Lien copié" : "Partager"}
          </button>
        </div>
      </div>

      {/* What a visitor can actually do when they land there, right now. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-emerald-100/70 bg-white/60 px-4 py-2.5 text-[11px] font-bold text-gray-500 sm:px-5">
        <span className="flex items-center gap-1.5">
          <Users size={12} className="text-emerald-500" />
          {teamCount} équipe{teamCount > 1 ? "s" : ""} inscrite{teamCount > 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1.5">
          <UserPlus size={12} className={open ? "text-emerald-500" : "text-gray-300"} />
          {open ? "Un club peut s'inscrire depuis la page" : "Inscriptions fermées"}
        </span>
        <span className="flex items-center gap-1.5">
          <Radio size={12} className="text-emerald-500" />
          Les matchs passent en direct sur{" "}
          <Link href={`/c/${competition.slug}`} className="text-emerald-600 underline-offset-2 hover:underline">
            la page compétition
          </Link>
        </span>
      </div>
    </div>
  );
}
