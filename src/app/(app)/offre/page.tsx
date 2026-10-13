"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { motion } from "motion/react";
import { Check, Gem, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale, useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import type { CleLimite } from "@/lib/offre";
import { idPaiementDuRetour, type FormuleEnVente, type IdFormule, type StatutPaiement } from "@/lib/paiement";

// ============================================
// Mon offre.
//
// Ce que la personne a (gratuit, ou Pro jusqu'à telle date), ce que l'offre
// gratuite compte chez ELLE (seulement les lignes qui la concernent : un
// joueur qui ne gère rien ne lit pas de compteur), et ce qui reste gratuit
// pour tout le monde. La date d'entrée en vigueur des limites est dite ici
// avant d'arriver : c'est la promesse des conditions d'utilisation.
//
// LE PRO S'ACHÈTE ICI, quand il est en vente : une formule, un prix, un bouton
// qui mène à la page de paiement FedaPay. Tant qu'aucune formule n'a de prix,
// la page dit « écris-nous », comme avant.
//
// AU RETOUR DU PAIEMENT, LA PAGE NE CROIT PAS L'ADRESSE. FedaPay y écrit un
// `status` qui ne prouve rien ; on n'y lit que l'identifiant de notre
// paiement, et c'est le serveur qui dit où il en est (lib/paiement-serveur).
// ============================================

interface VueDroit {
  actif: boolean;
  jusquAu: string | null;
}

interface Offre {
  jour: string;
  estPro: boolean;
  estSansPub: boolean;
  pro: VueDroit | null;
  sansPub: VueDroit | null;
  limitesDepuis: string | null;
  limitesActives: boolean;
  limites: Record<CleLimite, number>;
  usage: Record<"equipes" | "terrains" | "competitions", number>;
  casquettes: { manager: boolean; organisateur: boolean; gerant: boolean };
  formules: FormuleEnVente[];
  proIllimite: boolean;
}

/** Où en est le paiement dont on revient. `aucun` : l'identifiant ne nous dit rien. */
type Retour =
  | { etat: "recu"; jusquAu: string | null }
  | { etat: "echec" | "lent" | "verifier" | "aucun" };

/** Dix fois, toutes les trois secondes : le temps que la confirmation de l'opérateur arrive. */
const ESSAIS_RETOUR = 10;
const PAUSE_RETOUR_MS = 3000;

const T = textes(
  {
    titre: "Mon offre",
    sousTitre: "Jouer, suivre un match, s'inscrire à une compétition, arbitrer : c'est gratuit et ça le reste.",
    gratuit: "Offre gratuite",
    pro: "KoppaFoot Pro",
    jusquAu: (date: string) => `jusqu'au ${date}`,
    sansEcheance: "sans échéance",
    proActif: "Aucune limite ne s'applique à ce que tu crées.",
    sansPubSeul: (fin: string) => `Option sans pub, ${fin}.`,
    pasEncore: "Les limites de l'offre gratuite ne s'appliquent pas encore. Tu seras prévenu avant.",
    aPartirDu: (date: string) => `À partir du ${date}, l'offre gratuite comptera ce qui suit.`,
    depuis: (date: string) => `En vigueur depuis le ${date}.`,
    garde: "Ce que tu as déjà créé reste à toi, même au-delà : une limite empêche seulement de créer plus.",
    chezToi: "Chez toi",
    equipes: "Équipes que tu gères",
    terrains: "Terrains référencés",
    competitions: "Compétitions en cours",
    competitionsDetail: "brouillons compris",
    tailleComp: "Équipes par compétition",
    illimite: "illimité",
    rienAGerer: "Tu ne gères ni équipe, ni terrain, ni compétition : rien ne te limite.",
    proDebloque: "Ce que le Pro débloque",
    avantage1: "Équipes illimitées, pour les managers et les clubs",
    avantage2: "Compétitions en cours illimitées, et plus de 16 équipes par compétition",
    avantage3: "Terrains illimités, pour les gérants",
    avantage4: "Aucune publicité",
    avantage5: "Club multi-équipes : réunis tes équipes sous un même club, avec sa page et son encadrement",
    gererClub: "Gérer mon Club multi-équipes",
    pasEnVente: "Le Pro n'est pas encore en vente. Pour l'essayer avec ton équipe, ta compétition ou ton terrain, écris-nous.",
    ecrire: "Nous écrire",
    erreur: "Impossible de charger ton offre.",
    prolonger: "Prolonger mon Pro",
    prolongerDetail: "La période achetée s'ajoute à la fin de celle en cours.",
    unMois: "1 mois",
    unAn: "1 an",
    parMois: (montant: string) => `soit ${montant} FCFA par mois`,
    payer: "Payer",
    redirection: "Redirection…",
    moyens: "Mobile money ou carte, sur la page de paiement sécurisée de FedaPay. Tu achètes une période : rien ne se renouvelle tout seul.",
    retourAttente: "Paiement en cours de confirmation…",
    retourRecu: (date: string) => `Paiement reçu. Tu es Pro jusqu'au ${date}.`,
    retourRecuSimple: "Paiement reçu.",
    retourEchec: "Le paiement n'a pas abouti. Tu peux réessayer.",
    retourLent: "La confirmation tarde. Ton Pro s'activera tout seul dès qu'elle arrive : tu peux fermer cette page.",
    retourVerifier: "Ce paiement demande une vérification de notre part. Écris-nous, on règle ça.",
    refusPasEnVente: "Le Pro n'est pas en vente pour l'instant.",
    refusIllimite: "Ton Pro n'a pas d'échéance : il n'y a rien à prolonger.",
    refusTentatives: "Trop de tentatives. Réessaie dans une heure.",
    refusIndisponible: "Paiement indisponible pour l'instant. Réessaie dans un moment.",
  },
  {
    titre: "My plan",
    sousTitre: "Playing, following a match, entering a competition, refereeing: it's free and it stays free.",
    gratuit: "Free plan",
    pro: "KoppaFoot Pro",
    jusquAu: (date: string) => `until ${date}`,
    sansEcheance: "no end date",
    proActif: "No limit applies to what you create.",
    sansPubSeul: (fin: string) => `Ad-free option, ${fin}.`,
    pasEncore: "The free plan's limits don't apply yet. You'll be told beforehand.",
    aPartirDu: (date: string) => `From ${date}, the free plan will count the following.`,
    depuis: (date: string) => `In force since ${date}.`,
    garde: "What you've already created stays yours, even beyond: a limit only stops you creating more.",
    chezToi: "Your usage",
    equipes: "Teams you manage",
    terrains: "Listed venues",
    competitions: "Running competitions",
    competitionsDetail: "drafts included",
    tailleComp: "Teams per competition",
    illimite: "unlimited",
    rienAGerer: "You don't manage a team, a venue or a competition: nothing limits you.",
    proDebloque: "What Pro unlocks",
    avantage1: "Unlimited teams, for managers and clubs",
    avantage2: "Unlimited running competitions, and more than 16 teams per competition",
    avantage3: "Unlimited venues, for venue owners",
    avantage4: "No ads",
    avantage5: "Multi-team club: bring your teams together under one club, with its page and staff",
    gererClub: "Manage my multi-team club",
    pasEnVente: "Pro isn't on sale yet. To try it with your team, competition or venue, write to us.",
    ecrire: "Write to us",
    erreur: "Couldn't load your plan.",
    prolonger: "Extend my Pro",
    prolongerDetail: "The period you buy is added to the end of the current one.",
    unMois: "1 month",
    unAn: "1 year",
    parMois: (montant: string) => `that's ${montant} FCFA a month`,
    payer: "Pay",
    redirection: "Redirecting…",
    moyens: "Mobile money or card, on FedaPay's secure payment page. You buy a period: nothing renews by itself.",
    retourAttente: "Confirming your payment…",
    retourRecu: (date: string) => `Payment received. You're Pro until ${date}.`,
    retourRecuSimple: "Payment received.",
    retourEchec: "The payment didn't go through. You can try again.",
    retourLent: "Confirmation is taking a while. Pro will switch on by itself when it arrives: you can close this page.",
    retourVerifier: "This payment needs a check on our side. Write to us and we'll sort it out.",
    refusPasEnVente: "Pro isn't on sale right now.",
    refusIllimite: "Your Pro has no end date: there's nothing to extend.",
    refusTentatives: "Too many attempts. Try again in an hour.",
    refusIndisponible: "Payment is unavailable right now. Try again in a moment.",
  },
);

function Jauge({ libelle, detail, usage, max, illimite }: {
  libelle: string; detail?: string; usage: number; max: number; illimite: string | null;
}) {
  const plein = !illimite && usage >= max;
  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-gray-800">
          {libelle}
          {detail && <span className="ml-1 text-xs font-normal text-gray-400">({detail})</span>}
        </span>
        <span className={`shrink-0 whitespace-nowrap font-display text-lg font-black tabular-nums ${plein ? "text-amber-600" : "text-gray-900"}`}>
          {usage}
          <span className="text-sm font-bold text-gray-400"> / {illimite ?? max}</span>
        </span>
      </div>
      {!illimite && (
        <div className="mt-2 h-1.5 bg-gray-100">
          <div className={`h-full ${plein ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, (usage / max) * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

/** Les formules en vente, côte à côte : la durée, le prix, le bouton. */
function Formules({ formules, enCours, onPayer, locale, libelles }: {
  formules: FormuleEnVente[];
  enCours: IdFormule | null;
  onPayer: (formule: IdFormule) => void;
  locale: string;
  libelles: { unMois: string; unAn: string; parMois: (montant: string) => string; payer: string; redirection: string; moyens: string };
}) {
  return (
    <>
      <div className={`grid gap-px border border-gray-200/70 bg-gray-200/70 ${formules.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {formules.map((f) => (
          <div key={f.id} className="flex flex-col gap-3 bg-white p-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
                {f.mois === 12 ? libelles.unAn : libelles.unMois}
              </p>
              <p className="mt-1 font-display text-2xl font-black tabular-nums text-gray-900">
                {f.prix.toLocaleString(locale)}
                <span className="ml-1 text-sm font-bold text-gray-400">FCFA</span>
              </p>
              {f.mois > 1 && (
                <p className="mt-0.5 text-xs text-gray-500">{libelles.parMois(Math.round(f.prix / f.mois).toLocaleString(locale))}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onPayer(f.id)}
              disabled={enCours !== null}
              className="mt-auto inline-flex items-center justify-center gap-2 border border-gray-900 bg-gray-900 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {enCours === f.id && <Loader2 size={14} className="animate-spin" />}
              {enCours === f.id ? libelles.redirection : libelles.payer}
            </button>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-500">{libelles.moyens}</p>
    </>
  );
}

export default function OffrePage() {
  const t = useTextes(T);
  const locale = useLocale();
  const { firebaseUser } = useAuth();
  const [offre, setOffre] = useState<Offre | null>(null);
  const [erreur, setErreur] = useState(false);
  const [achat, setAchat] = useState<IdFormule | null>(null);
  // Lu une fois, au premier rendu dans le navigateur : le paiement dont on
  // revient. Tant que l'offre charge, la page n'affiche que son squelette,
  // côté serveur comme côté navigateur : les deux rendus restent identiques.
  const [idRetour] = useState(() =>
    typeof window === "undefined" ? null : idPaiementDuRetour(new URLSearchParams(window.location.search).get("paiement")));
  const [retour, setRetour] = useState<Retour | null>(null);

  const charger = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const r = await fetch("/api/offre", { headers: { Authorization: `Bearer ${await firebaseUser.getIdToken()}` } });
      if (!r.ok) throw new Error(String(r.status));
      setOffre((await r.json()) as Offre);
    } catch {
      setErreur(true);
    }
  }, [firebaseUser]);

  useEffect(() => { void charger(); }, [charger]);

  useEffect(() => {
    if (!firebaseUser || !idRetour) return;
    let vivant = true;
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    let essais = 0;
    // L'adresse garde « ?paiement=… » : on l'enlève, pour qu'un rechargement
    // ne rejoue pas l'attente d'un paiement déjà réglé.
    window.history.replaceState(null, "", window.location.pathname);

    const verifier = async () => {
      essais += 1;
      let etat: { statut?: StatutPaiement; jusquAu?: string | null; aVerifier?: boolean } | null = null;
      let inconnu = false;
      try {
        const r = await fetch(`/api/paiements/${idRetour}`, { headers: { Authorization: `Bearer ${await firebaseUser.getIdToken()}` } });
        inconnu = r.status === 404;
        etat = r.ok ? await r.json() : null;
      } catch {
        etat = null;
      }
      if (!vivant) return;
      if (inconnu) return setRetour({ etat: "aucun" });
      if (etat?.aVerifier) return setRetour({ etat: "verifier" });
      if (etat?.statut === "paye") {
        setRetour({ etat: "recu", jusquAu: etat.jusquAu ?? null });
        void charger();
        return;
      }
      if (etat?.statut === "echoue" || etat?.statut === "annule" || etat?.statut === "expire") return setRetour({ etat: "echec" });
      if (essais >= ESSAIS_RETOUR) return setRetour({ etat: "lent" });
      minuterie = setTimeout(() => void verifier(), PAUSE_RETOUR_MS);
    };
    void verifier();
    return () => { vivant = false; clearTimeout(minuterie); };
  }, [firebaseUser, idRetour, charger]);

  // Revenu de la page de paiement par le bouton « retour » du navigateur : la
  // page ressort du cache telle qu'on l'a quittée, bouton grisé sur
  // « Redirection… ». On le rend.
  useEffect(() => {
    const revenir = (e: PageTransitionEvent) => { if (e.persisted) setAchat(null); };
    window.addEventListener("pageshow", revenir);
    return () => window.removeEventListener("pageshow", revenir);
  }, []);

  const date = (jour: string) =>
    new Date(`${jour}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  const fin = (d: VueDroit | null) => (d?.jusquAu ? t.jusquAu(date(d.jusquAu)) : t.sansEcheance);

  const refus = (code: string): string =>
    code === "deja_illimite" ? t.refusIllimite
      : code === "trop_de_tentatives" ? t.refusTentatives
        : code === "fedapay" || code === "" ? t.refusIndisponible
          : t.refusPasEnVente;

  const payer = async (formule: IdFormule) => {
    if (!firebaseUser || achat) return;
    setAchat(formule);
    try {
      const r = await fetch("/api/paiements", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await firebaseUser.getIdToken()}` },
        body: JSON.stringify({ formule }),
      });
      const d = (await r.json().catch(() => ({}))) as { url?: string; code?: string };
      if (!r.ok || typeof d.url !== "string") throw new Error(d.code ?? "");
      // On quitte la page : le bouton reste sur « Redirection… » jusque-là.
      window.location.assign(d.url);
    } catch (e) {
      toast.error(refus(e instanceof Error ? e.message : ""));
      setAchat(null);
    }
  };

  if (erreur) return <p className="mx-auto max-w-2xl py-16 text-center text-sm text-gray-500">{t.erreur}</p>;
  if (!offre) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 py-6">
        {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse bg-gray-100" />)}
      </div>
    );
  }

  const illimite = offre.estPro ? t.illimite : null;
  const { casquettes: c } = offre;
  const enVente = offre.formules.length > 0 && !offre.proIllimite;
  const libellesFormules = {
    unMois: t.unMois, unAn: t.unAn, parMois: t.parMois, payer: t.payer, redirection: t.redirection, moyens: t.moyens,
  };
  const etatRetour = retour?.etat ?? (idRetour ? "attente" : "aucun");
  const lignes = [
    c.manager && <Jauge key="e" libelle={t.equipes} usage={offre.usage.equipes} max={offre.limites.equipes} illimite={illimite} />,
    c.gerant && <Jauge key="t" libelle={t.terrains} usage={offre.usage.terrains} max={offre.limites.terrains} illimite={illimite} />,
    c.organisateur && (
      <Jauge key="c" libelle={t.competitions} detail={t.competitionsDetail} usage={offre.usage.competitions}
        max={offre.limites.competitions} illimite={illimite} />
    ),
    c.organisateur && (
      <div key="taille" className="flex items-baseline justify-between gap-3 px-4 py-3">
        <span className="text-sm font-semibold text-gray-800">{t.tailleComp}</span>
        <span className="font-display text-lg font-black tabular-nums text-gray-900">
          {illimite ?? offre.limites.equipesParCompetition}
        </span>
      </div>
    ),
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24">
      <div>
        <motion.h1
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="font-display text-2xl font-extrabold text-gray-900 sm:text-3xl"
        >
          {t.titre}
        </motion.h1>
        <p className="mt-1 text-sm text-gray-500">{t.sousTitre}</p>
      </div>

      {etatRetour !== "aucun" && (
        <p
          role="status"
          className={`flex items-center gap-2 border px-4 py-3 text-sm font-semibold ${
            etatRetour === "recu" ? "border-emerald-600 bg-emerald-50 text-emerald-900"
              : etatRetour === "echec" || etatRetour === "verifier" ? "border-amber-500 bg-amber-50 text-amber-900"
                : "border-gray-200/70 bg-white text-gray-700"
          }`}
        >
          {etatRetour === "attente" && <Loader2 size={16} className="shrink-0 animate-spin" />}
          {etatRetour === "recu" && <Check size={16} className="shrink-0" />}
          {etatRetour === "attente" && t.retourAttente}
          {retour?.etat === "recu" && (retour.jusquAu ? t.retourRecu(date(retour.jusquAu)) : t.retourRecuSimple)}
          {etatRetour === "echec" && t.retourEchec}
          {etatRetour === "lent" && t.retourLent}
          {etatRetour === "verifier" && t.retourVerifier}
        </p>
      )}

      <section className={`border p-5 ${offre.estPro ? "border-emerald-600 bg-emerald-950 text-white" : "border-gray-200/70 bg-white"}`}>
        <p className="flex items-center gap-2">
          {offre.estPro && <Gem size={18} className="shrink-0 text-emerald-400" />}
          <span className="font-display text-xl font-black uppercase tracking-tight">
            {offre.estPro ? t.pro : t.gratuit}
          </span>
        </p>
        {offre.estPro && (
          <>
            <p className="mt-0.5 text-xs font-bold uppercase tracking-[0.14em] text-emerald-300">{fin(offre.pro)}</p>
            <p className="mt-2 text-sm text-emerald-100">{t.proActif}</p>
            <Link href="/mon-club" className="mt-3 inline-flex text-xs font-black uppercase tracking-[0.12em] text-emerald-300 hover:text-white">
              {t.gererClub} →
            </Link>
          </>
        )}
        {!offre.estPro && offre.estSansPub && <p className="mt-1 text-sm text-gray-600">{t.sansPubSeul(fin(offre.sansPub))}</p>}
      </section>

      {offre.estPro && enVente && (
        <section>
          <h2 className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">{t.prolonger}</h2>
          <p className="mb-3 text-sm text-gray-600">{t.prolongerDetail}</p>
          <Formules formules={offre.formules} enCours={achat} onPayer={(f) => void payer(f)} locale={locale} libelles={libellesFormules} />
        </section>
      )}

      <section>
        <h2 className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">{t.chezToi}</h2>
        <div className="border border-gray-200/70 bg-white">
          <p className="border-b border-gray-200/70 px-4 py-3 text-sm text-gray-600">
            {offre.limitesActives
              ? t.depuis(date(offre.limitesDepuis!))
              : offre.limitesDepuis ? t.aPartirDu(date(offre.limitesDepuis)) : t.pasEncore}
            {" "}{t.garde}
          </p>
          {lignes.length
            ? <div className="divide-y divide-gray-200/70">{lignes}</div>
            : <p className="px-4 py-3 text-sm text-gray-500">{t.rienAGerer}</p>}
        </div>
      </section>

      {!offre.estPro && (
        <section>
          <h2 className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">{t.proDebloque}</h2>
          <div className="border border-gray-200/70 bg-white p-4">
            <ul className="space-y-2">
              {[t.avantage5, t.avantage1, t.avantage2, t.avantage3, t.avantage4].map((a) => (
                <li key={a} className="flex items-start gap-2 text-sm text-gray-700">
                  <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                  {a}
                </li>
              ))}
            </ul>
            {enVente ? (
              <div className="mt-4">
                <Formules formules={offre.formules} enCours={achat} onPayer={(f) => void payer(f)} locale={locale} libelles={libellesFormules} />
              </div>
            ) : (
              <>
                <p className="mt-4 text-sm text-gray-500">{t.pasEnVente}</p>
                <Link
                  href="/aide"
                  className="mt-3 inline-flex items-center border border-gray-900 bg-gray-900 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-gray-700"
                >
                  {t.ecrire}
                </Link>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
