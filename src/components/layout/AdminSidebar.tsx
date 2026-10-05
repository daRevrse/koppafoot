"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronLeft, ClipboardList, Flag, Goal, Handshake, LayoutDashboard, LogOut, MapPin, MapPinPlus,
  Megaphone, MessageSquareText, Radio, Scale, Send, Shield, ShieldCheck, TrendingUp, Trophy, Users, X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useATraiter } from "@/components/admin/ATraiterContext";
import type { ATraiter } from "@/lib/admin-tableau";

// ============================================
// Le menu de l'administration.
//
// RANGÉ PAR CE QU'ON VIENT Y FAIRE. « Utilisateurs / Contenu / Système »
// rangeait par type de donnée : une candidature de terrain voisinait avec la
// liste des comptes, un signalement se cachait au bas de la page Tribune, et
// rien ne disait ce qui attendait. D'abord ce qui attend une décision, avec
// son compte ; puis ce qu'on consulte ; puis ce qu'on dit à la plateforme.
// ============================================

interface Entree {
  href: string;
  label: string;
  Icone: React.ComponentType<{ size?: number; className?: string }>;
  exact?: boolean;
  compte?: (a: ATraiter) => number;
}

const NAV: { titre: string | null; entrees: Entree[] }[] = [
  { titre: null, entrees: [{ href: "/admin", label: "Tableau de bord", Icone: LayoutDashboard, exact: true }] },
  {
    titre: "À traiter",
    entrees: [
      { href: "/admin/organizers", label: "Organisateurs", Icone: ClipboardList, compte: (a) => a.organisateurs },
      { href: "/admin/scorers", label: "Scoreurs", Icone: Radio, compte: (a) => a.scoreurs },
      { href: "/admin/terrains", label: "Terrains proposés", Icone: MapPinPlus, compte: (a) => a.terrains },
      { href: "/admin/contestations", label: "Contestations", Icone: Scale, compte: (a) => a.contestations },
      { href: "/admin/signalements", label: "Signalements", Icone: Flag, compte: (a) => a.signalements },
      { href: "/admin/retours", label: "Retours", Icone: MessageSquareText, compte: (a) => a.retours },
    ],
  },
  {
    titre: "Plateforme",
    entrees: [
      { href: "/admin/users", label: "Comptes", Icone: Users },
      { href: "/admin/teams", label: "Équipes", Icone: Shield },
      { href: "/admin/matches", label: "Matchs", Icone: Goal },
      { href: "/admin/competitions", label: "Compétitions", Icone: Trophy, compte: (a) => a.competitions },
      { href: "/admin/venues", label: "Terrains", Icone: MapPin },
      { href: "/admin/stats", label: "Statistiques", Icone: TrendingUp },
    ],
  },
  {
    titre: "Communication",
    entrees: [
      { href: "/admin/tribune", label: "Tribune", Icone: Megaphone },
      { href: "/admin/messages", label: "Messages", Icone: Send },
      { href: "/admin/partenaires", label: "Partenaires", Icone: Handshake },
    ],
  },
  { titre: "Réglages", entrees: [{ href: "/admin/settings", label: "Administrateurs", Icone: ShieldCheck }] },
];

/** L'intitulé de la page ouverte, pour l'en-tête. Les fiches héritent de leur liste. */
export function titreDeLaPage(pathname: string): string {
  if (pathname === "/admin/profile") return "Mon profil";
  if (pathname.startsWith("/admin/campaigns")) return "Messages";
  for (const groupe of NAV) {
    for (const e of groupe.entrees) {
      if (e.exact ? pathname === e.href : pathname.startsWith(e.href)) return e.label;
    }
  }
  return "Administration";
}

function actif(pathname: string, e: Entree): boolean {
  if (e.exact) return pathname === e.href;
  // Les anciennes campagnes vivent désormais dans Messages.
  if (e.href === "/admin/messages" && pathname.startsWith("/admin/campaigns")) return true;
  return pathname.startsWith(e.href);
}

export default function AdminSidebar({ ouvert, onFermer }: { ouvert: boolean; onFermer: () => void }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { aTraiter } = useATraiter();

  if (!user) return null;

  const deconnexion = async () => {
    await logout();
    router.push("/login");
  };

  const menu = (
    <div className="flex h-full flex-col bg-black text-white">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-5">
        <Link href="/admin" onClick={onFermer} className="flex items-center gap-2.5">
          <Image src="/branding/logo_symbol.png" alt="" width={24} height={24} className="brightness-0 invert" />
          <span className="font-display text-base font-black uppercase tracking-tight">Koppa</span>
          <span className="bg-emerald-400 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-black">Admin</span>
        </Link>
        <button onClick={onFermer} className="text-white/50 hover:text-white lg:hidden" aria-label="Fermer le menu">
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Administration">
        {NAV.map((groupe) => (
          <div key={groupe.titre ?? "accueil"} className="mb-3">
            {groupe.titre && (
              <p className="mb-1 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">{groupe.titre}</p>
            )}
            {groupe.entrees.map((e) => {
              const estActif = actif(pathname, e);
              const n = e.compte?.(aTraiter) ?? 0;
              return (
                <Link
                  key={e.href}
                  href={e.href}
                  onClick={onFermer}
                  aria-current={estActif ? "page" : undefined}
                  className={`flex items-center gap-3 border-l-2 px-3 py-1.5 text-[13px] font-bold transition-colors ${
                    estActif
                      ? "border-emerald-400 bg-white/10 text-white"
                      : "border-transparent text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <e.Icone size={16} className={estActif ? "text-emerald-400" : "text-white/40"} />
                  <span className="min-w-0 flex-1 truncate">{e.label}</span>
                  {n > 0 && (
                    <span className="min-w-5 bg-amber-400 px-1.5 py-0.5 text-center text-[10px] font-black tabular-nums text-black">
                      {n}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Le profil se rejoint par l'avatar de l'en-tête : le pied du menu ne
          garde que la sortie, sur une ligne, pour que tout le menu tienne sur
          un écran d'ordinateur portable sans défiler. */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/10 px-3 py-2">
        <Link href="/" className="flex items-center gap-2 px-3 py-2 text-[13px] font-bold text-emerald-400 hover:bg-white/5">
          <ChevronLeft size={16} /> Retour au site
        </Link>
        <button onClick={deconnexion} aria-label="Déconnexion" title="Déconnexion" className="flex items-center gap-2 px-3 py-2 text-[13px] font-bold text-white/60 hover:bg-white/5 hover:text-white">
          <LogOut size={16} className="text-white/40" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Sur téléphone, le menu s'ouvre par-dessus depuis le bouton de l'en-tête.
          Ce bouton flottait en position fixe et recouvrait le titre de la page. */}
      {ouvert && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={onFermer} />
          <div className="relative h-full w-72 max-w-[85vw]">{menu}</div>
        </div>
      )}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">{menu}</aside>
    </>
  );
}
