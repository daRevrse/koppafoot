"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FileDown, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminApi } from "@/hooks/useAdminApi";
import { type AudienceDeCompetition, type Periode } from "@/lib/audience";
import PanneauAudienceCompetition from "@/components/audience/PanneauAudienceCompetition";

// ============================================
// Les statistiques d'une compétition, pour son staff : qui regarde ses pages
// et ses matchs, combien suivaient un direct, d'où ils viennent — et le
// rapport PDF qu'on envoie à un sponsor. Le garde de l'espace organisateur
// (app/(organizer)/layout) n'y laisse entrer que ses organisateurs, ses
// modérateurs et l'administration ; la route refait le contrôle.
// ============================================

export default function StatistiquesDeLaCompetition() {
  const { cid } = useParams<{ cid: string }>();
  const { firebaseUser } = useAuth();
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
        ?? `audience-${data.slug}.pdf`;
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
          {data ? `${data.nom} : qui regarde ses pages et ses matchs.` : "Qui regarde tes pages et tes matchs."}
        </p>
      </div>

      {chargement ? (
        <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-300" /></div>
      ) : erreur || !data ? (
        <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreur ?? "Lecture impossible"}</p>
      ) : (
        <PanneauAudienceCompetition
          data={data}
          periode={periode}
          onPeriode={setPeriode}
          urlDuMatch={(mid) => `/api/competitions/${cid}/audience?match=${encodeURIComponent(mid)}`}
          actions={
            <button
              type="button"
              onClick={telechargerLeRapport}
              disabled={telechargement}
              className="flex items-center gap-2 bg-gray-900 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-black disabled:opacity-50"
            >
              {telechargement ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
              Télécharger le rapport PDF
            </button>
          }
        />
      )}
    </div>
  );
}
