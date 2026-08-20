"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { KeyRound, Loader2, LogIn, Radio, ShieldCheck, Ticket } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  describeStaffScope,
  explainStaffScope,
  formatStaffCode,
  normalizeStaffCode,
} from "@/lib/staff-scope";
import type { StaffScope } from "@/types";

// ============================================
// Redeem a staff access code
//
// The screen a volunteer lands on from the link (or the code) an organizer
// sent them. It asks for one thing, the code, and hands back the live space
// for exactly what that code covers.
// ============================================

interface Redeemed {
  cid: string;
  competitionName: string;
  scope: StaffScope;
  label: string;
  alreadyStaff: boolean;
}

function JoinStaffInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, firebaseUser, loading } = useAuth();

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Redeemed | null>(null);

  // Prefill from the link, so the volunteer only has to press the button.
  useEffect(() => {
    const fromLink = params.get("code");
    if (fromLink) setCode(formatStaffCode(fromLink));
  }, [params]);

  const handleRedeem = async () => {
    const normalized = normalizeStaffCode(code);
    if (!normalized) {
      toast.error("Saisis le code reçu");
      return;
    }
    if (!firebaseUser) {
      toast.error("Connecte-toi d'abord");
      return;
    }
    setSubmitting(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/competitions/staff-codes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: normalized }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Ce code n'a pas pu être activé");
        return;
      }
      setResult(data as Redeemed);
      toast.success("Accès activé");
    } catch (err) {
      console.error("Error redeeming staff code:", err);
      toast.error("Une erreur est survenue");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  // Signed in, code accepted: hand over the space it unlocks.
  if (result) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-md space-y-5 rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-50">
          <ShieldCheck size={26} className="text-emerald-600" />
        </div>
        <div>
          <h1 className="font-display text-xl font-extrabold text-gray-900">
            {result.alreadyStaff ? "Tu as déjà accès" : "Accès activé"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{result.competitionName}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-4 text-left">
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">Portée</p>
          <p className="mt-1 text-sm font-bold text-gray-900">
            {describeStaffScope(result.scope)}
          </p>
          <p className="mt-1 text-xs text-gray-500">{explainStaffScope(result.scope)}</p>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/live-ops/${result.cid}`)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-colors hover:bg-primary-700"
        >
          <Radio size={16} />
          Ouvrir l&apos;espace live
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-md space-y-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
    >
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary-50">
          <Ticket size={26} className="text-primary-600" />
        </div>
        <h1 className="mt-4 font-display text-xl font-extrabold text-gray-900">
          Code d&apos;accès staff
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Saisis le code que l&apos;organisateur t&apos;a envoyé pour saisir les matchs en direct.
        </p>
      </div>

      <div className="relative">
        <KeyRound
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="XXXX-XXXX"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-lg border border-gray-300 py-3 pl-9 pr-4 text-center font-mono text-lg font-black tracking-[0.2em] text-gray-900 focus:border-primary-500 focus:outline-none"
        />
      </div>

      {firebaseUser && user ? (
        <button
          type="button"
          onClick={handleRedeem}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-colors hover:bg-primary-700 disabled:opacity-50"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
          Activer mon accès
        </button>
      ) : (
        <div className="space-y-3">
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
            Connecte-toi (ou crée un compte en 30 secondes) pour activer ce code, c&apos;est ce
            qui permet de savoir qui a saisi quoi pendant le match.
          </p>
          <Link
            href={`/login?next=${encodeURIComponent(
              `/staff/rejoindre?code=${normalizeStaffCode(code)}`,
            )}`}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-colors hover:bg-primary-700"
          >
            <LogIn size={16} />
            Se connecter
          </Link>
        </div>
      )}
    </motion.div>
  );
}

export default function JoinStaffPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-gray-300" />
        </div>
      }
    >
      <JoinStaffInner />
    </Suspense>
  );
}
