import Link from "next/link";
import Image from "next/image";
import {
  Radio, Hand, ListChecks, ShieldCheck, ArrowRight,
} from "lucide-react";

// ============================================
// Le site du scoreur.
//
// Même registre que /organisateurs : pas une page de l'application, pas de
// coquille, pas de barre du bas. On arrive ici par un message WhatsApp ou une
// conversation au bord d'un terrain, et on ne doit encore rien à KoppaFoot.
// La page argumente avant de demander.
//
// CE QU'ELLE NE PROMET PAS : une rémunération, un statut, un nombre de matchs.
// Rien de cela n'est décidé, et une page qui invente ce qu'elle ignore se paie
// au premier bénévole déçu. La question de l'argent est posée franchement dans
// les questions plutôt qu'évitée — c'est la première qu'on se pose, et une
// page qui l'esquive répond quand même, mal.
//
// Elle dit en revanche ce qu'un scoreur NE PEUT PAS faire. C'est ce qui
// rassure les deux côtés : celui qui se propose sait où s'arrête sa
// responsabilité, et le manager qui lit la page sait ce qu'un inconnu pourra
// toucher de son match.
// ============================================

export const metadata = {
  title: "Devenir scoreur, KoppaFoot",
  description:
    "Tenir la console d'un match au bord du terrain : buts, passeurs, cartons, "
    + "remplacements. Le score bouge en direct pour ceux qui n'ont pas pu venir.",
  openGraph: {
    title: "Deviens scoreur sur KoppaFoot",
    description:
      "Un match se joue près de chez toi. Un téléphone suffit à ce que tout le monde en suive le score.",
    images: ["/branding/fan_scores.png"],
  },
};

const PENDANT_LE_MATCH = [
  {
    Icon: Radio,
    title: "Le direct, depuis la touche",
    body: "Coup d'envoi, buts, passeurs, cartons, remplacements, arrêts du gardien. Chaque geste part sur la page publique dans la seconde.",
  },
  {
    Icon: Hand,
    title: "On touche le joueur, pas un menu",
    body: "La console montre le terrain et les maillots. Tu touches celui qui vient de marquer, tu choisis l'action. C'est l'ordre dans lequel ça s'est passé.",
  },
  {
    Icon: ListChecks,
    title: "Tu choisis tes matchs",
    body: "Ton espace liste les amicaux que personne ne couvre. Tu prends celui qui t'arrange, et tu peux le rendre tant qu'il n'a pas commencé.",
  },
];

const ETAPES = [
  {
    n: "01",
    title: "Tu déposes ta candidature",
    body: "Quelques phrases sur les terrains que tu fréquentes et ce qui t'y amène. C'est lu par quelqu'un, pas par un formulaire.",
  },
  {
    n: "02",
    title: "On te répond",
    body: "Une validation ouvre l'espace « Console live » sur ton compte. C'est tout ce qui change, et ça ne change rien à ce que tu es par ailleurs sur la plateforme.",
  },
  {
    n: "03",
    title: "Tu prends un match",
    body: "Les amicaux sans scoreur apparaissent dans ton espace, avec leur date et leur terrain. Premier arrivé.",
  },
  {
    n: "04",
    title: "Tu tiens la console",
    body: "Dix minutes avant, tu valides les deux feuilles de match. Puis coup d'envoi, et tu saisis ce qui se passe jusqu'au coup de sifflet final.",
  },
];

const QUESTIONS = [
  {
    q: "Ça me prend combien de temps ?",
    a: "Le temps du match, plus une dizaine de minutes avant pour valider les deux feuilles. La console tient sur un téléphone, debout.",
  },
  {
    q: "Est-ce que c'est rémunéré ?",
    a: "Non, et on ne va pas faire semblant. KoppaFoot ne facture rien à personne aujourd'hui, et rien n'est décidé pour la suite. On préfère l'écrire que le laisser deviner.",
  },
  {
    q: "Et si je me trompe pendant le match ?",
    a: "Le bouton « but » se verrouille une minute après chaque but, contre le double appui — un score faux est ce qui se corrige le plus mal. Le reste se rattrape tant que le match n'est pas terminé.",
  },
  {
    q: "Il faut connaître les joueurs ?",
    a: "Non. Les feuilles de match sont saisies avant le coup d'envoi, et la console affiche les maillots sur le terrain : tu touches un numéro, pas un nom que tu dois retrouver dans une liste.",
  },
  {
    q: "Je peux me désister ?",
    a: "Oui, tant que le match n'a pas commencé — il retourne alors dans la liste et quelqu'un d'autre peut le prendre. Une fois le coup d'envoi donné, on va au bout : personne d'autre ne peut reprendre la console en cours de route.",
  },
  {
    q: "J'organise déjà une compétition.",
    a: "Alors tu es déjà scoreur sur tes propres matchs, sans rien demander. Cette candidature ne sert qu'à couvrir les amicaux, qui n'appartiennent à personne.",
  },
];

