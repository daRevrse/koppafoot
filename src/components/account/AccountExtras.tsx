"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Share2, Check, Megaphone, HelpCircle, MessageSquare, ChevronRight,
  Sun, Moon, Languages,
} from "lucide-react";
import { shareInviteLink } from "@/lib/invite-link";
import { useTheme } from "@/contexts/ThemeContext";

// ============================================
// Les blocs du menu compte : inviter, support, thème, langue.
//
// Partagés entre le menu du header et la feuille du bas, pour la raison
// apprise avec la navigation : deux copies d'un même bloc divergent, et
// personne ne s'en aperçoit avant qu'un utilisateur le signale.
//
// Les deux hôtes n'ont pas le même fond, le menu est blanc, la feuille
// mobile est vert nuit. D'où `sombre` : une seule structure, deux palettes.
// L'alternative aurait été un second fichier, c'est-à-dire exactement la
// divergence qu'on cherche à éviter.
//
// THÈME et LANGUE sont pour l'instant de l'INTERFACE SEULE. Aucun système de
// thème sombre n'existe dans le projet (deux règles `dark:` en tout, aucune
// bibliothèque i18n), donc les basculer ne change rien à ce qu'on voit. Ils
// le disent : une bascule muette qui prétend fonctionner est pire qu'une
// bascule qui annonce son état.
// ============================================

interface Ton {
  titre: string;
  libelle: string;
  chevron: string;
  survol: string;
  puceFond: string;
  icone: string;
}

const CLAIR: Ton = {
  titre: "text-gray-400",
  libelle: "text-gray-700",
  chevron: "text-gray-300",
  survol: "hover:bg-gray-50",
  puceFond: "border-gray-200/70 bg-gray-50",
  icone: "text-gray-500",
};

const SOMBRE: Ton = {
  titre: "text-emerald-400/60",
  libelle: "text-white/80",
  chevron: "text-white/20",
  survol: "hover:bg-white/5",
  puceFond: "border-white/10 bg-white/5",
  icone: "text-emerald-400",
};

const ton = (sombre?: boolean) => (sombre ? SOMBRE : CLAIR);

/** Une ligne de menu : icône, libellé, chevron. */
function Ligne({ href, Icon, label, onClick, t }: {
  href?: string;
  Icon: typeof HelpCircle;
  label: string;
  onClick?: () => void;
  t: Ton;
}) {
  const contenu = (
    <>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center border ${t.puceFond}`}>
        <Icon size={15} className={t.icone} />
      </span>
      <span className={`min-w-0 flex-1 truncate text-[13px] font-bold ${t.libelle}`}>{label}</span>
      <ChevronRight size={15} className={`shrink-0 ${t.chevron}`} />
    </>
  );

  const classe = `flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${t.survol}`;

  if (href) {
    return <Link href={href} onClick={onClick} className={classe}>{contenu}</Link>;
  }
  return <button type="button" onClick={onClick} className={classe}>{contenu}</button>;
}

/**
 * Le bloc d'invitation.
 *
 * En couleur pleine, contrairement au reste du menu : c'est la seule chose
 * ici qu'on demande à l'utilisateur de FAIRE pour le produit, tout le reste
 * est à son service. Elle mérite de se détacher, sur fond clair comme sur
 * fond sombre.
 */
export function InviteCard({ firstName }: { firstName?: string }) {
  const [copie, setCopie] = useState(false);

  const partager = async () => {
    const resultat = await shareInviteLink(firstName);
    // La feuille de partage native parle d'elle-même ; une copie silencieuse
    // dans le presse-papier, non.
    if (resultat === "copied") {
      setCopie(true);
      setTimeout(() => setCopie(false), 2500);
    }
  };

  return (
    <div className="relative overflow-hidden bg-emerald-700 p-4 text-white">
      <Megaphone
        size={72}
        strokeWidth={1}
        aria-hidden
        className="absolute -bottom-3 -right-3 text-white/10"
      />
      <div className="relative">
        <p className="font-display text-base font-black uppercase tracking-tight">
          Invite tes amis
        </p>
        <p className="mt-1 max-w-[15rem] text-[11px] font-semibold leading-relaxed text-white/70">
          Le foot se suit à plusieurs. Partage KoppaFoot à ceux qui jouent avec toi.
        </p>
        <button
          type="button"
          onClick={partager}
          className="mt-3 inline-flex items-center gap-2 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-gray-900 transition-colors hover:bg-emerald-300"
        >
          {copie ? <Check size={13} /> : <Share2 size={13} />}
          {copie ? "Lien copié" : "Partager le lien"}
        </button>
      </div>
    </div>
  );
}

/** Aide et retours. Deux portes vers la même page, pas un centre d'assistance. */
export function SupportBlock({ sombre, onNavigate }: {
  sombre?: boolean;
  onNavigate?: () => void;
}) {
  const t = ton(sombre);
  return (
    <div>
      <p className={`px-4 pb-2 pt-3 text-[10px] font-black uppercase tracking-[0.15em] ${t.titre}`}>
        Support
      </p>
      <Ligne t={t} href="/aide" onClick={onNavigate} Icon={HelpCircle} label="Questions fréquentes" />
      <Ligne t={t} href="/aide#retour" onClick={onNavigate} Icon={MessageSquare} label="Nous faire un retour" />
    </div>
  );
}

/**
 * Thème et langue.
 *
 * Le thème est branché : le choix s'applique tout de suite et se garde sur
 * l'appareil. La langue ne l'est pas encore, et le dit, une bascule muette
 * qui prétend fonctionner étant pire qu'une bascule qui annonce son état.
 */
export function PreferencesBlock({ sombre }: { sombre?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [langue, setLangue] = useState<"fr" | "en">("fr");
  const t = ton(sombre);

  const bascule = (actif: boolean) =>
    `flex-1 px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] transition-colors ${
      actif
        ? sombre ? "bg-emerald-500 text-emerald-950" : "bg-gray-900 text-white"
        : sombre ? "text-white/50 hover:text-white" : "text-gray-500 hover:text-gray-900"
    }`;

  return (
    <div>
      <p className={`px-4 pb-2 pt-3 text-[10px] font-black uppercase tracking-[0.15em] ${t.titre}`}>
        Préférences
      </p>

      <div className="px-4 pb-2">
        <div className="flex items-center justify-between gap-3 py-1.5">
          <span className={`flex items-center gap-2 text-[13px] font-bold ${t.libelle}`}>
            {theme === "light"
              ? <Sun size={15} className={t.icone} />
              : <Moon size={15} className={t.icone} />}
            Thème
          </span>
          <span className={`flex shrink-0 border ${sombre ? "border-white/10" : "border-gray-200/70"}`}>
            <button type="button" onClick={() => setTheme("light")} className={bascule(theme === "light")}>
              Clair
            </button>
            <button type="button" onClick={() => setTheme("dark")} className={bascule(theme === "dark")}>
              Sombre
            </button>
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 py-1.5">
          <span className={`flex items-center gap-2 text-[13px] font-bold ${t.libelle}`}>
            <Languages size={15} className={t.icone} />
            Langue
            <span className={
              sombre
                ? "border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-amber-300"
                : "border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-amber-700"
            }>
              Bientôt
            </span>
          </span>
          <span className={`flex shrink-0 border ${sombre ? "border-white/10" : "border-gray-200/70"}`}>
            <button type="button" onClick={() => setLangue("fr")} className={bascule(langue === "fr")}>
              FR
            </button>
            <button type="button" onClick={() => setLangue("en")} className={bascule(langue === "en")}>
              EN
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
