"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Share2, Check, Megaphone, HelpCircle, MessageSquare, ChevronRight,
  Sun, Moon, Languages, Bell, BellOff,
} from "lucide-react";
import { shareInviteLink } from "@/lib/invite-link";
import { useTheme } from "@/contexts/ThemeContext";
import { useLangue, useT } from "@/i18n";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { CATEGORIES_PUSH } from "@/lib/push-categories";

// ============================================
// Les blocs du menu compte : inviter, support, notifications, thème, langue.
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
// Une bascule muette qui prétend fonctionner est pire qu'une bascule qui
// annonce son état : c'est la règle que suivent ces blocs. Le thème et la
// langue s'appliquent pour de bon, et les notifications disent quand elles ne
// peuvent PAS être réglées ici — refus navigateur, iPhone hors application —
// plutôt que d'afficher un interrupteur sans effet.
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
  const t = useT();

  const partager = async () => {
    const resultat = await shareInviteLink(
      firstName,
      firstName ? t("invite.message", { prenom: firstName }) : t("invite.messageAnonyme"),
    );
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
          {t("invite.titre")}
        </p>
        <p className="mt-1 max-w-[15rem] text-[11px] font-semibold leading-relaxed text-white/70">
          {t("invite.texte")}
        </p>
        <button
          type="button"
          onClick={partager}
          className="mt-3 inline-flex items-center gap-2 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-gray-900 transition-colors hover:bg-emerald-300"
        >
          {copie ? <Check size={13} /> : <Share2 size={13} />}
          {copie ? t("invite.copie") : t("invite.partager")}
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
  const ton_ = ton(sombre);
  const t = useT();
  return (
    <div>
      <p className={`px-4 pb-2 pt-3 text-[10px] font-black uppercase tracking-[0.15em] ${ton_.titre}`}>
        {t("support.titre")}
      </p>
      <Ligne t={ton_} href="/aide" onClick={onNavigate} Icon={HelpCircle} label={t("support.faq")} />
      <Ligne t={ton_} href="/aide#retour" onClick={onNavigate} Icon={MessageSquare} label={t("support.retour")} />
    </div>
  );
}

/**
 * Les notifications push.
 *
 * DEUX PORTÉES DANS UN SEUL BLOC, et l'ordre le dit : l'interrupteur du haut
 * vaut pour CET APPAREIL — le jeton y vit, couper sur le téléphone ne doit
 * pas éteindre l'ordinateur — les lignes du dessous valent pour le COMPTE,
 * puisque c'est le serveur qui filtre à l'envoi.
 *
 * LES CAS OÙ IL N'Y A PAS D'INTERRUPTEUR comptent autant que l'interrupteur
 * lui-même. Un refus navigateur est définitif : aucun appel ne peut le
 * rouvrir, donc afficher une bascule qui ne marchera pas laisserait conclure
 * à une panne du produit. On dit où aller. Sur iPhone, le push n'existe que
 * dans l'application ajoutée à l'écran d'accueil, et là encore une bascule
 * muette vaudrait moins que la phrase qui explique.
 *
 * L'INTERRUPTEUR DU HAUT COMMANDE CEUX DU DESSOUS. Tant qu'il est éteint,
 * aucune notification ne part vers cet appareil : proposer d'y trier les
 * catégories reviendrait à faire choisir la couleur d'une lampe débranchée,
 * et laisserait croire, une fois les cases réglées, qu'on va recevoir
 * quelque chose. Les catégories restent affichées — c'est ce qu'on gagne à
 * autoriser — mais grisées et inertes jusqu'à l'autorisation.
 */
