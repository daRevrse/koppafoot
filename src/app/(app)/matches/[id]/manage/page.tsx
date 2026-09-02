"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, ChevronLeft, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { onMatchLive } from "@/lib/firestore";
import { piloteAmical } from "@/lib/console-pilote";
import LiveMatchConsole from "@/components/competition/LiveMatchConsole";
import type { Match } from "@/types";

// ============================================
// La console d'un match amical.
//
// ELLE FAISAIT MILLE DEUX CENTS LIGNES, et c'était le problème : une seconde
// console, écrite à part de celle des compétitions, qui rendait le même
// tableau d'affichage, le même chronomètre, le même historique — en moins
// bien. Elle n'a jamais eu le passeur. Le verrou anti-double-but ne lui est
// arrivé que longtemps après. Chaque correctif porté sur l'une manquait à
// l'autre.
//
// Il n'y en a plus qu'une (voir components/competition/LiveMatchConsole), et
// ce qui change d'un type de match à l'autre tient dans le PILOTE : où et
// comment on écrit. Un amical vit dans `matches/{id}`, une rencontre de
// compétition dans une sous-collection, leurs effectifs ne viennent pas du
// même endroit — c'est tout ce qui les sépare, et c'est tout ce que
// `piloteAmical` sait.
//
// Cette page ne garde donc que ce qui lui appartient vraiment : QUI a le
// droit d'ouvrir la console, et QUAND la porte est fermée.
// ============================================

export default function LiveMatchManage() {
  const { id } = useParams() as { id: string };
  const { user } = useAuth();
  const router = useRouter();

  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);

  // Mémoïsé : le pilote est en dépendance des abonnements de la console.
  const pilote = useMemo(() => piloteAmical(id), [id]);

  useEffect(() => {
    if (!id) return;
    return onMatchLive(id, (m) => {
      setMatch(m);
      setLoading(false);
    });
  }, [id]);

  // Seuls les deux managers, un arbitre confirmé et les modérateurs du match
  // peuvent le couvrir. La console n'avait aucune garde quand elle vivait dans
  // le panneau arbitre remisé : elle s'ouvrait à l'URL. Le contrôle de fond
  // reste l'affaire des règles Firestore ; ceci tient juste les mauvaises
  // personnes à l'écart des commandes.
  useEffect(() => {
    if (!match || !user) return;
    const peutCouvrir =
      user.uid === match.managerId ||
      user.uid === match.awayManagerId ||
      (match.moderatorIds ?? []).includes(user.uid) ||
      (match.refereeId === user.uid && match.refereeStatus === "confirmed");
    if (!peutCouvrir) {
      toast.error("Tu n'es pas chargé de couvrir ce match.");
      router.replace(`/matches/${id}`);
    }
  }, [match, user, router, id]);

  if (loading) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-700" />
        <p className="font-bold text-gray-500 italic">Chargement du match...</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-lg font-bold text-gray-900">Match introuvable</p>
        <button
          onClick={() => router.push("/matches")}
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
        >
          Retour aux matchs
        </button>
      </div>
    );
  }

  /**
   * Un match terminé ou annulé n'a plus de console.
   *
   * Un match fini rouvrait comme s'il était en cours, et un but ajouté par
   * mégarde incrémentait son score pour de bon — l'écriture ajoute, elle ne
   * corrige pas, et le résultat était déjà consolidé sur les clubs et les
   * joueurs à ce moment-là. Même chose pour un match annulé : il n'y a rien à
   * couvrir.
   *
   * Ce n'est pas une redirection muette : on arrive ici par un lien gardé dans
   * un fil de discussion ou par l'historique du navigateur, et il vaut mieux
   * dire pourquoi la porte est fermée que de renvoyer sans un mot.
   */
  if (match.status === "completed" || match.status === "cancelled") {
    const termine = match.status === "completed";
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-50/30 p-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center bg-white text-gray-300">
          {termine ? <CheckCircle2 size={40} /> : <AlertTriangle size={40} />}
        </div>
        <h2 className="mt-8 font-display text-3xl font-black tracking-tight text-gray-900">
          {termine ? "Match terminé" : "Match annulé"}
        </h2>
        <p className="mt-3 max-w-sm text-base font-medium leading-relaxed text-gray-500">
          {termine ? (
            <>
              {match.homeTeamName} {match.scoreHome ?? 0} – {match.scoreAway ?? 0} {match.awayTeamName}.
              {" "}Le direct est clos : la feuille, le déroulé et le rapport se lisent sur la fiche du match.
            </>
          ) : (
            <>Cette rencontre n&apos;aura pas lieu, il n&apos;y a rien à couvrir.</>
          )}
        </p>
        <button
          onClick={() => router.push(`/matches/${id}`)}
          className="mt-10 inline-flex items-center gap-2 bg-gray-900 px-6 py-3 text-[11px] font-black uppercase tracking-widest text-white transition-colors hover:bg-black"
        >
          <ChevronLeft size={16} /> Voir la fiche du match
        </button>
      </div>
    );
  }

  return <LiveMatchConsole pilote={pilote} returnHref={`/matches/${id}`} />;
}
