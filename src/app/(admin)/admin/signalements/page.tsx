"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, Loader2, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAdminAction, useAdminApi } from "@/hooks/useAdminApi";
import { useATraiter } from "@/components/admin/ATraiterContext";
import {
  BOUTON_CONTOUR, BOUTON_DANGER, Carte, Chargement, EnTete, Erreur, Vide, ilYA,
} from "@/components/admin/ui";

// ============================================
// Les signalements de la Tribune.
//
// Ils vivaient au bas de la page Tribune, sous le formulaire de publication
// et la liste des annonces officielles : il fallait savoir qu'ils étaient là
// et descendre les chercher. Un signalement attend une décision, il vit
// désormais avec ce qui attend une décision.
// ============================================

interface Signalement {
  id: string;
  postId: string;
  postContent: string;
  postAuthorId: string;
  postAuthorName: string;
  reporterName: string;
  reason: string;
  status: string;
  createdAt: string | null;
}

export default function AdminSignalementsPage() {
  const { data, erreur, chargement, recharger, setData } = useAdminApi<{ reports: Signalement[] }>("/api/tribune/reports");
  const agir = useAdminAction();
  const { rafraichir } = useATraiter();
  const [enCours, setEnCours] = useState<string | null>(null);
  const signalements = data?.reports ?? [];

  const moderer = async (s: Signalement, action: "supprimer" | "ignorer") => {
    if (action === "supprimer" && !window.confirm(`Supprimer la publication de ${s.postAuthorName} ? Elle disparaît de la Tribune.`)) return;
    setEnCours(s.id);
    try {
      if (action === "supprimer") {
        await agir("/api/admin/tribune", "DELETE", { id: s.postId });
      }
      // Dans les deux cas, le signalement quitte la file.
      await agir("/api/tribune/reports", "PATCH", { id: s.id, action: "dismiss" });
      toast.success(action === "supprimer" ? "Publication supprimée" : "Signalement ignoré");
      setData({ reports: signalements.filter((x) => x.id !== s.id) });
      rafraichir();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "L'opération a échoué");
    } finally {
      setEnCours(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <EnTete titre="Signalements" sousTitre="Les publications de la Tribune signalées par les membres." />
      {erreur && <Erreur message={erreur} onReessayer={recharger} />}
      {chargement ? (
        <Chargement />
      ) : signalements.length === 0 ? (
        <Vide titre="Rien à modérer" />
      ) : (
        <ul className="space-y-3">
          {signalements.map((s) => (
            <li key={s.id}>
              <Carte className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-black text-gray-900">
                    {s.postAuthorId ? (
                      <Link href={`/admin/users/${s.postAuthorId}`} className="hover:text-emerald-700">{s.postAuthorName}</Link>
                    ) : s.postAuthorName}
                    <span className="font-semibold text-gray-400"> · signalé par {s.reporterName} {ilYA(s.createdAt)}</span>
                  </p>
                  <a href={`/feed?post=${s.postId}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-gray-700">
                    Voir <ExternalLink size={11} />
                  </a>
                </div>
                {/* Le texte tel qu'il était au signalement : la publication a
                    pu être modifiée depuis, ou supprimée. */}
                <p className="mt-2 border-l-2 border-gray-200 bg-gray-50 px-3 py-2 text-sm italic text-gray-700">
                  {s.postContent || "(sans texte)"}
                </p>
                {s.reason && <p className="mt-2 text-xs text-gray-500"><strong className="font-black text-gray-700">Motif :</strong> {s.reason}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => moderer(s, "ignorer")} disabled={enCours === s.id} className={BOUTON_CONTOUR}>
                    <Check size={13} /> Ignorer
                  </button>
                  <button onClick={() => moderer(s, "supprimer")} disabled={enCours === s.id} className={BOUTON_DANGER}>
                    {enCours === s.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    Supprimer la publication
                  </button>
                </div>
              </Carte>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
