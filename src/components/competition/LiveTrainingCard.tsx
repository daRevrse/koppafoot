"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, Play, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";

// ============================================
// Training sandbox entry point. Creates (or reuses) the user's own fake
// competition and drops them straight into the live console. Nothing here
// is published: the sandbox is a draft competition only they can see.
// ============================================

export default function LiveTrainingCard() {
  const { firebaseUser } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState<"open" | "reset" | null>(null);

  const call = async (method: "POST" | "PATCH") => {
    if (!firebaseUser) return null;
    const token = await firebaseUser.getIdToken();
    const res = await fetch("/api/live-training", {
      method,
      headers: { authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Une erreur est survenue");
      return null;
    }
    return data as { cid: string; mid: string };
  };

  const open = async () => {
    setBusy("open");
    try {
      const data = await call("POST");
      if (data) router.push(`/live-ops/${data.cid}/matches/${data.mid}/live`);
    } catch {
      toast.error("Une erreur est survenue");
    } finally {
      setBusy(null);
    }
  };

  const reset = async () => {
    setBusy("reset");
    try {
      const data = await call("PATCH");
      if (data) toast.success("Match remis à zéro");
    } catch {
      toast.error("Une erreur est survenue");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
          <GraduationCap size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-emerald-900">Match d&apos;entraînement</p>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-emerald-800">
            Un match fictif, rien que pour toi : compose les feuilles, lance le
            chrono, marque des buts, distribue des cartons. Rien n&apos;est publié et
            personne ne le voit, tu peux tout recommencer autant de fois que tu veux.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={open}
              disabled={busy !== null}
              className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
            >
              {busy === "open" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Play size={15} />
              )}
              Ouvrir la console
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={busy !== null}
              className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50"
            >
              {busy === "reset" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <RotateCcw size={15} />
              )}
              Recommencer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
