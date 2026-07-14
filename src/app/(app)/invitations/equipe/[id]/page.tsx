"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Shield, Loader2, SearchX, LogIn, UserPlus, Check, CheckCircle2, Briefcase,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";

// ============================================
// Team-manager invitation — accept page (link sent by email).
// Public path: guests see the invite and get login/signup CTAs that
// bounce back here; logged-in users accept in one tap (the API checks
// that their email matches the invited one).
// ============================================

interface InviteInfo {
  id: string;
  teamName: string;
  competitionName: string;
  invitedByName: string;
  emailMasked: string;
  status: "pending" | "accepted" | "revoked";
}

export default function TeamManagerInvitePage() {
  const params = useParams<{ id: string }>();
  const inviteId = params.id;
  const { user, firebaseUser, loading: authLoading } = useAuth();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!inviteId) return;
    fetch(`/api/team-manager-invites/${inviteId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("not found");
        const data = await res.json();
        setInvite(data.invite);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [inviteId]);

  const handleAccept = async () => {
    if (!firebaseUser) return;
    setAccepting(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/team-manager-invites/${inviteId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Une erreur est survenue");
        return;
      }
      setAccepted(true);
      toast.success("Tu gères maintenant cette équipe !");
    } catch (err) {
      console.error("Invite accept failed:", err);
      toast.error("Une erreur est survenue");
    } finally {
      setAccepting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (notFound || !invite) {
    return (
      <div className="mx-auto max-w-md">
        <div className="flex flex-col items-center gap-4 rounded-[2rem] border border-gray-100 bg-white py-16 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gray-50 text-gray-300">
            <SearchX size={28} />
          </div>
          <div>
            <p className="font-display text-lg font-black text-gray-900">
              Invitation introuvable
            </p>
            <p className="mt-1 px-6 text-sm font-bold text-gray-400">
              Ce lien n&apos;est plus valide. Demande à l&apos;organisateur de renvoyer
              une invitation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const done = accepted || invite.status === "accepted";
  const revoked = invite.status === "revoked" && !accepted;
  const nextParam = encodeURIComponent(`/invitations/equipe/${inviteId}`);

  return (
    <div className="mx-auto max-w-md">
      <div className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm">
        {/* Header strip */}
        <div className="bg-emerald-950 px-6 py-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-emerald-300">
            {done ? <CheckCircle2 size={26} /> : <Shield size={26} />}
          </div>
          <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-emerald-400">
            {invite.competitionName}
          </p>
          <h1 className="mt-1 font-display text-2xl font-black text-white">
            {invite.teamName}
          </h1>
        </div>

        <div className="p-6 text-center">
          {done ? (
            <>
              <p className="text-sm font-bold leading-relaxed text-gray-600">
                {accepted
                  ? "C'est officiel : tu es propriétaire et manager de cette équipe. 🎉"
                  : "Cette invitation a déjà été acceptée."}
              </p>
              {accepted && (
                <Link
                  href="/evolution"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-600"
                >
                  <Briefcase size={15} />
                  Ouvrir mon espace manager
                </Link>
              )}
            </>
          ) : revoked ? (
            <p className="text-sm font-bold leading-relaxed text-gray-500">
              Cette invitation a été annulée par l&apos;organisateur.
            </p>
          ) : (
            <>
              <p className="text-sm font-bold leading-relaxed text-gray-600">
                <span className="text-gray-900">{invite.invitedByName}</span> t&apos;invite
                à prendre la gestion de cette équipe. En acceptant, tu en deviens
                propriétaire et manager.
              </p>
              <p className="mt-2 text-xs font-semibold text-gray-400">
                Invitation envoyée à {invite.emailMasked}
              </p>

              {user ? (
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={accepting}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3.5 text-sm font-black text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                >
                  {accepting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Accepter la gestion
                </button>
              ) : (
                <div className="mt-6 space-y-2">
                  <Link
                    href={`/login?next=${nextParam}`}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3.5 text-sm font-black text-white transition-colors hover:bg-emerald-600"
                  >
                    <LogIn size={15} />
                    Se connecter pour accepter
                  </Link>
                  <Link
                    href={`/signup?next=${nextParam}`}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3.5 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    <UserPlus size={15} />
                    Créer mon compte
                  </Link>
                  <p className="pt-1 text-[11px] font-semibold text-gray-400">
                    Utilise l&apos;adresse email qui a reçu l&apos;invitation.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
