"use client";

import { useState } from "react";
import Link from "next/link";
import { HelpCircle, MessageSquare, Plus, Minus, Loader2, Check } from "lucide-react";
import toast from "react-hot-toast";
import { auth } from "@/lib/firebase";

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
// Le retour part dans les notifications des superadmins, et pas dans une
// boîte de réception à consulter : une boîte que personne n'ouvre est une
// corbeille avec un nom plus poli. Il est aussi conservé pour être relu.
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
    r: "Oui, depuis votre profil, tout en bas de la page. La suppression retire votre fiche, vos publications et vos demandes de réservation. Les feuilles de match déjà jouées gardent la trace des buts : ils appartiennent à l'histoire de la compétition, pas seulement à vous. Si vous gérez une équipe, organisez une compétition ou possédez un terrain, il faut d'abord passer la main : partir laisserait une équipe sans manager ou un terrain sans personne pour répondre.",
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

/**
 * Le formulaire de retour.
 *
 * Il n'exige pas de compte. Le premier retour utile vient souvent de
 * quelqu'un qui n'a pas réussi à en créer un, et le lui demander fermerait
 * la seule porte qui lui restait.
 */
function FormulaireRetour() {
  const [message, setMessage] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);

  const envoyer = async () => {
    const texte = message.trim();
    if (texte.length < 5) {
      toast.error("Dites-nous un peu plus");
      return;
    }
    setEnvoi(true);
    try {
      // Le jeton s'il existe : il donne un nom au retour, sans être exigé.
      const entetes: Record<string, string> = { "Content-Type": "application/json" };
      const fbUser = auth.currentUser;
      if (fbUser) entetes.Authorization = `Bearer ${await fbUser.getIdToken()}`;

      const rep = await fetch("/api/feedback", {
        method: "POST",
        headers: entetes,
        body: JSON.stringify({ message: texte, page: window.location.pathname }),
      });
      const data = await rep.json().catch(() => ({}));
      if (!rep.ok) {
        toast.error(data.error ?? "L'envoi a échoué");
        return;
      }
      setEnvoye(true);
      setMessage("");
    } catch (err) {
      console.error("Envoi du retour:", err);
      toast.error("L'envoi a échoué");
    } finally {
      setEnvoi(false);
    }
  };

  if (envoye) {
    return (
      <div className="border-x border-b border-gray-200/70 bg-white p-8 text-center sm:p-10">
        <Check size={28} className="mx-auto text-emerald-600" strokeWidth={2.5} />
        <p className="mt-4 font-display text-lg font-black uppercase tracking-tight text-gray-900">
          C&apos;est parti
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">
          Votre message est arrivé. On ne répond pas toujours, mais on lit
          tout, et ce sont ces retours qui décident de la suite.
        </p>
        <button
          type="button"
          onClick={() => setEnvoye(false)}
          className="mt-5 text-[11px] font-black uppercase tracking-[0.12em] text-gray-400 transition-colors hover:text-emerald-700"
        >
          Écrire un autre retour
        </button>
      </div>
    );
  }

  return (
    <div className="border-x border-b border-gray-200/70 bg-white p-5 sm:p-6">
      <p className="text-sm leading-relaxed text-gray-500">
        Un bug, un score faux, une idée : écrivez-le ici. Ce sont les
        retours du terrain qui décident de ce qu&apos;on construit ensuite.
      </p>
      <textarea
        rows={5}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={4000}
        placeholder="Ce que vous avez vu, et ce que vous attendiez…"
        className="mt-4 w-full resize-none border border-gray-200/70 bg-gray-50 p-4 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-900 focus:bg-white"
      />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={envoyer}
          disabled={envoi || message.trim().length < 5}
          className="flex items-center gap-2 border border-gray-900 bg-gray-900 px-6 py-3.5 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:border-gray-200/70 disabled:bg-gray-100 disabled:text-gray-400"
        >
          {envoi && <Loader2 size={13} className="animate-spin" />}
          Envoyer
        </button>
        <span className="text-[11px] font-semibold text-gray-400">
          {message.length > 0 && `${message.length} / 4000`}
        </span>
      </div>
    </div>
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
        <FormulaireRetour />
      </section>
    </div>
  );
}