export function NotificationsBlock({ sombre }: { sombre?: boolean }) {
  const { etat, prefs, occupe, activer, desactiver, basculer } = usePushNotifications();
  const trad = useT();
  const t = ton(sombre);

  // `null` tant que le navigateur n'a pas été interrogé, voir le hook : rien
  // à afficher plutôt qu'un état par défaut qui serait faux la moitié du
  // temps.
  if (etat === null || etat === "non-supporte") return null;

  const bascule = (actif: boolean) =>
    `flex-1 px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] transition-colors disabled:cursor-not-allowed ${
      actif
        ? sombre ? "bg-emerald-500 text-emerald-950" : "bg-gray-900 text-white"
        : sombre ? "text-white/50 hover:text-white" : "text-gray-500 hover:text-gray-900"
    }`;

  const cadre = `flex shrink-0 border ${sombre ? "border-white/10" : "border-gray-200/70"}`;
  const note = `px-4 pb-1 text-[11px] font-semibold leading-relaxed ${
    sombre ? "text-white/40" : "text-gray-500"
  }`;

  const actif = etat === "actif";
  const reglable = etat === "actif" || etat === "inactif";

  return (
    <div>
      <p className={`px-4 pb-2 pt-3 text-[10px] font-black uppercase tracking-[0.15em] ${t.titre}`}>
        {trad("notifs.titre")}
      </p>

      <div className="px-4 pb-2">
        <div className="flex items-center justify-between gap-3 py-1.5">
          <span className={`flex items-center gap-2 text-[13px] font-bold ${t.libelle}`}>
            {actif
              ? <Bell size={15} className={t.icone} />
              : <BellOff size={15} className={t.icone} />}
            {trad("notifs.appareil")}
          </span>
          {reglable && (
            <span className={cadre}>
              <button
                type="button"
                disabled={occupe}
                onClick={() => (actif ? undefined : activer())}
                className={bascule(actif)}
              >
                {trad("notifs.oui")}
              </button>
              <button
                type="button"
                disabled={occupe}
                onClick={() => (actif ? desactiver() : undefined)}
                className={bascule(!actif)}
              >
                {trad("notifs.non")}
              </button>
            </span>
          )}
        </div>
      </div>

      {etat === "refuse" && <p className={note}>{trad("notifs.refuse")}</p>}
      {etat === "ios-hors-app" && <p className={note}>{trad("notifs.ios")}</p>}

      {/* Grisées et inertes tant que l'appareil n'est pas autorisé : ce sont
          des réglages de ce qu'on RECEVRA, et on ne reçoit rien encore. */}
      <div className={`px-4 pb-2 ${actif ? "" : "opacity-50"}`} aria-disabled={!actif}>
        {CATEGORIES_PUSH.map((categorie) => (
          <div key={categorie} className="flex items-center justify-between gap-3 py-1.5">
            <span className={`min-w-0 flex-1 truncate text-[13px] font-bold ${t.libelle}`}>
              {trad(`notifs.cat.${categorie}` as Parameters<typeof trad>[0])}
            </span>
            <span className={cadre}>
              <button
                type="button"
                disabled={occupe || !actif}
                onClick={() => (prefs[categorie] ? undefined : basculer(categorie))}
                className={bascule(prefs[categorie])}
              >
                {trad("notifs.oui")}
              </button>
              <button
                type="button"
                disabled={occupe || !actif}
                onClick={() => (prefs[categorie] ? basculer(categorie) : undefined)}
                className={bascule(!prefs[categorie])}
              >
                {trad("notifs.non")}
              </button>
            </span>
          </div>
        ))}
      </div>
      {actif && <p className={note}>{trad("notifs.compte")}</p>}
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
  const { langue, setLangue } = useLangue();
  const trad = useT();
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
        {trad("prefs.titre")}
      </p>

      <div className="px-4 pb-2">
        <div className="flex items-center justify-between gap-3 py-1.5">
          <span className={`flex items-center gap-2 text-[13px] font-bold ${t.libelle}`}>
            {theme === "light"
              ? <Sun size={15} className={t.icone} />
              : <Moon size={15} className={t.icone} />}
            {trad("prefs.theme")}
          </span>
          <span className={`flex shrink-0 border ${sombre ? "border-white/10" : "border-gray-200/70"}`}>
            <button type="button" onClick={() => setTheme("light")} className={bascule(theme === "light")}>
              {trad("prefs.clair")}
            </button>
            <button type="button" onClick={() => setTheme("dark")} className={bascule(theme === "dark")}>
              {trad("prefs.sombre")}
            </button>
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 py-1.5">
          <span className={`flex items-center gap-2 text-[13px] font-bold ${t.libelle}`}>
            <Languages size={15} className={t.icone} />
            {trad("prefs.langue")}
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
