"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FileDown, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminApi } from "@/hooks/useAdminApi";
import { type AudienceDeCompetition, type Periode } from "@/lib/audience";
import { onCompetition, onCompMatches, updateCompetition } from "@/lib/competition-firestore";
import { statsDeJeu } from "@/lib/stats-competition";
import PanneauAudienceCompetition from "@/components/audience/PanneauAudienceCompetition";
import PanneauStatsDeJeu from "@/components/competition/PanneauStatsDeJeu";
import type { CompMatch, Competition } from "@/types";

// ============================================
// Les statistiques d'une compétition, pour son staff, en deux onglets :
// l'AUDIENCE — qui regarde ses pages et ses matchs, combien suivaient un
// direct, d'où ils viennent — et LE JEU — les totaux de ses matchs et leurs
// records (lib/stats-competition). Le rapport PDF qu'on envoie à un sponsor
// porte les deux. Le garde de l'espace organisateur (app/(organizer)/layout)
// n'y laisse entrer que ses organisateurs, ses modérateurs et
// l'administration ; la route du rapport refait le contrôle.
// ============================================

/**
 * L'onglet « Le jeu » : les statistiques, et l'interrupteur qui les publie.
 *
 * FERMÉ PAR DÉFAUT. Ce sont des chiffres d'organisateur, pour préparer un
 * bilan ou une discussion avec un sponsor ; c'est lui qui décide si le public
 * les voit, et alors exactement ce panneau-ci (onglet « Stats » de la page de
 * la compétition). L'audience, elle, ne sort jamais de cet espace.
 */
function LeJeu({ cid, rapport }: { cid: string; rapport: React.ReactNode }) {
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [matchs, setMatchs] = useState<CompMatch[] | null>(null);
  const [bascule, setBascule] = useState(false);
  useEffect(() => onCompetition(cid, setCompetition), [cid]);
  useEffect(() => onCompMatches(cid, setMatchs), [cid]);
  const stats = useMemo(() => (matchs ? statsDeJeu(matchs) : null), [matchs]);

  if (!competition || !stats) {
    return <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-300" /></div>;
  }

  const publiques = competition.statsPubliques;
  const basculer = async () => {
    setBascule(true);
    try {
      await updateCompetition(cid, { stats_publiques: !publiques });
      toast.success(publiques ? "Statistiques retirées de la page publique" : "Statistiques publiées sur la page publique");
    } catch {
      toast.error("Le réglage n'a pas été enregistré");
    } finally {
      setBascule(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3 border border-gray-200/70 bg-white px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900">Montrer ces statistiques sur la page publique</p>
            <p className="text-xs text-gray-400">
              {publiques
                ? "Activé : un onglet « Stats » les montre sur la page de la compétition."
                : "Désactivé : seuls les organisateurs et les modérateurs les voient."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={publiques}
            aria-label="Montrer ces statistiques sur la page publique"
            onClick={basculer}
            disabled={bascule}
            className={`relative h-6 w-11 shrink-0 transition-colors disabled:opacity-50 ${publiques ? "bg-primary-600" : "bg-gray-300"}`}
          >
            <span className={`absolute top-1 h-4 w-4 bg-white transition-all ${publiques ? "left-6" : "left-1"}`} />
          </button>
        </div>
        {rapport}
      </div>
      <PanneauStatsDeJeu stats={stats} lienDuMatch={(mid) => `/c/${competition.slug}/matches/${mid}`} />
    </div>
  );
}

export default function StatistiquesDeLaCompetition() {
  const { cid } = useParams<{ cid: string }>();
  const { firebaseUser } = useAuth();
  const [onglet, setOnglet] = useState<"audience" | "jeu">("audience");
  const [periode, setPeriode] = useState<Periode>("30j");
  const [telechargement, setTelechargement] = useState(false);
  const { data, erreur, chargement, recharger } = useAdminApi<AudienceDeCompetition>(
    `/api/competitions/${cid}/audience?periode=${periode}`,
  );

  // Un de ses matchs en cours : les spectateurs du moment se relisent.
  const enDirect = (data?.totaux.maintenant ?? 0) > 0 || data?.matchs.some((m) => m.statut === "live");
  useEffect(() => {
    if (!enDirect) return;
    const minuteur = setInterval(recharger, 30_000);
    return () => clearInterval(minuteur);
  }, [enDirect, recharger]);

  const telechargerLeRapport = async () => {
    if (!firebaseUser || !data) return;
    setTelechargement(true);
    try {
      const jeton = await firebaseUser.getIdToken();
      const res = await fetch(`/api/competitions/${cid}/audience/rapport?periode=${periode}`, {
        headers: { Authorization: `Bearer ${jeton}` },
      });
      if (!res.ok) {
        const corps = await res.json().catch(() => ({}));
        toast.error(corps.error ?? "Le rapport n'a pas pu être créé");
        return;
      }
      const fichier = await res.blob();
      const nom = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1]
        ?? `statistiques-${data.slug}.pdf`;
      const lien = document.createElement("a");
      lien.href = URL.createObjectURL(fichier);
      lien.download = nom;
      lien.click();
      setTimeout(() => URL.revokeObjectURL(lien.href), 10_000);
    } catch {
      toast.error("Le rapport n'a pas pu être téléchargé");
    } finally {
      setTelechargement(false);
    }
  };

  const boutonRapport = (
    <button
      type="button"
      onClick={telechargerLeRapport}
      disabled={telechargement || !data}
      className="flex items-center gap-2 bg-gray-900 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-black disabled:opacity-50"
    >
      {telechargement ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
      Télécharger le rapport PDF
    </button>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href={`/organizer/competitions/${cid}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-primary-600"
      >
        <ArrowLeft size={16} />
        Tableau de bord
      </Link>

      <div>
        <h1 className="font-display text-2xl font-extrabold text-gray-900">Statistiques</h1>
        <p className="mt-0.5 max-w-xl text-sm text-gray-500">
          {data ? `${data.nom} : qui regarde, et ce qui s'est joué.` : "Qui regarde, et ce qui s'est joué."}
        </p>
      </div>

      <div className="flex border-b border-gray-200/70" role="tablist">
        {([["audience", "Audience"], ["jeu", "Le jeu"]] as const).map(([id, libelle]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={onglet === id}
            onClick={() => setOnglet(id)}
            className={`-mb-px border-b-2 px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors ${
              onglet === id ? "border-primary-600 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            {libelle}
          </button>
        ))}
      </div>

      {onglet === "jeu" ? (
        <LeJeu cid={cid} rapport={boutonRapport} />
      ) : chargement ? (
        <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-300" /></div>
      ) : erreur || !data ? (
        <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreur ?? "Lecture impossible"}</p>
      ) : (
        <PanneauAudienceCompetition
          data={data}
          periode={periode}
          onPeriode={setPeriode}
          urlDuMatch={(mid) => `/api/competitions/${cid}/audience?match=${encodeURIComponent(mid)}`}
          actions={boutonRapport}
        />
      )}
    </div>
  );
}
