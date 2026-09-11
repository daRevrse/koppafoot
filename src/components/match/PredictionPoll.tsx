"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/components/auth/AuthModal";
import BarreRepartition, { type SegmentRepartition } from "@/components/match/BarreRepartition";
import MiniEcusson from "@/components/match/MiniEcusson";
import { castPrediction, fetchCounts, getMyPrediction, EMPTY_COUNTS, type Pick, type PredictionCounts, pourcentages } from "@/lib/predictions";

// ============================================
// « Qui gagne ? », le pronostic de la fiche match.
//
// UNE BARRE DONT LA LARGEUR EST LE VOTE. Chaque issue — victoire à domicile,
// nul, victoire à l'extérieur — prend la largeur de sa part, et l'issue en
// tête se remplit en vert (voir BarreRepartition). Le résultat n'occupe donc
// aucune place de plus que la question : on lit le rapport de force avant
// même de lire un chiffre.
//
// ELLE A QUITTÉ LE TABLEAU D'AFFICHAGE pour ouvrir l'onglet Infos. Elle y
// était montée parce qu'en bas de page personne ne l'atteignait ; en tête de
// l'onglet ouvert par défaut avant le coup d'envoi, elle reste la première
// chose sous le tableau. Et pendant le direct, close, elle n'a plus rien à
// faire à côté du score.
//
// Un compte est nécessaire pour voter, sans quoi le sondage se remplit de
// rechargements de page, mais le RÉSULTAT est visible de tous, y compris
// sans compte : c'est une information publique, comme le score.
//
// PAS DE DÉCOMPTE. Sur un amical entre deux clubs de quartier, « 3 votes »
// annonce surtout que personne ne regarde. Les pourcentages portent le
// résultat, qui est ce qu'on vient lire.
// ============================================

interface Side {
  label: string;
  logo: string | null;
}

export default function PredictionPoll({
  matchId, home, away, closed = false,
}: {
  matchId: string;
  home: Side;
  away: Side;
  /** Le coup d'envoi est passé : on ne pronostique plus, on regarde. */
  closed?: boolean;
}) {
  const { user } = useAuth();
  const { open } = useAuthModal();
  const titreId = useId();

  const [counts, setCounts] = useState<PredictionCounts | null>(null);
  const [mine, setMine] = useState<Pick | null>(null);
  const [sending, setSending] = useState<Pick | null>(null);

  const reload = useCallback(async () => {
    setCounts(await fetchCounts(matchId));
  }, [matchId]);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    let alive = true;
    if (!user) { setMine(null); return; }
    getMyPrediction(matchId, user.uid).then((p) => { if (alive) setMine(p); });
    return () => { alive = false; };
  }, [matchId, user]);

  /**
   * Voter, ou changer d'avis, jusqu'au coup d'envoi.
   *
   * VOIR LES CHIFFRES N'EMPÊCHE PLUS DE VOTER. Depuis que le résultat s'ouvre
   * à tout le monde dès le premier vote, les boutons se désactivaient en même
   * temps que les chiffres s'affichaient : le premier votant fermait le
   * sondage pour tous les autres. C'est le coup d'envoi qui ferme, rien
   * d'autre — comme sur le Direct, où le choix se change jusqu'au bout.
   */
  const vote = async (pick: Pick) => {
    if (closed || sending || pick === mine) return;
    if (!user) {
      open("Crée ton compte pour donner ton pronostic.");
      return;
    }
    setSending(pick);
    try {
      await castPrediction(matchId, user.uid, pick);
      setMine(pick);
      await reload();
    } finally {
      setSending(null);
    }
  };

  /**
   * « Au moins un vote RÉEL » : `total` ne compte pas les voix d'office, qui
   * n'existent que pour amortir les pourcentages des premiers votes (voir
   * lib/predictions). Sans ce garde-fou, un match que personne n'a
   * pronostiqué afficherait un 33/33/34 inventé de toutes pièces.
   */
  const chiffres = (counts?.total ?? 0) > 0;

  // Clos sans un seul pronostic : il n'y a rien à montrer.
  if (counts !== null && closed && !chiffres) return null;

  const parts = pourcentages(counts ?? EMPTY_COUNTS);
  const issues: { cle: Pick; nom: string; logo: string | null; pct: number; libelle: string }[] = [
    { cle: "home", nom: home.label, logo: home.logo, pct: parts.home, libelle: `Victoire de ${home.label}` },
    { cle: "draw", nom: "Nul", logo: null, pct: parts.draw, libelle: "Match nul" },
    { cle: "away", nom: away.label, logo: away.logo, pct: parts.away, libelle: `Victoire de ${away.label}` },
  ];

  // L'issue en tête, si elle est seule : deux issues à égalité ne dominent pas.
  const max = Math.max(...issues.map((i) => i.pct));
  const enTete = issues.filter((i) => i.pct === max);
  const enAvant = chiffres && enTete.length === 1 ? enTete[0].cle : null;

  const segments: SegmentRepartition[] = issues.map((i) => ({
    cle: i.cle,
    pct: i.pct,
    libelle: chiffres ? `${i.libelle}, ${i.pct} %` : i.libelle,
    haut: (
      <>
        {/* L'écusson descend dans la petite ligne quand le pourcentage prend
            la grande : il n'y a qu'une grande place par segment. */}
        {chiffres && i.cle !== "draw" && <MiniEcusson nom={i.nom} logo={i.logo} taille={14} />}
        <span className="truncate uppercase tracking-wide">{i.nom}</span>
        {mine === i.cle && <Check size={12} strokeWidth={3} aria-hidden className="shrink-0" />}
      </>
    ),
    bas: sending === i.cle ? (
      <Loader2 size={20} className="animate-spin" />
    ) : chiffres ? (
      `${i.pct}%`
    ) : i.cle === "draw" ? (
      "N"
    ) : (
      <MiniEcusson nom={i.nom} logo={i.logo} taille={26} />
    ),
  }));

  const consigne = closed
    ? "Clos au coup d'envoi"
    : mine
      ? "Modifiable jusqu'au coup d'envoi"
      : "Touche ton pronostic";

  return (
    <section aria-labelledby={titreId} className="border border-gray-200/70 bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id={titreId} className="shrink-0 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
          {closed ? "Pronostics" : "Qui gagne ?"}
        </h2>
        <p className="truncate text-[11px] font-bold text-gray-400">{consigne}</p>
      </div>

      {counts === null ? (
        <div className="flex justify-center py-6">
          <Loader2 size={16} className="animate-spin text-gray-300" />
        </div>
      ) : (
        <BarreRepartition
          libelle="Pronostics du match"
          segments={segments}
          enAvant={enAvant}
          choisi={mine}
          onChoisir={closed ? undefined : (cle) => vote(cle as Pick)}
          occupe={sending !== null}
          largeursEgales={!chiffres}
        />
      )}
    </section>
  );
}