export default function ScoreursPage() {
  return (
    <main className="bg-white">
      {/* ---------- Hero pleine page ---------- */}
      <section className="relative flex min-h-[88vh] items-end overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/branding/fan_scores.png')" }}
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-black/30" />

        <div className="relative mx-auto w-full max-w-7xl px-6 pb-20 pt-32 sm:px-10 sm:pb-28">
          <p className="mb-6 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300">
            Koppafoot Score
          </p>
          <h1 className="max-w-5xl font-display text-[13vw] font-black uppercase leading-[0.86] tracking-[-0.03em] text-white sm:text-[9vw] lg:text-[7.5vw]">
            Le match se joue.
            <br />
            Personne
            <br />
            ne sait le score
          </h1>

          <p className="mt-8 max-w-lg text-lg leading-relaxed text-white/70 sm:text-xl">
            Un scoreur, c&apos;est quelqu&apos;un avec un téléphone au bord du
            terrain. Ça suffit à ce que tout le quartier suive la rencontre.
          </p>

          <Link
            href="/scoreurs/candidature"
            className="group mt-12 flex w-full items-center justify-between gap-6 bg-white px-8 py-7 text-gray-900 transition-colors hover:bg-emerald-400 sm:px-12 sm:py-9"
          >
            <span className="font-display text-xl font-black uppercase tracking-tight sm:text-3xl">
              Déposer ma candidature
            </span>
            <ArrowRight
              size={32}
              strokeWidth={1.5}
              className="shrink-0 transition-transform group-hover:translate-x-2"
            />
          </Link>
        </div>
      </section>

      {/* ---------- Le problème, et ce qu'on y change ---------- */}
      <section className="py-24 sm:py-36">
        <div className="mx-auto max-w-7xl px-6 sm:px-10">
          <div className="grid gap-16 lg:grid-cols-2 lg:gap-24">
            <div>
              <h2 className="font-display text-4xl font-black uppercase leading-[0.95] tracking-tight text-gray-900 sm:text-5xl">
                Un amical se joue,
                <br />
                et rien n&apos;en sort
              </h2>
              <p className="mt-8 text-lg leading-relaxed text-gray-600">
                Pas de score en direct. Pas de buteurs. Rien pour le frère qui
                travaillait, pour le cousin parti à Kara, pour celui qui voulait
                juste savoir si son équipe a gagné. Le match a eu lieu, et il
                n&apos;en reste qu&apos;une conversation.
              </p>
            </div>
            <div className="lg:pt-6">
              <p className="text-lg leading-relaxed text-gray-600">
                Une personne sur la touche change ça entièrement. Le score bouge
                en même temps sur la page du match, sur le tableau du Direct, et
                sur le téléphone de ceux qui suivent l&apos;équipe.
              </p>
              <p className="mt-6 text-lg leading-relaxed text-gray-600">
                Et ce qui est saisi ne disparaît pas au coup de sifflet : les
                buts et les passes décisives entrent dans les statistiques des
                joueurs et remontent dans le classement de la plateforme.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Ce qu'on fait pendant le match ---------- */}
      <section className="border-y border-gray-200/70 bg-gray-50/50">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 sm:grid-cols-3 sm:px-10 sm:py-28">
          {PENDANT_LE_MATCH.map(({ Icon, title, body }) => (
            <div key={title}>
              <Icon size={34} className="text-emerald-600" strokeWidth={1.5} />
              <h3 className="mt-6 font-display text-xl font-black leading-tight text-gray-900">
                {title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-gray-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- La console, en image ---------- */}
      <section className="relative flex min-h-[70vh] items-center overflow-hidden">
        <Image
          src="/branding/fan_matchs.png"
          alt=""
          fill
          className="object-cover object-center"
          sizes="100vw"
        />
        <div aria-hidden className="absolute inset-0 bg-black/60" />
        <div className="relative mx-auto w-full max-w-4xl px-6 py-24 text-center sm:px-10">
          <p className="font-display text-3xl font-black uppercase leading-[1.05] tracking-tight text-white sm:text-5xl">
            «&nbsp;Le 9 a marqué&nbsp;»
          </p>
          <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-white/70">
            C&apos;est ce qu&apos;on dit au bord d&apos;un terrain, et c&apos;est
            l&apos;ordre dans lequel la console travaille : on touche le joueur,
            puis on dit ce qu&apos;il vient de faire. Jamais l&apos;inverse.
          </p>
        </div>
      </section>

      {/* ---------- Comment ça se passe ---------- */}
      <section className="py-24 sm:py-36">
        <div className="mx-auto max-w-6xl px-6 sm:px-10">
          <h2 className="font-display text-4xl font-black uppercase leading-[0.95] tracking-tight text-gray-900 sm:text-5xl">
            Comment ça se passe
          </h2>
          <div className="mt-16 grid gap-x-16 gap-y-14 sm:grid-cols-2">
            {ETAPES.map(({ n, title, body }) => (
              <div key={n} className="flex gap-6">
                <span className="font-display text-3xl font-black text-gray-200">{n}</span>
                <div>
                  <h3 className="font-display text-xl font-black leading-tight text-gray-900">
                    {title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-gray-600">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Les limites, dites franchement ---------- */}
      <section className="border-t border-gray-200/70 py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-6 sm:px-10">
          <div className="flex items-start gap-6">
            <ShieldCheck size={34} className="mt-1 shrink-0 text-gray-300" strokeWidth={1.5} />
            <div>
              <h2 className="font-display text-3xl font-black uppercase leading-tight tracking-tight text-gray-900 sm:text-4xl">
                Ce qu&apos;un scoreur
                <br />
                ne peut pas faire
              </h2>
              <p className="mt-8 text-lg leading-relaxed text-gray-600">
                Couvrir un match, c&apos;est en tenir le déroulé et le score. Ce
                n&apos;est pas le rédiger. La date, le lieu, les équipes, la
                liste des joueurs et celle des autres scoreurs restent à ceux qui
                organisent la rencontre — ce n&apos;est pas une politesse, c&apos;est
                écrit dans les règles du serveur.
              </p>
              <p className="mt-6 text-lg leading-relaxed text-gray-600">
                Et on ne couvre pas un match qu&apos;on joue. Si tu figures sur
                la feuille, la console reste fermée : saisir les buts de sa
                propre rencontre, ce n&apos;est plus tenir un score, c&apos;est
                être juge et partie.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Questions ---------- */}
      <section className="border-t border-gray-200/70 py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-6 sm:px-10">
          <h2 className="font-display text-4xl font-black uppercase leading-[0.95] tracking-tight text-gray-900 sm:text-5xl">
            Questions
          </h2>
          <dl className="mt-14 space-y-10">
            {QUESTIONS.map(({ q, a }) => (
              <div key={q} className="border-t border-gray-200/70 pt-8">
                <dt className="font-display text-lg font-black text-gray-900">{q}</dt>
                <dd className="mt-3 text-[15px] leading-relaxed text-gray-600">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------- Dernier appel ---------- */}
      <section className="bg-gray-900 px-6 py-24 text-center sm:px-10 sm:py-32">
        <h2 className="mx-auto max-w-3xl font-display text-4xl font-black uppercase leading-[0.95] tracking-tight text-white sm:text-6xl">
          Il faut une candidature,
          <br />
          et c&apos;est voulu
        </h2>
        <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-white/60">
          Ce qu&apos;un scoreur saisit devient le score officiel de la
          rencontre, compte dans les statistiques des deux équipes et remonte
          dans le classement des joueurs. On lit chaque candidature.
        </p>
        <Link
          href="/scoreurs/candidature"
          className="group mx-auto mt-14 flex w-full max-w-2xl items-center justify-between gap-6 bg-white px-8 py-7 text-gray-900 transition-colors hover:bg-emerald-400 sm:px-12 sm:py-9"
        >
          <span className="font-display text-xl font-black uppercase tracking-tight sm:text-3xl">
            Je me lance
          </span>
          <ArrowRight
            size={32}
            strokeWidth={1.5}
            className="shrink-0 transition-transform group-hover:translate-x-2"
          />
        </Link>
      </section>
    </main>
  );
}
