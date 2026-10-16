"use client";

import { useEffect, useState } from "react";
import { ArrowRightLeft, Check, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getUsersByIds } from "@/lib/firestore";
import { accorder } from "@/lib/genre";
import type { Competition } from "@/types";

// ============================================
// Le transfert de propriété, vu de la page Staff.
//
// Trois visages selon qui regarde :
//  - le modérateur à qui on propose la compétition : accepter ou refuser ;
//  - le propriétaire, transfert en attente : à qui, et annuler ;
//  - le propriétaire, sinon : choisir l'un de ses modérateurs.
// Tous les autres ne voient rien. La route /api/competitions/transfert
// refait chaque vérification ; cet écran n'offre que ce qu'elle acceptera.
// ============================================

interface Moderateur {
  uid: string;
  firstName: string;
  lastName: string;
}

const nomComplet = (m: { firstName: string; lastName: string } | undefined) =>
  [m?.firstName, m?.lastName].filter(Boolean).join(" ") || "Un membre";

export default function TransfertPropriete({
  competition,
  moderateurs,
  proprietaire,
}: {
  competition: Competition;
  /** Les modérateurs, noms résolus par la page Staff. */
  moderateurs: Moderateur[];
  /** Voir `possedeLaCompetition` (lib/hats). */
  proprietaire: boolean;
}) {
  const { user, firebaseUser } = useAuth();
  const [choix, setChoix] = useState("");
  const [enCours, setEnCours] = useState(false);
  // Le nom de celui qui propose, pour le destinataire : il n'est pas dans la
  // liste des modérateurs, c'est le propriétaire.
  const [proposeur, setProposeur] = useState<string | null>(null);

  const transfert = competition.transfert;
  const pourMoi = !!user && transfert?.versUid === user.uid;

  useEffect(() => {
    if (!pourMoi || !transfert) return;
    let annule = false;
    getUsersByIds([transfert.parUid])
      .then(([p]) => { if (!annule) setProposeur(nomComplet(p)); })
      .catch(() => { if (!annule) setProposeur(null); });
    return () => { annule = true; };
  }, [pourMoi, transfert]);

  const appeler = async (method: "POST" | "PUT" | "DELETE", corps: Record<string, string>, succes: string) => {
    if (!firebaseUser) {
      toast.error("Session expirée, reconnecte-toi");
      return;
    }
    setEnCours(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/competitions/transfert", {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cid: competition.id, ...corps }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Une erreur est survenue");
        return;
      }
      toast.success(succes);
      setChoix("");
      // onCompetition, sur la page, rafraîchit la proposition et le staff.
    } catch (err) {
      console.error("Error on competition transfer:", err);
      toast.error("Une erreur est survenue");
    } finally {
      setEnCours(false);
    }
  };

  if (competition.isSandbox) return null;

  // ── Le destinataire ─────────────────────────────────────
  if (pourMoi) {
    return (
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-gray-900">
          <ArrowRightLeft size={16} className="text-amber-500" />
          Transfert de propriété
        </h2>
        <div className="border border-amber-200 bg-amber-50/60 p-4">
          <p className="text-sm font-bold text-gray-900">
            {proposeur ?? "Le propriétaire"} te propose de devenir propriétaire de cette compétition.
          </p>
          <p className="mt-1 text-xs text-gray-600">
            Tu pourras la supprimer, gérer ses modérateurs, la transférer à ton tour et fixer ses
            frais d&apos;inscription. Elle comptera dans tes compétitions en cours. Le
            propriétaire actuel reste au staff, comme modérateur.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => appeler("PUT", {}, "Tu es propriétaire de la compétition")}
              disabled={enCours}
              className="flex items-center gap-2 bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black disabled:opacity-50"
            >
              {enCours ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Accepter
            </button>
            <button
              type="button"
              onClick={() => appeler("DELETE", {}, "Transfert refusé")}
              disabled={enCours}
              className="flex items-center gap-2 border border-gray-200/70 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              <X size={16} />
              Refuser
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!proprietaire) return null;

  // ── Le propriétaire ─────────────────────────────────────
  const destinataire = transfert ? moderateurs.find((m) => m.uid === transfert.versUid) : undefined;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-gray-900">
          <ArrowRightLeft size={16} className="text-gray-400" />
          Transfert de propriété
        </h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Confie la compétition à l&apos;un de tes modérateurs, qui devra accepter. Tu resteras{" "}
          {accorder(user?.gender, "modérateur", "modératrice")}.
        </p>
      </div>

      {transfert ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-gray-200/70 bg-white p-4">
          <p className="min-w-0 text-sm text-gray-700">
            Proposée à <span className="font-bold text-gray-900">{nomComplet(destinataire)}</span>, en
            attente de sa réponse.
          </p>
          <button
            type="button"
            onClick={() => appeler("DELETE", {}, "Transfert annulé")}
            disabled={enCours}
            className="flex shrink-0 items-center gap-2 border border-gray-200/70 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {enCours ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
            Annuler
          </button>
        </div>
      ) : moderateurs.length === 0 ? (
        <p className="px-1 text-xs text-gray-400">
          Ajoute d&apos;abord la personne comme modérateur : la compétition ne se transfère qu&apos;à
          quelqu&apos;un du staff.
        </p>
      ) : (
        <div className="flex flex-col gap-3 border border-gray-200/70 bg-white p-4 sm:flex-row sm:items-center">
          <select
            value={choix}
            onChange={(e) => setChoix(e.target.value)}
            disabled={enCours}
            className="w-full flex-1 border border-gray-200/70 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
          >
            <option value="">Choisis un modérateur</option>
            {moderateurs.map((m) => (
              <option key={m.uid} value={m.uid}>
                {nomComplet(m)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => appeler("POST", { uid: choix }, "Transfert proposé")}
            disabled={enCours || !choix}
            className="flex shrink-0 items-center justify-center gap-2 bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black disabled:opacity-50"
          >
            {enCours ? <Loader2 size={16} className="animate-spin" /> : <ArrowRightLeft size={16} />}
            Proposer
          </button>
        </div>
      )}
    </section>
  );
}
