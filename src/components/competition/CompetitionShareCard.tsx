"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Share2, Check, ExternalLink, Users, UserPlus, Radio, Copy,
} from "lucide-react";
import { copierDansLePressePapier, lienAbsolu, partagerLien } from "@/lib/partage";
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

export default function CompetitionShareCard({
  competition, teamCount,
}: {
  competition: Competition;
  teamCount: number;
}) {
  const [feedback, setFeedback] = useState<"copied" | null>(null);

  const open = competition.status === "registration";
  const brouillon = competition.status === "draft";

  /**
   * CE QU'ON MET DANS LA MAIN DE L'ORGANISATEUR DÉPEND DE CE QU'IL PEUT EN
   * ATTENDRE.
   *
   * La carte servait la page d'inscription à tout le monde, et l'annonçait
   * comme « le lien à envoyer pour remplir ta compétition » — y compris sur
   * une compétition TERMINÉE, deux lignes au-dessus de « Inscriptions
   * fermées ». Elle se contredisait, et le lien menait à une porte close.
   *
   * Inscriptions ouvertes : la page d'inscription, c'est bien elle qui
   * remplit le tournoi. Sinon, la page de la compétition — les scores en
   * cours, ou les résultats une fois fini. Un brouillon n'est visible de
   * personne : le dire vaut mieux que promettre un lien mort.
   */
  const path = open ? `/c/${competition.slug}/rejoindre` : `/c/${competition.slug}`;
  const url = lienAbsolu(path);

  const accroche = brouillon
    ? "Ta page n'est pas encore publique : passe la compétition en inscriptions pour l'ouvrir."
    : open
      ? "C'est le lien à envoyer pour remplir ta compétition."
      : competition.status === "completed"
        ? "C'est le lien à partager pour faire revivre ta compétition."
        : "C'est le lien à partager pour faire suivre tes matchs.";

  const share = async () => {
    const text = open
      ? `${competition.name}, les inscriptions sont ouvertes. Inscris ton équipe :`
      : competition.status === "completed"
        ? `${competition.name}, c'est fini. Les résultats sur KoppaFoot :`
        : `Suis ${competition.name} en direct sur KoppaFoot :`;

    const resultat = await partagerLien({ title: competition.name, text, url });
    if (resultat === "copie") {
      setFeedback("copied");
      setTimeout(() => setFeedback(null), 2500);
    }
    // Un échec ne laisse pas l'organisateur sans rien : l'adresse est écrite
    // en toutes lettres juste à côté, il lui reste à la copier à la main.
  };

  const copyUrl = async () => {
    if (!(await copierDansLePressePapier(url))) return;
    setFeedback("copied");
    setTimeout(() => setFeedback(null), 2500);
  };

  return (
    <div className="overflow-hidden border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wide text-emerald-600">
            Ta page publique
          </p>
          <p className="mt-1 text-sm font-bold text-gray-900">{accroche}</p>

          <button
            type="button"
            onClick={copyUrl}
            title="Copier l'adresse"
            className="group mt-2 flex max-w-full items-center gap-2 bg-white px-3 py-2 text-left ring-1 ring-emerald-100 transition-colors hover:ring-emerald-300"
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
            className="flex items-center gap-1.5 border-2 border-emerald-100 bg-white px-3 py-2.5 text-sm font-bold text-emerald-700 transition-colors hover:border-emerald-300"
          >
            <ExternalLink size={15} />
            Voir
          </Link>
          <button
            type="button"
            onClick={share}
            className="flex items-center gap-1.5 bg-emerald-600 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-emerald-700"
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
