"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GraduationCap, Loader2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// ============================================
// /live-ops/entrainement, a linkable door to the training sandbox.
//
// The sandbox is provisioned by an API call, not a URL, so the sidebar had
// nothing to point at. This page does the provisioning and forwards to the
// console, which keeps "Match d'entraînement" a real destination.
// ============================================

export default function LiveTrainingEntry() {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Provisioning is create-or-get, but React 18 mounts effects twice in dev,
  // guard so a single visit doesn't fire two POSTs.
  const started = useRef(false);

  useEffect(() => {
    if (loading || !firebaseUser || started.current) return;
    started.current = true;
    let cancelled = false;

    (async () => {
      try {
        const token = await firebaseUser.getIdToken();
        const res = await fetch("/api/live-training", {
          method: "POST",
          headers: { authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erreur serveur");
        if (!cancelled) {
          router.replace(`/live-ops/${data.cid}/matches/${data.mid}/live`);
        }
      } catch (err) {
        console.error("live-training provisioning failed:", err);
        if (!cancelled) {
          setError("Impossible de préparer le match d'entraînement.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [firebaseUser, loading, router]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center bg-red-50 text-red-500">
          <AlertTriangle size={26} />
        </div>
        <p className="mt-4 font-display text-lg font-black text-gray-900">{error}</p>
        <Link
          href="/live-ops"
          className="mt-4 text-sm font-bold text-emerald-600 hover:text-emerald-700"
        >
          ← Retour à l&apos;espace live
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center bg-emerald-50 text-emerald-500">
        <GraduationCap size={26} />
      </div>
      <p className="mt-4 font-display text-lg font-black text-gray-900">
        Préparation du match d&apos;entraînement
      </p>
      <p className="mt-1 text-sm font-semibold text-gray-400">
        On installe le terrain, deux équipes et leurs effectifs…
      </p>
      <Loader2 size={22} className="mt-6 animate-spin text-gray-300" />
    </div>
  );
}
