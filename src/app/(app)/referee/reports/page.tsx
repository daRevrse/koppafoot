"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { 
  Trophy, ChevronLeft, Save, Loader2, AlertCircle, 
  CheckCircle2, Info, Star, MessageSquare, ChevronRight
} from "lucide-react";
import { getMatchById, submitMatchReport, onRefereeAssignments } from "@/lib/firestore";
import type { Match } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";

// ============================================
// Internal Component
// ============================================

function ReportForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const matchId = searchParams.get("matchId");

  const [match, setMatch] = useState<Match | null>(null);
  const [assignedMatches, setAssignedMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [scoreHome, setScoreHome] = useState<number>(0);
  const [scoreAway, setScoreAway] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    if (!matchId) {
      const unsub = onRefereeAssignments(user.uid, (data) => {
        setAssignedMatches(data.filter(m => m.refereeStatus === "confirmed" && m.status === "upcoming"));
        setLoading(false);
      });
      return () => unsub();
    }

    const fetchMatch = async () => {
      try {
        const data = await getMatchById(matchId);
        if (!data) {
          setError("Match introuvable.");
        } else if (data.status === "completed") {
          setError("Ce match a déjà été clôturé.");
        } else {
          setMatch(data);
        }
      } catch (err) {
        console.error(err);
        setError("Erreur lors de la récupération du match.");
      } finally {
        setLoading(false);
      }
    };

    fetchMatch();
  }, [matchId, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchId || !user) return;
    
    setSubmitting(true);
    try {
      await submitMatchReport(matchId, scoreHome, scoreAway);
      router.push("/referee/matches?success=report-submitted");
    } catch (err) {
      console.error(err);
      setError("Erreur lors de la soumission du rapport.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        <p className="font-medium text-gray-500">Chargement des données du match...</p>
      </div>
    );
  }

  if (!matchId && !loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight font-display italic">Mes Rapports</h1>
          <p className="mt-2 text-gray-500 font-medium tracking-tight">Sélectionne un match pour saisir le score final et clôturer la rencontre.</p>
        </div>

        {assignedMatches.length > 0 ? (
          <div className="grid gap-4">
            {assignedMatches.map(m => (
              <Link
                key={m.id}
                href={`/referee/reports?matchId=${m.id}`}
                className="group flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:border-emerald-200 hover:shadow-md"
              >
                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black uppercase text-gray-400">{m.time}</span>
                    <span className="text-sm font-black text-gray-900">{format(new Date(m.date), "dd MMM", { locale: fr })}</span>
                  </div>
                  <div className="h-10 w-px bg-gray-100" />
                  <div>
                    <div className="text-sm font-black text-gray-900 group-hover:text-emerald-600 transition-colors">
                      {m.homeTeamName} vs {m.awayTeamName}
                    </div>
                    <div className="text-xs font-medium text-gray-400">
                      {m.venueName}, {m.venueCity}
                    </div>
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 text-gray-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-all">
                  <ChevronRight size={20} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-100 bg-white p-12 text-center">
            <div className="mb-4 text-gray-200">
               <Trophy size={64} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Aucun rapport en attente</h3>
            <p className="mt-2 text-sm text-gray-500 max-w-xs mx-auto">
              Tu n'as aucun match programmé nécessitant un rapport pour le moment.
            </p>
            <Link 
              href="/referee/find-matches"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-600 transition-all"
            >
              Trouver un match
            </Link>
          </div>
        )}
      </div>
    );
  }

  if (error || (!match && matchId)) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl border border-red-50"
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-red-50 text-red-500">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 font-display">Attention</h2>
        <p className="mt-2 text-gray-500">{error || "Match introuvable"}</p>
        <button
          onClick={() => router.back()}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white hover:bg-gray-800 transition-all"
        >
          <ChevronLeft size={18} /> Retour
        </button>
      </motion.div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition-all hover:bg-gray-50 hover:text-gray-900"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight font-display">Rapport de Match</h1>
          <p className="text-sm text-gray-500">Saisie officielle du score final</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left: Summary */}
        <div className="space-y-6 lg:col-span-1">
          <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-xl">
            <div className="bg-emerald-900 p-6 text-white text-center">
              <Trophy className="mx-auto mb-2 text-accent-400" size={32} />
              <h3 className="text-lg font-black uppercase tracking-tighter">Récapitulatif</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1 border-b border-gray-50 pb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Date & Heure</span>
                <p className="text-sm font-bold text-gray-900">{match?.date} — {match?.time}</p>
              </div>
              <div className="space-y-1 border-b border-gray-50 pb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Lieu</span>
                <p className="text-sm font-bold text-gray-900 leading-tight">{match?.venueName}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Format</span>
                <p className="text-sm font-bold text-gray-900">{match?.format}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-amber-50 p-4 border border-amber-100 flex gap-3">
            <Info className="text-amber-500 shrink-0" size={20} />
            <p className="text-xs font-medium text-amber-700 leading-relaxed">
              Le score que tu saisis sera définitif et générera une annonce publique sur La Tribune. 
              Vérifie bien avant de valider.
            </p>
          </div>
        </div>

        {/* Right: Score Form */}
        <div className="lg:col-span-2">
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="overflow-hidden rounded-3xl border border-white bg-white/60 p-8 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex flex-col gap-8 md:flex-row md:items-center">
              {/* Home Team */}
              <div className="flex-1 space-y-6 text-center">
                <div className="mx-auto h-16 w-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-2xl border-2 border-emerald-100 shadow-sm uppercase">
                  {match?.homeTeamName?.[0]}
                </div>
                <h3 className="text-lg font-black text-gray-900 leading-tight">{match?.homeTeamName}</h3>
                <div className="flex items-center justify-center gap-4">
                  <button 
                    type="button" 
                    onClick={() => setScoreHome(Math.max(0, scoreHome - 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 active:scale-95 transition-all text-xl font-bold"
                  >-</button>
                  <input
                    type="number"
                    value={scoreHome}
                    onChange={(e) => setScoreHome(parseInt(e.target.value) || 0)}
                    className="w-20 rounded-2xl border-gray-100 bg-gray-50/50 py-4 text-center text-3xl font-black text-gray-900 focus:border-emerald-500 focus:bg-white focus:outline-none transition-all"
                  />
                  <button 
                    type="button"
                    onClick={() => setScoreHome(scoreHome + 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 active:scale-95 transition-all text-xl font-bold"
                  >+</button>
                </div>
              </div>

              <div className="flex flex-col items-center">
                 <div className="h-10 w-px bg-gray-100 md:h-20" />
                 <span className="my-2 text-xs font-black italic text-gray-300">VS</span>
                 <div className="h-10 w-px bg-gray-100 md:h-20" />
              </div>

              {/* Away Team */}
               <div className="flex-1 space-y-6 text-center">
                <div className="mx-auto h-16 w-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-2xl border-2 border-blue-100 shadow-sm uppercase">
                  {match?.awayTeamName?.[0]}
                </div>
                <h3 className="text-lg font-black text-gray-900 leading-tight">{match?.awayTeamName}</h3>
                <div className="flex items-center justify-center gap-4">
                  <button 
                    type="button"
                    onClick={() => setScoreAway(Math.max(0, scoreAway - 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 active:scale-95 transition-all text-xl font-bold"
                  >-</button>
                  <input
                    type="number"
                    value={scoreAway}
                    onChange={(e) => setScoreAway(parseInt(e.target.value) || 0)}
                    className="w-20 rounded-2xl border-gray-100 bg-gray-50/50 py-4 text-center text-3xl font-black text-gray-900 focus:border-emerald-500 focus:bg-white focus:outline-none transition-all"
                  />
                  <button 
                    type="button"
                    onClick={() => setScoreAway(scoreAway + 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 active:scale-95 transition-all text-xl font-bold"
                  >+</button>
                </div>
              </div>
            </div>

            <div className="mt-12 space-y-6 pt-8 border-t border-gray-50">
               <div className="grid gap-4 md:grid-cols-2">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Évaluation Ambiance</label>
                   <div className="flex gap-1">
                     {[1, 2, 3, 4, 5].map((star) => (
                       <button key={star} type="button" className="text-gray-200 hover:text-amber-400 transition-colors">
                         <Star size={20} fill={star <= 4 ? "currentColor" : "none"} />
                       </button>
                     ))}
                   </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Commentaire Arbitre (optionnel)</label>
                    <textarea 
                      placeholder="Fair-play, incidents, etc..."
                      className="w-full rounded-xl border-gray-100 bg-gray-50/50 p-3 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none transition-all h-20 resize-none"
                    />
                 </div>
               </div>

               <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 px-6 py-4 text-lg font-black uppercase tracking-tight text-white transition-all hover:bg-emerald-600 active:scale-[0.98] disabled:opacity-50"
               >
                 {submitting ? (
                   <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Enregistrement...
                   </>
                 ) : (
                   <>
                    <Save size={20} />
                    Valider le score et clôturer
                   </>
                 )}
               </button>
            </div>
          </motion.form>
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ReportForm />
    </Suspense>
  );
}
