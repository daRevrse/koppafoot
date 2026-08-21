"use client";

import { useState } from "react";
import Link from "next/link";
import { HelpCircle, MessageSquare, Plus, Minus } from "lucide-react";

// ============================================
// L'aide, et le retour qu'on veut nous faire.
//
// Cette page naît d'un manque : le bloc « Support » du menu compte pointait
// vers /aide et /aide/contact, deux adresses qui n'existaient pas. Un menu
// d'aide qui mène à une 404 est pire que pas de menu d'aide.
//
// Une seule page plutôt que deux : les questions et le retour sont le même
// geste, « je ne comprends pas quelque chose ». Séparer les deux obligerait
// à choisir avant de savoir laquelle des deux on cherche.
//
// Le formulaire de retour est de l'INTERFACE SEULE : aucune adresse de
// support n'existe dans le projet, et en inventer une enverrait les messages
// dans le vide. Il le dit plutôt que de faire semblant d'envoyer.
// ============================================

const QUESTIONS: { q: string; r: string }[] = [
  {
    q: "Qu'est-ce qu'un rôle, et qu'est-ce qu'une casquette ?",
    r: "Le rôle dit ce que vous êtes sur le terrain : joueur, manager ou arbitre. Vous n'en avez qu'un, il se choisit dans Évolution. Les casquettes, organisateur de compétition et propriétaire de terrain, sont des fonctions qui s'ajoutent par-dessus : le même compte peut jouer, organiser un tournoi et louer son terrain.",
  },
  {
    q: "Comment rejoindre une compétition ?",
    r: "Une compétition se rejoint par équipe, pas individuellement. Le manager de votre équipe inscrit celle-ci depuis la page de la compétition, l'organisateur valide ensuite l'inscription. Si vous jouez sans équipe, passez par le Mercato pour en trouver une.",
  },
  {
    q: "Mes statistiques ne sont pas à jour, pourquoi ?",
    r: "Les buts et passes viennent des feuilles de match saisies en direct par les scoreurs de la compétition. Elles apparaissent dès que le match est marqué terminé. Si un match est fini depuis longtemps et que rien ne bouge, la feuille n'a probablement pas été clôturée : signalez-le à l'organisateur.",
  },
  {
    q: "Comment référencer mon terrain ?",
    r: "Depuis la page MyFields, en déposant une candidature. Vous gardez votre rôle de joueur ou de manager : référencer un terrain ajoute une casquette, cela ne remplace rien. Une fois validé, les demandes de créneau arrivent dans « Réservations reçues ».",
  },
  {
    q: "Pourquoi les compétitions internationales n'affichent-elles rien ?",
    r: "Elles proviennent d'un service extérieur, football-data.org, interrogé toutes les quelques minutes. Une fenêtre vide veut dire qu'aucun match n'est programmé dans les jours affichés, ou que le service ne répond pas. Les compétitions locales, elles, ne dépendent de personne.",
  },
  {
    q: "Puis-je supprimer mon compte ?",
    r: "Oui, depuis votre profil, tout en bas de la page. La suppression retire votre fiche, vos publications et vos demandes de réservation. Les feuilles de match déjà jouées gardent la trace des buts : ils appartiennent à l'histoire de la compétition, pas seulement à vous.",
  },
];

function Question({ q, r }: { q: string; r: string }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <li className="border-b border-gray-200/70 last:border-b-0">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50"
      >
        <span className="text-sm font-bold text-gray-900">{q}</span>
        {ouvert
          ? <Minus size={16} className="mt-0.5 shrink-0 text-emerald-700" />
          : <Plus size={16} className="mt-0.5 shrink-0 text-gray-300" />}
      </button>
      {ouvert && (
        <p className="px-5 pb-5 text-sm leading-relaxed text-gray-500">{r}</p>
      )}
    </li>
  );
}

export default function AidePage() {
  return (
    <div className="mx-auto max-w-3xl pb-24">
      <nav
        aria-label="Fil d'ariane"
        className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-black uppercase tracking-[0.12em] text-gray-400"
      >
        <Link href="/" className="transition-colors hover:text-emerald-700">Direct</Link>
        <span aria-hidden className="text-gray-300">›</span>
        <span className="text-gray-600">Aide</span>
      </nav>

      <section className="sticky top-[var(--header-h,72px)] z-30 -mx-3 overflow-hidden bg-gray-900 text-white lg:-mx-5">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-gray-900 to-black" />
        <div className="relative mx-auto max-w-3xl px-5 py-6 sm:px-8 sm:py-8">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
            Support
          </p>
          <h1 className="mt-1 font-display text-2xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
            Aide
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/60">
            Les questions qui reviennent le plus souvent. Si la vôtre n&apos;y
            est pas, dites-la nous en bas de page.
          </p>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="flex items-center gap-2 border-b border-gray-200/70 pb-3 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
          <HelpCircle size={14} /> Questions fréquentes
        </h2>
        <ul className="border-x border-b border-gray-200/70 bg-white">
          {QUESTIONS.map((item) => <Question key={item.q} {...item} />)}
        </ul>
      </section>

      <section id="retour" className="mt-10 scroll-mt-[calc(var(--header-h,72px)+1rem)]">
        <h2 className="flex items-center gap-2 border-b border-gray-200/70 pb-3 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
          <MessageSquare size={14} /> Nous faire un retour
        </h2>
        <div className="border-x border-b border-gray-200/70 bg-white p-5 sm:p-6">
          <p className="text-sm leading-relaxed text-gray-500">
            Un bug, un score faux, une idée : écrivez-le ici. Ce sont les
            retours du terrain qui décident de ce qu&apos;on construit ensuite.
          </p>
          <textarea
            rows={5}
            placeholder="Ce que vous avez vu, et ce que vous attendiez…"
            className="mt-4 w-full resize-none border border-gray-200/70 bg-gray-50 p-4 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-900 focus:bg-white"
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled
              className="border border-gray-200/70 bg-gray-100 px-6 py-3.5 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400"
            >
              Envoyer
            </button>
            <span className="border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-700">
              Bientôt
            </span>
          </div>
          <p className="mt-3 text-[11px] font-semibold leading-relaxed text-gray-400">
            L&apos;envoi n&apos;est pas encore branché. En attendant, passez par
            la Tribune : un post y est lu par toute l&apos;équipe.
          </p>
        </div>
      </section>
    </div>
  );
}
