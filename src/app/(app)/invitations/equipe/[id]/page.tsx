"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Shield, Loader2, SearchX, LogIn, UserPlus, Check, CheckCircle2, Briefcase,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getTeamsIManage } from "@/lib/firestore";
import { choixParDefaut, messageDeReprise, type ResumeReprise } from "@/lib/rattachement-equipe";
import type { Team } from "@/types";

// ============================================
// Team-manager invitation, accept page (link sent by email).
// Public path: guests see the invite and get login/signup CTAs that
// bounce back here; logged-in users accept in one tap (the API checks
// that their email matches the invited one).
//
// L'ÉQUIPE REJOINT LES SIENNES (lib/rattachement-equipe). Avant d'accepter,
// le manager choisit : la lier à une de ses équipes, ou la créer dans ses
// équipes. Sans ce choix, l'équipe restait celle du tournoi seul et
// n'apparaissait jamais dans « Mes équipes ». Une équipe du même nom est
// proposée d'abord, sinon la création. Créer reprend l'effectif : les joueurs
// sans compte deviennent des fiches de l'équipe, et la page dit combien de
// joueurs, qui ont un compte, restent à inviter.
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
  // Les équipes que gère l'appelant, et son choix : l'identifiant de l'une
  // d'elles, ou « nouvelle ».
  const [equipes, setEquipes] = useState<Team[] | null>(null);
  const [choix, setChoix] = useState("nouvelle");
  const [resultat, setResultat] = useState<{
    cid: string; teamId: string; equipeId: string | null; lie: boolean; repris: ResumeReprise | null;
  } | null>(null);

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

  const uid = user?.uid ?? null;
  const nomEquipe = invite?.teamName ?? "";
  const enAttente = invite?.status === "pending";
  useEffect(() => {
    if (!uid || !enAttente) return;
    let vivant = true;
    getTeamsIManage(uid)
      .then((l) => {
        if (!vivant) return;
        setEquipes(l);
        setChoix(choixParDefaut(l, nomEquipe));
      })
      .catch(() => { if (vivant) setEquipes([]); });
    return () => { vivant = false; };
  }, [uid, enAttente, nomEquipe]);

  const handleAccept = async () => {
    if (!firebaseUser) return;
    setAccepting(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/team-manager-invites/${inviteId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ rattacher: choix }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Une erreur est survenue");
        return;
      }
      setAccepted(true);
      setResultat({
        cid: data.cid, teamId: data.teamId, equipeId: data.equipeId ?? null,
        lie: choix !== "nouvelle", repris: data.repris ?? null,
      });
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
        <div className="flex flex-col items-center gap-4 border border-gray-100 bg-white py-16 text-center shadow-sm">
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
      <div className="overflow-hidden border border-gray-100 bg-white shadow-sm">
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
              {resultat?.equipeId && (
                <p className="mt-2 text-xs font-semibold leading-relaxed text-gray-500">
                  {resultat.lie
                    ? "Elle est liée à ton équipe : reprends ton effectif depuis la page de l'équipe dans la compétition."
                    : messageDeReprise(invite.teamName, resultat.repris ?? { fiches: 0, comptes: 0, categorie: null })}
                </p>
              )}
              {/* Vers l'équipe, et non vers un « espace manager » : cette
                  page-là n'existe plus, le choix du rôle ayant rejoint la
                  vitrine. Ce qu'on vient d'obtenir, ce sont des équipes. */}
              {accepted && (
                <div className="mt-5 flex flex-col items-center gap-2">
                  {resultat && (
                    <Link
                      href={`/mon-equipe/${resultat.cid}/${resultat.teamId}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-600"
                    >
                      <Shield size={15} />
                      Voir l&apos;équipe dans la compétition
                    </Link>
                  )}
                  <Link
                    href={resultat?.equipeId ? `/teams/${resultat.equipeId}` : "/teams"}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <Briefcase size={15} />
                    Voir mes équipes
                  </Link>
                </div>
              )}
            </>
          ) : revoked ? (
            <p className="text-sm font-bold leading-relaxed text-gray-500">
              Cette invitation a été annulée par l&apos;organisateur.
            </p>
          ) : (
            <>
              <p className="text-sm font-bold leading-relaxed text-gray-600">
                <span className="text-gray-900">{invite.invitedByName}</span>{" "}t&apos;invite
                à prendre la gestion de cette équipe. En acceptant, tu en deviens
                propriétaire et manager.
              </p>
              <p className="mt-2 text-xs font-semibold text-gray-400">
                Invitation envoyée à {invite.emailMasked}
              </p>

              {user && (
                <fieldset className="mt-6 text-left">
                  <legend className="mb-2 text-[11px] font-black uppercase tracking-wide text-gray-500">
                    Dans tes équipes
                  </legend>
                  {equipes === null ? (
                    <div className="flex justify-center py-3 text-gray-300"><Loader2 size={18} className="animate-spin" /></div>
                  ) : (
                    <div className="space-y-2">
                      {equipes.map((e) => (
                        <label
                          key={e.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                            choix === e.id ? "border-emerald-500 bg-emerald-50" : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <input type="radio" name="rattacher" value={e.id} checked={choix === e.id} onChange={() => setChoix(e.id)} />
                          <span className="min-w-0">
                            <span className="block font-bold text-gray-900">Lier à {e.name}</span>
                            <span className="block text-xs font-semibold text-gray-500">C&apos;est la même équipe : tu pourras reprendre son effectif.</span>
                          </span>
                        </label>
                      ))}
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                          choix === "nouvelle" ? "border-emerald-500 bg-emerald-50" : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <input type="radio" name="rattacher" value="nouvelle" checked={choix === "nouvelle"} onChange={() => setChoix("nouvelle")} />
                        <span className="min-w-0">
                          <span className="block font-bold text-gray-900">Créer « {invite.teamName} » dans mes équipes</span>
                          <span className="block text-xs font-semibold text-gray-500">Une nouvelle équipe à toi, avec son nom, son logo et ses joueurs.</span>
                        </span>
                      </label>
                    </div>
                  )}
                </fieldset>
              )}

              {user ? (
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={accepting || equipes === null}
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
