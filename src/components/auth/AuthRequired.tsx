"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Lock, ArrowLeft } from "lucide-react";
import { useAuthModal } from "./AuthModal";

// ============================================
// AuthRequired — what a protected page shows instead of bouncing.
//
// The old guard replaced the URL with /login, which lost the destination and
// made "back" go in circles. The page now stays on its own address, says
// what it needs, and opens the sign-in dialog on top. Once the account
// lands, the page below renders itself — no redirect, no lost URL.
// ============================================

export default function AuthRequired({
  message = "Cette page demande un compte KoppaFoot.",
}: {
  message?: string;
}) {
  const { open } = useAuthModal();

  // Asked once, on arrival. Dismissing the dialog leaves the explanation and
  // its button behind, so nobody is stuck with a blank screen.
  useEffect(() => {
    open(message);
  }, [open, message]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center border border-gray-200/70 bg-white px-8 py-20 text-center">
      <Lock size={34} strokeWidth={1.2} className="text-gray-900" />
      <p className="mt-7 font-display text-3xl font-black leading-tight tracking-tight text-gray-900">
        Connexion requise
      </p>
      <p className="mt-3 text-base leading-relaxed text-gray-500">{message}</p>

      <button
        type="button"
        onClick={() => open(message)}
        className="mt-8 border border-gray-900 bg-gray-900 px-7 py-4 text-sm font-black uppercase tracking-[0.12em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700"
      >
        Se connecter
      </button>

      <Link
        href="/"
        className="mt-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-gray-400 transition-colors hover:text-gray-700"
      >
        <ArrowLeft size={13} />
        Retour au direct
      </Link>
    </div>
  );
}
