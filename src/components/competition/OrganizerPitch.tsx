"use client";

import { Radio, Trophy, Share2, ListChecks, ArrowDown } from "lucide-react";

// ============================================
// OrganizerPitch, the argument, above the application form.
//
// /devenir-organisateur opened straight onto five form fields. Someone who
// arrives cold from a WhatsApp message met paperwork before a single reason
// to say yes, and the one real argument was nowhere on the page: a
// competition run here lands on the KoppaFoot home, where people already
// come for the scores. That is the whole trade, you keep the calendar up
// to date, the platform gives you an audience.
//
// No invented proof: no counts, no testimonials, no logos. Everything
// claimed below is something the product actually does today.
// ============================================

const PROMISES = [
  {
    Icon: Radio,
    title: "Tes matchs sur la home, en direct",
    body: "Chaque rencontre passe sur le tableau du Direct, là où les gens viennent déjà voir les scores. Tes affiches sont vues par des supporters qui ne te connaissaient pas.",
  },
  {
    Icon: Trophy,
    title: "Classements et statistiques tenus tout seuls",
    body: "Poules, tableau final, meilleurs buteurs et passeurs se calculent à partir des matchs saisis. Plus de tableur, plus de feuille recopiée le soir.",
  },
  {
    Icon: Share2,
    title: "Une page d'inscription à envoyer",
    body: "Ta compétition a son adresse publique dès sa création : tu l'envoies sur WhatsApp, les clubs s'inscrivent eux-mêmes, tu valides.",
  },
  {
    Icon: ListChecks,
    title: "Tu n'organises pas seul",
    body: "Tu invites des scoreurs à saisir les matchs en direct depuis leur téléphone, chacun sur les rencontres que tu lui confies.",
  },
];

const STEPS = [
  { n: 1, label: "Tu candidates", body: "Le formulaire ci-dessous, deux minutes." },
  { n: 2, label: "On valide", body: "Réponse par email et notification." },
  { n: 3, label: "Tu crées", body: "Équipes, poules, calendrier, guidé étape par étape." },
];

export default function OrganizerPitch() {
  return (
    <div className="space-y-4">
      {/* ---- The promise ---- */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-800 to-emerald-950 p-6 sm:p-8">
        <span className="flex w-fit items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-950">
          <Trophy size={12} />
          Espace organisateur
        </span>

        <h1 className="mt-3 font-display text-2xl font-black leading-tight text-white sm:text-4xl">
          Ta compétition, suivie comme un vrai championnat
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-emerald-100/80 sm:text-base">
          Tu gères déjà les équipes, le calendrier et les résultats. KoppaFoot
          s&apos;occupe du reste, et met tes matchs devant du monde.
        </p>

        <a
          href="#candidature"
          className="mt-6 inline-flex items-center gap-2 bg-amber-400 px-5 py-3 text-sm font-black text-emerald-950 transition-colors hover:bg-amber-300"
        >
          Devenir organisateur
          <ArrowDown size={15} />
        </a>
      </div>

      {/* ---- What you actually get ---- */}
      <div className="grid gap-3 sm:grid-cols-2">
        {PROMISES.map(({ Icon, title, body }) => (
          <div key={title} className=" border border-gray-200/70 bg-white p-5">
            <span className="flex h-9 w-9 items-center justify-center bg-emerald-50">
              <Icon size={18} className="text-emerald-600" />
            </span>
            <p className="mt-3 text-sm font-black text-gray-900">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">{body}</p>
          </div>
        ))}
      </div>

      {/* ---- How it goes ---- */}
      <div className=" border border-gray-200/70 bg-white p-5">
        <p className="font-display text-base font-black text-gray-900">Comment ça se passe</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {STEPS.map(({ n, label, body }) => (
            <div key={n} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-black text-white">
                {n}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-gray-900">{label}</span>
                <span className="block text-xs text-gray-500">{body}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
