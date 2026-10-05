"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Check, Gem } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale, useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import type { CleLimite } from "@/lib/offre";

// ============================================
// Mon offre.
//
// Ce que la personne a (gratuit, ou Pro jusqu'à telle date), ce que l'offre
// gratuite compte chez ELLE (seulement les lignes qui la concernent : un
// joueur qui ne gère rien ne lit pas de compteur), et ce qui reste gratuit
// pour tout le monde. La date d'entrée en vigueur des limites est dite ici
// avant d'arriver : c'est la promesse des conditions d'utilisation.
//
// Pas de bouton « Payer » : rien ne s'achète encore. Qui veut essayer le Pro
// écrit à l'équipe, qui l'accorde depuis l'administration.
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
}

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
    avantage5: "Le statut club : réunis tes équipes sous un même club, avec sa page et son encadrement",
    gererClub: "Gérer mon club",
    pasEnVente: "Le Pro n'est pas encore en vente. Pour l'essayer avec ton équipe, ta compétition ou ton terrain, écris-nous.",
    ecrire: "Nous écrire",
    erreur: "Impossible de charger ton offre.",
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
    avantage5: "Club status: bring your teams together under one club, with its page and staff",
    gererClub: "Manage my club",
    pasEnVente: "Pro isn't on sale yet. To try it with your team, competition or venue, write to us.",
    ecrire: "Write to us",
    erreur: "Couldn't load your plan.",
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

export default function OffrePage() {
  const t = useTextes(T);
  const locale = useLocale();
  const { firebaseUser } = useAuth();
  const [offre, setOffre] = useState<Offre | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;
    let vivant = true;
    firebaseUser.getIdToken()
      .then((jeton) => fetch("/api/offre", { headers: { Authorization: `Bearer ${jeton}` } }))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Offre) => { if (vivant) setOffre(d); })
      .catch(() => { if (vivant) setErreur(true); });
    return () => { vivant = false; };
  }, [firebaseUser]);

  const date = (jour: string) =>
    new Date(`${jour}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  const fin = (d: VueDroit | null) => (d?.jusquAu ? t.jusquAu(date(d.jusquAu)) : t.sansEcheance);

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
            <p className="mt-4 text-sm text-gray-500">{t.pasEnVente}</p>
            <Link
              href="/aide"
              className="mt-3 inline-flex items-center border border-gray-900 bg-gray-900 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-gray-700"
            >
              {t.ecrire}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
