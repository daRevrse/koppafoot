"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Share2, Check, Megaphone, HelpCircle, MessageSquare, ChevronRight,
  Sun, Moon, Languages, Bell, BellOff, Download, Share,
} from "lucide-react";
import toast from "react-hot-toast";
import { shareInviteLink } from "@/lib/invite-link";
import { useTheme } from "@/contexts/ThemeContext";
import { useLangue, useT } from "@/i18n";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  etatInstallation, etatInstallationServeur, installer, souscrireInstallation,
} from "@/lib/pwa-install";

// ============================================
// Les blocs du menu compte : inviter, support, installation, notifications,
// thème, langue.
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
    // dans le presse-papier, non. Et un échec encore moins : le bouton
    // s'enfonçait, rien ne se passait, on cliquait à nouveau.
    if (resultat === "copied") {
      setCopie(true);
      setTimeout(() => setCopie(false), 2500);
    } else if (resultat === "failed") {
      toast.error(t("invite.echec"));
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
 * L'installation de l'application.
 *
 * ELLE ÉTAIT DÉJÀ LÀ, mais seulement sur la page de connexion : personne de
 * déjà connecté ne la voyait jamais, c'est-à-dire précisément ceux qui se
 * servent du produit. Elle vit maintenant dans le menu du compte, à demeure,
 * là où on cherche ce genre de chose.
 *
 * ELLE PASSE AVANT LES NOTIFICATIONS, et ce n'est pas un choix de mise en
 * page : sur iPhone, le push n'existe QUE dans l'application ajoutée à
 * l'écran d'accueil. Régler ses notifications sans l'avoir installée n'y mène
 * nulle part, l'ordre des deux blocs dit donc l'ordre des gestes.
 *
 * SUR IPHONE, PAS DE BOUTON, une phrase. Safari n'offre aucune installation
 * par appel, elle se fait à la main depuis le menu Partager. Un bouton qui ne
 * ferait rien vaudrait moins que la marche à suivre.
 */
export function InstallBlock({ sombre }: { sombre?: boolean }) {
  // L'état vit hors de React, dans un module qui écoute dès le chargement,
  // voir lib/pwa-install. Le rendu serveur ne peut rien en savoir et
  // n'affirme donc rien.
  const etat = useSyncExternalStore(
    souscrireInstallation,
    etatInstallation,
    etatInstallationServeur,
  );
  const t = ton(sombre);
  const trad = useT();

  if (etat === "installee" || etat === "indisponible") return null;

  return (
    <div>
      <p className={`px-4 pb-2 pt-3 text-[10px] font-black uppercase tracking-[0.15em] ${t.titre}`}>
        {trad("install.titre")}
      </p>

      {etat === "possible" ? (
        <Ligne t={t} Icon={Download} label={trad("install.action")} onClick={() => installer()} />
      ) : (
        <div className="flex items-start gap-3 px-4 py-2.5">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center border ${t.puceFond}`}>
            <Share size={15} className={t.icone} />
          </span>
          <p className={`text-[11px] font-semibold leading-relaxed ${
            sombre ? "text-white/50" : "text-gray-500"
          }`}>
            {trad("install.ios")}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Les notifications push.
 *
 * UN SEUL INTERRUPTEUR, et il vaut pour CET APPAREIL : le jeton y vit, couper
 * sur le téléphone ne doit pas éteindre l'ordinateur.
 *
 * LES CAS OÙ IL N'Y A PAS D'INTERRUPTEUR comptent autant que l'interrupteur
 * lui-même. Un refus navigateur est définitif : aucun appel ne peut le
 * rouvrir, donc afficher une bascule qui ne marchera pas laisserait conclure
 * à une panne du produit. On dit où aller. Sur iPhone, le push n'existe que
 * dans l'application ajoutée à l'écran d'accueil, et là encore une bascule
 * muette vaudrait moins que la phrase qui explique.
 *
 * LE TRI PAR CATÉGORIE existe côté serveur (voir lib/push-categories) mais ne
 * s'affiche pas ici : cinq lignes de plus pour un arbitrage que personne n'a
 * encore demandé alourdissaient un menu dont c'est le cinquième bloc. Le
 * jour où « trop de notifications » remonte du terrain, le filtre est déjà
 * écrit, il ne manquera que les bascules.
 */
export function NotificationsBlock({ sombre }: { sombre?: boolean }) {
  const { etat, occupe, activer, desactiver } = usePushNotifications();
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
