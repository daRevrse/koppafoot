"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, LogOut, LogIn, X, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/i18n";
import {
  InviteCard, SupportBlock, InstallBlock,
} from "@/components/account/AccountExtras";
import { useAuthModal } from "@/components/auth/AuthModal";

// ============================================
// La feuille du compte, ouverte depuis le header sur telephone.
//
// ELLE VIVAIT DANS LA BARRE DU BAS, dont elle etait le cinquieme onglet.
// Le profil a rejoint le header — la barre porte desormais le Direct, les
// actus, la Tribune et l'Espace — et la feuille suit son bouton plutot que
// de rester derriere un declencheur qui n'existe plus.
//
// Elle sert le visiteur autant que le membre : connexion d'un cote,
// deconnexion de l'autre, et entre les deux l'invitation, l'aide, les
// notifications et les preferences, qui ne demandent aucun compte.
// ============================================

export default function AvatarBottomSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const authModal = useAuthModal();
  const t = useT();

  const handleLogout = useCallback(async () => {
    onClose();
    await logout();
    // Home is public, no reason to send anyone to a login screen.
    router.push("/");
  }, [logout, router, onClose]);

  if (!open) return null;

  const initials = user
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : "";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-[70] animate-slide-up">
        <div className="mx-2 mb-2 max-h-[85vh] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-emerald-950/95 shadow-2xl backdrop-blur-xl">
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-white/20" />
          </div>

          {/* Qui on est, ou l'invitation a le devenir */}
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-800 ring-2 ring-emerald-400/30">
              {user?.profilePictureUrl ? (
                <img
                  src={user.profilePictureUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : user ? (
                <span className="text-sm font-bold text-emerald-300">
                  {initials}
                </span>
              ) : (
                <User size={22} className="text-emerald-300" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">
                {user ? `${user.firstName} ${user.lastName}` : t("compte.visiteur")}
              </p>
              <p className="truncate text-xs text-emerald-400/70">
                {user ? (user.email ?? user.phone) : t("compte.aucunCompte")}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Divider */}
          <div className="mx-5 h-px bg-white/10" />

          {user ? (
            <div className="p-2">
              <Link
                href="/profile"
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/5 hover:text-white transition-colors"
              >
                <User size={18} className="text-emerald-400" />
                {t("compte.monProfil")}
              </Link>
            </div>
          ) : (
            /* Le meme emplacement, l'autre geste. La boite de dialogue reste
               ce qu'elle etait, elle s'ouvre juste d'ici en plus. */
            <div className="px-4 py-3">
              <p className="mt-2 px-1 pb-2 text-[11px] font-semibold leading-relaxed font-display text-base text-white uppercase tracking-tight">
                {t("compte.faitesPlus")}
              </p>
              <button
                type="button"
                onClick={() => { onClose(); authModal.open(); }}
                className="flex w-full items-center justify-center gap-2 bg-emerald-500 px-4 py-3.5 text-[11px] font-black uppercase tracking-[0.15em] text-emerald-950 transition-colors hover:bg-emerald-400"
              >
                <LogIn size={14} />
                {t("compte.seConnecter")}
              </button>
              {/* <p className="mt-2 px-1 text-[11px] font-semibold leading-relaxed text-white/40">
                Suivre une équipe, pronostiquer, publier dans la Tribune : tout
                cela demande un compte. Le reste se lit sans.
              </p> */}
            </div>
          )}

          <div className="px-4 pb-3">
            <InviteCard firstName={user?.firstName} />
          </div>

          <div className="mx-5 h-px bg-white/10" />
          <SupportBlock sombre onNavigate={onClose} />

          {/* LES REGLAGES ONT LEUR PAGE. Ils s'empilaient dans cette feuille,
              qu'on ouvre plusieurs fois par semaine pour aller a son profil
              ou se deconnecter — et qu'on traversait donc a chaque fois pour
              rien.

              HORS DU CONDITIONNEL SUR `user`, et c'est le point : le theme et
              la langue valent pour l'APPAREIL. Ils etaient offerts a tout le
              monde ici ; les enfermer derriere un compte en les sortant
              aurait retire le mode sombre a qui n'en a pas. */}
          <div className="mx-5 h-px bg-white/10" />
          <div className="p-2">
            <Link
              href="/parametres"
              onClick={onClose}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/5 hover:text-white transition-colors"
            >
              <Settings size={18} className="text-emerald-400" />
              {t("compte.parametres")}
            </Link>
          </div>

          {/* L'invitation a installer reste : ce n'est pas un reglage, c'est
              une proposition, et elle ne vaut qu'ici. */}
          <div className="mx-5 h-px bg-white/10" />
          <InstallBlock sombre />

          {user ? (
            <>
              <div className="mx-5 h-px bg-white/10" />
              <div className="p-2 pb-safe">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut size={18} />
                  {t("compte.deconnexion")}
                </button>
              </div>
            </>
          ) : (
            <div className="pb-safe" />
          )}
        </div>
      </div>
    </>
  );
}

// ─── Spaces Bottom Sheet ─────────────────────────────────────
// The role spaces used to hang at the bottom of the profile sheet, three taps
// deep. They now have their own tab, the one the Tribune freed when it moved
// up to the header, and the same sheet styling as the profile button.
